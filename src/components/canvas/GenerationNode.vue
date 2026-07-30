<template>
  <div
    :class="[
      'gen-node',
      `gen-node--${kind}`,
      {
        'gen-node--selected': selected,
        'gen-node--expanded': expanded,
        'gen-node--running': isRunning,
        'gen-node--failed': data.status === 'failed',
        'gen-node--done': data.status === 'completed',
      },
    ]"
  >
    <Handle class="gen-handle" type="target" :position="Position.Left" />

    <!-- 头部：步骤图标 + 标题 + 状态 -->
    <div class="gen-head">
      <span class="gen-icon" :class="`gen-icon--${kind}`">
        <svg v-if="kind === 'text'" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <svg v-else-if="kind === 'image'" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
          <circle cx="9" cy="10" r="1.6" fill="currentColor" />
          <path d="M5 17l4-4 3 3 3-3 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8" />
          <path d="M11 10l4 2-4 2z" fill="currentColor" />
        </svg>
      </span>
      <span class="gen-title">{{ titleText }}</span>
      <span v-if="data.status === 'running'" class="gen-badge gen-badge--run">运行中</span>
      <span v-else-if="data.status === 'completed'" class="gen-badge gen-badge--ok">完成</span>
      <span v-else-if="data.status === 'failed'" class="gen-badge gen-badge--err">失败</span>
      <span v-else class="gen-badge gen-badge--idle">待运行</span>
      <button
        v-if="expanded"
        class="gen-gear"
        :class="{ 'gen-gear--active': showSettings }"
        title="设置：自定义 AI 润色系统提示词"
        @click.stop="showSettings = !showSettings"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
          />
          <path
            d="M19.4 13a7.6 7.6 0 0 0 .06-1 7.6 7.6 0 0 0-.06-1l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1l-.4-2.5H10.1l-.4 2.5a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.3 7.3 0 0 0 1.7 1l.4 2.5h3.8l.4-2.5a7.3 7.3 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button v-if="expanded" class="gen-del" title="删除节点" @click.stop="store.removeNode(id)">✕</button>
    </div>

    <!-- 设置面板：可查看并自定义本节点的 AI 润色系统提示词 -->
    <div v-if="expanded && showSettings" class="gen-settings nodrag" @mousedown.stop @wheel.stop>
      <div class="gen-settings-head">
        <span class="gen-settings-title">AI 润色系统提示词</span>
        <button
          class="gen-settings-reset"
          title="恢复为默认系统提示词"
          @click="store.updateNodeData(id, { systemPrompt: '' })"
        >
          恢复默认
        </button>
      </div>
      <textarea
        class="gen-settings-input"
        :value="data.systemPrompt ?? ''"
        :placeholder="defaultSystemPrompt"
        rows="5"
        @input="onSystemPromptInput"
        @mousedown.stop
        @dblclick.stop
        @wheel.stop
      />
      <div class="gen-settings-hint">
        留空则使用默认系统提示词（上方占位内容），仅在开启「AI 润色」时生效。
      </div>
    </div>


    <!-- 结果预览（始终可见，工作流每步的产出） -->
    <div v-if="data.resultType === 'image' && data.resultUrl" class="gen-preview">
      <img :src="data.resultUrl" alt="result" />
    </div>
    <div v-else-if="data.resultType === 'video' && data.resultUrl" class="gen-preview">
      <video :src="data.resultUrl" controls />
    </div>
    <div v-else-if="data.resultType === 'text' && data.resultText" class="gen-result-text" :class="{ 'gen-result-text--clamp': !expanded }">
      {{ data.resultText }}
    </div>

    <!-- 未展开且尚无结果时，显示 prompt 摘要 / 提示 -->
    <div
      v-if="!expanded && !hasResult && data.status !== 'running'"
      class="gen-collapsed-hint"
    >
      <span v-if="data.prompt" class="gen-prompt-preview">{{ data.prompt }}</span>
      <span v-else class="gen-empty-hint">点击编辑此步骤</span>
    </div>

    <div v-if="data.status === 'failed' && data.error" class="gen-error">{{ data.error }}</div>

    <!-- 进度条 -->
    <div v-if="data.status === 'running'" class="gen-progress">
      <div class="gen-progress-bar" :style="{ width: (data.progress || 0) + '%' }" />
    </div>

    <!-- 展开后的编辑区：输入框 + 操作 -->
    <template v-if="expanded">
      <textarea
        ref="promptRef"
        class="gen-input nodrag"
        :value="data.prompt"
        :placeholder="placeholder"
        rows="3"
        @input="onPromptInput"
        @mousedown.stop
        @dblclick.stop
        @wheel.stop
      />


      <div class="gen-toolbar nodrag" @mousedown.stop>
        <!-- 模式选择（图片/视频） -->
        <select v-if="kind === 'image'" class="gen-select" :value="data.imageMode" @change="onImageMode">
          <option value="text2image">文生图</option>
          <option value="image2image">图生图</option>
        </select>
        <select v-if="kind === 'video'" class="gen-select" :value="data.videoMode" @change="onVideoMode">
          <option v-for="m in videoModeOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>


        <!-- 文本节点：AI 润色开关 -->
        <button
          v-if="kind === 'text'"
          class="gen-chip"
          :class="{ 'gen-chip--active': data.polish }"
          :title="data.polish ? '已开启 AI 润色，点击关闭后直接透传原文' : '已关闭 AI 润色，点击开启后可对文字进行润色'"
          @click="store.updateNodeData(id, { polish: !data.polish })"
        >
          AI润色 {{ data.polish ? '开' : '关' }}
        </button>

        <!-- 模型选择 -->
        <ModelSelector
          v-if="kind !== 'text'"
          class="gen-model"
          :media-type="kind"
          :model-value="data.model ?? null"
          compact
          @update:model-value="(v) => store.updateNodeData(id, { model: v })"
        />
        <!-- 文本节点：仅在开启润色时才需要选择润色模型 -->
        <select
          v-else-if="data.polish"
          class="gen-select gen-model"
          :value="data.model || ''"
          @change="onTextModel"
        >
          <option value="" disabled>选择润色模型</option>
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

        <!-- 上传参考图（图生视频 / 图生图） -->
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


        <!-- 文本节点：润色按钮（仅开启 AI 润色时显示），润色结果直接覆盖到发送框 -->
        <button
          v-if="kind === 'text' && data.polish"
          class="gen-chip gen-polish"
          :disabled="data.polishing || isRunning"
          title="用所选模型润色当前文字，结果会覆盖到输入框，可继续修改"
          @click="store.polishTextNode(id)"
        >
          {{ data.polishing ? '润色中…' : '润色' }}
        </button>

        <!-- 运行 -->
        <button class="gen-run" :disabled="isRunning" @click="store.runNode(id)">
          {{ data.status === 'running' ? '生成中' : data.status === 'completed' ? '重新运行' : '运行' }}
        </button>

      </div>
    </template>

    <Handle class="gen-handle" type="source" :position="Position.Right" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Handle, Position } from '@vue-flow/core'

