<template>
  <NodeShell
    :id="id"
    :data="data"
    :selected="selected"
    title="文本节点"
    placeholder="输入想创作的话语或方向…"
    :default-system-prompt="DEFAULT_TEXT_SYSTEM_PROMPT"
    editable-result
  >
    <template #icon>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <path
          d="M4 6h16M4 12h16M4 18h10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
        />
      </svg>
    </template>

    <template #toolbar>
      <!-- Skill 规范上传：仅文本节点提供，非必填；上传后会沿连线约束下游图片/视频生成 -->
      <button
        class="gen-chip gen-upload"
        title="上传 .md Skill 文件，生成图片/视频时将严格遵循该规范（非必填）"
        @click.stop="skillInputRef?.click()"
      >
        {{ data.skillName ? '更换 Skill' : '上传 Skill' }}
      </button>
      <input
        ref="skillInputRef"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        hidden
        @change="onSkillFile"
      />
      <span
        v-if="data.skillName"
        class="gen-skill-name"
        :title="data.skillContent || ''"
      >
        {{ data.skillName }}
        <button
          class="gen-skill-remove"
          type="button"
          title="移除 Skill 文件"
          @click.stop="clearSkill"
        >
          ✕
        </button>
      </span>

      <!-- AI 润色开关 -->
      <button
        class="gen-chip"
        :class="{ 'gen-chip--active': data.polish }"
        :title="data.polish ? '已开启 AI 润色，点击关闭后直接透传原文' : '已关闭 AI 润色，点击开启后可对文字进行润色'"
        @click="store.updateNodeData(id, { polish: !data.polish })"
      >
        AI润色 {{ data.polish ? '开' : '关' }}
      </button>

      <!-- 仅在开启润色时才需要选择润色模型 -->
      <select
        v-if="data.polish"
        class="gen-select gen-model"
        :value="data.model || ''"
        @change="onTextModel"
      >
        <option value="" disabled>选择润色模型</option>
        <option v-for="m in textModels" :key="m.id" :value="m.id">
          {{ m.displayName }}{{ m.supportsVision ? ' · 支持图片' : '' }}
        </option>
      </select>

      <!-- 润色按钮（仅开启 AI 润色时显示），润色结果写入下方「发送框」 -->
      <button
        v-if="data.polish"
        class="gen-chip gen-polish"
        :disabled="data.polishing || isRunning"
        title="用所选模型润色输入框中的文字，结果会写入下方「发送框」，可继续修改后传给下游节点"
        @click="store.polishTextNode(id)"
      >
        {{ data.polishing ? '润色中…' : '润色' }}
      </button>
    </template>
  </NodeShell>
</template>

<script setup lang="ts">
/** 文本节点：负责文字创作 / AI 润色。 */
import { ref } from 'vue'
import NodeShell from './NodeShell.vue'
import { useGenerationNode, type GenerationNodeProps } from './useGenerationNode'
import { DEFAULT_TEXT_SYSTEM_PROMPT } from '@/stores/settingsStore'
import { readSkillFile } from '@/features/skill/parse'

const props = defineProps<GenerationNodeProps>()
const { store, isRunning, textModels, onTextModel } = useGenerationNode(props)

const skillInputRef = ref<HTMLInputElement | null>(null)
const skillError = ref('')

async function onSkillFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  if (!/\.(md|markdown)$/i.test(file.name) && file.type !== 'text/markdown') {
    skillError.value = '请上传 .md 或 .markdown 格式的 Skill 文件。'
    store.updateNodeData(props.id, { error: skillError.value, status: 'failed' })
    input.value = ''
    return
  }

  try {
    const content = await readSkillFile(file)
    if (!content.trim()) {
      throw new Error('Skill 文件内容为空，请换一个文件重试。')
    }
    skillError.value = ''
    store.updateNodeData(props.id, {
      skillContent: content,
      skillName: file.name,
      error: undefined,
      status: 'idle',
    })
  } catch (error) {
    skillError.value = error instanceof Error ? error.message : 'Skill 文件读取失败，请重试。'
    store.updateNodeData(props.id, { error: skillError.value, status: 'failed' })
  } finally {
    input.value = ''
  }
}

function clearSkill() {
  skillError.value = ''
  store.updateNodeData(props.id, {
    skillContent: '',
    skillName: '',
    error: undefined,
    status: 'idle',
  })
}
</script>
