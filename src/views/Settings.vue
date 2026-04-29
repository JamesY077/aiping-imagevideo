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
        <span class="kicker">Overview</span>
        <h2>保持配置清晰，也让数据更容易浏览。</h2>
        <p>这里延续新的简约风格，重点展示连接状态、调用记录和账号配置。</p>
      </section>

      <section class="card">
        <div class="section-head">
          <span class="kicker">Connection</span>
          <h3>API 配置</h3>
        </div>
        <div class="info-list">
          <div class="row">
            <span class="label">服务地址</span>
            <span class="value fixed">https://api.aiping.cn/v1</span>
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
          <button class="ghost-btn" @click="showEditKey = true">修改 Key</button>
          <button class="primary-btn" :disabled="testing" @click="handleTest">
            {{ testing ? '测试中...' : '测试连接' }}
          </button>
        </div>
        <div v-if="testStatus" :class="['status-msg', testStatusType]">{{ testStatus }}</div>
      </section>

      <section class="card">
        <div class="section-head">
          <span class="kicker">About</span>
          <h3>项目信息</h3>
        </div>
        <div class="info-list">
          <div class="row">
            <span class="label">版本</span>
            <span class="value">v1.0.0</span>
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

    <div v-if="showEditKey" class="modal-overlay" @click.self="showEditKey = false">
      <div class="modal">
        <span class="kicker">Edit Key</span>
        <h3>修改 API Key</h3>
        <ApiKeyInput v-model="newApiKey" />
        <div v-if="editStatus" :class="['status-msg', editStatusType]">{{ editStatus }}</div>
        <div class="btn-row">
          <button class="ghost-btn" @click="showEditKey = false">取消</button>
          <button class="primary-btn" :disabled="!newApiKey || saving" @click="handleSaveKey">
            {{ saving ? '保存中...' : '确认保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import ApiKeyInput from '@/components/ApiKeyInput.vue'
import { useApiStore } from '@/stores/apiStore'
import { useChatStore } from '@/stores/chatStore'
import { maskApiKey } from '@/utils/format'
import { testConnection } from '@/api/aiping'

const router = useRouter()
const apiStore = useApiStore()
const chatStore = useChatStore()

const showEditKey = ref(false)
const newApiKey = ref('')
const saving = ref(false)
const editStatus = ref('')
const editStatusType = ref<'success' | 'error'>('success')

const testing = ref(false)
const testStatus = ref('')
const testStatusType = ref<'success' | 'error'>('success')

const maskedKey = computed(() => (apiStore.apiKey ? maskApiKey(apiStore.apiKey) : '未设置'))

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
    testStatus.value = 'API 连接失败，请检查 API Key。'
    testStatusType.value = 'error'
    apiStore.isConnected = false
  }
}

async function handleSaveKey() {
  if (!newApiKey.value) return
  saving.value = true
  editStatus.value = ''
  const ok = await apiStore.testAndSave(newApiKey.value)
  saving.value = false
  if (ok) {
    editStatus.value = '保存成功。'
    editStatusType.value = 'success'
    setTimeout(() => {
      showEditKey.value = false
      editStatus.value = ''
    }, 900)
  } else {
    editStatus.value = 'API Key 无效，请重新检查。'
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
</script>

<style scoped>
.settings-page {
  min-height: 100vh;
  padding: 20px;
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
  backdrop-filter: blur(14px);
}

.topbar-inner {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  border-radius: 28px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  box-shadow: var(--color-shadow);
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
}

.card {
  padding: 28px;
  border-radius: 32px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  box-shadow: var(--color-shadow);
  backdrop-filter: blur(22px);
}

.hero-card {
  grid-column: 1 / -1;
  background:
    radial-gradient(circle at top left, rgba(0, 113, 227, 0.12), transparent 26%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.82));
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
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--color-border);
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
  border-radius: 24px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.68);
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
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--color-border);
  line-height: 1.8;
}

.info-list {
  overflow: hidden;
  border-radius: 24px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.72);
}

.row {
  padding: 16px 18px;
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
  background: rgba(255, 255, 255, 0.78);
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
  border-radius: 32px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.92);
  box-shadow: var(--color-shadow);
}

.modal h3 {
  margin-bottom: 18px;
  font-size: 28px;
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
  }

  .title-block {
    text-align: left;
  }

  .placeholder {
    display: none;
  }

  .dashboard-summary {
    grid-template-columns: 1fr;
  }
}
</style>
