<template>
  <div
    :class="[
      'gen-node',
      `gen-node--${kind}`,
      { 'gen-node--selected': selected, 'gen-node--running': isRunning, 'gen-node--failed': data.status === 'failed' },
    ]"
  >
    <Handle class="gen-handle" type="target" :position="Position.Left" />

    <!-- 头部 -->
    <div class="gen-head">
      <span class="gen-title">{{ titleText }}</span>
      <span v-if="data.status === 'running'" class="gen-badge gen-badge--run">运行中</span>
      <span v-else-if="data.status === 'completed'" class="gen-badge gen-badge--ok">完成</span>
      <span v-else-if="data.status === 'failed'" class="gen-badge gen-badge--err">失败</span>
      <button class="gen-del" title="删除节点" @click.stop="store.removeNode(id)">✕</button>
    </div>

    <!-- 结果预览 -->
    <div v-if="data.resultType === 'image' && data.resultUrl" class="gen-preview">
      <img :src="data.resultUrl" alt="result" />
    </div>
    <div v-else-if="data.resultType === 'video' && data.resultUrl" class="gen-preview">
      <video :src="data.resultUrl" controls />
    </div>
    <div v-else-if="data.resultType === 'text' && data.resultText" class="gen-result-text">
      {{ data.resultText }}
    </div>

    <div v-if="data.status === 'failed' && data.error" class="gen-error">{{ data.error }}</div>

    <!-- 进度条 -->
    <div v-if="data.status === 'running'" class="gen-progress">
      <div class="gen-progress-bar" :style="{ width: (data.progress || 0) + '%' }" />
    </div>

    <!-- 聊天/输入框 -->
    <textarea
      class="gen-input nodrag"
      :value="data.prompt"
      :placeholder="placeholder"
      rows="2"
      @input="onPromptInput"
      @mousedown.stop
      @dblclick.stop
    />

    <!-- 底部选项 -->
    <div class="gen-toolbar nodrag" @mousedown.stop>
      <!-- 模式选择（图片/视频） -->
      <select v-if="kind === 'image'" class="gen-select" :value="data.imageMode" @change="onImageMode">
        <option value="text2image">文生图</option>
        <option value="image2image">图生图</option>
      </select>
      <select v-if="kind === 'video'" class="gen-select" :value="data.videoMode" @change="onVideoMode">
        <option value="text2video">文生视频</option>
        <option value="image2video">图生视频</option>
      </select>

      <!-- 模型选择 -->
      <ModelSelector
        v-if="kind !== 'text'"
        class="gen-model"
        :media-type="kind"
        :model-value="data.model ?? null"
        compact
        @update:model-value="(v) => store.updateNodeData(id, { model: v })"
      />
      <select v-else class="gen-select gen-model" :value="data.model || ''" @change="onTextModel">
        <option value="" disabled>选择文本模型</option>
        <option v-for="m in textModels" :key="m.id" :value="m.id">
          {{ m.displayName }}{{ m.supportsVision ? ' · 支持图片' : '' }}
        </option>
      </select>

      <!-- 比例选择（图片/视频） -->
      <select v-if="kind !== 'text'" class="gen-select" :value="data.aspectRatio" @change="onRatio">
        <option v-for="r in ratioOptions" :key="r" :value="r">{{ r }}</option>
      </select>

      <!-- 时长选择（视频） -->
      <select v-if="kind === 'video'" class="gen-select" :value="String(data.duration)" @change="onDuration">
        <option v-for="d in durationOptions" :key="d.value" :value="String(d.value)">{{ d.label }}</option>
      </select>

      <!-- AI 润色（图片/视频） -->
      <button
        v-if="kind !== 'text'"
        class="gen-chip"
        :class="{ 'gen-chip--active': data.polish }"
        @click="store.updateNodeData(id, { polish: !data.polish })"
      >
        AI润色
      </button>

      <!-- 上传参考图 -->
      <label v-if="showUpload" class="gen-chip gen-upload">
        {{ data.referenceFileName ? '已选图' : '参考图' }}
        <input type="file" accept="image/*" hidden @change="onFile" />
      </label>

      <!-- 运行 -->
      <button class="gen-run" :disabled="isRunning" @click="store.runNode(id)">
        {{ data.status === 'running' ? '生成中' : '运行' }}
      </button>
    </div>

    <Handle class="gen-handle" type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useCanvasStore, type CanvasNodeData } from '@/stores/canvasStore'
import ModelSelector from '@/components/ModelSelector.vue'
import { getSupportedAspectRatios, getSupportedVideoDurations } from '@/types/model'
import { textModelModules } from '@/models'

const props = defineProps<{ id: string; data: CanvasNodeData; selected?: boolean }>()
const store = useCanvasStore()

const kind = computed(() => props.data.nodeKind || 'text')
const isRunning = computed(() => store.runningNodeId === props.id)

