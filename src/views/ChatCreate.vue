<template>
  <div class="chat-page">
    <div class="main-shell">
      <header class="topbar">
        <div class="title-block">
          <span class="brand-kicker">AIDRAW</span>
          <h1>创作台</h1>
        </div>

        <div class="nav-tip" aria-label="使用提示">
          <span>该项目不做任何保存功能，请及时保存生成内容</span>
          <span>AI生成仅供参考</span>
        </div>

        <div class="topbar-actions">
          <button class="rail-btn icon-rail-btn" @click="showUsagePanel = true" aria-label="打开用量统计" title="用量统计">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 16V10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M10 16V6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M16 16V3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="rail-btn icon-rail-btn" @click="router.push('/settings')" aria-label="打开设置" title="设置">
            <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M10 7.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z" stroke="currentColor" stroke-width="1.7"/>
              <path d="M16.2 10.7v-1.4l-1.35-.45a5.24 5.24 0 0 0-.43-1.03l.64-1.27-.99-.99-1.27.64c-.33-.18-.67-.32-1.03-.43L10.7 3.8H9.3l-.45 1.35c-.36.11-.7.25-1.03.43l-1.27-.64-.99.99.64 1.27c-.18.33-.32.67-.43 1.03L3.8 9.3v1.4l1.35.45c.11.36.25.7.43 1.03l-.64 1.27.99.99 1.27-.64c.33.18.67.32 1.03.43l.45 1.35h1.4l.45-1.35c.36-.11.7-.25 1.03-.43l1.27.64.99-.99-.64-1.27c.18-.33.32-.67.43-1.03l1.35-.45Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      <section class="studio-card">
        <div class="panel-head">
          <div>
            <span class="panel-kicker">Conversation</span>
            <h2>生成记录</h2>
          </div>
        </div>

        <div class="chat-area" ref="chatAreaRef">
          <ChatBubble
            v-for="msg in chatStore.messages"
            :key="msg.id"
            :message="msg"
            @regenerate="handleRegenerate"
            @copy-prompt="handleCopyPrompt"
          />
        </div>
      </section>

      <section class="composer-card">
        <div class="composer-wrap">
            <!-- 悬浮气泡行 -->
            <div class="float-pills">
              <!-- 图片/视频切换 -->
              <div class="pill-bubble pill-switch">
                <div class="media-switch">
                  <button
                    class="switch-btn"
                    :class="{ active: settingsStore.mediaType === 'image' }"
                    @click="handleMediaTypeChange('image')"
                  >图片</button>
                  <button
                    class="switch-btn"
                    :class="{ active: settingsStore.mediaType === 'video' }"
                    @click="handleMediaTypeChange('video')"
                  >视频</button>
                </div>
              </div>

              <!-- 模型选择 -->
              <div class="pill-bubble pill-model">
                <ModelSelector
                  :key="settingsStore.mediaType"
                  :mediaType="settingsStore.mediaType"
                  v-model="settingsStore.selectedModel"
                  @update:modelValue="settingsStore.saveToStorage()"
                />
              </div>

              <!-- 比例选择 -->
              <div class="pill-bubble ratio-pill-wrap">
                <div class="ratio-selector" :class="{ open: showAspectRatioMenu }">
                  <button
                    class="ratio-current-btn"
                    type="button"
                    :aria-expanded="showAspectRatioMenu"
                    aria-label="选择比例"
                    @click="showAspectRatioMenu = !showAspectRatioMenu"
                  >
                    <span
                      class="ratio-icon ratio-icon-current"
                      :style="{ width: `${selectedAspectRatioOption.boxWidth}px`, height: `${selectedAspectRatioOption.boxHeight}px` }"
                    />
                    <span class="ratio-current-text">{{ selectedAspectRatioOption.label }}</span>
                    <span class="ratio-caret">▾</span>
                  </button>

                  <button
                    type="button"
                    class="ratio-preview-btn"
                    :aria-expanded="showAspectRatioMenu"
                    aria-label="展开更多比例"
                    @click="showAspectRatioMenu = !showAspectRatioMenu"
                  >
                    <span
                      v-for="option in aspectRatioPreviewOptions"
                      :key="option.value"
                      class="ratio-preview-icon"
                      :class="{ active: settingsStore.aspectRatio === option.value }"
                      :style="{ width: `${option.boxWidth}px`, height: `${option.boxHeight}px` }"
                    />
                    <span class="ratio-preview-more">{{ aspectRatioOptions.length }}</span>
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
                      <span
                        class="ratio-icon"
                        :style="{ width: `${option.boxWidth}px`, height: `${option.boxHeight}px` }"
                      />
                      <span>{{ option.label }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <!-- 素材上传（可选） -->
              <div v-if="showReferenceField" class="pill-bubble upload-pill-wrap">
                <div v-if="isUploadEnabled" class="upload-mini-row" :class="{ 'has-file': !!uploadedFile }">
                  <input
                    ref="fileInput"
                    type="file"
                    :accept="uploadAccept"
                    class="file-input"
                    @change="handleFileChange"
                  />
                  <button class="upload-icon-btn" type="button" @click="fileInput?.click()">
                    <span class="upload-icon-plus">+</span>
                    <span class="upload-icon-copy">
                      <span class="upload-icon-label">上传图片</span>
                      <span class="upload-icon-text">支持本地素材</span>
                    </span>
                  </button>
                  <span v-if="uploadedFile" class="pill-filename">{{ uploadedFile.name }}</span>
                  <button v-if="uploadedFile" class="text-btn" type="button" @click="uploadedFile = null">移除</button>
                </div>
                <input
                  v-else-if="showReferenceUrlInput"
                  v-model.trim="referenceUrl"
                  type="url"
                  class="reference-input"
                  placeholder="粘贴参考图链接"
                />
              </div>
            </div>

            <!-- 输入框 -->
            <div :class="['input-shell', { expanded: isComposerExpanded }]">
              <textarea
                ref="promptInputRef"
                v-model="inputText"
                :placeholder="inputPlaceholder"
                @keydown.enter.exact.prevent="handleSend"
              />
              <div class="composer-actions">
                <button
                  class="expand-btn icon-expand-btn"
                  :title="isComposerExpanded ? '收起输入框' : '扩大输入框'"
                  :aria-label="isComposerExpanded ? '收起输入框' : '扩大输入框'"
                  @click="toggleComposerExpanded"
                >
                  <span>{{ isComposerExpanded ? '↙' : '↗' }}</span>
                </button>
                <button
                  class="polish-btn"
                  :disabled="isPolishing || chatStore.isGenerating || !hasPromptPolishModelConfigured"
                  :title="!hasPromptPolishModelConfigured ? polishDisabledReason : ''"
                  :aria-label="!hasPromptPolishModelConfigured ? polishDisabledReason : 'AI润色'"
                  @click="handlePolishPrompt"
                >
                  {{ isPolishing ? '润色中...' : 'AI润色' }}
                </button>
                <button
                  class="primary-btn"
                  :disabled="!canSend || chatStore.isGenerating"
                  @click="handleSend"
                >
                  <span class="send-btn-icon">↑</span>
                  <span class="send-btn-text">{{ chatStore.isGenerating ? '生成中' : '开始生成' }}</span>
                </button>
              </div>
            </div>
          </div>
        </section>
    </div>

    <div v-if="showUsagePanel" class="panel-overlay" @click.self="showUsagePanel = false">
      <aside class="usage-panel">
        <div class="usage-head">
          <div>
            <span class="panel-kicker">Usage</span>
            <h3>用量统计</h3>
          </div>
          <button class="rail-btn small" @click="showUsagePanel = false">✕</button>
        </div>

        <div class="usage-summary">
          <div class="summary-card">
            <span class="summary-label">总调用次数</span>
            <strong>{{ totalCalls }}</strong>
          </div>
          <div class="summary-card">
            <span class="summary-label">累计花费</span>
            <strong>{{ formatCost(totalCost) }}</strong>
          </div>
        </div>

        <div v-if="callRecords.length > 0" class="usage-list">
          <div v-for="(record, idx) in callRecords" :key="idx" class="usage-row">
            <span>{{ record.model }}</span>
            <strong>{{ formatCost(record.cost) }}</strong>
          </div>
        </div>
        <div v-else class="usage-empty">还没有生成记录，开始一次创作后这里会自动累计。</div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import ChatBubble from '@/components/ChatBubble.vue'
import ModelSelector from '@/components/ModelSelector.vue'
import { useChatStore } from '@/stores/chatStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT } from '@/stores/settingsStore'
import { useGenerate } from '@/composables/useGenerate'
import { polishPrompt } from '@/api/aiping'
import {
  ASPECT_RATIO_OPTIONS,
  getLocalUploadAccept,
  getModelCapability,
  getSupportedAspectRatios,
  modelRequiresReference,
  modelSupportsLocalUpload,
  type MediaType,
} from '@/types/model'
import { formatCost } from '@/utils/format'
import { showErrorMessage } from '@/utils/errors'
import { getReadableErrorMessage, validatePromptOrThrow } from '@/utils/errorHandling'
import type { Message, UploadedFile } from '@/types/chat'
import { resolveGenerateIoType } from '@/features/generate/media'

const router = useRouter()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const { generate } = useGenerate()

const inputText = ref('')
const chatAreaRef = ref<HTMLElement | null>(null)
const promptInputRef = ref<HTMLTextAreaElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadedFile = ref<UploadedFile | null>(null)
const referenceUrl = ref('')
const showUsagePanel = ref(false)
const isPolishing = ref(false)
const isComposerExpanded = ref(false)
const showAspectRatioMenu = ref(false)

const hasPromptPolishModelConfigured = computed(() => !!settingsStore.promptPolishModel.trim())
const polishDisabledReason = '请前往设置完成AI润色模型设置'

const isUploadEnabled = computed(() => modelSupportsLocalUpload(settingsStore.selectedModel))
const requiresUpload = computed(() => modelRequiresReference(settingsStore.selectedModel))
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

const selectedAspectRatioOption = computed(() => {
  return (
    aspectRatioOptions.value.find((option) => option.value === settingsStore.aspectRatio) ||
    aspectRatioOptions.value[0] ||
    ASPECT_RATIO_OPTIONS[0]
  )
})

const aspectRatioPreviewOptions = computed(() => {
  return aspectRatioOptions.value.filter((option) => option.value !== settingsStore.aspectRatio).slice(0, 3)
})

const inputPlaceholder = computed(() => {
  if (settingsStore.mediaType === 'image' && uploadedFile.value) {
    return '描述你想如何修改这张图片，例如构图、风格、光线、材质。'
  }
  if (settingsStore.mediaType === 'video' && uploadedFile.value) {
    return '描述这段素材如何延展成视频，例如镜头、动作、节奏、情绪。'
  }
  return settingsStore.mediaType === 'image'
    ? '写下图片创作需求，例如主体、场景、构图、光线和风格。'
    : '写下视频创作需求，例如场景、运动方式、镜头语言和氛围。'
})

const canSend = computed(() => {
  if (!inputText.value.trim()) return false
  if (!requiresUpload.value) return true
  return !!uploadedFile.value || !!referenceUrl.value.trim()
})

const callRecords = computed(() => {
  const records: { model: string; cost: number }[] = []
  chatStore.messages.forEach((msg) => {
    if (msg.type === 'assistant' && msg.generateResult) {
      records.push({
        model: msg.generateResult.model,
        cost: msg.generateResult.cost,
      })
    }
  })
  return records.reverse()
})

const totalCalls = computed(() => callRecords.value.length)
const totalCost = computed(() => callRecords.value.reduce((sum, r) => sum + r.cost, 0))

function handleMediaTypeChange(nextType: MediaType) {
  settingsStore.setMediaType(nextType)
  ensureSupportedAspectRatio()
  uploadedFile.value = null
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
    alert(getReadableErrorMessage(error, '请检查提示词后再试。'))
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
    alert(getReadableErrorMessage(error, 'AI 润色失败，请稍后重试。'))
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

onMounted(() => {
  settingsStore.loadFromStorage()
  ensureSupportedAspectRatio()
  if (chatStore.messages.length === 0) {
    chatStore.addMessage({
      type: 'system',
      content: '欢迎来到简约版创作工作台。选择生成模式并输入提示词后就可以开始创作啦。使用“AI润色”功能请先前往右上角“设置”进行模型配置。',
    })
  }
})

watch(
  () => settingsStore.selectedModel,
  () => {
    const capability = getModelCapability(settingsStore.selectedModel)
    if (uploadedFile.value?.type === 'image' && !capability?.localUploadInputs?.includes('image')) {
      uploadedFile.value = null
    }
    if (uploadedFile.value?.type === 'video' && !capability?.localUploadInputs?.includes('video')) {
      uploadedFile.value = null
    }
    if (!showReferenceUrlInput.value) {
      referenceUrl.value = ''
    }
    ensureSupportedAspectRatio()
    showAspectRatioMenu.value = false
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

  if (!canSend.value || chatStore.isGenerating) return

  inputText.value = ''

  const file =
    uploadedFile.value ||
    (referenceUrl.value.trim()
      ? {
          name: '参考图链接',
          type: 'image' as const,
          url: referenceUrl.value.trim(),
          size: 0,
        }
      : null)

  uploadedFile.value = null
  referenceUrl.value = ''
  const ioType = resolveGenerateIoType(settingsStore.mediaType, file)

  await generate(prompt, ioType, settingsStore.selectedModel, file, settingsStore.aspectRatio)
  settingsStore.saveToStorage()
  await nextTick()
  chatAreaRef.value?.scrollTo({ top: chatAreaRef.value.scrollHeight, behavior: 'smooth' })
}

async function handleRegenerate(message: Message) {
  const idx = chatStore.messages.findIndex((m) => m.id === message.id)
  const userMsg = idx > 0 ? chatStore.messages[idx - 1] : null
  if (userMsg && userMsg.type === 'user') {
    // 优先使用原始消息里存储的 model 和 aspectRatio，保证重新生成与原始一致
    const model = userMsg.model || settingsStore.selectedModel
    const aspectRatio = userMsg.aspectRatio || settingsStore.aspectRatio
    await generate(
      userMsg.content,
      resolveGenerateIoType(settingsStore.mediaType, userMsg.uploadedFile),
      model,
      userMsg.uploadedFile,
      aspectRatio
    )
    await nextTick()
    chatAreaRef.value?.scrollTo({ top: chatAreaRef.value.scrollHeight, behavior: 'smooth' })
  }
}
</script>

<style scoped>
.chat-page {
  height: 100%;
  min-height: 100dvh;
  padding: 20px;
  box-sizing: border-box;
  overflow-x: hidden;
}

.topbar,
.studio-card,
.usage-panel {
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  box-shadow: var(--color-shadow);
  backdrop-filter: blur(22px);
}

.rail-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  height: 38px;
  border-radius: 12px;
  padding: 0 14px;
  font-size: 13px;
}

.rail-btn {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-text);
}

.rail-btn.active {
  background: var(--color-primary-soft);
  color: var(--color-primary);
  border-color: rgba(0, 113, 227, 0.2);
}

.main-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  height: calc(100vh - 40px);
  min-height: calc(100vh - 40px);
  height: calc(100dvh - 40px);
  min-height: calc(100dvh - 40px);
  overflow: hidden;
}

.topbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-radius: 20px;
  overflow: hidden;
  flex-shrink: 0;
}

.title-block {
  min-width: 0;
}

.nav-tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  flex-wrap: wrap;
  text-align: center;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.45);
}

.topbar-actions {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 10px;
  justify-content: flex-end;
}

.icon-rail-btn {
  min-width: 38px;
  width: 38px;
  padding: 0;
}

.icon-rail-btn svg {
  width: 18px;
  height: 18px;
  display: block;
}

.brand-kicker,
.panel-kicker {
  display: block;
  margin-bottom: 1px;
  font-size: 9px;
  color: var(--color-text-hint);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2,
h3 {
  letter-spacing: -0.03em;
}

h1 {
  font-size: 16px;
}

h2 {
  font-size: 12px;
}

.studio-card {
  padding: 10px 16px 8px;
  border-radius: 28px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.panel-head {
  margin-bottom: 4px;
}

.chat-area {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow-y: auto;
  padding-right: 8px;
}

/* composer-card 去掉自身背景，作为透明容器 */
.composer-card {
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none !important;
  padding: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  overflow: visible;
  flex-shrink: 0;
}

.composer-wrap {
  width: min(100%, 1080px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 悬浮气泡行 */
.float-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* 每个气泡 */
.pill-bubble {
  display: inline-flex;
  align-items: center;
  padding: 4px 6px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(16px);
  flex-shrink: 0;
}

/* 模型选择气泡稍宽 */
.pill-model {
  flex: 1;
  min-width: 160px;
  max-width: 320px;
  border-radius: 14px;
  padding: 2px 6px;
}

.pill-switch {
  flex-shrink: 0;
}

.media-switch {
  display: inline-flex;
  padding: 2px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.05);
}

.switch-btn {
  min-height: 24px;
  padding: 0 10px;
  font-size: 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-secondary);
}

.switch-btn.active {
  background: #fff;
  color: var(--color-text);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
}

.primary-btn,
.polish-btn,
.expand-btn,
.ratio-btn,
.text-btn {
  transition:
    border-color var(--transition-base),
    background var(--transition-base),
    transform var(--transition-base),
    box-shadow var(--transition-base);
}

.upload-mini-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  min-width: 0;
}

.upload-mini-row.has-file {
  width: 100%;
}

.file-input {
  display: none;
}

.pill-filename {
  font-size: 11px;
  color: var(--color-text-secondary);
  max-width: 132px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-icon-btn,
.primary-btn {
  min-height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
}

.upload-icon-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(0, 113, 227, 0.18);
  background: linear-gradient(135deg, rgba(0, 113, 227, 0.16), rgba(125, 211, 252, 0.24));
  min-width: 104px;
  min-height: 40px;
  height: auto;
  padding: 6px 12px;
  font-size: 12px;
  line-height: 1;
  color: var(--color-primary);
  border-radius: 16px;
  font-weight: 600;
  box-shadow: 0 8px 20px rgba(0, 113, 227, 0.12);
}

.upload-icon-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
  font-size: 16px;
  flex-shrink: 0;
}

