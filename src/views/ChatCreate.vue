<template>
  <div class="chat-page">
    <div class="workspace-shell single-session-layout">
      <aside class="session-sidebar single-session-sidebar" aria-label="当前会话">
        <div class="sidebar-top single-session-top">
          <div class="brand-lockup">
            <strong class="brand-title">ArtRealm AI</strong>
          </div>
        </div>

        <div class="mode-intro-card">
          <span class="mode-intro-badge">简易模式</span>
          <p class="mode-intro-desc">
            当前处于「简易模式」：通过对话即可快速生成图像与视频，适合灵感速写与单张创作。想要多画面协作、串联创作流程，可切换到下方的「无限画布」。
          </p>
        </div>


        <div class="sidebar-footer">
          <button class="canvas-entry-btn" type="button" @click="router.push('/canvas')">
            <span class="canvas-entry-text">无限画布</span>
            <span class="canvas-entry-new" aria-label="全新功能">NEW</span>
          </button>

          <button class="sidebar-secondary-btn" type="button" @click="router.push('/settings')">
            设置
          </button>
        </div>

      </aside>

      <main class="workspace-main">
        <section class="chat-stage">
          <div class="chat-area" ref="chatAreaRef">
            <div v-if="activeMessages.length === 0" class="empty-state">
              <p class="empty-kicker">简易模式 · Start with an idea</p>
              <h1>把灵感写成一句清晰的创作指令。</h1>
              <p class="empty-copy">这里是「简易模式」——用一句话描述主体、氛围、镜头语言，即可快速生成图像或视频。想要多画面并行、串联复杂创作流程？点击左侧「无限画布」体验全新玩法。</p>
            </div>


            <ChatBubble
              v-for="msg in activeMessages"
              :key="msg.id"
              :message="msg"
              @regenerate="handleRegenerate"
              @copy-prompt="handleCopyPrompt"
            />
          </div>
        </section>

        <section class="composer-dock">
          <div class="composer-meta-row composer-meta-row-top">
            <div class="dock-pills dock-pills-primary">
              <div class="meta-pill meta-pill-type">
                <span class="meta-pill-label">创作类型</span>
                <div class="media-switch compact-switch" role="tablist" aria-label="生成类型">
                  <button class="switch-btn" :class="{ active: settingsStore.mediaType === 'image' }" @click="handleMediaTypeChange('image')">图像</button>
                  <button class="switch-btn" :class="{ active: settingsStore.mediaType === 'video' }" @click="handleMediaTypeChange('video')">视频</button>
                </div>
              </div>

              <div class="meta-pill meta-pill-model">
                <span class="meta-pill-label">模型选择</span>
                <div class="model-slot compact-model-slot">
                  <ModelSelector
                    :key="settingsStore.mediaType"
                    :mediaType="settingsStore.mediaType"
                    compact
                    v-model="settingsStore.selectedModel"
                    @update:modelValue="settingsStore.saveToStorage()"
                  />
                </div>
              </div>

              <div v-if="settingsStore.mediaType === 'image'" class="meta-pill meta-pill-mode">
                <span class="meta-pill-label">生成方式</span>
                <div class="video-mode-switch compact-switch" role="tablist" aria-label="图片生成方式">
                  <button
                    v-for="option in imageModeOptions"
                    :key="option.value"
                    class="switch-btn mode-switch-btn"
                    :class="{ active: imageMode === option.value }"
                    type="button"
                    :disabled="option.value === 'image2image' && !supportsImageReferenceMode"
                    @click="setImageMode(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <div v-else-if="usesViduLikeVideoMode" class="meta-pill meta-pill-mode">
                <span class="meta-pill-label">生成方式</span>
                <div class="video-mode-switch compact-switch" role="tablist" aria-label="视频生成方式">
                  <button
                    v-for="option in activeVideoModeOptions"
                    :key="option.value"
                    class="switch-btn mode-switch-btn"
                    :class="{ active: videoMode === option.value }"
                    type="button"
                    @click="setVideoMode(option.value)"
                  >
                    {{ option.label }}
                  </button>
                </div>
              </div>

              <div class="meta-pill meta-pill-ratio">
                <span class="meta-pill-label">比例</span>
                <div class="ratio-selector" :class="{ open: showAspectRatioMenu }">
                  <button
                    class="ratio-current-btn"
                    type="button"
                    :aria-expanded="showAspectRatioMenu"
                    aria-label="选择比例"
                    @click="showAspectRatioMenu = !showAspectRatioMenu"
                  >
                    <span class="ratio-chip">
                      <span
                        class="ratio-current-box"
                        :style="{ width: `${selectedAspectRatioOption.boxWidth}px`, height: `${selectedAspectRatioOption.boxHeight}px` }"
                      />
                      {{ selectedAspectRatioOption.label }}
                    </span>
                    <span class="ratio-caret">▾</span>
                  </button>

                  <div v-if="showAspectRatioMenu" class="ratio-dropdown">
                    <button
                      v-for="option in aspectRatioOptions"
                      :key="option.value"
                      type="button"
                      class="ratio-dropdown-item"
                      :class="{ active: settingsStore.aspectRatio === option.value }"
                      @click="handleAspectRatioMenuSelect(option.value)"
                    >
                      <span class="ratio-option-preview">
                        <span class="ratio-option-box" :style="{ width: `${option.boxWidth}px`, height: `${option.boxHeight}px` }" />
                      </span>
                      <span>{{ option.label }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div v-if="settingsStore.mediaType === 'video'" class="meta-pill meta-pill-duration duration-slot">
                <span class="meta-pill-label">时长</span>
                <div class="duration-selector">
                  <div class="duration-select-wrap">
                    <select
                      id="video-duration"
                      v-model="settingsStore.videoDuration"
                      class="duration-select"
                      @change="settingsStore.saveToStorage()"
                    >
                      <option v-for="option in videoDurationOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </option>
                    </select>
                    <span class="duration-caret" aria-hidden="true">▾</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="showReferenceField" class="reference-strip">
              <template v-if="usesViduLikeVideoMode">
                <div v-if="videoMode === 'image2video'" class="upload-mini-row upload-card-row" :class="{ 'has-file': !!uploadedFile }">
                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    class="file-input"
                    @change="handleFileChange"
                  />
                  <button class="upload-btn upload-icon-btn" type="button" aria-label="上传参考图" @click="fileInput?.click()">
                    +
                  </button>
                  <div class="upload-copy">
                    <span class="upload-label">参考图</span>
                    <span class="upload-hint">用于图生视频</span>
                  </div>
                  <span v-if="uploadedFile" class="pill-filename">{{ uploadedFile.name }}</span>
                  <button v-if="uploadedFile" class="text-btn" type="button" @click="() => removeUploadedFile()">移除</button>
                </div>

                <div v-else-if="videoMode === 'motionControl2video'" class="motion-control-panel">
                  <p class="motion-control-note">动作控制 <small>用于通过参考图像和参考视频生成视频，使生成视频中的人物动作与参考视频一致。</small></p>
                  <div class="motion-control-options">
                    <label class="motion-control-option">
                      <span class="motion-control-option-label">保留原声</span>
                      <select v-model="motionControlKeepOriginalSound" class="motion-control-select" aria-label="是否保留原声">
                        <option value="yes">保留</option>
                        <option value="no">不保留</option>
                      </select>
                    </label>
                    <label class="motion-control-option">
                      <span class="motion-control-option-label">人物朝向</span>
                      <select v-model="motionControlCharacterOrientation" class="motion-control-select" aria-label="人物朝向">
                        <option value="image">参考图像</option>
                        <option value="video">参考视频</option>
                      </select>
                    </label>
                  </div>
                  <div class="frame-upload-grid">
                    <div class="upload-mini-row upload-card-row frame-upload-card" :class="{ 'has-file': !!motionControlImage }">
                      <input
                        ref="motionControlImageInput"
                        type="file"
                        accept="image/*"
                        class="file-input"
                        @change="handleMotionControlFileChange($event, 'image')"
                      />
                      <button class="upload-btn upload-icon-btn" type="button" aria-label="上传动作控制参考图" @click="motionControlImageInput?.click()">
                        +
                      </button>
                      <div class="upload-copy">
                        <span class="upload-label">参考图像</span>
                        <span class="upload-hint">作为生成视频的人物外观参考</span>
                      </div>
                      <span v-if="motionControlImage" class="pill-filename">{{ motionControlImage.name }}</span>
                      <button v-if="motionControlImage" class="text-btn" type="button" @click="removeMotionControlFile('image')">移除</button>
                    </div>

                    <div class="upload-mini-row upload-card-row frame-upload-card" :class="{ 'has-file': !!motionControlVideo }">
                      <input
                        ref="motionControlVideoInput"
                        type="file"
                        accept="video/*"
                        class="file-input"
                        @change="handleMotionControlFileChange($event, 'video')"
                      />
                      <button class="upload-btn upload-icon-btn" type="button" aria-label="上传动作控制参考视频" @click="motionControlVideoInput?.click()">
                        +
                      </button>
                      <div class="upload-copy">
                        <span class="upload-label">参考视频</span>
                        <span class="upload-hint">用于对齐人物动作</span>
                      </div>
                      <span v-if="motionControlVideo" class="pill-filename">{{ motionControlVideo.name }}</span>
                      <button v-if="motionControlVideo" class="text-btn" type="button" @click="removeMotionControlFile('video')">移除</button>
                    </div>
                  </div>
                </div>

                <div v-else-if="videoMode === 'startEnd2video'" class="frame-upload-grid">
                  <div class="upload-mini-row upload-card-row frame-upload-card" :class="{ 'has-file': !!viduStartFrame }">
                    <input
                      ref="viduStartInput"
                      type="file"
                      accept="image/*"
                      class="file-input"
                      @change="handleViduFrameChange($event, 'start')"
                    />
                    <button class="upload-btn upload-icon-btn" type="button" aria-label="上传首帧" @click="viduStartInput?.click()">
                      +
                    </button>
                    <div class="upload-copy">
                      <span class="upload-label">首帧</span>
                      <span class="upload-hint">视频开始画面</span>
                    </div>
                    <span v-if="viduStartFrame" class="pill-filename">{{ viduStartFrame.name }}</span>
                    <button v-if="viduStartFrame" class="text-btn" type="button" @click="removeViduFrame('start')">移除</button>
                  </div>

                  <div class="upload-mini-row upload-card-row frame-upload-card" :class="{ 'has-file': !!viduEndFrame }">
                    <input
                      ref="viduEndInput"
                      type="file"
                      accept="image/*"
                      class="file-input"
                      @change="handleViduFrameChange($event, 'end')"
                    />
                    <button class="upload-btn upload-icon-btn" type="button" aria-label="上传尾帧" @click="viduEndInput?.click()">
                      +
                    </button>
                    <div class="upload-copy">
                      <span class="upload-label">尾帧</span>
                      <span class="upload-hint">视频结束画面</span>
                    </div>
                    <span v-if="viduEndFrame" class="pill-filename">{{ viduEndFrame.name }}</span>
                    <button v-if="viduEndFrame" class="text-btn" type="button" @click="removeViduFrame('end')">移除</button>
                  </div>
                </div>

                <div v-else-if="videoMode === 'subjectReference2video'" class="subject-reference-card" :class="{ 'has-file': !!uploadedFile || !!referenceUrl }">
                  <input
                    ref="fileInput"
                    type="file"
                    accept="image/*"
                    class="file-input"
                    @change="handleFileChange"
                  />
                  <button class="subject-upload-btn" type="button" @click="fileInput?.click()">
                    <span class="subject-upload-icon">+</span>
                    上传主体图
                  </button>
                  <div class="subject-reference-copy">
                    <span class="upload-label">主体参考</span>
                    <span class="upload-hint">上传人物主体图片，或粘贴图片链接生成 S2V 视频</span>
                  </div>
                  <span v-if="uploadedFile" class="pill-filename">{{ uploadedFile.name }}</span>
                  <button v-if="uploadedFile" class="text-btn" type="button" @click="() => removeUploadedFile()">移除</button>
                  <input
                    v-else
                    v-model.trim="referenceUrl"
                    type="url"
                    class="reference-input subject-reference-url"
                    placeholder="或粘贴主体图片 URL"
                  />
                </div>
              </template>

              <div v-else-if="isImageReferenceMode" class="upload-mini-row upload-card-row" :class="{ 'has-file': !!uploadedFile }">
                <input
                  ref="fileInput"
                  type="file"
                  accept="image/*"
                  class="file-input"
                  @change="handleFileChange"
                />
                <button class="upload-btn upload-icon-btn" type="button" aria-label="上传参考图" @click="fileInput?.click()">
                  +
                </button>
                <div class="upload-copy">
                  <span class="upload-label">参考图</span>
                  <span class="upload-hint">用于图生图</span>
                </div>
                <span v-if="uploadedFile" class="pill-filename">{{ uploadedFile.name }}</span>
                <button v-if="uploadedFile" class="text-btn" type="button" @click="() => removeUploadedFile()">移除</button>
              </div>
              <div v-else-if="isUploadEnabled" class="upload-mini-row" :class="{ 'has-file': !!uploadedFile }">
                <input
                  ref="fileInput"
                  type="file"
                  :accept="uploadAccept"
                  class="file-input"
                  @change="handleFileChange"
                />
                <button class="upload-btn upload-icon-btn" type="button" aria-label="上传参考" @click="fileInput?.click()">
                  +
                </button>
                <span v-if="uploadedFile" class="pill-filename">{{ uploadedFile.name }}</span>
                <button v-if="uploadedFile" class="text-btn" type="button" @click="() => removeUploadedFile()">移除</button>
              </div>
              <input
                v-else-if="showReferenceUrlInput"
                v-model.trim="referenceUrl"
                type="url"
                class="reference-input"
                placeholder="粘贴参考图片或视频链接"
              />
            </div>
          </div>

          <div :class="['input-shell', { expanded: isComposerExpanded }]">
            <textarea
              ref="promptInputRef"
              v-model="inputText"
              :placeholder="inputPlaceholder"
              @keydown.enter.exact.prevent="handleSend"
            />

            <div class="composer-actions">
              <button
                class="icon-btn"
                :title="isComposerExpanded ? '收起输入框' : '展开输入框'"
                :aria-label="isComposerExpanded ? '收起输入框' : '展开输入框'"
                @click="toggleComposerExpanded"
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8 16L16 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                  <path d="M9 8H16V15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button
                class="polish-btn"
                :disabled="isPolishing || activeSessionGenerating || !hasPromptPolishModelConfigured"
                :title="!hasPromptPolishModelConfigured ? polishDisabledReason : ''"
                :aria-label="!hasPromptPolishModelConfigured ? polishDisabledReason : 'AI 润色'"
                @click="handlePolishPrompt"
              >
                {{ isPolishing ? '润色中…' : 'AI 润色' }}
              </button>
              <button
                class="send-btn send-icon-btn"
                :class="{ ready: canSend && !activeSessionGenerating }"
                :disabled="!canSend || activeSessionGenerating"
                @click="handleSend"
              >
                <span class="send-gradient-icon" :class="{ 'is-ready': canSend && !activeSessionGenerating }" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 12.75L19.5 4.5L15.75 19.5L11.25 13.5L4 12.75Z" :stroke="canSend && !activeSessionGenerating ? 'currentColor' : 'url(#chatSendGradient)'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M10.75 13.25L19.5 4.5" :stroke="canSend && !activeSessionGenerating ? 'currentColor' : 'url(#chatSendGradient)'" stroke-width="1.8" stroke-linecap="round" />
                    <defs>
                      <linearGradient id="chatSendGradient" x1="4" y1="4.5" x2="19.5" y2="19.5" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stop-color="#171717" />
                        <stop offset="0.45" stop-color="#5f4b8b" />
                        <stop offset="1" stop-color="#c86b4a" />
                      </linearGradient>
                    </defs>
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import ChatBubble from '@/components/ChatBubble.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import { useSettingsStore } from '@/stores/settingsStore'
import { DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT } from '@/stores/settingsStore'
import { useGenerate } from '@/composables/useGenerate'
import { useChatStore } from '@/stores/chatStore'
import { polishPrompt } from '@/api/aiping'
import {
  ASPECT_RATIO_OPTIONS,
  getLocalUploadAccept,
  getModelCapability,
  getDefaultVideoDuration,
  getSupportedAspectRatios,
  getSupportedVideoDurations,
  modelRequiresReference,
  modelSupportsLocalUpload,
  type MediaType,
} from '@/types/model'
import { showErrorMessage } from '@/utils/errors'
import { getReadableErrorMessage, validatePromptOrThrow } from '@/utils/errorHandling'
import type { Message, UploadedFile } from '@/types/chat'
import { resolveGenerateIoType } from '@/features/generate/media'

const router = useRouter()
const settingsStore = useSettingsStore()
const chatStore = useChatStore()
const { generate } = useGenerate()

const chatAreaRef = ref<HTMLElement | null>(null)
const promptInputRef = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const viduStartInput = ref<HTMLInputElement | null>(null)
const viduEndInput = ref<HTMLInputElement | null>(null)
const motionControlImageInput = ref<HTMLInputElement | null>(null)
const motionControlVideoInput = ref<HTMLInputElement | null>(null)
const isPolishing = ref(false)
const isComposerExpanded = ref(false)
const showAspectRatioMenu = ref(false)
const uploadedFile = ref<UploadedFile | null>(null)
const viduStartFrame = ref<UploadedFile | null>(null)
const viduEndFrame = ref<UploadedFile | null>(null)
const motionControlImage = ref<UploadedFile | null>(null)
const motionControlVideo = ref<UploadedFile | null>(null)
const motionControlKeepOriginalSound = ref<'yes' | 'no'>('yes')
const motionControlCharacterOrientation = ref<'image' | 'video'>('image')
const referenceUrl = ref('')
const inputText = ref('')
type ImageMode = 'text2image' | 'image2image'
type VideoMode = 'text2video' | 'image2video' | 'startEnd2video' | 'subjectReference2video' | 'motionControl2video'
interface ImageDimensions {
  width: number
  height: number
}
const imageMode = ref<ImageMode>('text2image')
const videoMode = ref<VideoMode>('text2video')
const imageModeOptions: Array<{ value: ImageMode; label: string }> = [
  { value: 'text2image', label: '文生图' },
  { value: 'image2image', label: '图生图' },
]
const viduVideoModeOptions: Array<{ value: VideoMode; label: string }> = [
  { value: 'text2video', label: '文生视频' },
  { value: 'image2video', label: '图生视频' },
  { value: 'startEnd2video', label: '首尾帧生视频' },
]
const minimaxHailuoVideoModeOptions: Array<{ value: VideoMode; label: string }> = [
  ...viduVideoModeOptions,
  { value: 'subjectReference2video', label: '主体参考视频' },
]
const klingMotionControlVideoModeOptions: Array<{ value: VideoMode; label: string }> = [
  { value: 'text2video', label: '文生视频' },
  { value: 'image2video', label: '图生视频' },
  { value: 'motionControl2video', label: '动作控制' },
]
const hasPromptPolishModelConfigured = computed(() => !!settingsStore.promptPolishModel.trim())
const polishDisabledReason = '请前往设置完成 AI 润色模型设置'

const activeMessages = computed(() => chatStore.messages)
const activeSessionGenerating = computed(() => chatStore.isGenerating)
const modelCapability = computed(() => getModelCapability(settingsStore.selectedModel))
const isViduVideoModel = computed(() => settingsStore.mediaType === 'video' && modelCapability.value?.videoRequestMode === 'viduq3-fast')
const isMinimaxHailuoVideoModel = computed(() => settingsStore.mediaType === 'video' && modelCapability.value?.videoRequestMode === 'minimax-hailuo')
const isKlingMultimodalVideoModel = computed(() => {
  const mode = modelCapability.value?.videoRequestMode
  return settingsStore.mediaType === 'video' && (mode === 'kling-v26' || mode === 'kling-v3' || mode === 'kling-omni')
})
const isKlingMotionControlVideoModel = computed(() => {
  const mode = modelCapability.value?.videoRequestMode
  return settingsStore.mediaType === 'video' && (mode === 'kling-v26' || mode === 'kling-v3')
})
const usesViduLikeVideoMode = computed(() => isViduVideoModel.value || isMinimaxHailuoVideoModel.value || isKlingMultimodalVideoModel.value)
const activeVideoModeOptions = computed(() => {
  if (isMinimaxHailuoVideoModel.value) return minimaxHailuoVideoModeOptions
  if (isKlingMotionControlVideoModel.value) return klingMotionControlVideoModeOptions
  if (isKlingMultimodalVideoModel.value) return viduVideoModeOptions
  return viduVideoModeOptions
})
const isUploadEnabled = computed(() => modelSupportsLocalUpload(settingsStore.selectedModel))
const supportsImageReferenceMode = computed(() => {
  return settingsStore.mediaType === 'image' && !!modelCapability.value?.inputs.includes('image') && isUploadEnabled.value
})
const isImageReferenceMode = computed(() => {
  return settingsStore.mediaType === 'image' && imageMode.value === 'image2image' && supportsImageReferenceMode.value
})
const requiresUpload = computed(() => {
  if (!modelRequiresReference(settingsStore.selectedModel)) return false
  return !!modelCapability.value?.inputs.includes('image') && !inputText.value.trim()
})
const showReferenceUrlInput = computed(() => requiresUpload.value && !isUploadEnabled.value)
const showReferenceField = computed(() => {
  if (usesViduLikeVideoMode.value) return videoMode.value !== 'text2video'
  if (settingsStore.mediaType === 'image') return isImageReferenceMode.value || showReferenceUrlInput.value
  return isUploadEnabled.value || showReferenceUrlInput.value
})

const uploadAccept = computed(() => getLocalUploadAccept(settingsStore.selectedModel) || 'image/*,video/*')
const aspectRatioOptions = computed(() => {
  if (settingsStore.mediaType !== 'video') return ASPECT_RATIO_OPTIONS
  const supported = getSupportedAspectRatios(settingsStore.selectedModel)
  return supported
    ? ASPECT_RATIO_OPTIONS.filter((option) => supported.includes(option.value))
    : ASPECT_RATIO_OPTIONS
})

const videoDurationOptions = computed(() => getSupportedVideoDurations(settingsStore.selectedModel) ?? [{ value: 6, label: '6s' }])

const selectedAspectRatioOption = computed(() => {
  return (
    aspectRatioOptions.value.find((option) => option.value === settingsStore.aspectRatio) ||
    aspectRatioOptions.value[0] ||
    ASPECT_RATIO_OPTIONS[0]
  )
})

const inputPlaceholder = computed(() => {
  if (usesViduLikeVideoMode.value && videoMode.value === 'text2video') {
    return '描述你想生成的视频：场景、运动、节奏、情绪和镜头语言。'
  }
  if (usesViduLikeVideoMode.value && videoMode.value === 'image2video') {
    return '描述参考图如何动起来：主体运动、镜头推进、节奏和氛围。'
  }
  if (usesViduLikeVideoMode.value && videoMode.value === 'motionControl2video') {
    return '描述参考图中的人物外观、服装和场景，并结合参考视频控制人物动作。'
  }
  if (usesViduLikeVideoMode.value && videoMode.value === 'startEnd2video') {
    return '描述首帧到尾帧之间的变化过程、镜头运动、节奏和氛围。'
  }
  if (isMinimaxHailuoVideoModel.value && videoMode.value === 'subjectReference2video') {
    return '描述人物主体在视频中的动作、表情、镜头运动和氛围。'
  }
  if (isImageReferenceMode.value) {
    return '描述你希望参考图如何变化：风格、光线、细节、构图。'
  }
  if (settingsStore.mediaType === 'video' && uploadedFile.value?.type === 'image') {
    return '描述你希望参考图如何动起来：主体运动、镜头推进、节奏和氛围。'
  }
  if (settingsStore.mediaType === 'video' && uploadedFile.value?.type === 'video') {
    return '描述你希望参考视频如何延展：运动、镜头、节奏、氛围。'
  }
  return settingsStore.mediaType === 'image'
    ? '描述你想生成的画面：主体、氛围、镜头、色彩、质感。'
    : '描述你想生成的视频：场景、运动、节奏、情绪和镜头语言。'
})

const canSend = computed(() => {
  if (!inputText.value.trim()) return false
  if (usesViduLikeVideoMode.value) {
    if (videoMode.value === 'text2video') return true
    if (videoMode.value === 'image2video') return !!uploadedFile.value
    if (videoMode.value === 'motionControl2video') return !!motionControlImage.value && !!motionControlVideo.value
    if (videoMode.value === 'startEnd2video') return !!viduStartFrame.value && !!viduEndFrame.value
    return !!uploadedFile.value || !!referenceUrl.value.trim()
  }
  if (settingsStore.mediaType === 'image' && imageMode.value === 'image2image') {
    return supportsImageReferenceMode.value && !!uploadedFile.value
  }
  if (modelCapability.value?.availabilityNote === 'requires-image-upload' || modelCapability.value?.availabilityNote === 'requires-video-upload') {
    return !!uploadedFile.value || !!referenceUrl.value.trim()
  }
  if (!requiresUpload.value) return true
  return !!uploadedFile.value || !!referenceUrl.value.trim()
})

function buildSessionWelcomeMessage(): Omit<Message, 'id' | 'timestamp'> {
  return {
    type: 'system',
    content: [
      '👋 欢迎来到 ArtRealm AI「简易模式」！这里专为快速出图、灵感速写而设计，一句话即可生成图像或视频。',
      '',
      '🖼️ 图像生成：支持「文生图」与「图生图」两种方式，快速把创意变成画面。',
      '🎬 视频生成：覆盖文生视频、图生视频、首尾帧生视频、主体参考视频与动作控制等多种玩法。',
      '📐 参数可调：可自由选择画面比例、视频时长，快速匹配不同创作场景。',
      '✨ AI 润色：一键把简短描述扩写成更专业的提示词（需先在「设置」中配置润色模型）。',
      '🧩 无限画布（NEW）：想要多画面并行、串联复杂创作流程？点击左侧「无限画布」体验节点式创作。',
      '',
      '💡 上手很简单：选择创作类型与模型 → 写下你的创意描述 → 点击发送即可开始生成。',
    ].join('\n'),


  }
}


function ensureWelcomeMessage() {
  if (chatStore.messages.length > 0) return
  chatStore.addMessage(buildSessionWelcomeMessage())
}

function handleMediaTypeChange(nextType: MediaType) {
  settingsStore.setMediaType(nextType)
  ensureSupportedAspectRatio()
  imageMode.value = 'text2image'
  removeUploadedFile()
  removeViduFrames()
  removeMotionControlFiles()
  referenceUrl.value = ''
}

function setImageMode(mode: ImageMode) {
  if (mode === 'image2image' && !supportsImageReferenceMode.value) return
  if (imageMode.value === mode) return
  imageMode.value = mode
  removeUploadedFile()
  referenceUrl.value = ''
}

function setVideoMode(mode: VideoMode) {
  if (videoMode.value === mode) return
  videoMode.value = mode
  removeUploadedFile()
  removeViduFrames()
  removeMotionControlFiles()
  referenceUrl.value = ''
}

function selectAspectRatio(value: string) {
  if (!aspectRatioOptions.value.some((option) => option.value === value)) return
  settingsStore.aspectRatio = value
  settingsStore.saveToStorage()
}

function handleAspectRatioMenuSelect(value: string) {
  selectAspectRatio(value)
  showAspectRatioMenu.value = false
}

function ensureSupportedAspectRatio() {
  if (!aspectRatioOptions.value.length) return
  if (aspectRatioOptions.value.some((option) => option.value === settingsStore.aspectRatio)) return
  settingsStore.aspectRatio = aspectRatioOptions.value[0]?.value || '1:1'
  settingsStore.saveToStorage()
}

function ensureSupportedVideoDuration() {
  if (settingsStore.mediaType !== 'video') return
  if (videoDurationOptions.value.some((option) => option.value === settingsStore.videoDuration)) return
  settingsStore.videoDuration = getDefaultVideoDuration(settingsStore.selectedModel)
  settingsStore.saveToStorage()
}

function releaseUploadedFile(file: UploadedFile | null | undefined) {
  if (file?.file && file.url.startsWith('blob:')) {
    URL.revokeObjectURL(file.url)
  }
}

function createUploadedFile(file: File, type: UploadedFile['type'], dimensions?: ImageDimensions): UploadedFile {
  return {
    name: file.name,
    type,
    url: URL.createObjectURL(file),
    size: file.size,
    file,
    dimensions,
  }
}

function getGreatestCommonDivisor(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}

function getAspectRatioLabel(dimensions: ImageDimensions): string {
  const divisor = getGreatestCommonDivisor(dimensions.width, dimensions.height)
  return `${dimensions.width / divisor}:${dimensions.height / divisor}`
}

function hasSameAspectRatio(a: ImageDimensions, b: ImageDimensions): boolean {
  return a.width * b.height === b.width * a.height
}

function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const dimensions = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      }
      URL.revokeObjectURL(objectUrl)
      if (!dimensions.width || !dimensions.height) {
        reject(new Error('无法读取图片尺寸'))
        return
      }
      resolve(dimensions)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法读取图片尺寸'))
    }
    image.src = objectUrl
  })
}