import { useCanvasStore, type CanvasNodeData } from '@/stores/canvasStore'
import ModelSelector from '@/components/ModelSelector.vue'
import {
  getSupportedAspectRatios,
  getSupportedVideoDurations,
  getSupportedVideoModes,
} from '@/types/model'

import { textModelModules } from '@/models'
import {
  DEFAULT_TEXT_SYSTEM_PROMPT,
  DEFAULT_IMAGE_SYSTEM_PROMPT,
  DEFAULT_VIDEO_SYSTEM_PROMPT,
} from '@/stores/settingsStore'

const props = defineProps<{ id: string; data: CanvasNodeData; selected?: boolean }>()
const store = useCanvasStore()

const kind = computed(() => props.data.nodeKind || 'text')
const isRunning = computed(() => store.runningNodeId === props.id)

// 选中即展开：用户点击某个节点后才出现输入框与操作
const expanded = computed(() => !!props.selected)

// 节点“设置”面板：显示 / 隐藏自定义系统提示词编辑区
const showSettings = ref(false)

// 该类型节点对应的默认系统提示词（作为占位提示与“恢复默认”依据）
const defaultSystemPrompt = computed(() =>
  kind.value === 'text'
    ? DEFAULT_TEXT_SYSTEM_PROMPT
    : kind.value === 'image'
      ? DEFAULT_IMAGE_SYSTEM_PROMPT
      : DEFAULT_VIDEO_SYSTEM_PROMPT,
)

function onSystemPromptInput(e: Event) {
  store.updateNodeData(props.id, { systemPrompt: (e.target as HTMLTextAreaElement).value })
}


const hasResult = computed(
  () =>
    (props.data.resultType === 'image' && !!props.data.resultUrl) ||
    (props.data.resultType === 'video' && !!props.data.resultUrl) ||
    (props.data.resultType === 'text' && !!props.data.resultText),
)

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

// 视频节点：当前模型支持的生成方式（文生/图生/首尾帧/主体参考/动作控制）。
const videoModeOptions = computed(() => getSupportedVideoModes(props.data.model))

// 主体参考视频：与图生视频一样，只需一张参考图。
const showSubjectUpload = computed(
  () => kind.value === 'video' && props.data.videoMode === 'subjectReference2video',
)
// 首尾帧生视频：需要首帧 + 尾帧两张图片。
const showStartEndUpload = computed(
  () => kind.value === 'video' && props.data.videoMode === 'startEnd2video',
)
// 动作控制：需要参考图像 + 参考视频。
const showMotionUpload = computed(
  () => kind.value === 'video' && props.data.videoMode === 'motionControl2video',
)


const DEFAULT_RATIOS = ['16:9', '3:2', '4:3', '1:1', '3:4', '2:3', '9:16']
const ratioOptions = computed(() => getSupportedAspectRatios(props.data.model) ?? DEFAULT_RATIOS)
const durationOptions = computed(
  () => getSupportedVideoDurations(props.data.model) ?? [{ value: 5, label: '5s' }],
)