const titleText = computed(() =>
  kind.value === 'text' ? '文本节点' : kind.value === 'image' ? '图片节点' : '视频节点',
)
const placeholder = computed(() =>
  kind.value === 'text' ? '输入想创作的话语或方向…' : '输入 prompt…',
)

const showUpload = computed(
  () =>
    (kind.value === 'image' && props.data.imageMode === 'image2image') ||
    (kind.value === 'video' && props.data.videoMode === 'image2video'),
)

const DEFAULT_RATIOS = ['16:9', '3:2', '4:3', '1:1', '3:4', '2:3', '9:16']
const ratioOptions = computed(() => getSupportedAspectRatios(props.data.model) ?? DEFAULT_RATIOS)
const durationOptions = computed(
  () => getSupportedVideoDurations(props.data.model) ?? [{ value: 5, label: '5s' }],
)

// 文本模型列表（PRD - 文本节点 - 文本模型列表，预定义于 @/models/text）
const textModels = textModelModules


function onPromptInput(e: Event) {
  store.updateNodeData(props.id, { prompt: (e.target as HTMLTextAreaElement).value })
}
function onImageMode(e: Event) {
  store.updateNodeData(props.id, { imageMode: (e.target as HTMLSelectElement).value as any })
}
function onVideoMode(e: Event) {
  store.updateNodeData(props.id, { videoMode: (e.target as HTMLSelectElement).value as any })
}
function onTextModel(e: Event) {
  store.updateNodeData(props.id, { model: (e.target as HTMLSelectElement).value })
}
function onRatio(e: Event) {
  store.updateNodeData(props.id, { aspectRatio: (e.target as HTMLSelectElement).value })
}
function onDuration(e: Event) {
  store.updateNodeData(props.id, { duration: Number((e.target as HTMLSelectElement).value) })
}
function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () =>
    store.updateNodeData(props.id, {
      referenceImage: reader.result as string,
      referenceFileName: file.name,
    })
  reader.readAsDataURL(file)
}
</script>

<style scoped>
.gen-node {
  width: 300px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #1c1c1e;
  color: #f5f5f7;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  font-size: 13px;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}
.gen-node--selected {
  box-shadow: 0 0 0 2px #0a84ff, 0 8px 28px rgba(0, 0, 0, 0.45);
}
.gen-node--running {
  border-color: #0a84ff;
  box-shadow: 0 0 0 2px #0a84ff, 0 0 24px rgba(10, 132, 255, 0.6);
}
.gen-node--failed {
  border-color: #ff453a;
}
.gen-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.gen-title {
  font-weight: 600;
  flex: 1;
}
.gen-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
}
.gen-badge--run {
  background: rgba(10, 132, 255, 0.2);
  color: #0a84ff;
}
.gen-badge--ok {
  background: rgba(48, 209, 88, 0.2);
  color: #30d158;
}
.gen-badge--err {
  background: rgba(255, 69, 58, 0.2);
  color: #ff453a;
}
.gen-del {
  border: none;
  background: transparent;
  color: #98989d;
  cursor: pointer;
  font-size: 12px;
}
.gen-del:hover {
  color: #ff453a;
}
.gen-preview {
  margin-bottom: 8px;
  border-radius: 10px;
  overflow: hidden;
}
.gen-preview img,
.gen-preview video {
  width: 100%;
  display: block;
  border-radius: 10px;
}
.gen-result-text {
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  max-height: 140px;
  overflow-y: auto;
  white-space: pre-wrap;
  line-height: 1.5;
}
.gen-error {
  margin-bottom: 8px;
  color: #ff453a;
  font-size: 12px;
}
.gen-progress {
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
  margin-bottom: 8px;
}
.gen-progress-bar {
  height: 100%;
  background: #0a84ff;
  transition: width 0.3s ease;
}
.gen-input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  color: #f5f5f7;
  padding: 8px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  box-sizing: border-box;
}
.gen-input:focus {
  border-color: #0a84ff;
}
.gen-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 8px;
}
.gen-select {
  appearance: none;
  -webkit-appearance: none;
  height: 28px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #f5f5f7;
  font-size: 11px;
  outline: none;
}
.gen-model {
  flex: 1;
  min-width: 100px;
}
.gen-chip {
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #f5f5f7;
  font-size: 11px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
}
.gen-chip--active {
  background: rgba(10, 132, 255, 0.25);
  border-color: #0a84ff;
  color: #0a84ff;
}
.gen-upload {
  cursor: pointer;
}
.gen-run {
  margin-left: auto;
  height: 28px;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: #0a84ff;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.gen-run:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.gen-handle {
  width: 10px;
  height: 10px;
  background: #0a84ff;
  border: 2px solid #1c1c1e;
}
:deep(.gen-model .model-selector) {
  width: 100%;
}
</style>