async function resolveUploadedImageDimensions(uploadedFile: UploadedFile): Promise<ImageDimensions | null> {
  if (uploadedFile.dimensions) return uploadedFile.dimensions
  if (!uploadedFile.file) return null
  const dimensions = await getImageDimensions(uploadedFile.file)
  uploadedFile.dimensions = dimensions
  return dimensions
}

function showViduFrameAspectRatioError(startDimensions: ImageDimensions, endDimensions: ImageDimensions) {
  showErrorMessage(
    `首帧和尾帧图片比例必须相同。当前首帧为 ${getAspectRatioLabel(startDimensions)}，尾帧为 ${getAspectRatioLabel(endDimensions)}。`,
  )
}

async function validateViduFrameAspectRatio(): Promise<boolean> {
  if (!viduStartFrame.value || !viduEndFrame.value) return true
  try {
    const startDimensions = await resolveUploadedImageDimensions(viduStartFrame.value)
    const endDimensions = await resolveUploadedImageDimensions(viduEndFrame.value)
    if (!startDimensions || !endDimensions) return true
    if (hasSameAspectRatio(startDimensions, endDimensions)) return true
    showViduFrameAspectRatioError(startDimensions, endDimensions)
    return false
  } catch (error) {
    showErrorMessage('无法读取首帧或尾帧图片尺寸，请重新上传图片后再试。')
    return false
  }
}

