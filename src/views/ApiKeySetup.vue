<template>
  <div class="setup-page">
    <header class="setup-nav">
      <button class="brand" type="button" @click="router.push('/')">
        <img class="brand-mark" :src="assetUrl('/logo1.webp')" alt="" />
        <span>ArtRealm</span>
      </button>

      <div class="nav-spacer" aria-hidden="true" />

      <button class="nav-cta" type="button" @click="router.push('/')">Back home</button>
    </header>

    <main class="setup-shell">
      <section class="setup-copy">
        <p class="kicker">AI VISUAL CREATION SYSTEM</p>
        <h1>Connect your creative engine.</h1>
        <p class="copy">
          填写 API Base URL 与 API Key，连接后即可进入 ArtRealm，开始生成图片与视频。
        </p>

        <section class="setup-form-card" aria-label="API 登录表单">
          <div class="input-group">
            <label for="api-base-url">服务地址</label>
            <input
              id="api-base-url"
              v-model="apiBaseUrl"
              class="text-input"
              placeholder="https://api.openai.com/v1"
            />
          </div>

          <div class="input-group compact">
            <ApiKeyInput v-model="apiKey" />
          </div>

          <a
            class="apikey-helper"
            href="https://aiping.cn/user/apikey"
            target="_blank"
            rel="noopener"
          >
            快速获取AI Ping-APIKEY
          </a>

          <label class="consent-row">
            <input type="checkbox" checked />
            <span>我确认访问地址为 OpenAI baseURL 格式，并理解密钥仅保存在本地浏览器。</span>
          </label>

          <button class="submit-btn" :disabled="!apiBaseUrl.trim() || !apiKey.trim() || isLoading" @click="handleSubmit">
            {{ isLoading ? '正在验证连通性...' : 'Connect and start creating' }}
          </button>

          <div v-if="error" class="error-msg">{{ error }}</div>
        </section>
      </section>

      <section class="visual-stage" aria-hidden="true" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ApiKeyInput from '@/components/ApiKeyInput.vue'
import { useApiStore } from '@/stores/apiStore'
import { AIPING_PUBLIC_API_BASE_URL, isOpenAiBaseUrlFormat } from '@/api/config'
import { assetUrl } from '@/utils/assets'

const router = useRouter()
const route = useRoute()
const apiStore = useApiStore()
const apiKey = ref('')
const apiBaseUrl = ref(AIPING_PUBLIC_API_BASE_URL)
const isLoading = ref(false)
const error = ref('')

const LANDING_PENDING_PROMPT_KEY = 'artrealm_landing_pending_prompt'

/**
 * 登录成功后要回到哪个创作页。
 * 支持两种写法：完整路径（/voice）与首页分区简写（skill / studio / voice）。
 */
function resolveRedirectTarget(): string {
  const raw = typeof route.query.redirect === 'string' ? route.query.redirect.trim() : ''
  if (!raw) return '/image'
  if (raw.startsWith('/')) return raw
  if (raw === 'skill') return '/skill'
  if (raw === 'voice') return '/voice'
  // 兼容拆分前的旧分区简写。
  if (raw === 'studio') return '/image'
  return '/image'
}

function consumeLandingPendingPrompt(): { prompt: string; hasReference: boolean } | null {
  const raw = sessionStorage.getItem(LANDING_PENDING_PROMPT_KEY)
  if (!raw) return null
  sessionStorage.removeItem(LANDING_PENDING_PROMPT_KEY)
  try {
    const parsed = JSON.parse(raw) as { prompt?: string; hasReference?: boolean }
    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : ''
    if (!prompt) return null
    return { prompt, hasReference: !!parsed.hasReference }
  } catch {
    return null
  }
}

async function handleSubmit() {
  if (!apiBaseUrl.value.trim() || !apiKey.value.trim()) return
  if (!isOpenAiBaseUrlFormat(apiBaseUrl.value)) {
    error.value = '服务地址格式不正确，请填写 OpenAI baseURL 格式，例如：https://api.openai.com/v1。'
    return
  }

  isLoading.value = true
  error.value = ''
  const ok = await apiStore.testAndSave(apiKey.value.trim(), apiBaseUrl.value.trim())
  isLoading.value = false
  if (ok) {
    const pending = consumeLandingPendingPrompt()
    if (pending) {
      router.push({
        path: '/image',
        query: {
          mode: 'simple',
          type: 'image',
          prompt: pending.prompt,
          ...(pending.hasReference ? { reference: 'landing' } : {}),
        },
      })
    } else {
      // 首页分区入口会带上目标分区，登录后直接回到对应工作台。
      router.push(resolveRedirectTarget())
    }
  } else {
    error.value = apiStore.connectionError || '连接失败，请检查 API Key 是否正确。'
  }
}
</script>

<style scoped>
.setup-page {
  position: relative;
  min-height: 100dvh;
  overflow: hidden;
  padding: 24px;
  color: rgba(255, 255, 255, 0.94);
  background:
    url('https://artrealm-image-1314455608.cos.ap-beijing.myqcloud.com/site-assets/login-collage-bg.webp') center / cover no-repeat, #05060a;
  isolation: isolate;
}

.setup-page::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  background:
    radial-gradient(ellipse at 76% 54%, rgba(245, 129, 255, 0.16), transparent 0 30%),
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
  background-size: auto, 92px 92px, 92px 92px;
  mask-image: radial-gradient(circle at 58% 48%, #000 0 58%, transparent 92%);
}

.setup-page::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.58));
}

