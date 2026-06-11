<template>
  <div class="settings-page">
    <header class="topbar">
      <div class="topbar-inner">
        <button class="ghost-btn" @click="router.back()">返回工作台</button>
        <div class="title-block">
          <span class="kicker">Settings</span>
          <h1>设置与概览</h1>
        </div>
        <span class="placeholder" />
      </div>
    </header>

    <main class="content">
      <section class="card hero-card">
        <span class="kicker">Settings</span>
        <h2>设置中心</h2>
        <p>在这里可以进行连接状态查询、调用记录和账号配置。</p>
      </section>

      <section class="card">
        <div class="section-head">
          <span class="kicker">Connection</span>
          <h3>API 配置</h3>
        </div>
        <div class="info-list">
          <div class="row row-service-url">
            <div class="service-url-block">
              <span class="label">服务地址</span>
              <span class="service-url-value">{{ apiStore.apiBaseUrl }}</span>
            </div>
          </div>
          <div class="row">
            <span class="label">API Key</span>
            <span class="value">{{ maskedKey }}</span>
          </div>
          <div class="row">
            <span class="label">连接状态</span>
            <span :class="['status', apiStore.isConnected ? 'connected' : 'unknown']">
              {{ apiStore.isConnected ? '已连接' : '未验证' }}
            </span>
          </div>
        </div>
        <div class="btn-row">
          <button class="ghost-btn" @click="openEditConfig">修改配置</button>
          <button class="primary-btn" :disabled="testing" @click="handleTest">
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
        </div>
        <div v-if="testStatus" :class="['status-msg', testStatusType]">{{ testStatus }}</div>
      </section>

      <section class="card">
        <div class="section-head">
          <span class="kicker">Prompt Model</span>
          <h3>AI 润色</h3>
        </div>
        <div class="input-group">
          <label for="polish-model">润色模型 ID</label>
          <input
            id="polish-model"
            v-model.trim="settingsStore.promptPolishModel"
            class="text-input"
            placeholder="填写用于润色提示词的模型 ID"
            @blur="settingsStore.saveToStorage()"
          />
          <a href="https://www.aiping.cn/modelList" target="_blank" rel="noopener" class="helper-link">
            查看 AIPing 模型列表
          </a>
        </div>
        <div class="input-group">
          <label for="polish-system-prompt">System Prompt</label>
          <textarea
            id="polish-system-prompt"
            v-model.trim="settingsStore.promptPolishSystemPrompt"
            class="text-area"
            :placeholder="defaultPolishSystemPrompt"
            @blur="settingsStore.saveToStorage()"
          />
          <p class="field-hint">留空时会使用默认润色模板。</p>
        </div>
        <div class="btn-row">
          <button class="ghost-btn" @click="resetPolishPrompt">恢复默认模板</button>
          <button class="primary-btn" @click="savePolishSettings">保存润色设置</button>
        </div>
        <div v-if="polishStatus" class="status-msg success">{{ polishStatus }}</div>
      </section>

      <section class="card">
        <div class="section-head">
          <span class="kicker">About</span>
          <h3>项目信息</h3>
        </div>
        <div class="info-list">
          <div class="row">
            <span class="label">版本</span>
            <span class="value">v1.2.0</span>
          </div>
          <div class="row">
            <span class="label">API 文档</span>
            <a href="https://aiping.cn/docs" target="_blank" class="link">aiping.cn/docs</a>
          </div>
        </div>
      </section>

      <section class="card danger-card">
        <div class="section-head">
          <span class="kicker">Danger Zone</span>
          <h3>账号操作</h3>
        </div>
        <p class="danger-copy">清除本地配置后将退出当前登录状态，并移除当前会话记录。</p>
        <button class="danger-btn" @click="handleClear">清除配置并退出</button>
      </section>
    </main>

    <div v-if="showEditConfig" class="modal-overlay" @click.self="showEditConfig = false">
      <div class="modal">
        <span class="kicker">Edit Config</span>
        <h3>修改 API 配置</h3>
        <div class="input-group">
          <label for="edit-base-url">Base URL</label>
          <div class="base-url-switch" aria-label="选择 Base URL 类型">
            <button
              type="button"
              :class="{ active: editBaseUrlMode === 'aiping' }"
              @click="selectEditBaseUrlMode('aiping')"
            >
              AIPing
            </button>
            <button
              type="button"
              :class="{ active: editBaseUrlMode === 'custom' }"
              @click="selectEditBaseUrlMode('custom')"
            >
              自定义
            </button>
          </div>
          <input
            id="edit-base-url"
            v-model="newApiBaseUrl"
            class="text-input"
            :readonly="editBaseUrlMode === 'aiping'"
            :placeholder="editBaseUrlMode === 'aiping' ? 'https://aiping.cn/api/v1' : 'https://example.com/v1'"
          />
        </div>
        <ApiKeyInput v-model="newApiKey" />
        <div v-if="editStatus" :class="['status-msg', editStatusType]">{{ editStatus }}</div>
        <div class="btn-row">
          <button class="ghost-btn" @click="showEditConfig = false">取消</button>
          <button class="primary-btn" :disabled="!newApiBaseUrl || !newApiKey || saving" @click="handleSaveConfig">
            {{ saving ? '保存中...' : '确认保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import ApiKeyInput from '@/components/ApiKeyInput.vue'
import { useApiStore } from '@/stores/apiStore'
import { useChatStore } from '@/stores/chatStore'
import { DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT, useSettingsStore } from '@/stores/settingsStore'
import { maskApiKey } from '@/utils/format'
import { testConnection } from '@/api/aiping'
import { AIPING_PUBLIC_API_BASE_URL, isAipingBaseUrl } from '@/api/config'

const router = useRouter()
const apiStore = useApiStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

type BaseUrlMode = 'aiping' | 'custom'

const showEditConfig = ref(false)
const newApiKey = ref('')
const newApiBaseUrl = ref('')
const editBaseUrlMode = ref<BaseUrlMode>('aiping')
const saving = ref(false)
const editStatus = ref('')
const editStatusType = ref<'success' | 'error'>('success')

const testing = ref(false)
const testStatus = ref('')
const testStatusType = ref<'success' | 'error'>('success')
const polishStatus = ref('')
const defaultPolishSystemPrompt = DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT

const maskedKey = computed(() => (apiStore.apiKey ? maskApiKey(apiStore.apiKey) : '未设置'))

onMounted(() => {
  settingsStore.loadFromStorage()
})

function openEditConfig() {
  newApiBaseUrl.value = apiStore.apiBaseUrl
  editBaseUrlMode.value = isAipingBaseUrl(newApiBaseUrl.value) ? 'aiping' : 'custom'
  newApiKey.value = apiStore.apiKey || ''
  editStatus.value = ''
  showEditConfig.value = true
}

function selectEditBaseUrlMode(mode: BaseUrlMode) {
  editBaseUrlMode.value = mode
  if (mode === 'aiping') {
    newApiBaseUrl.value = AIPING_PUBLIC_API_BASE_URL
  } else if (isAipingBaseUrl(newApiBaseUrl.value)) {
    newApiBaseUrl.value = ''
  }
}

async function handleTest() {
  testing.value = true
  testStatus.value = ''
  const ok = await testConnection()
  testing.value = false
  if (ok) {
    testStatus.value = 'API 连接成功。'
    testStatusType.value = 'success'
    apiStore.isConnected = true
  } else {
    testStatus.value = 'API 连接失败，请检查 Base URL 和 API Key。'
    testStatusType.value = 'error'
    apiStore.isConnected = false
  }
}

async function handleSaveConfig() {
  if (!newApiBaseUrl.value || !newApiKey.value) return
  saving.value = true
  editStatus.value = ''
  const ok = await apiStore.testAndSave(newApiKey.value, newApiBaseUrl.value)
  saving.value = false
  if (ok) {
    editStatus.value = '保存成功。'
    editStatusType.value = 'success'
    setTimeout(() => {
      showEditConfig.value = false
      editStatus.value = ''
    }, 900)
  } else {
    editStatus.value = '连接验证失败，请检查 Base URL 和 API Key。'
    editStatusType.value = 'error'
  }
}

function handleClear() {
  if (confirm('确定要清除配置并退出吗？')) {
    apiStore.clear()
    chatStore.clearMessages()
    router.push('/setup')
  }
}

function savePolishSettings() {
  settingsStore.saveToStorage()
  polishStatus.value = '润色设置已保存。'
  setTimeout(() => {
    polishStatus.value = ''
  }, 1200)
}

function resetPolishPrompt() {
  settingsStore.promptPolishSystemPrompt = ''
  savePolishSettings()
}
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 20px;
  background:
    linear-gradient(180deg, #f7f9fc 0%, #eef4fb 48%, #f7f9fc 100%);
  color: var(--color-text);
}

.topbar-inner,
.content,
.modal {
  width: min(100%, var(--content-width));
  margin: 0 auto;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  padding-bottom: 16px;
  background: linear-gradient(180deg, rgba(247, 249, 252, 0.96), rgba(247, 249, 252, 0.72));
  backdrop-filter: blur(14px);
}

.topbar-inner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  border-radius: 22px;
  border: 1px solid rgba(176, 190, 207, 0.58);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 12px 32px rgba(31, 41, 55, 0.08);
}

.title-block {
  text-align: center;
}

.kicker {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
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
  font-size: 24px;
}

.content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px;
  padding-bottom: 28px;
}