function removeUploadedFile(options: { revoke?: boolean } = {}) {
  if (options.revoke !== false) {
    releaseUploadedFile(uploadedFile.value)
  }
  uploadedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

function removeViduFrame(position: 'start' | 'end', options: { revoke?: boolean } = {}) {
  if (position === 'start') {
    if (options.revoke !== false) {
      releaseUploadedFile(viduStartFrame.value)
    }
    viduStartFrame.value = null
    if (viduStartInput.value) viduStartInput.value.value = ''
    return
  }
  if (options.revoke !== false) {
    releaseUploadedFile(viduEndFrame.value)
  }
  viduEndFrame.value = null
  if (viduEndInput.value) viduEndInput.value.value = ''
}

function removeViduFrames(options: { revoke?: boolean } = {}) {
  removeViduFrame('start', options)
  removeViduFrame('end', options)
}

function removeMotionControlFile(type: 'image' | 'video', options: { revoke?: boolean } = {}) {
  if (type === 'image') {
    if (options.revoke !== false) releaseUploadedFile(motionControlImage.value)
    motionControlImage.value = null
    if (motionControlImageInput.value) motionControlImageInput.value.value = ''
    return
  }

  if (options.revoke !== false) releaseUploadedFile(motionControlVideo.value)
  motionControlVideo.value = null
  if (motionControlVideoInput.value) motionControlVideoInput.value.value = ''
}

function removeMotionControlFiles(options: { revoke?: boolean } = {}) {
  removeMotionControlFile('image', options)
  removeMotionControlFile('video', options)
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const capability = getModelCapability(settingsStore.selectedModel)
  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')
  if (!isImage && !isVideo) {
    showErrorMessage('仅支持图片和视频文件')
    return
  }

  if (isImage && !capability?.localUploadInputs?.includes('image')) {
    showErrorMessage('当前模型不支持本地图片上传')
    return
  }

  if (isVideo && !capability?.localUploadInputs?.includes('video')) {
    showErrorMessage('当前模型不支持本地视频上传')
    return
  }

  removeUploadedFile()
  uploadedFile.value = createUploadedFile(file, isImage ? 'image' : 'video')
}

async function handleViduFrameChange(e: Event, position: 'start' | 'end') {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    showErrorMessage('首尾帧生视频仅支持上传图片')
    target.value = ''
    return
  }

  let dimensions: ImageDimensions
  try {
    dimensions = await getImageDimensions(file)
  } catch (error) {
    showErrorMessage('无法读取图片尺寸，请重新上传图片后再试。')
    target.value = ''
    return
  }

  const oppositeFrame = position === 'start' ? viduEndFrame.value : viduStartFrame.value
  if (oppositeFrame) {
    try {
      const oppositeDimensions = await resolveUploadedImageDimensions(oppositeFrame)
      if (oppositeDimensions && !hasSameAspectRatio(dimensions, oppositeDimensions)) {
        if (position === 'start') {
          showViduFrameAspectRatioError(dimensions, oppositeDimensions)
        } else {
          showViduFrameAspectRatioError(oppositeDimensions, dimensions)
        }
        target.value = ''
        return
      }
    } catch (error) {
      showErrorMessage('无法读取已上传图片尺寸，请重新上传首帧和尾帧。')
      target.value = ''
      return
    }
  }

  removeViduFrame(position)
  const uploaded = createUploadedFile(file, 'image', dimensions)
  if (position === 'start') {
    viduStartFrame.value = uploaded
  } else {
    viduEndFrame.value = uploaded
  }
}

