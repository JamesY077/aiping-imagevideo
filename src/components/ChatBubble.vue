<template>
  <div :class="['message', message.type]">
    <div class="avatar">
      <span v-if="message.type === 'user'" class="avatar-icon">我</span>
      <span v-else-if="message.type === 'system'" class="avatar-icon">🤖</span>
      <span v-else class="avatar-icon">AI</span>
    </div>
    <div class="bubble">
      <div class="content">
        <p v-if="message.content">{{ message.content }}</p>
        <div v-if="previewFiles.length" class="file-preview-list">
          <div
            v-for="(file, index) in previewFiles"
            :key="`${file.url}-${index}`"
            class="file-preview"
          >
            <span v-if="previewFiles.length > 1" class="frame-badge">{{ index === 0 ? '首帧' : '尾帧' }}</span>
            <img v-if="file.type === 'image'" :src="file.url" class="preview-img" loading="lazy" decoding="async" />
            <video v-else :src="file.url" class="preview-video" controls preload="metadata" />
            <span class="file-name">{{ file.name }}</span>
          </div>
        </div>
      </div>
      <div v-if="message.generateStatus" class="generate-result">
        <div v-if="isActiveGeneration" class="generation-progress">
          <div class="inline-loading">
            <div class="inline-spinner" />
            <span class="loading-text">{{ loadingText }}</span>
          </div>

          <div class="tip-window">
            <Transition name="tip-slide" mode="out-in">
              <span :key="tipIndex" class="generation-tip">{{ currentTip }}</span>
            </Transition>
          </div>

          <div class="progress-meta">
            <span class="progress-label">{{ progressLabel }}</span>
            <span class="progress-text">{{ Math.round(displayProgress) }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${displayProgress}%` }" />
          </div>
        </div>
        <div
          v-if="resultItems.length"
          class="result-list"
          :class="{ 'has-multiple': resultItems.length > 1, 'stack-rows': isVideoBatch }"
        >
          <div
            v-if="resultItems.length > 1 || (message.batchSize && message.batchSize > 1)"
            class="batch-note"
          >
            <template v-if="isActiveGeneration">
              已完成 {{ resultItems.length }}/{{ message.batchSize || resultItems.length }} 个，其余生成中…
            </template>
            <template v-else>本轮共生成 {{ resultItems.length }} 个结果</template>
          </div>
          <template v-for="(result, index) in resultItems" :key="`${result.url}-${index}`">
            <ImageResult
              v-if="result.type === 'image'"
              :result="result"
              @regenerate="$emit('regenerate', message)"
            />
            <VideoResult
              v-else-if="result.type === 'video'"
              :result="result"
              @regenerate="$emit('regenerate', message)"
            />
          </template>
        </div>
        <div v-if="message.partialError && message.generateStatus !== 'failed'" class="partial-warning">
          {{ message.partialError }}
        </div>
        <div v-if="message.generateStatus === 'failed'" class="error">
          <span>{{ message.error || '生成失败' }}</span>
          <button class="retry-btn" @click="$emit('regenerate', message)">重新尝试</button>
        </div>
      </div>
      <div class="meta">
        <span class="time">{{ formatTime(message.timestamp) }}</span>
        <div class="meta-actions">
          <button
            v-if="message.type === 'user' && message.content"
            class="icon-btn"
            title="复制到输入框"
            aria-label="复制提示词到输入框"
            @click="$emit('copyPrompt', message.content)"
          >
            ⧉
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ImageResult from './ImageResult.vue'
import VideoResult from './VideoResult.vue'
import { formatTime } from '@/utils/format'
import type { Message } from '@/types/chat'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ message: Message }>()
defineEmits<{
  (e: 'regenerate', message: Message): void
  (e: 'copyPrompt', prompt: string): void
}>()

const previewFiles = computed(() => props.message.uploadedFiles?.length ? props.message.uploadedFiles : props.message.uploadedFile ? [props.message.uploadedFile] : [])
const isVideoBatch = computed(() => props.message.generateType === 'video' && resultItems.value.length > 1)

const resultItems = computed(() => (
  props.message.generateResults?.length
    ? props.message.generateResults
    : props.message.generateResult
      ? [props.message.generateResult]
      : []
))

const imageTips = [
  '正在理解画面主体与空间关系…',
  '正在拆解光影、风格与材质细节…',
  '参考图已进入提示词编排…',
  '正在为构图匹配最佳画幅…',
  '模型正在调度算力，马上就好…',
  '正在渲染细节与色彩层次…',
]

const videoTips = [
  '正在解析分镜与运镜节奏…',
  '参考帧已进入视频提示词编排…',
  '正在匹配首尾帧与主体一致性…',
  '模型正在调度视频算力…',
  '正在渲染关键帧与动态细节…',
  '视频任务已进入生成队列，请稍候…',
]

const tips = computed(() => (props.message.generateType === 'video' ? videoTips : imageTips))
const tipIndex = ref(0)
const simulatedProgress = ref(0)

let progressTimer: ReturnType<typeof setInterval> | undefined
let tipTimer: ReturnType<typeof setInterval> | undefined

const isActiveGeneration = computed(() => props.message.generateStatus === 'pending' || props.message.generateStatus === 'processing')
const currentTip = computed(() => tips.value[tipIndex.value % tips.value.length])
const loadingText = computed(() => {
  const kind = props.message.generateType === 'video' ? '视频' : '图片'
  const isBatch = !!props.message.batchSize && props.message.batchSize > 1
  const batchLabel = isBatch ? `（共 ${props.message.batchSize} 个）` : ''
  if (props.message.generateStatus === 'pending') {
    return isBatch ? `${kind}批量任务准备中${batchLabel}` : `${kind}任务准备中`
  }
  return isBatch ? `${kind}批量生成进行中${batchLabel}` : `${kind}生成进行中`
})
const progressLabel = computed(() => {
  if (displayProgress.value >= 88) return '收尾渲染中'
  if (displayProgress.value >= 45) return '主体与细节生成中'
  return '正在理解创作意图'
})
const displayProgress = computed(() => {
  const real = props.message.progress
  const normalizedReal = typeof real === 'number' && Number.isFinite(real) ? Math.min(real, 99) : 0
  return Math.min(99, Math.max(simulatedProgress.value, normalizedReal))
})

function clearGenerationTimers() {
  if (progressTimer) clearInterval(progressTimer)
  if (tipTimer) clearInterval(tipTimer)
  progressTimer = undefined
  tipTimer = undefined
}

function startGenerationAnimation() {
  clearGenerationTimers()
  simulatedProgress.value = Math.max(simulatedProgress.value, 4)
  tipIndex.value = 0

  progressTimer = setInterval(() => {
    const next = simulatedProgress.value + (92 - simulatedProgress.value) * 0.028 + 0.25
    simulatedProgress.value = Math.min(92, Math.round(next * 10) / 10)
  }, 800)

  tipTimer = setInterval(() => {
    tipIndex.value += 1
  }, 3200)
}

function stopGenerationAnimation() {
  clearGenerationTimers()
  simulatedProgress.value = 0
}

watch(
  () => props.message.generateStatus,
  (status) => {
    if (status === 'pending' || status === 'processing') {
      startGenerationAnimation()
      return
    }
    if (status === 'completed') {
      clearGenerationTimers()
      simulatedProgress.value = 100
      return
    }
    stopGenerationAnimation()
  },
  { immediate: true },
)

onBeforeUnmount(clearGenerationTimers)
</script>

<style scoped>
.message {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: flex-start;
  animation: fade-up 0.35s ease;
}

.message.user {
  flex-direction: row-reverse;
}

.avatar {
  position: sticky;
  top: 88px;
  flex-shrink: 0;
}

.avatar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 9px;
  font-weight: 700;
  backdrop-filter: blur(14px);
}

.bubble {
  width: min(100%, 680px);
  padding: 7px 11px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--color-border);
  box-shadow: var(--color-shadow-soft);
  backdrop-filter: blur(18px);
}

.message.user .bubble {
  background: var(--color-user-bubble);
  border-color: transparent;
}

.message.system .bubble {
  background: rgba(255, 255, 255, 0.92);
}

.content p {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text);
  word-break: break-word;
  white-space: pre-wrap;
}


.message.user .content p,
.message.user .time {
  color: rgba(255, 255, 255, 0.96);
}

.file-preview-list {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
}

.file-preview {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.24);
}

.frame-badge {
  position: absolute;
  left: 8px;
  top: 8px;
  z-index: 1;
  padding: 3px 7px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.74);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.preview-img,
.preview-video {
  display: block;
  max-height: 180px;
  width: 100%;
  object-fit: cover;
}

.file-name {
  display: block;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
}

.generate-result {
  margin-top: 6px;
}

.result-list {
  margin-top: 6px;
}

.result-list.has-multiple {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 10px;
  align-items: start;
}

/* 视频批量结果：一行一个，纵向堆叠 */
.result-list.stack-rows {
  grid-template-columns: 1fr;
}

.batch-note {
  grid-column: 1 / -1;
  padding: 6px 10px;
  border-radius: 10px;
  background: rgba(10, 132, 255, 0.08);
  color: rgba(30, 64, 175, 0.86);
  font-size: 11px;
  font-weight: 700;
}

.generation-progress {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-top: 4px;
  padding: 11px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(30, 41, 59, 0.08);
}

.inline-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.inline-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(0, 113, 227, 0.18);
  border-top-color: var(--color-primary);
  animation: spin 0.75s linear infinite;
}

.loading-text,
.time,
.progress-text {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.progress-bar {
  position: relative;
  height: 7px;
  border-radius: 999px;
  background: rgba(29, 29, 31, 0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0071e3 0%, #54a8ff 100%);
  transition: width var(--transition-base);
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.progress-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text);
}

.progress-text {
  flex-shrink: 0;
}

.tip-window {
  min-height: 18px;
  overflow: hidden;
}

.generation-tip {
  display: block;
  font-size: 11px;
  line-height: 18px;
  color: var(--color-text-secondary);
}

.tip-slide-enter-active,
.tip-slide-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.tip-slide-enter-from {
  opacity: 0;
  transform: translateY(7px);
}

.tip-slide-leave-to {
  opacity: 0;
  transform: translateY(-7px);
}

.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.meta-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid rgba(255, 255, 255, 0.36);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: inherit;
  font-size: 12px;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}

.message.user .icon-btn {
  border-color: rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.message.user .icon-btn:hover {
  background: rgba(255, 255, 255, 0.32);
}

.error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  flex-wrap: wrap;
}

.partial-warning {
  margin-top: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 1.5;
  background: rgba(234, 179, 8, 0.12);
  color: #92610e;
}

.retry-btn {
  min-height: 22px;
  padding: 0 8px;
  font-size: 11px;
  border: none;
  border-radius: 999px;
  background: #fff;
  color: var(--color-text);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 767px) {
  .message {
    gap: 10px;
    margin-bottom: 18px;
  }

  .avatar {
    top: 72px;
  }

  .avatar-icon {
    width: 36px;
    height: 36px;
  }

  .bubble {
    width: 100%;
    padding: 16px;
    border-radius: 20px;
  }
}
</style>
