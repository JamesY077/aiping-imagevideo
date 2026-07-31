<template>
  <NodeShell
    :id="id"
    :data="data"
    :selected="selected"
    title="扩图节点"
    placeholder="（可选）描述希望扩展区域出现的内容，留空则自然延展…"
    :default-system-prompt="DEFAULT_EXPAND_SYSTEM_PROMPT"
  >
    <template #icon>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <rect x="8" y="8" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.6" />
        <path
          d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </template>

    <template #toolbar>
      <!-- 模型选择（复用图片模型列表） -->
      <ModelSelector
        class="gen-model"
        :media-type="modelMediaType"
        :model-value="data.model ?? null"
        compact
        @update:model-value="(v) => store.updateNodeData(id, { model: v })"
      />

      <!-- 目标比例选择 -->
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

      <!-- 上传原始图片（也可由上游图片节点接入） -->
      <label class="gen-chip gen-upload">
        {{ data.referenceFileName ? '已选原图' : '原始图片' }}
        <input type="file" accept="image/*" hidden @change="onFile" />
      </label>
    </template>
  </NodeShell>
</template>

<script setup lang="ts">
/** 扩图节点：对图片进行外扩延展，复用图片模型列表。 */
import NodeShell from './NodeShell.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import { useGenerationNode, type GenerationNodeProps } from './useGenerationNode'
import { DEFAULT_EXPAND_SYSTEM_PROMPT } from '@/stores/settingsStore'

const props = defineProps<GenerationNodeProps>()
const { store, modelMediaType, ratioOptions, onRatio, onFile } = useGenerationNode(props)
</script>