function handleMotionControlFileChange(e: Event, type: 'image' | 'video') {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const isExpectedType = type === 'image' ? file.type.startsWith('image/') : file.type.startsWith('video/')
  if (!isExpectedType) {
    showErrorMessage(type === 'image' ? '动作控制参考图像仅支持图片文件' : '动作控制参考视频仅支持视频文件')
    target.value = ''
    return
  }

  removeMotionControlFile(type)
  const uploaded = createUploadedFile(file, type)
  uploaded.purpose = type === 'image' ? 'motion-control-image' : 'motion-control-video'
  if (type === 'image') {
    motionControlImage.value = uploaded
  } else {
    motionControlVideo.value = uploaded
  }
}

async function handlePolishPrompt() {
  const prompt = inputText.value.trim()
  try {
    validatePromptOrThrow(prompt)
  } catch (error) {
    alert(getReadableErrorMessage(error, '请检查提示词后重试。'))
    return
  }

  const model = settingsStore.promptPolishModel.trim()
  if (!model) {
    showErrorMessage('请先在设置中填写用于 AI 润色的模型 ID。')
    return
  }

  isPolishing.value = true
  try {
    inputText.value = await polishPrompt({
      model,
      messages: [
        {
          role: 'system',
          content: settingsStore.promptPolishSystemPrompt.trim() || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
    })
    await nextTick()
    promptInputRef.value?.focus()
  } catch (error) {
    alert(getReadableErrorMessage(error, '润色失败，请稍后重试。'))
  } finally {
    isPolishing.value = false
  }
}

async function handleCopyPrompt(prompt: string) {
  inputText.value = prompt
  await nextTick()
  promptInputRef.value?.focus()
}

async function toggleComposerExpanded() {
  isComposerExpanded.value = !isComposerExpanded.value
  await nextTick()
  promptInputRef.value?.focus()
}

function scrollChatToBottom() {
  chatAreaRef.value?.scrollTo({ top: chatAreaRef.value.scrollHeight, behavior: 'smooth' })
}

onMounted(() => {

  settingsStore.loadFromStorage()
  ensureSupportedAspectRatio()
  ensureSupportedVideoDuration()
  ensureWelcomeMessage()
})

onBeforeUnmount(() => {
  releaseUploadedFile(uploadedFile.value)
  releaseUploadedFile(viduStartFrame.value)
  releaseUploadedFile(viduEndFrame.value)
  releaseUploadedFile(motionControlImage.value)
  releaseUploadedFile(motionControlVideo.value)
})

watch(
  () => settingsStore.selectedModel,
  () => {
    const capability = getModelCapability(settingsStore.selectedModel)
    if (!supportsImageReferenceMode.value) {
      imageMode.value = 'text2image'
    }
    const usesModeSwitcher = settingsStore.mediaType === 'video' && ['viduq3-fast', 'minimax-hailuo', 'kling-v26', 'kling-v3', 'kling-omni'].includes(capability?.videoRequestMode || '')
    if (!usesModeSwitcher) {
      videoMode.value = 'text2video'
      removeViduFrames()
      removeMotionControlFiles()
    }
    if (!activeVideoModeOptions.value.some((option) => option.value === videoMode.value)) {
      videoMode.value = 'text2video'
      removeViduFrames()
      removeMotionControlFiles()
    }
    if (uploadedFile.value?.type === 'image' && !capability?.localUploadInputs?.includes('image')) {
      removeUploadedFile()
    }
    if (uploadedFile.value?.type === 'video' && !capability?.localUploadInputs?.includes('video')) {
      removeUploadedFile()
    }
    if (!showReferenceUrlInput.value) {
      referenceUrl.value = ''
    }
    ensureSupportedAspectRatio()
    ensureSupportedVideoDuration()
    showAspectRatioMenu.value = false
  }
)

watch(
  () => chatStore.messages.length,
  async () => {
    await nextTick()
    scrollChatToBottom()
  }
)

async function handleSend() {
  const prompt = inputText.value.trim()

  try {
    validatePromptOrThrow(prompt)
  } catch (error) {
    alert(getReadableErrorMessage(error, '提示词校验失败，请修改后重试。'))
    return
  }

  if (!canSend.value || activeSessionGenerating.value) return

  if (usesViduLikeVideoMode.value && videoMode.value === 'startEnd2video') {
    const isAspectRatioValid = await validateViduFrameAspectRatio()
    if (!isAspectRatioValid) return
  }

  inputText.value = ''

  const file: UploadedFile | UploadedFile[] | null = usesViduLikeVideoMode.value
    ? videoMode.value === 'image2video'
      ? uploadedFile.value
      : videoMode.value === 'motionControl2video' && motionControlImage.value && motionControlVideo.value
        ? [
            {
              ...motionControlImage.value,
              motionControlOptions: {
                keep_original_sound: motionControlKeepOriginalSound.value,
                character_orientation: motionControlCharacterOrientation.value,
              },
            },
            motionControlVideo.value,
          ]
      : videoMode.value === 'startEnd2video' && viduStartFrame.value && viduEndFrame.value
        ? [viduStartFrame.value, viduEndFrame.value]
        : videoMode.value === 'subjectReference2video'
          ? (uploadedFile.value ? { ...uploadedFile.value, name: 'Subject Reference' } : null) ||
            (referenceUrl.value.trim()
              ? {
                  name: 'Subject Reference',
                  type: 'image' as const,
                  url: referenceUrl.value.trim(),
                  size: 0,
                }
              : null)
          : null
    : uploadedFile.value ||
      (referenceUrl.value.trim()
        ? {
            name: 'Reference URL',
            type: 'image' as const,
            url: referenceUrl.value.trim(),
            size: 0,
          }
        : null)

  removeUploadedFile({ revoke: false })
  removeViduFrames({ revoke: false })
  removeMotionControlFiles({ revoke: false })
  referenceUrl.value = ''
  const primaryFile = Array.isArray(file) ? file[0] : file
  const ioType = resolveGenerateIoType(settingsStore.mediaType, primaryFile)

  await nextTick()
  scrollChatToBottom()
  await generate(prompt, ioType, settingsStore.selectedModel, file, settingsStore.aspectRatio, settingsStore.videoDuration)
  settingsStore.saveToStorage()
  await nextTick()
  scrollChatToBottom()
}

async function handleRegenerate(message: Message) {
  const idx = activeMessages.value.findIndex((m) => m.id === message.id)
  const userMsg = idx > 0 ? activeMessages.value[idx - 1] : null
  if (userMsg && userMsg.type === 'user') {
    const model = userMsg.model || settingsStore.selectedModel
    const aspectRatio = userMsg.aspectRatio || settingsStore.aspectRatio
    const duration = userMsg.duration || settingsStore.videoDuration
    await generate(
      userMsg.content,
      resolveGenerateIoType(settingsStore.mediaType, userMsg.uploadedFiles?.[0] || userMsg.uploadedFile),
      model,
      userMsg.uploadedFiles || userMsg.uploadedFile || null,
      aspectRatio,
      duration,
    )
    await nextTick()
    scrollChatToBottom()
  }
}
</script>

<style scoped>
.chat-page {
  position: relative;
  height: 100dvh;
  padding: 16px 18px 18px;
  overflow: hidden;
  background: transparent;
  isolation: isolate;
}

.chat-page::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 18% 14%, rgba(255, 255, 255, 0.72), transparent 0 20%),
    radial-gradient(circle at 78% 22%, rgba(142, 165, 255, 0.18), transparent 0 18%),
    linear-gradient(180deg, rgba(246, 244, 239, 0.76), rgba(238, 236, 232, 0.92));
}

