<template>
  <div class="chat-page">
    <div class="app-shell">
      <aside class="side-rail">
        <div class="rail-top">
          <div class="brand-mark">A</div>
          <button class="rail-btn large-icon" @click="showUsagePanel = true" aria-label="打开用量统计">◔</button>
        </div>

        <div class="rail-bottom">
          <button class="rail-btn large-icon" @click="router.push('/settings')" aria-label="打开设置">⚙</button>
        </div>
      </aside>

      <div class="main-shell">
        <header class="topbar">
          <div class="title-block">
            <span class="brand-kicker">AIDRAW WORKSPACE</span>
            <h1>创作工作台</h1>
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
            />
          </div>
        </section>

        <section class="composer-card">
          <div class="composer-wrap">
            <!-- 悬浮气泡行 -->
            <div class="float-pills">
              <!-- 图片/视频切换 -->
              <div class="pill-bubble">
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
              <div class="pill-bubble">
                <div class="ratio-options">
                  <button
                    v-for="option in ASPECT_RATIO_OPTIONS"
                    :key="option.value"
                    class="ratio-btn"
                    :class="{ active: settingsStore.aspectRatio === option.value }"
                    @click="selectAspectRatio(option.value)"
                  >
                    <span
                      class="ratio-icon"
                      :style="{ width: `${option.boxWidth}px`, height: `${option.boxHeight}px` }"
                    />
                    <span>{{ option.label }}</span>
                  </button>
                </div>
              </div>

              <!-- 素材上传（可选） -->
              <div v-if="showReferenceField" class="pill-bubble">
                <div v-if="isUploadEnabled" class="upload-mini-row">
                  <input
                    ref="fileInput"
                    type="file"
                    :accept="uploadAccept"
                    class="file-input"
                    @change="handleFileChange"
                  />
                  <button class="upload-icon-btn" @click="fileInput?.click()">+</button>
                  <span v-if="uploadedFile" class="pill-filename">{{ uploadedFile.name }}</span>
                  <button v-if="uploadedFile" class="text-btn" @click="uploadedFile = null">✕</button>
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
            <div class="input-shell">
              <textarea
                v-model="inputText"
                :placeholder="inputPlaceholder"
                @keydown.enter.exact.prevent="handleSend"
              />
              <div class="composer-actions">
                <button
                  class="primary-btn"
                  :disabled="!canSend || chatStore.isGenerating"
                  @click="handleSend"
                >
                  {{ chatStore.isGenerating ? '生成中...' : '开始生成' }}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
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
import { useGenerate } from '@/composables/useGenerate'
import {
  ASPECT_RATIO_OPTIONS,
  getLocalUploadAccept,
  getModelCapability,
  modelRequiresReference,
  modelSupportsLocalUpload,
  type MediaType,
} from '@/types/model'
import { formatCost } from '@/utils/format'
import type { Message, UploadedFile } from '@/types/chat'
import type { ModelIOType } from '@/types/model'

const router = useRouter()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()
const { generate } = useGenerate()

const inputText = ref('')
const chatAreaRef = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const uploadedFile = ref<UploadedFile | null>(null)
const referenceUrl = ref('')
const showUsagePanel = ref(false)

const isUploadEnabled = computed(() => modelSupportsLocalUpload(settingsStore.selectedModel))
const requiresUpload = computed(() => modelRequiresReference(settingsStore.selectedModel))
const showReferenceUrlInput = computed(() => requiresUpload.value && !isUploadEnabled.value)
const showReferenceField = computed(() => isUploadEnabled.value || showReferenceUrlInput.value)

const uploadAccept = computed(() => getLocalUploadAccept(settingsStore.selectedModel) || 'image/*,video/*')

