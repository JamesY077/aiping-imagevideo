<template>
  <div class="settings-page">
    <header class="topbar">
      <div class="topbar-inner">
        <button class="ghost-btn" @click="router.back()">返回工作台</button>
        <div class="title-block">
          <span class="kicker">系统</span>
          <h1>工作台设置</h1>
        </div>
      </div>
    </header>

    <main class="content">
      <section class="hero-card">
        <div>
          <span class="kicker">控制中心</span>
          <h2>统一管理你的生成环境，保持清晰、稳定、随时可用。</h2>
        </div>
        <p>在一个简洁的设置界面中管理 API 访问、提示词优化与项目级配置。</p>
      </section>

      <section class="card">
        <div class="section-head">
          <span class="kicker">连接</span>
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
            <span class="label">API 密钥</span>
            <span class="value">{{ maskedKeyText }}</span>
          </div>
          <div class="row">
            <span class="label">状态</span>
            <span :class="['status', apiStore.isConnected ? 'connected' : 'unknown']">
              {{ apiStore.isConnected ? '已连接' : '未验证' }}
            </span>
          </div>
        </div>
        <div class="btn-row">
          <button class="ghost-btn" @click="openEditConfig">编辑配置</button>
          <button class="primary-btn" :disabled="testing" @click="handleTest">
            {{ testing ? '正在测试...' : '测试连接' }}
          </button>
        </div>
        <div v-if="testStatus" :class="['status-msg', testStatusType]">{{ testStatus }}</div>
      </section>

      <section class="card">
        <div class="section-head">
          <span class="kicker">提示词优化</span>
          <h3>提示词增强</h3>
        </div>
        <div class="input-group">
          <label for="polish-model">优化模型 ID</label>
          <input
            id="polish-model"
            v-model.trim="settingsStore.promptPolishModel"
            class="text-input"
            placeholder="请输入用于提示词优化的模型 ID"
            @blur="settingsStore.saveToStorage()"
          />
          <a href="https://www.aiping.cn/modelList" target="_blank" rel="noopener" class="helper-link">
            查看官方模型列表
          </a>
        </div>
        <div class="input-group">
          <label for="polish-system-prompt">系统提示词</label>
          <textarea
            id="polish-system-prompt"
            v-model.trim="settingsStore.promptPolishSystemPrompt"
            class="text-area"
            :placeholder="defaultPolishSystemPrompt"
            @blur="settingsStore.saveToStorage()"
          />
          <p class="field-hint">留空时将使用默认优化提示词。</p>
        </div>
        <div class="btn-row">
          <button class="ghost-btn" @click="resetPolishPrompt">恢复默认</button>
          <button class="primary-btn" @click="savePolishSettings">保存提示词设置</button>
        </div>
        <div v-if="polishStatus" class="status-msg success">{{ polishStatus }}</div>
      </section>

      <section class="card about-card">
        <div class="section-head">
          <span class="kicker">关于</span>
          <h3>项目信息</h3>
        </div>
        <div class="info-list">
          <div class="row">
            <span class="label">版本</span>
            <span class="value">v1.2.0</span>
          </div>
          <div class="row">
            <span class="label">文档</span>
            <a href="https://aiping.cn/docs" target="_blank" rel="noopener" class="link">aiping.cn/docs</a>
          </div>
        </div>
      </section>

      <section class="card danger-card">
        <div class="section-head">
          <span class="kicker">重置</span>
          <h3>退出登录并清除本地会话</h3>
        </div>
        <p class="danger-copy">这会从当前浏览器中移除 API 配置以及本地会话记录。</p>
        <button class="danger-btn" @click="handleClear">清除并退出登录</button>
      </section>
    </main>

    <div v-if="showEditConfig" class="modal-overlay" @click.self="showEditConfig = false">
      <div class="modal">
        <span class="kicker">编辑配置</span>
        <h3>更新 API 访问信息</h3>
        <div class="input-group">
          <label for="edit-base-url">服务地址</label>
          <input
            id="edit-base-url"
            v-model="newApiBaseUrl"
            class="text-input"
            readonly
            placeholder="https://aiping.cn/api/v1"
          />
        </div>
        <ApiKeyInput v-model="newApiKey" />
        <div v-if="editStatus" :class="['status-msg', editStatusType]">{{ editStatus }}</div>
        <div class="btn-row">
          <button class="ghost-btn" @click="showEditConfig = false">取消</button>
          <button class="primary-btn" :disabled="!newApiBaseUrl || !newApiKey || saving" @click="handleSaveConfig">
            {{ saving ? '正在保存...' : '保存修改' }}
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
import { AIPING_PUBLIC_API_BASE_URL } from '@/api/config'

const router = useRouter()
const apiStore = useApiStore()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const showEditConfig = ref(false)
const newApiKey = ref('')
const newApiBaseUrl = ref('')
const saving = ref(false)
const editStatus = ref('')
const editStatusType = ref<'success' | 'error'>('success')

const testing = ref(false)
const testStatus = ref('')
const testStatusType = ref<'success' | 'error'>('success')
const polishStatus = ref('')
const defaultPolishSystemPrompt = DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT

const maskedKeyText = computed(() => (apiStore.apiKey ? maskApiKey(apiStore.apiKey) : '未设置'))