.workspace-shell,
.session-sidebar,
.workspace-main,
.chat-stage,
.composer-dock {
  position: relative;
}

.workspace-shell {
  width: min(100%, 1480px);
  height: calc(100dvh - 34px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  gap: 18px;
  min-height: 0;
  z-index: 1;
}

.single-session-layout {
  grid-template-columns: 224px minmax(0, 1fr);
}

.session-sidebar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
  min-height: 0;
  padding: 16px 14px 14px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.86);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(22px);
}

.single-session-sidebar {
  justify-content: space-between;
}

.single-session-top {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}

.brand-lockup {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  width: 100%;
  padding: 6px 4px;
}

.brand-title {
  font-size: clamp(22px, 1.7vw, 28px);
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 1;
  font-family: "Georgia", "Times New Roman", serif;
  font-style: italic;
  background: linear-gradient(135deg, #171717 0%, #5f4b8b 45%, #c86b4a 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.single-session-card-panel {
  cursor: default;
}

.single-session-card-head {
  margin-bottom: 10px;
}

/* 简易模式说明卡片 */
.mode-intro-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 12px 14px;
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.86), rgba(246, 244, 239, 0.7));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.mode-intro-badge {
  align-self: flex-start;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #fff;
  background: linear-gradient(135deg, #171717 0%, #5f4b8b 55%, #c86b4a 100%);
  box-shadow: 0 6px 16px rgba(95, 75, 139, 0.22);
}

.mode-intro-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.65;
  color: rgba(71, 85, 105, 0.86);
}

