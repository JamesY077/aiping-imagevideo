<template>
  <div class="setup-page">
    <div class="setup-shell">
      <section class="hero-panel">
        <span class="eyebrow">AI Drawing Workspace</span>
        <h1>更安静、更专注的创作入口。</h1>
        <div class="hero-notes">
          <div class="note-card">
            <span class="note-label">接入方式</span>
            <strong>填写 Base URL 和 API Key 后立即开始</strong>
          </div>
        </div>
      </section>

      <section class="form-panel">
        <div class="form-card">
          <span class="eyebrow">Connect</span>
          <h2>连接你的 AI 能力</h2>
          <p class="form-hint">输入服务地址和 API Key 完成验证，进入创作工作台。</p>

          <div class="input-group">
            <label for="api-base-url">Base URL</label>
            <input
              id="api-base-url"
              v-model="apiBaseUrl"
              class="text-input"
              placeholder="/api/v1 或 https://example.com/v1"
            />
          </div>

          <div class="input-group compact">
            <ApiKeyInput v-model="apiKey" />
          </div>

          <div class="tips">
            <p class="tip-title">获取方式</p>
            <ol>
              <li>Base URL 默认使用 <code>/api/v1</code>，本地启动时推荐保持不变</li>
              <li>访问 <a href="https://aiping.cn" target="_blank">aiping.cn</a> 注册账号</li>
              <li>进入「控制台 → API 密钥」页面</li>
              <li>创建并复制新的 API Key</li>
            </ol>
          </div>

          <button
            class="submit-btn"
            :disabled="!apiBaseUrl.trim() || !apiKey.trim() || isLoading"
            @click="handleSubmit"
          >
            {{ isLoading ? '验证中...' : '进入工作台' }}
          </button>

          <div v-if="error" class="error-msg">{{ error }}</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ApiKeyInput from '@/components/ApiKeyInput.vue'
import { useApiStore } from '@/stores/apiStore'
import { getApiBaseUrl } from '@/api/config'

const router = useRouter()
const apiStore = useApiStore()

const apiKey = ref('')
const apiBaseUrl = ref(getApiBaseUrl())
const isLoading = ref(false)
const error = ref('')

async function handleSubmit() {
  if (!apiBaseUrl.value.trim() || !apiKey.value.trim()) return
  isLoading.value = true
  error.value = ''

  const ok = await apiStore.testAndSave(apiKey.value.trim(), apiBaseUrl.value.trim())
  isLoading.value = false

  if (ok) {
    router.push('/')
  } else {
    error.value = '连接验证失败，请检查 Base URL 和 API Key。'
  }
}
</script>

<style scoped>
.setup-page {
  min-height: 100vh;
  padding: 28px;
}

.setup-shell {
  width: min(100%, var(--content-width));
  margin: 0 auto;
  min-height: calc(100vh - 56px);
  display: grid;
  grid-template-columns: 1.2fr 0.9fr;
  gap: 24px;
}

.hero-panel,
.form-card {
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  box-shadow: var(--color-shadow);
  backdrop-filter: blur(22px);
}

.hero-panel {
  padding: 56px;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  justify-content: center;
  background:
    radial-gradient(circle at 20% 0%, rgba(41, 151, 255, 0.2), transparent 32%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.82));
}

.eyebrow {
  display: inline-flex;
  width: fit-content;
  padding: 8px 14px;
  margin-bottom: 20px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  max-width: 12ch;
  font-size: clamp(40px, 6vw, 72px);
  line-height: 1.02;
  letter-spacing: -0.05em;
}

.hero-copy {
  max-width: 560px;
  margin-top: 22px;
  font-size: 17px;
  line-height: 1.85;
  color: var(--color-text-secondary);
}

.hero-notes {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  margin-top: 56px;
}

.note-card {
  padding: 22px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.6);
}

.note-label {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--color-text-hint);
}

.note-card strong {
  font-size: 18px;
  line-height: 1.5;
}

.form-panel {
  display: flex;
  align-items: center;
}

.form-card {
  width: 100%;
  padding: 40px;
  border-radius: 32px;
}

h2 {
  font-size: 32px;
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.form-hint {
  margin-top: 12px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.input-group {
  margin-top: 28px;
}

.input-group.compact {
  margin-top: 18px;
}

label {
  display: block;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}

.text-input {
  width: 100%;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--color-text);
  transition:
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    background var(--transition-base);
}

.text-input:focus {
  outline: none;
  border-color: rgba(0, 113, 227, 0.35);
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.12);
  background: #fff;
}

.tips {
  margin-top: 22px;
  padding: 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--color-border);
}

.tip-title {
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.tips ol {
  padding-left: 18px;
  color: var(--color-text-secondary);
  line-height: 1.8;
}

.tips code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
  color: var(--color-text);
}

.submit-btn {
  width: 100%;
  min-height: 54px;
  margin-top: 24px;
  border: none;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  transition:
    transform var(--transition-base),
    background var(--transition-base),
    opacity var(--transition-base);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: var(--color-primary-hover);
}

.submit-btn:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.error-msg {
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 18px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  text-align: center;
}

@media (max-width: 1023px) {
  .setup-shell {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .hero-panel,
  .form-card {
    padding: 32px 24px;
  }

  .hero-notes {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .setup-page {
    padding: 16px;
  }

  h1 {
    max-width: 100%;
    font-size: 42px;
  }

  h2 {
    font-size: 28px;
  }
}
</style>
