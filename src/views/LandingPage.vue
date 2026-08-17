<template>
  <div class="landing-page">
    <header class="site-nav">
      <div class="nav-inner">
        <div class="brand-lockup">
          <strong class="brand-title">ArtRealm AI</strong>
        </div>
        <div class="nav-actions">
          <button class="nav-primary nav-login" @click="router.push('/setup')">登录</button>
        </div>
      </div>
    </header>

    <main class="page-content">
      <section class="hero-section">
        <div class="hero-copy">
          <p class="hero-kicker">智能创作平台</p>
          <h1>
            更纯粹的
            <span>图像与视频生成体验</span>
          </h1>
          <p class="hero-description">
            在一个简洁、安静、专业的界面中完成提示词编写、模型切换、参考图上传与生成管理，让灵感更专注地落地。
          </p>
          <div class="hero-actions">
            <button class="hero-primary" @click="router.push('/setup')">立即开始</button>
          </div>
        </div>

        <div class="hero-stage frost-panel">
          <div class="stage-header">
            <div>
              <span class="stage-label">实时工作台</span>
              <h2>统一的创作界面</h2>
            </div>
            <span class="stage-badge">已就绪</span>
          </div>

          <div class="stage-visual">
            <div class="visual-card visual-card-output">
              <span class="mini-kicker">输出结果</span>
              <strong>多模型统一接入</strong>
              <p>图像生成、编辑、参考图与视频能力都在同一套创作系统中协同完成。</p>
            </div>
            <div class="visual-card visual-card-input">
              <span class="mini-kicker">提示词</span>
              <strong>电影感人像，冷暖交错光影，细腻颗粒，极简背景。</strong>
              <p>层次更清晰，高光更柔和，画面情绪更统一，细节表达更自然。</p>
            </div>
          </div>

          <div class="stage-dialogue">
            <div class="dialogue-bubble">
              <span class="dialogue-prefix">AI</span>
              <div class="typing-line" aria-live="polite">
                <span class="typing-text">{{ displayedPrompt }}</span>
                <span class="typing-caret" aria-hidden="true"></span>
              </div>
              <span class="dialogue-send" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M4 12.75L19.5 4.5L15.75 19.5L11.25 13.5L4 12.75Z" stroke="url(#sendGradient)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M10.75 13.25L19.5 4.5" stroke="url(#sendGradient)" stroke-width="1.8" stroke-linecap="round" />
                  <defs>
                    <linearGradient id="sendGradient" x1="4" y1="4.5" x2="19.5" y2="19.5" gradientUnits="userSpaceOnUse">
                      <stop offset="0" stop-color="#171717" />
                      <stop offset="0.45" stop-color="#5f4b8b" />
                      <stop offset="1" stop-color="#c86b4a" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const prompts = ['生成一张电影感未来夜景海报', '设计一组极简高级感品牌海报', '输出一段流畅的产品展示短片']
const promptIndex = ref(0)
const visibleLength = ref(0)

let typingTimer: ReturnType<typeof window.setTimeout> | null = null
let loopTimer: ReturnType<typeof window.setTimeout> | null = null

const currentPrompt = computed(() => prompts[promptIndex.value])
const displayedPrompt = computed(() => currentPrompt.value.slice(0, visibleLength.value))

const clearTimers = () => {
  if (typingTimer) {
    window.clearTimeout(typingTimer)
    typingTimer = null
  }

  if (loopTimer) {
    window.clearTimeout(loopTimer)
    loopTimer = null
  }
}

const runPromptLoop = () => {
  clearTimers()
  visibleLength.value = 0

  const typeNext = () => {
    const text = currentPrompt.value

    if (visibleLength.value < text.length) {
      visibleLength.value += 1
      typingTimer = window.setTimeout(typeNext, 90)
      return
    }

    loopTimer = window.setTimeout(() => {
      promptIndex.value = (promptIndex.value + 1) % prompts.length
      visibleLength.value = 0
      runPromptLoop()
    }, 1600)
  }

  typingTimer = window.setTimeout(typeNext, 240)
}

onMounted(() => {
  runPromptLoop()
})

onBeforeUnmount(() => {
  clearTimers()
})
</script>

<style scoped>
.landing-page {
  min-height: 100dvh;
  padding: 14px 20px 20px;
  background:
    radial-gradient(circle at 10% 0%, rgba(10, 132, 255, 0.10), transparent 32%),
    radial-gradient(circle at 90% 8%, rgba(0, 0, 0, 0.06), transparent 26%),
    linear-gradient(180deg, #fbfbfd 0%, #f5f5f7 55%, #eef0f3 100%);
}

.page-content,
.site-nav {
  width: min(100%, var(--content-width-wide));
  margin: 0 auto;
}

.site-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  padding-top: 4px;
}

.nav-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  min-height: 56px;
  padding: 8px 10px 8px 16px;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
}

.brand-lockup {
  display: inline-flex;
  align-items: center;
}

.hero-kicker,
.stage-label,
.mini-kicker {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-text-hint);
}