/* 无限画布：黑色平面按钮 + NEW 标志 */
.canvas-entry-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 16px;
  cursor: pointer;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #f8fafc;
  background: #171717;
  transition: background var(--transition-base);
}

.canvas-entry-btn:hover {
  background: #262233;
}

.canvas-entry-text {
  position: relative;
  z-index: 1;
}

.canvas-entry-new {
  display: inline-flex;
  align-items: center;
  z-index: 2;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  line-height: 1.2;
  color: #fff;
  background: #ff5f6d;
}




.sidebar-secondary-btn,
.sidebar-danger-btn,
.switch-btn,
.ratio-current-btn,
.upload-btn,
.icon-btn,
.polish-btn,
.send-btn,
.text-btn,
.reference-input {
  transition:
    transform var(--transition-base),
    background var(--transition-base),
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    opacity var(--transition-base);
}

.workspace-main {
  min-width: 0;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 14px;
  overflow: hidden;
}

.chat-stage,
.composer-dock,
.session-card {
  border: 1px solid rgba(255, 255, 255, 0.88);
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05);
  backdrop-filter: blur(18px);
  background-clip: padding-box;
}

.status-label,
.session-meta-line.subtle,
.empty-kicker,
.empty-copy,
.duration-label {
  color: rgba(71, 85, 105, 0.78);
}

