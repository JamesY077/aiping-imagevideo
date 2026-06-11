<template>
  <div class="setup-page">
    <div class="setup-shell">
      <section class="hero-panel">
        <span class="eyebrow">ArtRealm Workspace</span>
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
            <div class="base-url-switch" aria-label="选择 Base URL 类型">
              <button
                type="button"
                :class="{ active: baseUrlMode === 'official' }"
                @click="selectBaseUrlMode('official')"
              >
                aiping
              </button>
              <button
                type="button"
                :class="{ active: baseUrlMode === 'custom' }"
                @click="selectBaseUrlMode('custom')"
              >
                自定义
              </button>
            </div>
            <input
              id="api-base-url"
              v-model="apiBaseUrl"
              class="text-input"
              :readonly="baseUrlMode === 'official'"
              :placeholder="baseUrlMode === 'official' ? 'https://aiping.cn/api/v1' : 'https://example.com/v1'"
            />
          </div>

          <div class="input-group compact">
            <ApiKeyInput v-model="apiKey" />
          </div>

          <div class="tips">
            <p class="tip-title">获取方式</p>
            <ol>
              <li>推荐使用 AI Ping，保持默认 Base URL：<code>https://aiping.cn/api/v1</code></li>
              <li>访问 <a href="https://aiping.cn" target="_blank">AI Ping 官方平台</a> 注册账号，并在控制台创建 API Key</li>
              <li>使用其他 OpenAI 兼容服务时，切换到「自定义」并填写对应 Base URL</li>
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
import { AIPING_PUBLIC_API_BASE_URL, getApiBaseUrlInputValue, isAipingBaseUrl } from '@/api/config'

const router = useRouter()
const apiStore = useApiStore()

type BaseUrlMode = 'official' | 'custom'

const apiKey = ref('')
const initialBaseUrl = getApiBaseUrlInputValue()
const baseUrlMode = ref<BaseUrlMode>(isAipingBaseUrl(initialBaseUrl) ? 'official' : 'custom')
const apiBaseUrl = ref(initialBaseUrl)
const isLoading = ref(false)
const error = ref('')

function selectBaseUrlMode(mode: BaseUrlMode) {
  baseUrlMode.value = mode
  if (mode === 'official') {
    apiBaseUrl.value = AIPING_PUBLIC_API_BASE_URL
  } else if (isAipingBaseUrl(apiBaseUrl.value)) {
    apiBaseUrl.value = ''
  }
}

async function handleSubmit() {
  if (!apiBaseUrl.value.trim() || !apiKey.value.trim()) return
  isLoading.value = true
  error.value = ''

  const ok = await apiStore.testAndSave(apiKey.value.trim(), apiBaseUrl.value.trim())
  isLoading.value = false

  if (ok) {
    router.push('/')
  } else {
    error.value = apiStore.connectionError || '连接验证失败，请检查 Base URL 和 API Key。'
  }
}
</script>

<style scoped>
.setup-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 20px;
}

.setup-shell {
  width: min(100%, var(--content-width));
  margin: 0 auto;
  min-height: calc(100vh - 40px);
  min-height: calc(100dvh - 40px);
  display: grid;
  grid-template-columns: 1.2fr 0.9fr;
  gap: 18px;
}

.hero-panel,
.form-card {
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  box-shadow: var(--color-shadow);
  backdrop-filter: blur(22px);
}

.hero-panel {
  padding: 40px;
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
  padding: 6px 12px;
  margin-bottom: 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  max-width: 12ch;
  font-size: clamp(32px, 5vw, 56px);
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
  gap: 12px;
  margin-top: 28px;
}

.note-card {
  padding: 18px;
  border-radius: 20px;
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
  font-size: 16px;
  line-height: 1.5;
}

.form-panel {
  display: flex;
  align-items: center;
}

.form-card {
  width: 100%;
  padding: 28px;
  border-radius: 28px;
}

h2 {
  font-size: 28px;
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.form-hint {
  margin-top: 8px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  font-size: 14px;
}

.input-group {
  margin-top: 20px;
}

.input-group.compact {
  margin-top: 14px;
}

label {
  display: block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}

.base-url-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 10px;
  padding: 4px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.68);
}

.base-url-switch button {
  min-height: 34px;
  border: none;
  border-radius: 12px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
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
  padding: 14px 16px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--color-text);
  font-size: 14px;
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

.tips {
  margin-top: 16px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid var(--color-border);
}

.tip-title {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
}

.tips ol {
  padding-left: 16px;
  color: var(--color-text-secondary);
  line-height: 1.65;
  font-size: 13px;
}

.submit-btn {
  width: 100%;
  min-height: 48px;
  margin-top: 18px;
  border: none;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
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
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 18px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  text-align: center;
  font-size: 13px;
}

@media (max-width: 1023px) {
  .setup-shell {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .hero-panel,
  .form-card {
    padding: 24px 20px;
  }

  .hero-notes {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .setup-page {
    padding: 14px;
  }

  h1 {
    max-width: 100%;
    font-size: clamp(28px, 9vw, 38px);
  }

  h2 {
    font-size: 24px;
  }

  .hero-panel,
  .form-card {
    padding: 20px 16px;
    border-radius: 22px;
  }
}
</style>