const inputPlaceholder = computed(() => {
  if (settingsStore.mediaType === 'image' && uploadedFile.value) {
    return '描述你想如何修改这张图片，例如构图、风格、光线、材质。'
  }
  if (settingsStore.mediaType === 'video' && uploadedFile.value) {
    return '描述这段素材如何延展成视频，例如镜头、动作、节奏、情绪。'
  }
  return settingsStore.mediaType === 'image'
    ? '写下图片创作需求，例如主体、场景、构图、光线和风格。'
    : '写下视频创作需求，例如场景、运动方式、镜头语言和时长氛围。'
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

function resolveIoType(file?: UploadedFile | null): ModelIOType {
  const hasReference = !!file
  if (settingsStore.mediaType === 'image') {
    return hasReference ? 'image2image' : 'text2image'
  }
  return hasReference ? 'image2video' : 'text2video'
}

function handleMediaTypeChange(nextType: MediaType) {
  settingsStore.setMediaType(nextType)
  uploadedFile.value = null
  referenceUrl.value = ''
}

function selectAspectRatio(value: string) {
  settingsStore.aspectRatio = value
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
    alert('仅支持图片和视频文件')
    return
  }

  if (isImage && !capability?.localUploadInputs?.includes('image')) {
    alert('当前模型不支持本地图片上传')
    return
  }

  if (isVideo && !capability?.localUploadInputs?.includes('video')) {
    alert('当前模型不支持本地视频上传')
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

onMounted(() => {
  settingsStore.loadFromStorage()
  if (chatStore.messages.length === 0) {
    chatStore.addMessage({
      type: 'system',
      content: '欢迎来到新的简约版创作工作台。选择生成模式，输入提示词，就可以开始。',
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
  }
)

async function handleSend() {
  const prompt = inputText.value.trim()
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
  const ioType = resolveIoType(file)

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
      resolveIoType(userMsg.uploadedFile),
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
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden;
}

.app-shell {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - 40px);
}

.side-rail,
.topbar,
.studio-card,
.usage-panel {
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  box-shadow: var(--color-shadow);
  backdrop-filter: blur(22px);
}

.side-rail {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 18px 0;
  border-radius: 28px;
}

.rail-top,
.rail-bottom {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.brand-mark,
.rail-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 16px;
}

.large-icon {
  font-size: 24px;
}

.brand-mark {
  background: linear-gradient(135deg, #0f172a, #334155);
  color: #fff;
  font-weight: 800;
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

.rail-btn.small {
  width: 36px;
  height: 36px;
  border-radius: 12px;
}

.main-shell {
  display: grid;
  grid-template-rows: calc(10vh - 13px) minmax(0, 1fr) auto;
  gap: 16px;
  min-height: 0;
  height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px;
  border-radius: 20px;
  overflow: hidden;
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
  overflow: hidden;
}

.panel-head {
  margin-bottom: 4px;
}

.chat-area {
  min-height: 0;
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
}

/* 宽度70%居中的包裹容器 */
.composer-wrap {
  width: 70%;
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
  min-width: 160px;
  border-radius: 14px;
  padding: 2px 6px;
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
  gap: 6px;
  min-height: 24px;
}

.file-input {
  display: none;
}

.pill-filename {
  font-size: 11px;
  color: var(--color-text-secondary);
  max-width: 100px;
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
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.72);
  width: 24px;
  min-width: 24px;
  height: 24px;
  padding: 0;
  font-size: 14px;
  line-height: 1;
  color: var(--color-text);
  border-radius: 50%;
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

.ratio-options {
  display: flex;
  gap: 4px;
  flex-wrap: nowrap;
}

.ratio-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 0 8px;
  font-size: 11px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text-secondary);
}

.ratio-btn.active {
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
  padding: 6px 6px 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: 20px;
  background: var(--color-bg-elevated);
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(22px);
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-height: 52px;
}

.input-shell textarea {
  flex: 1;
  min-height: 32px;
  max-height: 120px;
  padding: 4px 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  line-height: 1.6;
  font-size: 13px;
  overflow-y: auto;
}

.composer-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.primary-btn {
  border: none;
  background: var(--color-primary);
  color: #fff;
  font-weight: 700;
  min-height: 34px;
  padding: 0 16px;
  border-radius: 14px;
  font-size: 13px;
}

.primary-btn:hover,
.upload-icon-btn:hover,
.ratio-btn:hover,
.rail-btn:hover {
  transform: translateY(-1px);
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

  .app-shell {
    grid-template-columns: 1fr;
    height: auto;
  }

  .side-rail {
    flex-direction: row;
    padding: 14px;
  }

  .rail-top,
  .rail-bottom {
    flex-direction: row;
  }

  .main-shell {
    grid-template-rows: auto auto auto;
  }

  .studio-card {
    min-height: 52vh;
  }

  .toolbar-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .topbar,
  .studio-card,
  .composer-card {
    padding: 16px;
  }

  .composer-meta,
  .composer-actions {
    flex-wrap: wrap;
  }

  .usage-summary {
    grid-template-columns: 1fr;
  }

  .primary-btn {
    width: 100%;
  }
}
</style>
