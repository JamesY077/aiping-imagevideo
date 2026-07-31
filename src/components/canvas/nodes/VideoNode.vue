<template>
  <NodeShell
    :id="id"
    :data="data"
    :selected="selected"
    title="视频节点"
    placeholder="输入 prompt…"
    :default-system-prompt="DEFAULT_VIDEO_SYSTEM_PROMPT"
  >
    <template #icon>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path d="M11 10l4 2-4 2z" fill="currentColor" />
      </svg>
    </template>

    <template #toolbar>
      <!-- 生成方式选择 -->
      <select class="gen-select" :value="data.videoMode" @change="onVideoMode">
        <option v-for="m in videoModeOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
      </select>

      <!-- 模型选择 -->
      <ModelSelector
        class="gen-model"
        media-type="video"
        :model-value="data.model ?? null"
        compact
        @update:model-value="(v) => store.updateNodeData(id, { model: v })"
      />

      <!-- 比例选择 -->
      <select class="gen-select" :value="data.aspectRatio" @change="onRatio">
        <option v-for="r in ratioOptions" :key="r" :value="r">{{ r }}</option>
      </select>

      <!-- 时长选择 -->
      <select class="gen-select" :value="String(data.duration)" @change="onDuration">
        <option v-for="d in durationOptions" :key="d.value" :value="String(d.value)">{{ d.label }}</option>
      </select>

      <!-- AI 润色 -->
      <button
        class="gen-chip"
        :class="{ 'gen-chip--active': data.polish }"
        @click="store.updateNodeData(id, { polish: !data.polish })"
      >
        AI润色
      </button>

      <!-- 图生视频：上传参考图 -->
      <label v-if="showUpload" class="gen-chip gen-upload">
        {{ data.referenceFileName ? '已选图' : '参考图' }}
        <input type="file" accept="image/*" hidden @change="onFile" />
      </label>

      <!-- 主体参考视频：上传主体参考图 -->
      <label v-if="showSubjectUpload" class="gen-chip gen-upload">
        {{ data.referenceFileName ? '已选主体图' : '主体参考图' }}
        <input type="file" accept="image/*" hidden @change="onFile" />
      </label>

      <!-- 首尾帧生视频：上传首帧 + 尾帧 -->
      <template v-if="showStartEndUpload">
        <label class="gen-chip gen-upload">
          {{ data.startFrameName ? '已选首帧' : '首帧' }}
          <input type="file" accept="image/*" hidden @change="onStartFrame" />
        </label>
        <label class="gen-chip gen-upload">
          {{ data.endFrameName ? '已选尾帧' : '尾帧' }}
          <input type="file" accept="image/*" hidden @change="onEndFrame" />
        </label>
      </template>

      <!-- 动作控制：上传参考图像 + 参考视频 -->
      <template v-if="showMotionUpload">
        <label class="gen-chip gen-upload">
          {{ data.motionImageName ? '已选参考图' : '参考图像' }}
          <input type="file" accept="image/*" hidden @change="onMotionImage" />
        </label>
        <label class="gen-chip gen-upload">
          {{ data.motionVideoName ? '已选参考视频' : '参考视频' }}
          <input type="file" accept="video/*" hidden @change="onMotionVideo" />
        </label>
      </template>
    </template>
  </NodeShell>
</template>

<script setup lang="ts">
/** 视频节点：支持文生 / 图生 / 首尾帧 / 主体参考 / 动作控制多种生成方式。 */
import NodeShell from './NodeShell.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import { useGenerationNode, type GenerationNodeProps } from './useGenerationNode'
import { DEFAULT_VIDEO_SYSTEM_PROMPT } from '@/stores/settingsStore'

const props = defineProps<GenerationNodeProps>()
const {
  store,
  videoModeOptions,
  ratioOptions,
  durationOptions,
  showUpload,
  showSubjectUpload,
  showStartEndUpload,
  showMotionUpload,
  onVideoMode,
  onRatio,
  onDuration,
  onFile,
  onStartFrame,
  onEndFrame,
  onMotionImage,
  onMotionVideo,
} = useGenerationNode(props)
</script>