.chat-stage {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 32px;
  padding: 12px;
  overflow: hidden;
}

.chat-stage {
  border-bottom-color: rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.92);
}

.chat-area {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 12px 8px 12px 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  margin: auto;
  max-width: 560px;
  padding: 42px 28px;
  text-align: center;
}

.empty-kicker {
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.28em;
  font-size: 12px;
}

.empty-state h1 {
  margin: 0;
  font-size: clamp(30px, 4vw, 46px);
  line-height: 1.06;
  letter-spacing: -0.05em;
}

.empty-copy {
  margin: 16px 0 0;
  font-size: 15px;
  line-height: 1.7;
}

.composer-dock {
  flex-shrink: 0;
  border-radius: 32px;
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top-color: rgba(255, 255, 255, 0.76);
  background: rgba(255, 255, 255, 0.94);
  overflow: visible;
}

.composer-meta-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
}

.composer-meta-row-top {
  align-items: flex-start;
}

.dock-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dock-pills-primary {
  flex: 1 1 auto;
  min-width: 0;
}

.meta-pill {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 7px 5px 10px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(248, 250, 252, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.meta-pill-type {
  flex: 0 0 auto;
}

.meta-pill-model {
  flex: 1 1 220px;
}

.meta-pill-ratio {
  flex: 0 0 auto;
}

.meta-pill-duration {
  flex: 0 0 auto;
}

.meta-pill-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  color: rgba(51, 65, 85, 0.86);
}

.media-switch,
.ratio-selector,
.model-slot,
.duration-selector,
.upload-mini-row,
.reference-input {
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.84),
    0 1px 2px rgba(15, 23, 42, 0.04);
}

.media-switch,
.ratio-selector,
.duration-selector {
  position: relative;
}

.media-switch::after,
.ratio-selector::after,
.duration-selector::after {
  content: '';
  position: absolute;
  right: -5px;
  top: 7px;
  bottom: 7px;
  width: 1px;
  background: rgba(148, 163, 184, 0.28);
}

.duration-slot:last-child .duration-selector::after,
.dock-pills-primary > :last-child::after {
  display: none;
}

.media-switch {
  display: inline-flex;
  padding: 2px;
  gap: 2px;
}

.compact-switch {
  padding: 2px;
  border-radius: 14px;
}

.switch-btn,
.sidebar-secondary-btn,
.sidebar-danger-btn,
.polish-btn,
.send-btn,
.icon-btn,
.upload-btn,
.text-btn,
.ratio-current-btn {
  border: 0;
  cursor: pointer;
}

.switch-btn {
  min-width: 88px;
  height: 40px;
  padding: 0 16px;
  border-radius: 14px;
  background: transparent;
  color: rgba(15, 23, 42, 0.72);
  font-weight: 600;
}

.compact-switch .switch-btn {
  min-width: 56px;
  height: 28px;
  padding: 0 8px;
  border-radius: 10px;
  font-size: 11px;
}

.switch-btn.active {
  background: linear-gradient(135deg, rgba(23, 23, 23, 0.96), rgba(95, 75, 139, 0.94), rgba(200, 107, 74, 0.9));
  color: #fff;
  box-shadow: 0 14px 28px rgba(95, 75, 139, 0.18);
}

.ratio-selector {
  position: relative;
  border-color: rgba(100, 116, 139, 0.42);
  background: rgba(248, 250, 252, 0.92);
  flex: 0 0 auto;
  padding: 2px;
  border-radius: 14px;
  z-index: 2;
}

.ratio-selector.open,
.ratio-selector:focus-within,
.duration-selector:focus-within,
.media-switch:focus-within {
  border-color: rgba(95, 75, 139, 0.42);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 0 0 3px rgba(95, 75, 139, 0.08),
    0 8px 18px rgba(15, 23, 42, 0.06);
}

.ratio-selector.open {
  z-index: 30;
}

.ratio-current-btn {
  min-width: 112px;
  height: 28px;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
  font-size: 11px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.88);
}

.ratio-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.ratio-current-box,
.ratio-option-box {
  display: inline-block;
  flex: 0 0 auto;
  box-sizing: border-box;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  background: rgba(15, 23, 42, 0.06);
}

.ratio-current-box {
  transform: scale(0.72);
  transform-origin: center;
}

.ratio-caret,
.duration-caret {
  color: rgba(71, 85, 105, 0.7);
}

.ratio-dropdown {
  position: absolute;
  right: 0;
  bottom: calc(100% + 10px);
  width: min(420px, calc(100vw - 40px));
  min-width: max(300px, 100%);
  max-height: min(220px, calc(100dvh - 220px));
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 8px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.84);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.14);
  z-index: 31;
}