.upload-icon-copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
}

.upload-icon-label {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.1;
}

.upload-icon-text {
  font-size: 10px;
  color: var(--color-text-secondary);
  line-height: 1.1;
}

.upload-icon-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.text-btn {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 11px;
  padding: 0 4px;
}

.reference-input {
  width: 140px;
  min-height: 24px;
  padding: 0 8px;
  font-size: 12px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text);
  outline: none;
}

.ratio-pill-wrap,
.upload-pill-wrap {
  position: relative;
}

.ratio-selector {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.ratio-current-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: 999px;
  background: rgba(0, 113, 227, 0.1);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 600;
  flex: 1;
  justify-content: center;
}

.ratio-current-text {
  white-space: nowrap;
}

.ratio-icon-current {
  flex-shrink: 0;
}

.ratio-caret {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.ratio-preview-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 0 8px;
  border: 1px dashed rgba(0, 113, 227, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.ratio-preview-icon {
  display: inline-block;
  border: 1.5px solid currentColor;
  border-radius: 3px;
  opacity: 0.55;
}

.ratio-preview-icon.active {
  opacity: 1;
  color: var(--color-primary);
}

.ratio-preview-more {
  font-size: 10px;
  font-weight: 700;
}

.ratio-dropdown {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 132px;
  padding: 8px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(18px);
}

.ratio-dropdown-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  text-align: left;
}

.ratio-dropdown-item.active {
  background: rgba(0, 113, 227, 0.1);
  color: var(--color-primary);
}

.ratio-icon {
  display: inline-block;
  border: 1.5px solid currentColor;
  border-radius: 3px;
}

/* 输入框 */
.input-shell {
  padding: 10px 10px 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: var(--color-bg-elevated);
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(22px);
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-height: 82px;
  transition:
    min-height var(--transition-base),
    border-color var(--transition-base),
    box-shadow var(--transition-base);
}

.input-shell.expanded {
  min-height: min(42vh, 360px);
  border-color: rgba(0, 113, 227, 0.2);
  box-shadow: 0 10px 34px rgba(15, 23, 42, 0.12);
}

.input-shell textarea {
  flex: 1;
  min-height: 58px;
  max-height: 180px;
  padding: 4px 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  line-height: 1.6;
  font-size: 13px;
  overflow-y: auto;
}

.input-shell.expanded textarea {
  min-height: min(34vh, 286px);
  max-height: min(34vh, 286px);
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.primary-btn,
.polish-btn,
.expand-btn {
  border: none;
  font-weight: 700;
  min-height: 34px;
  padding: 0 16px;
  border-radius: 14px;
  font-size: 13px;
}

.primary-btn {
  background: var(--color-primary);
  color: #fff;
}

.polish-btn {
  background: rgba(0, 113, 227, 0.1);
  color: var(--color-primary);
}

.polish-btn:disabled {
  background: rgba(148, 163, 184, 0.16);
  color: rgba(100, 116, 139, 0.9);
  cursor: not-allowed;
  box-shadow: none;
}

.expand-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.76);
  color: var(--color-text);
}