.setup-nav {
  position: relative;
  z-index: 3;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  width: min(100%, 1280px);
  margin: 0 auto;
  padding: 4px 0 26px;
}

.brand,
.nav-cta,
.submit-btn {
  border: 0;
  font: inherit;
}

.brand {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  background: transparent;
  color: #fff;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.05em;
}

.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  object-fit: cover;
}

.nav-spacer {
  width: 1px;
  height: 1px;
}

.nav-cta {
  justify-self: end;
  min-height: 36px;
  padding: 0 18px;
  border: 1px solid var(--color-pale-glass-border);
  border-radius: 999px;
  background: var(--color-pale-glass-bg);
  color: rgba(255, 255, 255, 0.94);
  font-size: 13px;
  font-weight: 800;
}

.nav-cta:hover {
  background: var(--color-pale-glass-bg-hover);
}

.setup-shell {
  position: relative;
  z-index: 2;
  width: min(100%, 1280px);
  min-height: calc(100dvh - 144px);
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(360px, 0.82fr) minmax(0, 1.18fr);
  gap: clamp(28px, 5vw, 82px);
  align-items: center;
}

.setup-copy {
  align-self: center;
}

.kicker {
  margin-bottom: 18px;
  color: rgba(171, 214, 255, 0.68);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.setup-copy h1 {
  max-width: 11ch;
  color: #fff;
  font-family: var(--font-family-display);
  font-size: clamp(42px, 5.4vw, 72px);
  font-weight: 900;
  line-height: 0.92;
  letter-spacing: -0.08em;
}

.copy {
  max-width: 520px;
  margin-top: 18px;
  color: rgba(235, 245, 255, 0.74);
  font-size: 15px;
  line-height: 1.7;
}

.setup-form-card {
  width: min(100%, 460px);
  margin-top: 24px;
}

.input-group {
  margin-top: 14px;
}

.input-group.compact {
  margin-top: 12px;
}

label {
  display: block;
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.70);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.text-input {
  width: 100%;
  min-width: 0;
  min-height: 46px;
  padding: 0 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.92);
  outline: none;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(16px);
}

.text-input::placeholder {
  color: rgba(255, 255, 255, 0.38);
}

.text-input:focus {
  border-color: rgba(171, 214, 255, 0.34);
  box-shadow: 0 0 0 4px rgba(98, 139, 255, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.10);
}

.consent-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 14px;
  color: rgba(255, 255, 255, 0.64);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.45;
  text-transform: none;
}

.consent-row input {
  width: 16px;
  height: 16px;
  margin-top: 1px;
  accent-color: #9c7dff;
}

.apikey-helper {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 12px;
  color: rgba(171, 214, 255, 0.88);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  transition: color var(--transition-base), transform var(--transition-base);
}

.apikey-helper::after {
  content: '↗';
  font-size: 12px;
  line-height: 1;
}

.apikey-helper:hover {
  color: #ffffff;
  transform: translateY(-1px);
}

.submit-btn {
  width: 100%;
  min-height: 48px;
  margin-top: 18px;
  border: 1px solid var(--color-action-border);
  border-radius: 14px;
  background: var(--color-action-bg);
  color: var(--color-action-text);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.34);
  font-size: 14px;
  font-weight: 900;
}

.submit-btn:not(:disabled):hover {
  background: var(--color-action-bg-hover);
}

.submit-btn:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.tips {
  margin-top: 14px;
  color: rgba(230, 240, 255, 0.56);
  font-size: 12px;
  line-height: 1.6;
}

.error-msg {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 94, 94, 0.22);
  border-radius: 14px;
  background: rgba(255, 94, 94, 0.12);
  color: rgba(255, 190, 190, 0.96);
  font-size: 13px;
}

.visual-stage {
  position: relative;
  min-height: 560px;
}

.metric-row {
  position: absolute;
  left: clamp(24px, 4vw, 58px);
  bottom: 34px;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  gap: 18px;
}

.metric-row div {
  min-width: 142px;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(18px);
}

.metric-row strong,
.metric-row span {
  display: block;
}

.metric-row strong {
  color: #fff;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.06em;
}

.metric-row span {
  margin-top: 2px;
  color: rgba(255, 255, 255, 0.54);
  font-size: 12px;
  line-height: 1.2;
}

@media (max-width: 1023px) {
  .setup-page {
    overflow-y: auto;
  }

  .setup-nav {
    grid-template-columns: 1fr auto;
  }

  .setup-shell {
    grid-template-columns: 1fr;
    min-height: auto;
    padding-bottom: 160px;
  }

  .visual-stage {
    position: absolute;
    inset: auto 0 0;
    min-height: 420px;
    opacity: 0.55;
    pointer-events: none;
  }
}

@media (max-width: 767px) {
  .setup-page {
    padding: 16px;
  }

  .setup-nav {
    grid-template-columns: 1fr auto;
    padding-bottom: 28px;
  }

  .nav-spacer {
    display: none;
  }

  .nav-cta {
    min-height: 34px;
    padding: 0 14px;
  }

  .setup-copy h1 {
    font-size: clamp(38px, 13vw, 58px);
  }

  .copy {
    font-size: 14px;
  }

  .setup-form-card {
    width: 100%;
  }

  .setup-shell {
    gap: 24px;
  }

  .metric-row {
    position: relative;
    left: auto;
    bottom: auto;
    margin-top: -128px;
    flex-wrap: wrap;
  }

  .metric-row div {
    flex: 1;
    min-width: 130px;
  }
}
</style>