.brand-title {
  font-size: clamp(24px, 2.1vw, 30px);
  font-weight: 800;
  letter-spacing: -0.06em;
  line-height: 1;
  font-family: "Georgia", "Times New Roman", serif;
  font-style: italic;
  background: linear-gradient(135deg, #000000 0%, #1d1d1f 60%, #0a84ff 130%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.nav-actions,
.hero-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.nav-primary,
.hero-primary,
.nav-secondary,
.hero-secondary {
  min-height: 48px;
  padding: 0 24px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  transition:
    transform var(--transition-base),
    border-color var(--transition-base),
    background var(--transition-base),
    box-shadow var(--transition-base),
    color var(--transition-base);
}

.nav-primary,
.hero-primary {
  border: none;
  background: var(--color-theme-gradient);
  color: #fff;
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.20);
}

.nav-secondary,
.hero-secondary {
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.9);
  color: var(--color-text);
}

.nav-primary:hover,
.hero-primary:hover,
.nav-secondary:hover,
.hero-secondary:hover {
  transform: none;
}

.hero-section {
  display: grid;
  grid-template-columns: minmax(0, 0.94fr) minmax(320px, 0.86fr);
  gap: 18px;
  align-items: center;
  padding: 18px 0 8px;
  min-height: calc(100dvh - 74px);
}

.hero-copy {
  max-width: 560px;
}

.hero-kicker {
  letter-spacing: 0.22em;
}

.hero-copy h1 {
  max-width: 10ch;
  margin-top: 10px;
  font-size: clamp(40px, 5.2vw, 68px);
  line-height: 1.02;
  letter-spacing: -0.05em;
}

.hero-copy h1 span {
  display: block;
  font-family: inherit;
  font-style: normal;
  font-weight: 600;
}

.hero-description {
  max-width: 31rem;
  margin-top: 14px;
  color: var(--color-text-secondary);
  font-size: 15px;
  line-height: 1.75;
}

.hero-actions {
  margin-top: 20px;
}

.hero-primary,
.nav-primary {
  min-width: 132px;
}

.nav-login {
  min-width: auto;
  min-height: 40px;
  padding: 0 18px;
  font-size: 13px;
  background: #111;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.14);
}

.stage-dialogue,
.visual-card strong {
  display: block;
}

.visual-card p {
  display: block;
  margin-top: 8px;
  color: var(--color-text-secondary);
  line-height: 1.7;
}

.hero-stage {
  padding: 16px;
  border-radius: 24px;
  min-height: 460px;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.66);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.08);
  backdrop-filter: blur(24px);
  margin-left: -22px;
}

.stage-header,
.stage-dialogue {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.stage-header h2 {
  margin-top: 6px;
  font-size: 20px;
  letter-spacing: -0.04em;
}

.stage-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 80px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(30, 41, 59, 0.08);
  font-size: 11px;
  font-weight: 600;
}

.stage-visual {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  background:
    radial-gradient(circle at top left, rgba(10, 132, 255, 0.16), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(238, 240, 243, 0.94));
  border: 1px solid rgba(0, 0, 0, 0.08);
  min-height: 316px;
}

.visual-card {
  position: absolute;
  max-width: 260px;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.90);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.07);
}

.visual-card-output {
  left: 20px;
  top: 20px;
}

.visual-card-input {
  right: 20px;
  bottom: 20px;
}

.visual-card strong {
  font-size: 17px;
  letter-spacing: -0.03em;
  line-height: 1.45;
}

.stage-dialogue {
  align-items: flex-end;
  justify-content: flex-start;
}

.dialogue-bubble {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.78);
}

.dialogue-prefix {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  height: 34px;
  border-radius: 999px;
  background: #111;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.typing-line {
  display: inline-flex;
  align-items: center;
  flex: 1;
  margin: 0;
  font-size: 16px;
  line-height: 1.6;
  min-height: 26px;
  white-space: nowrap;
  overflow: hidden;
}

.typing-text {
  color: var(--color-text);
}

.typing-caret {
  display: inline-block;
  width: 2px;
  height: 1.2em;
  margin-left: 2px;
  border-radius: 999px;
  background: #0a84ff;
  animation: caretBlink 0.9s step-end infinite;
}

.dialogue-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
}

.dialogue-send svg {
  width: 22px;
  height: 22px;
}

@keyframes caretBlink {
  0%,
  50% {
    opacity: 1;
  }

  51%,
  100% {
    opacity: 0;
  }
}

@media (max-width: 1180px) {
  .hero-section {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .hero-copy h1 {
    max-width: 100%;
  }

  .hero-stage {
    min-height: 400px;
    margin-left: 0;
  }
}

@media (max-width: 860px) {
  .landing-page {
    padding: 10px 12px 20px;
  }

  .nav-inner {
    padding: 10px 0;
  }

  .nav-actions,
  .hero-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .nav-primary,
  .hero-primary,
  .nav-secondary,
  .hero-secondary {
    width: 100%;
    justify-content: center;
  }

  .hero-section {
    min-height: auto;
    padding-top: 12px;
  }

  .hero-copy h1 {
    font-size: clamp(34px, 11vw, 54px);
  }

  .hero-description {
    font-size: 14px;
  }

  .hero-stage {
    min-height: 420px;
    padding: 14px;
  }

  .stage-header,
  .stage-dialogue {
    flex-direction: column;
  }

  .visual-card {
    position: relative;
    inset: auto;
    max-width: none;
    margin: 14px;
  }

  .typing-line {
    font-size: 15px;
    min-height: auto;
    white-space: normal;
  }

  .typing-caret {
    display: none;
  }

  .stage-visual {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: 300px;
  }
}
</style>
