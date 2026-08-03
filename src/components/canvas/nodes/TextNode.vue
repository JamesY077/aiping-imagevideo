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
import NodeShell from './NodeShell.vue'
import { useGenerationNode, type GenerationNodeProps } from './useGenerationNode'
import { DEFAULT_TEXT_SYSTEM_PROMPT } from '@/stores/settingsStore'

const props = defineProps<GenerationNodeProps>()
const { store, isRunning, textModels, onTextModel } = useGenerationNode(props)
</script>
