<template>
  <div class="chat-page">
    <div class="workspace-shell single-session-layout">
      <aside class="session-sidebar single-session-sidebar" aria-label="当前会话">
        <div class="sidebar-top single-session-top">
          <div class="brand-lockup">
            <strong class="brand-title">ArtRealm AI</strong>
          </div>
        </div>


        <div class="sidebar-footer">
          <button class="sidebar-secondary-btn" type="button" @click="router.push('/settings')">
            设置
          </button>
          <button class="sidebar-danger-btn" type="button" @click="handleClearConversation">
            清空当前对话
          </button>
        </div>
      </aside>

      <main class="workspace-main">
        <section class="chat-stage">
          <div class="chat-area" ref="chatAreaRef">
            <div v-if="activeMessages.length === 0" class="empty-state">
              <p class="empty-kicker">Start with an idea</p>
              <h1>把灵感写成一句清晰的创作指令。</h1>
              <p class="empty-copy">你可以先描述主体、氛围、镜头语言，再根据结果继续迭代。</p>
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

              <div class="ratio-selector" :class="{ open: showAspectRatioMenu }">
                <button
                  class="ratio-current-btn"
                  type="button"
                  :aria-expanded="showAspectRatioMenu"
                  aria-label="选择比例"
                  @click="showAspectRatioMenu = !showAspectRatioMenu"
                >
                  <span class="ratio-chip">{{ selectedAspectRatioOption.label }}</span>
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
                    <span class="ratio-option-box" :style="{ width: `${option.boxWidth}px`, height: `${option.boxHeight}px` }" />
                    <span>{{ option.label }}</span>
                  </button>
                </div>
              </div>

              <div v-if="settingsStore.mediaType === 'video'" class="duration-slot">
                <div class="duration-selector">
                  <label class="duration-label" for="video-duration">时长</label>
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
              <div v-if="isUploadEnabled" class="upload-mini-row" :class="{ 'has-file': !!uploadedFile }">
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
                <button v-if="uploadedFile" class="text-btn" type="button" @click="removeUploadedFile">移除</button>
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
const isPolishing = ref(false)
const isComposerExpanded = ref(false)
const showAspectRatioMenu = ref(false)
const uploadedFile = ref<UploadedFile | null>(null)
const referenceUrl = ref('')
const inputText = ref('')

const hasPromptPolishModelConfigured = computed(() => !!settingsStore.promptPolishModel.trim())
const polishDisabledReason = '请前往设置完成 AI 润色模型设置'

const activeMessages = computed(() => chatStore.messages)
const activeSessionGenerating = computed(() => chatStore.isGenerating)
const modelCapability = computed(() => getModelCapability(settingsStore.selectedModel))
const isUploadEnabled = computed(() => modelSupportsLocalUpload(settingsStore.selectedModel))
const requiresUpload = computed(() => {
  if (!modelRequiresReference(settingsStore.selectedModel)) return false
  return !!modelCapability.value?.inputs.includes('image') && !inputText.value.trim()
})
const showReferenceUrlInput = computed(() => requiresUpload.value && !isUploadEnabled.value)
const showReferenceField = computed(() => isUploadEnabled.value || showReferenceUrlInput.value)

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
  if (settingsStore.mediaType === 'image' && uploadedFile.value) {
    return '描述你希望参考图如何变化：风格、光线、细节、构图。'
  }
  if (settingsStore.mediaType === 'video' && uploadedFile.value) {
    return '描述你希望参考视频如何延展：运动、镜头、节奏、氛围。'
  }
  return settingsStore.mediaType === 'image'
    ? '描述你想生成的画面：主体、氛围、镜头、色彩、质感。'
    : '描述你想生成的视频：场景、运动、节奏、情绪和镜头语言。'
})

const canSend = computed(() => {
  if (!inputText.value.trim()) return false
  if (modelCapability.value?.availabilityNote === 'requires-image-upload' || modelCapability.value?.availabilityNote === 'requires-video-upload') {
    return !!uploadedFile.value || !!referenceUrl.value.trim()
  }
  if (!requiresUpload.value) return true
  return !!uploadedFile.value || !!referenceUrl.value.trim()
})

function buildSessionWelcomeMessage(): Omit<Message, 'id' | 'timestamp'> {
  return {
    type: 'system',
    content: '欢迎来到 ArtRealm AI。当前已切换为单会话模式。选择模式，输入创作描述，开始生成；如需 AI 润色，请先前往设置完成模型配置。',
  }
}

function ensureWelcomeMessage() {
  if (chatStore.messages.length > 0) return
  chatStore.addMessage(buildSessionWelcomeMessage())
}

function handleMediaTypeChange(nextType: MediaType) {
  settingsStore.setMediaType(nextType)
  ensureSupportedAspectRatio()
  removeUploadedFile()
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

function removeUploadedFile() {
  releaseUploadedFile(uploadedFile.value)
  uploadedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
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
  const url = URL.createObjectURL(file)
  uploadedFile.value = {
    name: file.name,
    type: isImage ? 'image' : 'video',
    url,
    size: file.size,
    file,
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

function handleClearConversation() {
  removeUploadedFile()
  referenceUrl.value = ''
  inputText.value = ''
  chatStore.clearMessages()
  ensureWelcomeMessage()
}

onMounted(() => {
  settingsStore.loadFromStorage()
  ensureSupportedAspectRatio()
  ensureSupportedVideoDuration()
  ensureWelcomeMessage()
})

onBeforeUnmount(() => {
  releaseUploadedFile(uploadedFile.value)
})

watch(
  () => settingsStore.selectedModel,
  () => {
    const capability = getModelCapability(settingsStore.selectedModel)
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

  inputText.value = ''

  const file =
    uploadedFile.value ||
    (referenceUrl.value.trim()
      ? {
          name: 'Reference URL',
          type: 'image' as const,
          url: referenceUrl.value.trim(),
          size: 0,
        }
      : null)

  removeUploadedFile()
  referenceUrl.value = ''
  const ioType = resolveGenerateIoType(settingsStore.mediaType, file)

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
      resolveGenerateIoType(settingsStore.mediaType, userMsg.uploadedFile),
      model,
      userMsg.uploadedFile || null,
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
  gap: 6px;
}

.dock-pills-primary {
  flex: 1 1 auto;
  min-width: 0;
}

.meta-pill {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.26);
  background: rgba(255, 255, 255, 0.16);
}

.meta-pill-type {
  flex: 0 0 auto;
}

.meta-pill-model {
  flex: 1 1 220px;
}

.meta-pill-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: rgba(71, 85, 105, 0.78);
}

.media-switch,
.ratio-selector,
.model-slot,
.duration-selector,
.upload-mini-row,
.reference-input {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.12);
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
}

.ratio-current-btn {
  min-width: 100px;
  height: 34px;
  padding: 0 12px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background: transparent;
  font-size: 12px;
}

.ratio-dropdown {
  position: absolute;
  left: 0;
  bottom: calc(100% + 10px);
  min-width: 180px;
  padding: 8px;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.84);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.14);
}

.ratio-dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 0;
  border-radius: 14px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.ratio-dropdown-item.active {
  background: rgba(95, 75, 139, 0.1);
}

.ratio-option-box {
  display: inline-block;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  background: rgba(15, 23, 42, 0.06);
}

.duration-selector,
.upload-mini-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 10px;
}

.duration-select-wrap {
  position: relative;
}

.duration-select {
  appearance: none;
  border: 0;
  background: transparent;
  padding-right: 18px;
  font: inherit;
  color: inherit;
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
}
</style>
