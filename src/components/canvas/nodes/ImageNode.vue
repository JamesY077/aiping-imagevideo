<template>
  <NodeShell
    :id="id"
    :data="data"
    :selected="selected"
    title="图片节点"
    placeholder="输入 prompt…"
    :default-system-prompt="DEFAULT_IMAGE_SYSTEM_PROMPT"
  >
    <template #icon>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
        <circle cx="9" cy="10" r="1.6" fill="currentColor" />
        <path
          d="M5 17l4-4 3 3 3-3 4 4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </template>

    <template #toolbar>
      <!-- Skill 规范上传：与简易模式一致，非必填；本节点有 Skill 时优先按它生成 -->
      <button
        class="gen-chip gen-upload"
        :class="{ 'gen-chip--disabled': hasUpstreamTextNode }"
        :disabled="hasUpstreamTextNode"
        :title="hasUpstreamTextNode
          ? '已连接文字节点，Skill 由上游文字节点决定'
          : '上传 .md Skill 文件，生成时将严格遵循该规范（非必填）'"
        @click.stop="skillInputRef?.click()"
      >
        {{ data.skillName ? '更换 Skill' : '上传 Skill' }}
      </button>
      <input
        ref="skillInputRef"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        :disabled="hasUpstreamTextNode"
        hidden
        @change="onSkillFile"
      />
      <span
        v-if="data.skillName && !hasUpstreamTextNode"
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

      <!-- 模式选择：文生图 / 图生图 -->
      <select class="gen-select" :value="data.imageMode" @change="onImageMode">
        <option value="text2image">文生图</option>
        <option value="image2image">图生图</option>
      </select>

      <!-- 模型选择 -->
      <ModelSelector
        class="gen-model"
        :media-type="modelMediaType"
        :model-value="data.model ?? null"
        compact
        @update:model-value="(v) => store.updateNodeData(id, { model: v })"
      />

      <!-- 比例选择 -->
      <select class="gen-select" :value="data.aspectRatio" @change="onRatio">
        <option v-for="r in ratioOptions" :key="r" :value="r">{{ r }}</option>
      </select>

      <!-- AI 润色 -->
      <button
        class="gen-chip"
        :class="{ 'gen-chip--active': data.polish }"
        @click="store.updateNodeData(id, { polish: !data.polish })"
      >
        AI润色
      </button>

      <!-- 图生图：上传参考图 -->
      <label
        v-if="showUpload"
        class="gen-chip gen-upload"
        :title="`支持常见图片格式（${IMAGE_FORMAT_HINT}）`"
      >
        {{ data.referenceFileName ? '已选图' : '参考图' }}
        <input type="file" :accept="IMAGE_FILE_ACCEPT" hidden @change="onFile" />
      </label>
    </template>
  </NodeShell>
</template>

<script setup lang="ts">
/** 图片节点：文生图 / 图生图。 */
import { computed, ref, watch } from 'vue'
import NodeShell from './NodeShell.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import { useGenerationNode, type GenerationNodeProps } from './useGenerationNode'
import { DEFAULT_IMAGE_SYSTEM_PROMPT } from '@/stores/settingsStore'
import { readSkillFile } from '@/features/skill/parse'
import { IMAGE_FILE_ACCEPT, IMAGE_FORMAT_HINT } from '@/features/generate/fileFormats'

const props = defineProps<GenerationNodeProps>()
const { store, modelMediaType, ratioOptions, showUpload, onImageMode, onRatio, onFile } =
  useGenerationNode(props)

const skillInputRef = ref<HTMLInputElement | null>(null)
const skillError = ref('')

// 图片节点直接连接到文字节点时，不允许再上传自身 Skill。
const hasUpstreamTextNode = computed(() =>
  store.edges.some(
    (edge) =>
      edge.target === props.id &&
      store.nodes.some(
        (node) => node.id === edge.source && node.data.nodeKind === 'text',
      ),
  ),
)

watch(
  hasUpstreamTextNode,
  (connected) => {
    if (connected && props.data.skillContent) clearSkill()
  },
  { immediate: true },
)

async function onSkillFile(event: Event) {
  if (hasUpstreamTextNode.value) return
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
