<template>
  <div class="setup-page">
    <div class="setup-shell">
      <section class="setup-copy">
        <p class="kicker">连接 aiping</p>
        <h1>连接后即可开始创作。</h1>
        <p class="copy">
          填写 API Key，进入工作台开始生成图片与视频。
        </p>
      </section>

      <section class="setup-form-card">
        <div class="form-head">
          <p class="kicker">登录</p>
          <h2>填写 aiping API 访问信息</h2>
        </div>

        <div class="input-group">
          <label for="api-base-url">服务地址</label>
          <input
            id="api-base-url"
            v-model="apiBaseUrl"
            class="text-input"
            readonly
            placeholder="https://aiping.cn/api/v1"
          />
        </div>

        <div class="input-group compact">
          <ApiKeyInput v-model="apiKey" />
        </div>

        <div class="tips">
          <p>
            目前仅支持使用
            <a href="https://www.aiping.cn/" target="_blank" rel="noopener">aiping</a>
            官方服务地址。
          </p>
        </div>

        <button class="submit-btn" :disabled="!apiBaseUrl.trim() || !apiKey.trim() || isLoading" @click="handleSubmit">
          {{ isLoading ? '正在验证访问权限...' : '进入工作台' }}
        </button>

        <div v-if="error" class="error-msg">{{ error }}</div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ApiKeyInput from '@/components/ApiKeyInput.vue'
import { useApiStore } from '@/stores/apiStore'
import { AIPING_PUBLIC_API_BASE_URL } from '@/api/config'

const router = useRouter()
const apiStore = useApiStore()
const apiKey = ref('')
const apiBaseUrl = ref(AIPING_PUBLIC_API_BASE_URL)
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
    error.value = apiStore.connectionError || '连接失败，请检查 API Key 是否正确。'
  }
}
</script>

<style scoped>
.setup-page {
  min-height: 100dvh;
  padding: 24px;
}

.setup-shell {
  width: min(100%, var(--content-width));
  min-height: calc(100dvh - 48px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 28px;
  align-items: center;
}

.setup-copy h1,
.setup-form-card h2 {
  letter-spacing: -0.06em;
  color: var(--color-text);
}

.kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-hint);
}

.setup-copy h1 {
  max-width: 10ch;
  margin-top: 16px;
  font-size: clamp(48px, 7vw, 92px);
  line-height: 0.92;
}

.copy {
  max-width: 32rem;
  margin-top: 24px;
  color: var(--color-text-secondary);
  font-size: 17px;
  line-height: 1.75;
}

.setup-form-card {
  padding: 28px;
  border: 1px solid var(--color-border);
  border-radius: 32px;
  background: var(--color-surface-subtle);
}

.form-head {
  margin-bottom: 20px;
}

.setup-form-card h2 {
  margin-top: 12px;
  font-size: 36px;
  line-height: 0.98;
}

.input-group {
  margin-top: 18px;
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
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.submit-btn {
  min-height: 46px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
}

.text-input {
  width: 100%;
  min-width: 0;
  padding: 15px 16px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: #fff;
  color: var(--color-text);
  outline: none;
}

.text-input:focus {
  border-color: var(--color-border-strong);
}

.tips {
  margin-top: 18px;
  padding: 16px 18px;
  border-radius: 18px;
  background: #fff;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.tips a {
  color: var(--color-accent);
  font-weight: 600;
}

.submit-btn {
  width: 100%;
  margin-top: 20px;
  border: none;
  background: #111;
  color: #fff;
}

.submit-btn:disabled {
  opacity: 0.46;
}

.error-msg {
  margin-top: 12px;
  padding: 13px 14px;
  border-radius: 18px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 13px;
}

@media (max-width: 1023px) {
  .setup-shell {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .setup-copy h1 {
    max-width: 100%;
  }
}

@media (max-width: 767px) {
  .setup-page {
    padding: 12px;
  }

  .setup-shell {
    min-height: calc(100dvh - 24px);
    gap: 18px;
  }

  .setup-form-card {
    padding: 20px 16px;
    border-radius: 24px;
  }

  .setup-copy h1 {
    font-size: clamp(38px, 14vw, 58px);
  }
}
</style>