.card {
  padding: 28px;
  border-radius: 24px;
  border: 1px solid rgba(176, 190, 207, 0.58);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 14px 34px rgba(31, 41, 55, 0.08);
  backdrop-filter: blur(16px);
}

.hero-card {
  grid-column: 1 / -1;
  background:
    linear-gradient(135deg, rgba(0, 113, 227, 0.12), transparent 34%),
    linear-gradient(180deg, #fff, rgba(247, 250, 253, 0.94));
}

.hero-card h2 {
  max-width: 12ch;
  font-size: clamp(32px, 4vw, 48px);
  line-height: 1.05;
}

.hero-card p,
.danger-copy {
  margin-top: 12px;
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.section-head {
  margin-bottom: 18px;
}

.section-head h3 {
  font-size: 22px;
}

.dashboard-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.summary-item {
  padding: 20px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid rgba(176, 190, 207, 0.5);
}

.summary-label,
.label,
.record-header,
.empty-state {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.summary-value {
  display: block;
  margin-top: 8px;
  font-size: 28px;
  line-height: 1.1;
}

.records-list {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(176, 190, 207, 0.5);
  background: #f8fafc;
}

.record-header,
.record-row,
.row,
.btn-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.record-header,
.record-row {
  padding: 14px 18px;
}

.record-header {
  border-bottom: 1px solid var(--color-border);
}

.record-row + .record-row,
.row + .row {
  border-top: 1px solid var(--color-border);
}

.record-model,
.value,
.link {
  color: var(--color-text);
}

.record-cost {
  color: var(--color-danger);
  font-weight: 700;
}

.empty-state {
  padding: 20px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid rgba(176, 190, 207, 0.5);
  line-height: 1.8;
}

.info-list {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(176, 190, 207, 0.5);
  background: #f8fafc;
}

.row {
  padding: 16px 18px;
}

.row-service-url {
  align-items: stretch;
}

.service-url-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
}

.service-url-value {
  display: block;
  width: 100%;
  padding: 14px 16px;
  border-radius: 14px;
  border: 1px solid rgba(176, 190, 207, 0.5);
  background: rgba(255, 255, 255, 0.92);
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  word-break: break-all;
  overflow-wrap: anywhere;
}

.fixed {
  color: var(--color-text-secondary);
}

.status {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}

.status.connected {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.status.unknown {
  background: rgba(29, 29, 31, 0.06);
  color: var(--color-text-secondary);
}

.ghost-btn,
.primary-btn,
.danger-btn {
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  transition:
    transform var(--transition-base),
    background var(--transition-base),
    border-color var(--transition-base),
    opacity var(--transition-base);
}

.ghost-btn,
.primary-btn {
  border: 1px solid var(--color-border);
}

.ghost-btn {
  background: #fff;
  color: var(--color-text);
}

.primary-btn {
  border-color: transparent;
  background: var(--color-primary);
  color: #fff;
}

.danger-btn {
  margin-top: 18px;
  border: none;
  background: var(--color-danger);
  color: #fff;
}

.ghost-btn:hover,
.primary-btn:hover,
.danger-btn:hover {
  transform: translateY(-1px);
}

.primary-btn:hover {
  background: var(--color-primary-hover);
}

.btn-row {
  margin-top: 18px;
  flex-wrap: wrap;
}

.status-msg {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 18px;
  font-size: 14px;
}

.status-msg.success {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.status-msg.error {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.danger-card {
  grid-column: 1 / -1;
}

.placeholder {
  width: 96px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(8, 8, 10, 0.18);
  backdrop-filter: blur(10px);
}

.modal {
  padding: 28px;
  border-radius: 24px;
  border: 1px solid rgba(176, 190, 207, 0.58);
  background: #fff;
  box-shadow: 0 20px 52px rgba(15, 23, 42, 0.18);
}

.modal h3 {
  margin-bottom: 18px;
  font-size: 28px;
}

.input-group {
  margin-bottom: 18px;
}

label {
  display: block;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}

.base-url-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
  padding: 4px;
  border: 1px solid rgba(176, 190, 207, 0.5);
  border-radius: 18px;
  background: #f8fafc;
}

.base-url-switch button {
  min-height: 38px;
  border: none;
  border-radius: 14px;
  background: transparent;
  color: var(--color-text-secondary);
  font-weight: 700;
  transition:
    background var(--transition-base),
    color var(--transition-base),
    box-shadow var(--transition-base);
}

.base-url-switch button.active {
  background: #fff;
  color: var(--color-text);
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.text-input {
  width: 100%;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid rgba(176, 190, 207, 0.62);
  border-radius: 18px;
  background: #fff;
  color: var(--color-text);
  transition:
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    background var(--transition-base);
}

.text-input:read-only {
  color: var(--color-text-secondary);
}

.text-input:focus {
  outline: none;
  border-color: rgba(0, 113, 227, 0.35);
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.12);
  background: #fff;
}

.text-area {
  width: 100%;
  min-height: 132px;
  padding: 16px 18px;
  border: 1px solid rgba(176, 190, 207, 0.62);
  border-radius: 18px;
  background: #fff;
  color: var(--color-text);
  line-height: 1.7;
  resize: vertical;
  outline: none;
}

.text-area:focus {
  border-color: rgba(0, 113, 227, 0.35);
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.12);
  background: #fff;
}

.helper-link,
.field-hint {
  display: inline-block;
  margin-top: 10px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.helper-link {
  color: var(--color-primary);
}

@media (max-width: 1023px) {
  .content {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .settings-page {
    padding: 12px;
  }

  .topbar-inner,
  .card,
  .modal {
    padding: 20px;
    border-radius: 24px;
  }

  .topbar-inner {
    grid-template-columns: 1fr;
    justify-items: start;
  }

  .title-block {
    text-align: left;
  }

  h1 {
    font-size: 20px;
  }

  .content {
    gap: 14px;
  }

  .section-head h3 {
    font-size: 20px;
  }

  .hero-card h2 {
    max-width: 100%;
    font-size: clamp(28px, 8vw, 36px);
  }

  .row,
  .btn-row {
    align-items: stretch;
    flex-direction: column;
  }

  .row {
    padding: 14px 16px;
  }

  .service-url-block {
    gap: 8px;
  }

  .service-url-value {
    padding: 12px 14px;
    font-size: 12px;
    line-height: 1.55;
    border-radius: 12px;
  }

  .value,
  .link,
  .fixed {
    width: 100%;
    word-break: break-word;
  }

  .ghost-btn,
  .primary-btn,
  .danger-btn {
    width: 100%;
  }

  .modal-overlay {
    padding: 12px;
    align-items: flex-end;
  }

  .modal {
    width: 100%;
    max-height: min(88dvh, 720px);
    overflow-y: auto;
    border-radius: 24px 24px 0 0;
  }

  .modal h3 {
    font-size: 24px;
  }

  .placeholder {
    display: none;
  }

  .dashboard-summary {
    grid-template-columns: 1fr;
  }
}
</style>