.icon-expand-btn {
  min-width: 34px;
  width: 34px;
  height: 34px;
  padding: 0;
  border-radius: 50%;
  justify-content: center;
  flex-shrink: 0;
}

.primary-btn:hover,
.polish-btn:hover,
.expand-btn:hover,
.upload-icon-btn:hover,
.ratio-btn:hover,
.rail-btn:hover {
  transform: translateY(-1px);
}

.polish-btn:disabled:hover,
.primary-btn:disabled:hover,
.expand-btn:disabled:hover,
.upload-icon-btn.disabled:hover {
  transform: none;
}

.panel-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: flex-start;
  padding: 20px;
}

.usage-panel {
  width: min(380px, calc(100vw - 40px));
  height: calc(100vh - 40px);
  border-radius: 28px;
  padding: 20px;
}

.usage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.usage-summary {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 18px;
}

.summary-card,
.usage-list,
.usage-empty {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.78);
}

.summary-card {
  padding: 16px;
  border-radius: 20px;
}

.summary-label {
  display: block;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.summary-card strong {
  display: block;
  margin-top: 8px;
  font-size: 22px;
}

.usage-list {
  margin-top: 14px;
  border-radius: 20px;
  overflow: hidden;
}

.usage-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
}

.usage-row + .usage-row {
  border-top: 1px solid var(--color-border);
}

