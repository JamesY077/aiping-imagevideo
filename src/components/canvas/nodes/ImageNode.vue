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
      <label v-if="showUpload" class="gen-chip gen-upload">
        {{ data.referenceFileName ? '已选图' : '参考图' }}
        <input type="file" accept="image/*" hidden @change="onFile" />
      </label>
    </template>
  </NodeShell>
</template>

<script setup lang="ts">
/** 图片节点：文生图 / 图生图。 */
import NodeShell from './NodeShell.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import { useGenerationNode, type GenerationNodeProps } from './useGenerationNode'
import { DEFAULT_IMAGE_SYSTEM_PROMPT } from '@/stores/settingsStore'

const props = defineProps<GenerationNodeProps>()
const { store, modelMediaType, ratioOptions, showUpload, onImageMode, onRatio, onFile } =
  useGenerationNode(props)
</script>