// 文本模型列表（PRD - 文本节点 - 文本模型列表，预定义于 @/models/text）
const textModels = textModelModules

// 输入框自适应高度：随内容增减撑高/收缩，超过上限出现内部滚动条，
// 避免润色后文字过多导致节点/拖拽框溢出错位。
const promptRef = ref<HTMLTextAreaElement | null>(null)
const MAX_TEXTAREA_HEIGHT = 220

function autoResize() {
  const el = promptRef.value
  if (!el) return
  el.style.height = 'auto'
  const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)
  el.style.height = `${next}px`
  el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
}

// 展开或 prompt（如润色覆盖）变化时，等 DOM 更新后重新计算高度
watch(
  () => [expanded.value, props.data.prompt] as const,
  async () => {
    if (!expanded.value) return
    await nextTick()
    autoResize()
  },
  { immediate: true },
)

function onPromptInput(e: Event) {
  store.updateNodeData(props.id, { prompt: (e.target as HTMLTextAreaElement).value })
  autoResize()
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

// 通用：把选中的文件读为 data url 并写入指定的节点字段。
function readFileInto(e: Event, urlKey: keyof CanvasNodeData, nameKey: keyof CanvasNodeData) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () =>
    store.updateNodeData(props.id, {
      [urlKey]: reader.result as string,
      [nameKey]: file.name,
    } as Partial<CanvasNodeData>)
  reader.readAsDataURL(file)
}

function onStartFrame(e: Event) {
  readFileInto(e, 'startFrameImage', 'startFrameName')
}
function onEndFrame(e: Event) {
  readFileInto(e, 'endFrameImage', 'endFrameName')
}
function onMotionImage(e: Event) {
  readFileInto(e, 'motionImage', 'motionImageName')
}
function onMotionVideo(e: Event) {
  readFileInto(e, 'motionVideo', 'motionVideoName')
}
</script>


<style scoped>
.gen-node {
  width: 260px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: #1c1c1e;
  color: #f5f5f7;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  font-size: 13px;
  cursor: pointer;
  transition: width 0.2s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.gen-node--expanded {
  width: 380px;
  padding: 16px;
  cursor: default;
}
.gen-node--selected {
  box-shadow: 0 0 0 2px #0a84ff, 0 8px 28px rgba(0, 0, 0, 0.45);
}
.gen-node--running {
  border-color: #0a84ff;
  box-shadow: 0 0 0 2px #0a84ff, 0 0 24px rgba(10, 132, 255, 0.6);
}
.gen-node--done {
  border-color: rgba(48, 209, 88, 0.5);
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
.gen-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  flex-shrink: 0;
}
.gen-icon--text {
  background: rgba(191, 90, 242, 0.2);
  color: #bf5af2;
}
.gen-icon--image {
  background: rgba(10, 132, 255, 0.2);
  color: #0a84ff;
}
.gen-icon--video {
  background: rgba(255, 159, 10, 0.2);
  color: #ff9f0a;
}
.gen-title {
  font-weight: 600;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gen-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  flex-shrink: 0;
}
.gen-badge--idle {
  background: rgba(255, 255, 255, 0.08);
  color: #98989d;
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
.gen-gear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #98989d;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease;
}
.gen-gear:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f5f5f7;
}
.gen-gear--active {
  background: rgba(10, 132, 255, 0.2);
  color: #0a84ff;
}
.gen-del {
  border: none;
  background: transparent;
  color: #98989d;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
}
.gen-del:hover {
  color: #ff453a;
}
.gen-settings {
  margin-bottom: 10px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}
.gen-settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.gen-settings-title {
  font-size: 12px;
  font-weight: 600;
  color: #f5f5f7;
}
.gen-settings-reset {
  height: 22px;
  padding: 0 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: #98989d;
  font-size: 11px;
  cursor: pointer;
}
.gen-settings-reset:hover {
  color: #f5f5f7;
  border-color: rgba(255, 255, 255, 0.24);
}
.gen-settings-input {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.24);
  color: #f5f5f7;
  padding: 8px;
  font-size: 12px;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;
  min-height: 96px;
  max-height: 240px;
  outline: none;
  box-sizing: border-box;
}
.gen-settings-input:focus {
  border-color: #0a84ff;
}
.gen-settings-input::placeholder {
  color: #6b6b70;
}
.gen-settings-hint {
  margin-top: 6px;
  font-size: 11px;
  color: #98989d;
  line-height: 1.4;
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
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  line-height: 1.5;
}
.gen-result-text--clamp {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  max-height: none;
}
.gen-collapsed-hint {
  padding: 6px 2px;
  font-size: 12px;
  color: #98989d;
}
.gen-prompt-preview {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}
.gen-empty-hint {
  font-style: italic;
  opacity: 0.7;
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
  /* 高度由 JS 自适应控制，禁用手动拖拽以免与自适应逻辑冲突导致布局错位 */
  resize: none;
  min-height: 60px;
  outline: none;
  box-sizing: border-box;
  overflow-y: hidden;
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