.usage-empty {
  margin-top: 14px;
  padding: 18px;
  border-radius: 20px;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

@media (max-width: 1023px) {
  .chat-page {
    padding: 12px;
  }

  .studio-card {
    min-height: 52vh;
  }
}

@media (max-width: 767px) {
  .chat-page {
    min-height: 100dvh;
    padding: 8px;
    overflow-y: hidden;
    overflow-x: hidden;
  }

  .main-shell {
    gap: 8px;
    height: calc(100dvh - 16px);
    min-height: calc(100dvh - 16px);
    overflow: hidden;
  }

  .topbar,
  .studio-card,
  .composer-card {
    padding: 10px;
  }

  .topbar {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 6px 10px;
    border-radius: 14px;
  }

  .title-block {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .brand-kicker,
  .panel-kicker {
    font-size: 8px;
  }

  h1 {
    font-size: 15px;
  }

  h2 {
    font-size: 11px;
  }

  .topbar-actions {
    width: auto;
    justify-content: flex-end;
    gap: 6px;
  }

  .topbar-actions .rail-btn {
    flex: none;
  }

  .nav-tip {
    grid-column: 1 / -1;
    justify-content: flex-start;
    gap: 4px 10px;
    text-align: left;
    font-size: 10px;
    line-height: 1.35;
  }

  .studio-card {
    flex: 1 1 auto;
    min-height: clamp(220px, 32dvh, 360px);
    border-radius: 18px;
    padding-bottom: 8px;
    overflow: hidden;
  }

  .panel-head {
    margin-bottom: 6px;
  }

  .chat-area {
    min-height: 0;
    height: 100%;
    max-height: 100%;
    overflow-y: auto;
    padding-right: 0;
    padding-bottom: 4px;
  }

  .composer-card {
    flex: 0 0 auto;
  }

  .composer-wrap {
    width: 100%;
    gap: 8px;
  }

  .float-pills {
    display: flex;
    align-items: stretch;
    gap: 6px;
    overflow: visible;
    flex-wrap: wrap;
    padding-bottom: 0;
    -webkit-overflow-scrolling: touch;
  }

  .float-pills::-webkit-scrollbar {
    display: none;
  }

  .pill-bubble {
    min-width: 0;
    padding: 3px 5px;
    width: auto;
    max-width: 100%;
  }

  .pill-model {
    flex: 1 1 calc(100% - 112px);
    min-width: 0;
    border-radius: 12px;
  }

  .pill-switch {
    width: 106px;
  }

  .pill-switch .media-switch {
    width: 100%;
  }

  .pill-switch .switch-btn {
    flex: 1;
  }

  .pill-model :deep(select) {
    min-width: 0;
    padding-right: 28px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ratio-pill-wrap,
  .upload-pill-wrap {
    width: calc(50% - 3px);
  }

  .ratio-pill-wrap {
    flex: 1 1 calc(50% - 3px);
  }

  .upload-pill-wrap {
    flex: 1 1 calc(50% - 3px);
  }

  .upload-mini-row {
    width: 100%;
    min-width: 0;
    gap: 6px;
  }

  .pill-filename {
    flex: 1;
    max-width: none;
  }

  .text-btn {
    flex-shrink: 0;
  }

  .switch-btn,
  .text-btn,
  .pill-filename,
  .reference-input {
    font-size: 10px;
  }

  .switch-btn {
    min-height: 22px;
    padding: 0 8px;
  }

  .ratio-selector {
    width: 100%;
    justify-content: stretch;
  }

  .ratio-current-btn {
    min-width: 0;
    width: auto;
    flex: 1;
    justify-content: center;
    padding: 0 8px;
    font-size: 11px;
  }

  .ratio-preview-btn {
    display: none;
  }

  .ratio-icon {
    transform: scale(0.9);
    transform-origin: center;
  }

  .ratio-dropdown {
    left: 0;
    right: 0;
    bottom: calc(100% + 6px);
    min-width: auto;
  }

  .upload-icon-btn {
    min-width: 92px;
    min-height: 38px;
    padding: 6px 10px;
  }

  .upload-icon-text {
    font-size: 9px;
  }

  .upload-icon-label {
    font-size: 11px;
  }

  .reference-input {
    width: 100%;
    min-width: 0;
  }

  .composer-meta,
  .composer-actions {
    flex-wrap: wrap;
  }

  .input-shell {
    align-items: stretch;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px 10px 12px;
    border-radius: 16px;
    min-height: clamp(180px, 28dvh, 260px);
  }

  .input-shell.expanded {
    min-height: clamp(260px, 42dvh, 420px);
  }

  .input-shell textarea {
    flex: 1 1 auto;
    width: 100%;
    min-height: clamp(150px, 22dvh, 220px);
    max-height: clamp(150px, 24dvh, 240px);
    padding: 0;
    margin: 0;
    font-size: 16px;
    line-height: 1.5;
  }

  .input-shell.expanded textarea {
    min-height: clamp(220px, 34dvh, 360px);
    max-height: clamp(220px, 34dvh, 360px);
  }

  .composer-actions {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    align-self: stretch;
    justify-content: flex-end;
    gap: 6px;
  }

  .polish-btn {
    min-height: 32px;
    padding: 0 12px;
    font-size: 12px;
  }

  .icon-expand-btn {
    width: 32px;
    min-width: 32px;
    height: 32px;
    align-self: center;
  }

  .primary-btn {
    width: 42px;
    min-width: 42px;
    height: 42px;
    min-height: 42px;
    padding: 0;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 20px rgba(0, 113, 227, 0.22);
  }

  .send-btn-text {
    display: none;
  }

  .send-btn-icon {
    font-size: 18px;
    line-height: 1;
  }

  .rail-btn {
    min-width: 60px;
    height: 34px;
    padding: 0 12px;
    font-size: 12px;
  }

  .icon-rail-btn {
    min-width: 34px;
    width: 34px;
    height: 34px;
    padding: 0;
  }

  .usage-summary {
    grid-template-columns: 1fr;
  }
}
</style>