onMounted(() => {
  settingsStore.loadFromStorage()
})

function openEditConfig() {
  newApiBaseUrl.value = AIPING_PUBLIC_API_BASE_URL
  newApiKey.value = apiStore.apiKey || ''
  editStatus.value = ''
  showEditConfig.value = true
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
    testStatus.value = '连接失败，请检查 API Key 是否正确。'
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
    editStatus.value = '连接验证失败，请检查 API Key 是否正确。'
    editStatusType.value = 'error'
  }
}

function handleClear() {
  if (confirm('确定要清除配置并退出吗？')) {
    apiStore.clear()
    chatStore.clearMessages()
    router.push('/landing')
  }
}

function savePolishSettings() {
  settingsStore.saveToStorage()
  polishStatus.value = '提示词设置已保存。'
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
  min-height: 100dvh;
  padding: 20px;
}

.topbar-inner,
.content,
.modal {
  width: min(100%, var(--content-width));
  margin: 0 auto;
}

.topbar {
  padding-bottom: 18px;
}

.topbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 20px 24px;
  border: 1px solid var(--color-border);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: var(--color-shadow-soft);
  backdrop-filter: blur(24px);
}

.title-block {
  flex: 1;
}

.kicker {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-text-hint);
}

h1,
h2,
h3 {
  color: var(--color-text);
  letter-spacing: -0.04em;
}

h1 {
  font-size: 28px;
}

.content {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
  padding-bottom: 24px;
}

.hero-card,
.card {
  border: 1px solid var(--color-border);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: var(--color-shadow-soft);
  backdrop-filter: blur(24px);
}

.hero-card {
  grid-column: 1 / -1;
  padding: 34px 32px;
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 18px;
  align-items: end;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.12), transparent 26%),
    rgba(255, 255, 255, 0.82);
}

.hero-card h2 {
  max-width: 12ch;
  margin-top: 10px;
  font-size: clamp(34px, 4.4vw, 56px);
  line-height: 0.98;
}

.hero-card p,
.danger-copy {
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.card {
  padding: 28px;
}

.section-head {
  margin-bottom: 18px;
}

.section-head h3 {
  margin-top: 8px;
  font-size: 24px;
}

.info-list {
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 22px;
  background: rgba(244, 247, 251, 0.7);
}

.row,
.btn-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.row {
  padding: 16px 18px;
}

.row + .row {
  border-top: 1px solid rgba(148, 163, 184, 0.14);
}

.row-service-url {
  align-items: stretch;
}

.service-url-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.label,
.field-hint,
.helper-link {
  color: var(--color-text-secondary);
  font-size: 13px;
}

.value,
.link {
  color: var(--color-text);
}

.service-url-value {
  display: block;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  word-break: break-all;
}

.status {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 12px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 700;
}

.status.connected {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.status.unknown {
  background: rgba(148, 163, 184, 0.14);
  color: var(--color-text-secondary);
}

.ghost-btn,
.primary-btn,
.danger-btn {
  min-height: 44px;
  padding: 0 18px;
  border-radius: var(--radius-pill);
  font-size: 14px;
  font-weight: 700;
  transition:
    transform var(--transition-base),
    background var(--transition-base),
    border-color var(--transition-base),
    opacity var(--transition-base);
}

.ghost-btn {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.72);
  color: var(--color-text);
}

.primary-btn {
  border: none;
  background: linear-gradient(135deg, #0f172a, #2563eb);
  color: #fff;
}

.danger-btn {
  margin-top: 18px;
  border: none;
  background: #dc2626;
  color: #fff;
}

.ghost-btn:hover,
.primary-btn:hover,
.danger-btn:hover {
  transform: translateY(-1px);
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

.input-group {
  margin-bottom: 18px;
}

label {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.text-input,
.text-area {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.84);
  color: var(--color-text);
  transition:
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    background var(--transition-base);
}

.text-input {
  min-width: 0;
  padding: 14px 16px;
}

.text-area {
  min-height: 132px;
  padding: 16px 18px;
  line-height: 1.72;
  resize: vertical;
  outline: none;
}

.text-input:read-only {
  color: var(--color-text-secondary);
}

.text-input:focus,
.text-area:focus {
  outline: none;
  border-color: rgba(37, 99, 235, 0.34);
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
  background: rgba(255, 255, 255, 0.96);
}

.helper-link {
  display: inline-block;
  margin-top: 10px;
  color: var(--color-accent);
}

.about-card,
.danger-card {
  grid-column: span 1;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(10px);
}

.modal {
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
}

.modal h3 {
  margin-top: 8px;
  margin-bottom: 18px;
  font-size: 30px;
}

@media (max-width: 1023px) {
  .content {
    grid-template-columns: 1fr;
  }

  .hero-card,
  .about-card,
  .danger-card {
    grid-column: 1 / -1;
  }

  .hero-card {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .settings-page {
    padding: 12px;
  }

  .topbar-inner,
  .hero-card,
  .card,
  .modal {
    padding: 20px 16px;
    border-radius: 22px;
  }

  .topbar-inner,
  .row,
  .btn-row {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-card h2 {
    max-width: 100%;
    font-size: clamp(30px, 9vw, 42px);
  }

  h1 {
    font-size: 24px;
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
  }
}
</style>