.ratio-dropdown-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 52px;
  padding: 6px 6px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.ratio-dropdown-item.active {
  background: rgba(95, 75, 139, 0.1);
}

.ratio-option-preview {
  width: 32px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.duration-selector,
.upload-mini-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
}

.duration-selector {
  border-color: rgba(100, 116, 139, 0.42);
  background: rgba(248, 250, 252, 0.92);
  min-height: 34px;
  padding: 0 10px;
  border-radius: 14px;
}

.duration-select-wrap {
  position: relative;
}

.duration-select {
  appearance: none;
  border: 0;
  background: transparent;
  min-width: 48px;
  padding-right: 20px;
  font: inherit;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.88);
  outline: none;
}

.duration-caret {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}

.reference-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
  align-items: stretch;
}

.video-mode-switch {
  display: inline-flex;
  gap: 2px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.84),
    0 1px 2px rgba(15, 23, 42, 0.04);
}

.mode-switch-btn {
  min-width: 72px;
}

.upload-card-row {
  min-height: 48px;
  padding: 6px 10px;
  border-radius: 16px;
  background: rgba(248, 250, 252, 0.88);
}

.upload-card-row.has-file {
  border-color: rgba(95, 75, 139, 0.38);
  background: rgba(95, 75, 139, 0.07);
}

.subject-reference-card {
  width: 100%;
  min-height: 58px;
  display: grid;
  grid-template-columns: auto minmax(120px, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 18px;
  background: rgba(248, 250, 252, 0.9);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.84),
    0 1px 2px rgba(15, 23, 42, 0.04);
}

.subject-reference-card.has-file {
  border-color: rgba(95, 75, 139, 0.38);
  background: rgba(95, 75, 139, 0.07);
}

.motion-control-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.motion-control-note {
  margin: 0;
  padding: 0 2px;
  font-size: 12px;
  font-weight: 800;
  color: rgba(15, 23, 42, 0.9);
}

.motion-control-note small {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 500;
  color: rgba(71, 85, 105, 0.72);
}

.motion-control-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.motion-control-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.86);
}

.motion-control-option-label {
  font-size: 11px;
  font-weight: 800;
  color: rgba(51, 65, 85, 0.86);
}

.motion-control-select {
  border: 0;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  color: rgba(15, 23, 42, 0.88);
}

.subject-upload-btn {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(23, 23, 23, 0.94), rgba(95, 75, 139, 0.9));
  color: #fff;
  font-weight: 700;
  cursor: pointer;
}

.subject-upload-icon {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.18);
}

.subject-reference-copy {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.upload-copy {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  min-width: 78px;
}

.upload-label {
  font-size: 12px;
  font-weight: 800;
  line-height: 1.1;
  color: rgba(15, 23, 42, 0.9);
}

.upload-hint {
  font-size: 10px;
  line-height: 1.1;
  color: rgba(71, 85, 105, 0.72);
}

.frame-upload-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 8px;
}

.frame-upload-card {
  width: 100%;
  justify-content: flex-start;
}

.file-input {
  display: none;
}

.upload-icon-btn,
.icon-btn,
.send-icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.upload-btn,
.icon-btn {
  background: rgba(255, 255, 255, 0.2);
}

.upload-btn:hover,
.icon-btn:hover,
.text-btn:hover,
.polish-btn:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.46);
}

.pill-filename {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.reference-input {
  min-width: min(420px, 100%);
  min-height: 34px;
  padding: 0 12px;
  outline: none;
  font-size: 13px;
}

.input-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: end;
  padding: 8px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.14);
}

.input-shell:focus-within {
  border-color: rgba(255, 255, 255, 0.28);
  background: rgba(255, 255, 255, 0.18);
}

.compact-model-slot {
  min-width: min(200px, 100%);
  border: 0;
  background: transparent;
}

.input-shell.expanded textarea {
  min-height: 120px;
}

.input-shell textarea {
  width: 100%;
  min-height: 52px;
  max-height: 152px;
  resize: vertical;
  border: 0;
  background: transparent;
  outline: none;
  font: inherit;
  color: inherit;
  padding: 6px 8px;
  line-height: 1.45;
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  align-self: flex-end;
}

.icon-btn svg,
.send-gradient-icon svg {
  width: 18px;
  height: 18px;
}

.polish-btn {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 14px;
  font-weight: 600;
}

.sidebar-secondary-btn,
.sidebar-danger-btn {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 16px;
  font-weight: 600;
}

.sidebar-secondary-btn,
.polish-btn,
.icon-btn,
.send-btn,
.text-btn {
  background: rgba(255, 255, 255, 0.2);
  color: rgba(15, 23, 42, 0.9);
}

.sidebar-danger-btn {
  background: rgba(153, 27, 27, 0.08);
  color: rgba(153, 27, 27, 0.92);
}

.send-btn.ready {
  background: var(--color-theme-gradient);
  color: rgba(255, 255, 255, 0.98);
  box-shadow: 0 16px 30px rgba(95, 75, 139, 0.2);
}

.send-btn.ready .send-gradient-icon {
  color: rgba(255, 255, 255, 0.98);
}

.send-btn.ready .send-gradient-icon svg {
  color: currentColor;
}

.send-btn.ready .send-gradient-icon path {
  stroke: currentColor;
}

.send-btn:disabled,
.polish-btn:disabled,
.sidebar-secondary-btn:disabled,
.sidebar-danger-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.session-card {
  padding: 16px;
  border-radius: 24px;
}

.session-card-head,
.session-card-meta,
.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-title {
  font-size: 18px;
}

@media (max-width: 1100px) {
  .workspace-shell,
  .single-session-layout {
    grid-template-columns: 1fr;
    height: calc(100dvh - 34px);
    min-height: 0;
  }

  .session-sidebar {
    order: 2;
    min-height: auto;
  }

  .workspace-main {
    order: 1;
    min-height: 0;
    height: 100%;
    overflow: hidden;
  }

}

@media (max-width: 720px) {
  .chat-page {
    height: 100dvh;
    padding: 10px;
  }

  .workspace-shell {
    gap: 12px;
  }

  .composer-meta-row,
  .dock-pills,
  .composer-actions,
  .sidebar-footer {
    width: 100%;
  }

  .input-shell {
    grid-template-columns: 1fr;
  }

  .dock-pills-primary,
  .meta-pill,
  .compact-model-slot {
    width: 100%;
  }

  .composer-actions {
    justify-content: space-between;
  }

  .reference-input {
    min-width: 100%;
  }

  .frame-upload-grid {
    grid-template-columns: 1fr;
  }

  .subject-reference-card {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .video-mode-switch,
  .video-mode-switch .switch-btn {
    width: 100%;
  }

  .ratio-selector,
  .ratio-current-btn {
    width: 100%;
  }

  .ratio-dropdown {
    left: 0;
    right: auto;
    min-width: 100%;
    width: min(100%, calc(100vw - 20px));
    grid-template-columns: repeat(3, minmax(0, 1fr));
    max-height: min(260px, calc(100dvh - 190px));
  }
}
</style>
