<template>
  <div class="home">
    <div class="page-progress" aria-hidden="true">
      <span :style="{ transform: `scaleX(${pageProgress / 100})` }" />
    </div>
    <div class="noise" aria-hidden="true" />

    <header class="nav" :class="{ 'is-scrolled': scrolled }">
      <button class="brand" type="button" aria-label="ArtRealm 首页" @click="router.push('/')">
        <img class="brand-mark" :src="assetUrl('/logo1.webp')" alt="" />
        <span class="brand-text">ARTREALM<span class="brand-dot">.</span></span>
      </button>

      <nav class="nav-links" aria-label="主导航">
        <a href="#zones" @click.prevent="scrollToZones">工作台</a>
        <a href="#skill" @click.prevent="scrollToSkill">Skill</a>
        <a href="#prompts" @click.prevent="scrollToPrompts">提示词</a>
        <button type="button" @click="goModel3D">3D 建模</button>
      </nav>

      <button class="cta" type="button" @click="router.push('/setup')">
        <span>{{ hasSession ? '进入工坊' : '开始创作' }}</span>
        <span class="cta-icon" aria-hidden="true">
          <svg viewBox="0 0 14 14" fill="none">
            <path
              d="M3 11 11 3M4.4 3H11v6.6"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </button>
    </header>

    <main>
      <!-- Hero -->
      <section class="hero" aria-labelledby="hero-title">
        <div
          class="hero-bg"
          :style="{ backgroundImage: `url(${assetUrl('/home-collage-bg.webp')})` }"
          aria-hidden="true"
        />

        <div class="hero-main">
          <h1 id="hero-title" class="hero-title">
            <span class="hero-line hero-line--1">把灵感</span>
            <span class="hero-line hero-line--2">做成作品</span>
          </h1>

          <div class="hero-index">
            <button
              v-for="entry in heroEntries"
              :key="entry.key"
              class="index-row"
              type="button"
              @click="entry.onClick"
            >
              <span class="index-num">{{ entry.index }}</span>
              <span class="index-name">{{ entry.title }}</span>
              <span class="index-arrow" aria-hidden="true">↗</span>
            </button>
          </div>
        </div>

        <div class="hero-foot">
          <button class="ticker" type="button" @click="useTypedPrompt">
            <span class="ticker-label">Prompt</span>
            <span class="ticker-text">{{ typewriterText }}<i class="caret" aria-hidden="true" /></span>
            <span class="ticker-go" aria-hidden="true">↗</span>
          </button>
          <span class="scroll-hint" aria-hidden="true">
            <span>Scroll</span>
            <i />
          </span>
        </div>
      </section>

      <!-- 创作流程 -->
      <section id="process" class="process" aria-label="创作流程">
        <div class="process-sticky">
          <div class="process-words">
            <div
              v-for="(item, index) in manifestoWords"
              :key="item.word"
              class="process-word"
              :class="{ 'is-active': activeManifesto === index }"
            >
              <span class="pw-index">{{ item.index }}</span>
              <span class="pw-text">{{ item.word }}</span>
            </div>
          </div>
          <div class="process-track" aria-hidden="true">
            <span :style="{ transform: `scaleY(${manifestoProgress})` }" />
          </div>
        </div>
      </section>

      <!-- 三个工作台 -->
      <section id="zones" class="section">
        <div class="section-head" data-reveal>
          <span class="section-num">02</span>
          <h2 class="section-title">三个<span class="accent">工作台</span></h2>
        </div>

        <div class="work-grid">
          <article
            v-for="zone in zones"
            :key="zone.key"
            class="work-card"
            data-reveal
            role="button"
            tabindex="0"
            :aria-label="zone.cta"
            @click="enterZone(zone)"
            @keydown.enter.prevent="enterZone(zone)"
            @keydown.space.prevent="enterZone(zone)"
          >
            <div v-if="zone.image" class="work-bg" aria-hidden="true">
              <img :src="zone.image" alt="" loading="lazy" decoding="async" />
            </div>
            <div v-else class="work-bg work-bg--voice" aria-hidden="true">
              <span
                v-for="(height, index) in voiceWave"
                :key="index"
                class="voice-bar"
                :style="{ height: `${height}%`, animationDelay: `${index * 55}ms` }"
              />
            </div>

            <span class="work-num">{{ zone.index }}</span>

            <div class="work-bottom">
              <h3 class="work-title">{{ zone.title }}</h3>
              <span class="work-arrow" aria-hidden="true">↗</span>
            </div>
          </article>
        </div>
      </section>

      <!-- Skill 模板 -->
      <section id="skill" class="section">
        <div class="section-head" data-reveal>
          <span class="section-num">03</span>
          <h2 class="section-title"><span class="accent">Skill</span> 模板</h2>
        </div>

        <div class="skill-grid">
          <article
            v-for="(item, index) in skillTemplates"
            :key="item.title"
            class="skill-card"
            data-reveal
            role="button"
            tabindex="0"
            @click="handleSkillTemplateClick"
            @keydown.enter.prevent="handleSkillTemplateClick"
            @keydown.space.prevent="handleSkillTemplateClick"
          >
            <div class="skill-visual">
              <img :src="item.image" alt="" loading="lazy" decoding="async" />
              <span class="skill-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <button
                class="skill-download"
                type="button"
                :aria-label="`下载 ${item.title}`"
                @click.stop="handleSkillDownloadClick(item)"
              >
                <span aria-hidden="true">↓</span>
              </button>
            </div>
            <div class="skill-info">
              <strong>{{ item.title }}</strong>
              <span class="skill-arrow" aria-hidden="true">↗</span>
            </div>
          </article>
        </div>
      </section>

      <!-- 提示词模板 -->
      <section id="prompts" class="section">
        <div class="section-head" data-reveal>
          <span class="section-num">04</span>
          <h2 class="section-title">提示词<span class="accent">模板</span></h2>
        </div>

        <div class="prompt-grid">
          <button
            v-for="(item, index) in templates"
            :key="item.title"
            class="prompt-card"
            data-reveal
            type="button"
            @click="handleTemplateClick(item)"
          >
            <span class="prompt-visual">
              <img :src="item.image" alt="" loading="lazy" decoding="async" />
              <span class="prompt-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="prompt-use" aria-hidden="true">↗</span>
            </span>
            <span class="prompt-title">{{ item.title }}</span>
          </button>
        </div>
      </section>

      <!-- 收尾 -->
      <section class="outro">
        <div
          class="outro-bg"
          :style="{ backgroundImage: `url(${assetUrl('/home-collage-bg.webp')})` }"
          aria-hidden="true"
        />

        <div class="outro-inner" data-reveal>
          <h2 class="outro-title">
            灵感不用等<br />
            <span class="accent">现在就变成作品</span>
          </h2>
          <div class="outro-actions">
            <button class="outro-btn" type="button" @click="router.push('/setup')">
              <span>{{ hasSession ? '进入创作工坊' : '开始创作' }}</span>
              <span class="outro-btn-icon" aria-hidden="true">↗</span>
            </button>
            <button class="outro-ghost" type="button" @click="goModel3D">3D 建模 →</button>
          </div>
        </div>

        <button class="to-top" type="button" @click="scrollToTop">回到顶部 ↑</button>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { hasActiveApiSession } from '@/api/config'
import { assetUrl } from '@/utils/assets'

const LANDING_PENDING_PROMPT_KEY = 'artrealm_landing_pending_prompt'

const router = useRouter()
const hasSession = ref(false)

interface CreativeZone {
  key: 'skill' | 'media' | 'voice'
  index: string
  title: string
  cta: string
  target: 'skill' | 'studio' | 'voice'
  image?: string
}

const zones: CreativeZone[] = [
  {
    key: 'skill',
    index: '01',
    title: 'Skill 创作',
    cta: '进入 Skill 工作台',
    target: 'skill',
    image: assetUrl('/skill-wkw-neon-loneliness-style.webp'),
  },
  {
    key: 'media',
    index: '02',
    title: '图片视频生成',
    cta: '进入创作工坊',
    target: 'studio',
    image: assetUrl('/template-f1.webp'),
  },
  {
    key: 'voice',
    index: '03',
    title: '配音创作',
    cta: '进入配音工作台',
    target: 'voice',
  },
]

const skillTemplates = [
  {
    title: '王家卫式霓虹孤独风格',
    image: assetUrl('/skill-wkw-neon-loneliness-style.webp'),
    fileUrl: '/skills/wkw-neon-loneliness-style.md',
    fileName: 'wkw-neon-loneliness-style.md',
  },
  {
    title: '剪纸定格动画',
    image: assetUrl('/skill-papercut-stop-motion-explainer.webp'),
    fileUrl: '/skills/papercut-stop-motion-explainer.md',
    fileName: 'papercut-stop-motion-explainer.md',
  },
  {
    title: '手绘发光动画实拍融合',
    image: assetUrl('/skill-handdrawn-live-video-generator.webp'),
    fileUrl: '/skills/handdrawn-live-video-generator.md',
    fileName: 'handdrawn-live-video-generator.md',
  },
  {
    title: '极简旅行海报',
    image: assetUrl('/skill-photo-to-minimal-vector-travel-poster.webp'),
    fileUrl: '/skills/photo-to-minimal-vector-travel-poster.md',
    fileName: 'photo-to-minimal-vector-travel-poster.md',
  },
]

const templates = [
  {
    title: 'F1 飞驰赛车',
    prompt:
      'F1 方程式赛车在赛道上高速飞驰，低机位广角镜头，车身运动模糊，轮胎带起火花与水雾，雨后赛道反光，电影级运动摄影，浅景深，强烈速度感，超清细节',
    image: assetUrl('/template-f1.webp'),
  },
  {
    title: 'iPhone 17 产品电商图',
    prompt:
      'iPhone 17 旗舰手机产品电商主图，钛金属边框高光，深色科技感背景，蓝紫渐变轮廓光，镜头模组与屏幕清晰展示，悬浮构图，商业产品摄影，高级质感，超清渲染',
    image: assetUrl('/template-iphone17.webp'),
  },
  {
    title: '科技感网页 UI',
    prompt:
      '未来科技感网页 UI 界面设计，深色模式仪表盘，玻璃拟态数据卡片，蓝紫渐变数据可视化图表，悬浮导航栏，清晰信息层级，高清界面设计，现代极简',
    image: assetUrl('/template-webui.webp'),
  },
  {
    title: '卡通兔子',
    prompt:
      '可爱卡通兔子角色，软萌大眼睛，奶油白毛绒质感，治愈系绘本插画风格，柔和自然光，浅色温馨场景，精致细节，迪士尼级角色设计',
    image: assetUrl('/template-rabbit.webp'),
  },
  {
    title: '无线耳机结构解析',
    prompt:
      '无线头戴式降噪耳机爆炸分解产品图，精密声学结构与内部电子组件清晰展示，USB-C 充电口、电池、驱动单元、麦克风阵列与记忆棉耳罩，工业设计图纸风格，深色科技背景，商业产品渲染，超清细节',
    image: assetUrl('/template-headphones.webp'),
  },
  {
    title: '影视爆炸现场',
    prompt:
      '电影级爆炸现场，橙红色火球与黑色浓烟升腾，尘土碎片飞溅，冲击波，逆光剪影，广角构图，逼真影视特效，超高细节',
    image: assetUrl('/template-landscape.webp'),
  },
  {
    title: '中世纪战士',
    prompt:
      '中世纪战士角色，厚重金属铠甲，战损做旧，斗篷，手持长剑，阴天战场背景，电影级写实人像，戏剧性侧光，细腻质感，史诗氛围',
    image: assetUrl('/template-festival.webp'),
  },
  {
    title: '专业相机三视图',
    prompt:
      '专业数码相机产品三视图与爆炸分解展示，黑色机身，35mm f/2.0 定焦镜头，标注尺寸、按键与接口，工业设计图纸风格，商业产品展示，超清渲染',
    image: assetUrl('/template-camera.webp'),
  },
]

const typewriterPhrases = [
  'F1 方程式赛车在赛道上飞驰。',
  'iPhone 17 旗舰手机产品电商主图。',
  '未来科技感网页 UI 界面设计。',
  '治愈系卡通兔子角色。',
]

const manifestoWords = [
  { index: '01', word: '生成' },
  { index: '02', word: '编排' },
  { index: '03', word: '交付' },
]

/** 配音分区的等宽声波装饰（固定序列，避免每次渲染抖动）。 */
const voiceWave = Array.from({ length: 34 }, (_, index) =>
  16 + Math.round(Math.abs(Math.sin(index * 0.62)) * 66),
)

const typewriterText = ref('')
let typewriterTimer: number | undefined
let phraseIndex = 0
let charIndex = 0
let deleting = false

/** 页面进度：顶部细进度条 + 流程分区的词语高亮。 */
const pageProgress = ref(0)
const scrolled = ref(false)
const manifestoProgress = ref(0)
const activeManifesto = computed(() =>
  manifestoProgress.value < 1 / 3 ? 0 : manifestoProgress.value < 2 / 3 ? 1 : 2,
)

let scrollFrame = 0

function readScroll() {
  scrollFrame = 0

  const doc = document.documentElement
  const max = doc.scrollHeight - window.innerHeight
  pageProgress.value = max > 0 ? Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100))) : 0
  scrolled.value = window.scrollY > 32

  const process = document.getElementById('process')
  if (!process) return
  const rect = process.getBoundingClientRect()
  const span = rect.height - window.innerHeight
  const passed = -rect.top
  manifestoProgress.value = span > 0 ? Math.min(1, Math.max(0, passed / span)) : 0
}

function onScroll() {
  if (scrollFrame) return
  scrollFrame = window.requestAnimationFrame(readScroll)
}

function runTypewriter() {
  const phrase = typewriterPhrases[phraseIndex % typewriterPhrases.length]

  if (!deleting) {
    typewriterText.value = phrase.slice(0, charIndex + 1)
    charIndex += 1
    if (charIndex === phrase.length) {
      deleting = true
      typewriterTimer = window.setTimeout(runTypewriter, 1800)
      return
    }
    typewriterTimer = window.setTimeout(runTypewriter, 60)
    return
  }

  typewriterText.value = phrase.slice(0, charIndex - 1)
  charIndex -= 1
  if (charIndex === 0) {
    deleting = false
    phraseIndex += 1
    typewriterTimer = window.setTimeout(runTypewriter, 320)
    return
  }
  typewriterTimer = window.setTimeout(runTypewriter, 26)
}

function scrollToZones() {
  document.getElementById('zones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollToSkill() {
  document.getElementById('skill')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollToPrompts() {
  document.getElementById('prompts')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function enterZone(zone: CreativeZone) {
  if (zone.target === 'voice') {
    router.push('/voice')
    return
  }

  if (!hasActiveApiSession()) {
    router.push({ path: '/setup', query: { redirect: zone.target } })
    return
  }

  router.push(zone.target === 'skill' ? '/skill' : '/studio')
}

function goModel3D() {
  if (!hasActiveApiSession()) {
    router.push({ path: '/setup', query: { redirect: '/model3d' } })
    return
  }
  router.push('/model3d')
}

interface HeroEntry {
  key: string
  index: string
  title: string
  onClick: () => void
}

const heroEntries: HeroEntry[] = [
  { key: 'skill', index: '01', title: 'Skill 创作', onClick: () => enterZone(zones[0]) },
  { key: 'media', index: '02', title: '图片视频生成', onClick: () => enterZone(zones[1]) },
  { key: 'voice', index: '03', title: '配音创作', onClick: () => enterZone(zones[2]) },
  { key: 'model3d', index: '04', title: '3D 建模', onClick: () => goModel3D() },
]

function handleTemplateClick(item: { prompt: string }) {
  sessionStorage.setItem(
    LANDING_PENDING_PROMPT_KEY,
    JSON.stringify({ prompt: item.prompt, hasReference: false }),
  )

  if (hasActiveApiSession()) {
    router.push({
      path: '/studio',
      query: {
        mode: 'simple',
        type: 'image',
        prompt: item.prompt,
      },
    })
    return
  }

  router.push({ path: '/setup', query: { redirect: 'studio' } })
}

/** 点 Hero 底部的打字机提示词，直接把完整句子带进工坊。 */
function useTypedPrompt() {
  const phrase = typewriterPhrases[phraseIndex % typewriterPhrases.length]
  handleTemplateClick({ prompt: phrase })
}

function handleSkillTemplateClick() {
  if (hasActiveApiSession()) {
    router.push('/skill')
    return
  }
  router.push({ path: '/setup', query: { redirect: 'skill' } })
}

function handleSkillDownloadClick(item: { fileUrl: string; fileName: string }) {
  const link = document.createElement('a')
  link.href = item.fileUrl
  link.download = item.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

let revealObserver: IntersectionObserver | undefined

onMounted(() => {
  hasSession.value = hasActiveApiSession()
  runTypewriter()

  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  readScroll()

  revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        revealObserver?.unobserve(entry.target)
      })
    },
    { threshold: 0.04, rootMargin: '0px 0px -2% 0px' },
  )
  document.querySelectorAll('[data-reveal]').forEach((element) => revealObserver?.observe(element))
})

onBeforeUnmount(() => {
  if (typewriterTimer !== undefined) {
    window.clearTimeout(typewriterTimer)
  }
  if (scrollFrame) {
    window.cancelAnimationFrame(scrollFrame)
  }
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  revealObserver?.disconnect()
})
</script>

<style scoped>
.home {
  --orange: #ec5a00;
  --orange-bright: #ff7243;
  --deep: #641005;
  --ink: #060504;
  --line: rgba(255, 255, 255, 0.12);
  --muted: rgba(245, 241, 236, 0.5);
  --smooth: cubic-bezier(0.16, 1, 0.3, 1);

  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 100dvh;
  overflow-x: clip;
  background: var(--ink);
  color: #f5f1ec;
  font-family: var(--font-family);
}

.accent {
  background: linear-gradient(92deg, #ffffff 0%, #ffb27a 42%, var(--orange) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

/* ---------- 全局装饰 ---------- */

.page-progress {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 70;
  width: 100%;
  height: 2px;
  background: rgba(255, 255, 255, 0.06);
  pointer-events: none;
}

.page-progress span {
  display: block;
  width: 100%;
  height: 100%;
  transform-origin: 0 50%;
  background: linear-gradient(90deg, var(--orange), var(--orange-bright));
  transition: transform 120ms linear;
}

.noise {
  position: fixed;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  opacity: 0.05;
  background-image: radial-gradient(rgba(255, 255, 255, 0.7) 0.5px, transparent 0.5px);
  background-size: 3px 3px;
  mix-blend-mode: overlay;
}

[data-reveal] {
  opacity: 0;
  translate: 0 24px;
  transition:
    opacity 0.8s var(--smooth),
    translate 0.8s var(--smooth);
}

[data-reveal].is-visible {
  opacity: 1;
  translate: 0 0;
}

/* ---------- 导航 ---------- */

.nav {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: 100%;
  padding: 18px 32px;
  transition: background 0.4s ease, backdrop-filter 0.4s ease;
}

.nav.is-scrolled {
  background: linear-gradient(180deg, rgba(6, 5, 4, 0.86), rgba(6, 5, 4, 0.2) 78%, transparent);
  backdrop-filter: blur(12px);
}

.brand {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 10px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.brand-mark {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4);
}

.brand-text {
  font-family: var(--font-family-display);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2em;
}

.brand-dot {
  color: var(--orange-bright);
}

.nav-links {
  display: inline-flex;
  align-items: center;
  gap: 30px;
  padding: 12px 24px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(24px) saturate(140%);
}

.nav-links a,
.nav-links button {
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(245, 241, 236, 0.58);
  font-family: var(--font-family);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-decoration: none;
  cursor: pointer;
  transition: color 0.25s ease;
}

.nav-links a:hover,
.nav-links button:hover {
  color: #fff;
}

.cta {
  display: inline-flex;
  align-items: center;
  justify-self: end;
  gap: 14px;
  height: 44px;
  padding: 0 6px 0 20px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: linear-gradient(90deg, var(--orange), var(--deep));
  color: #fff;
  font-family: var(--font-family);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  cursor: pointer;
  box-shadow: 0 16px 40px rgba(236, 90, 0, 0.24);
  transition:
    transform 0.45s var(--smooth),
    box-shadow 0.45s var(--smooth);
}

.cta:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 54px rgba(236, 90, 0, 0.36);
}

.cta-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
}

.cta-icon svg {
  width: 13px;
  height: 13px;
}

/* ---------- Hero ---------- */

.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  padding: 116px 40px 26px;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: -6% -8% 0;
  z-index: 0;
  background-position: center 26%;
  background-size: cover;
  opacity: 0.22;
  filter: saturate(0.9) contrast(1.05);
  -webkit-mask-image: radial-gradient(120% 92% at 66% 20%, #000 0%, transparent 72%);
  mask-image: radial-gradient(120% 92% at 66% 20%, #000 0%, transparent 72%);
  pointer-events: none;
}

.hero::before {
  content: '';
  position: absolute;
  top: -34%;
  right: -8%;
  z-index: 0;
  width: 820px;
  height: 820px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(236, 90, 0, 0.2), transparent 66%);
  filter: blur(30px);
  pointer-events: none;
}

.hero-main {
  position: relative;
  z-index: 2;
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1.5fr) minmax(228px, 0.5fr);
  align-items: end;
  gap: clamp(32px, 6vw, 110px);
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding-bottom: clamp(32px, 6vh, 76px);
}

.hero-title {
  font-family: var(--font-family-display);
  font-size: clamp(3.3rem, 10.6vw, 12.6rem);
  font-weight: 500;
  line-height: 0.94;
  letter-spacing: -0.055em;
  animation: hero-in 1s var(--smooth) both;
}

.hero-line {
  display: block;
  width: fit-content;
}

.hero-line--1 {
  background: linear-gradient(92deg, #ffffff 8%, #d9c8bf 76%, #b97967 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-line--2 {
  margin-left: clamp(0px, 8vw, 180px);
  background: linear-gradient(92deg, #ffffff 0%, #ffb27a 46%, var(--orange) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

@keyframes hero-in {
  from {
    opacity: 0;
    translate: 0 40px;
  }
}

.hero-index {
  display: grid;
  align-content: end;
  min-width: 0;
  animation: hero-in 1s 0.15s var(--smooth) both;
}

.index-row {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 12px;
  padding: 15px 0;
  border: 0;
  border-top: 1px solid var(--line);
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.index-row:last-child {
  border-bottom: 1px solid var(--line);
}

.index-num {
  color: var(--orange-bright);
  font-family: var(--font-family-display);
  font-size: 9.5px;
  letter-spacing: 0.14em;
}

.index-name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  text-overflow: ellipsis;
  transition: color 0.25s ease;
}

.index-arrow {
  justify-self: end;
  color: rgba(245, 241, 236, 0.34);
  font-size: 13px;
  transition:
    color 0.3s ease,
    transform 0.4s var(--smooth);
}

.index-row:hover .index-name {
  color: var(--orange-bright);
}

.index-row:hover .index-arrow {
  color: var(--orange-bright);
  transform: translate(2px, -2px);
}

.hero-foot {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 30px;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  animation: hero-in 1s 0.25s var(--smooth) both;
}

.ticker {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 13px 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.035);
  color: inherit;
  text-align: left;
  backdrop-filter: blur(16px);
  cursor: pointer;
  transition: border-color 0.35s ease, background 0.35s ease;
}

.ticker:hover {
  border-color: rgba(236, 90, 0, 0.45);
  background: rgba(236, 90, 0, 0.06);
}

.ticker-label {
  flex: 0 0 auto;
  color: var(--orange-bright);
  font-family: var(--font-family-display);
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.ticker-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: rgba(245, 241, 236, 0.78);
  font-size: 12.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.caret {
  display: inline-block;
  width: 1px;
  height: 1em;
  margin-left: 3px;
  vertical-align: -0.14em;
  background: var(--orange-bright);
  animation: caret-blink 1s steps(1, end) infinite;
}

@keyframes caret-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}

.ticker-go {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.07);
  color: rgba(245, 241, 236, 0.7);
  font-size: 12px;
  transition: background 0.3s ease, color 0.3s ease;
}

.ticker:hover .ticker-go {
  background: var(--orange);
  color: #fff;
}

.scroll-hint {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 9px;
  color: rgba(245, 241, 236, 0.3);
  font-family: var(--font-family-display);
  font-size: 9px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.scroll-hint i {
  width: 1px;
  height: 34px;
  background: linear-gradient(180deg, var(--orange), transparent);
  animation: scroll-pulse 2.2s ease-in-out infinite;
}

@keyframes scroll-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scaleY(0.7);
    transform-origin: top;
  }
  50% {
    opacity: 1;
    transform: scaleY(1);
    transform-origin: top;
  }
}

/* ---------- 创作流程 ---------- */

.process {
  position: relative;
  height: 260vh;
}

.process-sticky {
  position: sticky;
  top: 0;
  display: grid;
  place-items: center;
  height: 100svh;
  padding: 0 40px;
  overflow: hidden;
}

.process-words {
  display: grid;
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding-right: 90px;
}

.process-word {
  display: flex;
  align-items: baseline;
  gap: clamp(12px, 2vw, 30px);
  color: rgba(245, 241, 236, 0.13);
  font-family: var(--font-family-display);
  font-size: clamp(3.6rem, 12.5vw, 11rem);
  font-weight: 500;
  line-height: 1.12;
  letter-spacing: -0.05em;
  transition:
    color 0.5s ease,
    transform 0.9s var(--smooth);
}

.process-word.is-active {
  color: #fff;
  transform: translateX(clamp(10px, 3vw, 54px));
}

.process-word.is-active .pw-text {
  background: linear-gradient(92deg, #ffffff 0%, #ff9a5c 55%, var(--orange) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pw-index {
  color: rgba(245, 241, 236, 0.28);
  font-size: 0.14em;
  letter-spacing: 0.2em;
}

.process-word.is-active .pw-index {
  color: var(--orange);
}

.process-track {
  position: absolute;
  top: 24%;
  right: 40px;
  bottom: 24%;
  width: 1px;
  background: rgba(255, 255, 255, 0.1);
}

.process-track span {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(180deg, var(--orange), var(--orange-bright));
  transform-origin: top;
  transition: transform 0.1s linear;
}

/* ---------- 分区通用 ---------- */

.section {
  position: relative;
  padding: clamp(84px, 8vw, 140px) 40px;
  scroll-margin-top: 96px;
}

.section-head {
  width: 100%;
  max-width: 1680px;
  margin: 0 auto;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}

.section-num {
  color: var(--orange-bright);
  font-family: var(--font-family-display);
  font-size: 10px;
  letter-spacing: 0.24em;
}

.section-title {
  margin-top: 24px;
  font-family: var(--font-family-display);
  font-size: clamp(2.4rem, 6vw, 7.2rem);
  font-weight: 500;
  line-height: 1.08;
  letter-spacing: -0.05em;
}

/* ---------- 三个工作台 ---------- */

.work-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.34fr) minmax(0, 1fr);
  grid-template-rows: repeat(2, minmax(0, 1fr));
  gap: 20px;
  width: 100%;
  max-width: 1680px;
  height: clamp(560px, 74vh, 760px);
  margin: clamp(40px, 4.5vw, 68px) auto 0;
}

.work-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 0;
  padding: 26px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 28px;
  background: #0a0908;
  cursor: pointer;
  transition:
    transform 0.7s var(--smooth),
    border-color 0.5s ease,
    box-shadow 0.7s var(--smooth);
}

.work-card:first-child {
  grid-row: 1 / span 2;
}

.work-card:first-child .work-title {
  font-size: clamp(1.9rem, 2.8vw, 3rem);
}

.work-card:hover,
.work-card:focus-visible {
  border-color: rgba(236, 90, 0, 0.55);
  outline: none;
  transform: translateY(-8px);
  box-shadow: 0 42px 96px rgba(0, 0, 0, 0.58);
}

.work-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.work-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.72;
  transform: scale(1.02);
  transition:
    transform 1.5s var(--smooth),
    opacity 0.6s ease;
}

.work-card:hover .work-bg img {
  opacity: 0.9;
  transform: scale(1.07);
}

.work-card::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    180deg,
    rgba(6, 5, 4, 0.5) 0%,
    rgba(6, 5, 4, 0.06) 26%,
    rgba(6, 5, 4, 0.5) 58%,
    rgba(6, 5, 4, 0.96) 100%
  );
  pointer-events: none;
}

.work-bg--voice {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 34px;
  background:
    radial-gradient(120% 90% at 50% 32%, rgba(236, 90, 0, 0.4), transparent 58%),
    radial-gradient(90% 80% at 18% 18%, rgba(100, 16, 5, 0.8), transparent 62%),
    #0a0705;
}

.voice-bar {
  flex: 1;
  min-height: 4px;
  max-height: 42%;
  border-radius: 999px;
  background: linear-gradient(180deg, #ff9a5c, rgba(236, 90, 0, 0.16));
  opacity: 0.8;
  animation: voice-pulse 1.8s ease-in-out infinite alternate;
}

@keyframes voice-pulse {
  from {
    transform: scaleY(0.55);
    opacity: 0.45;
  }
  to {
    transform: scaleY(1);
    opacity: 0.95;
  }
}

.work-num {
  position: relative;
  z-index: 2;
  color: rgba(255, 255, 255, 0.7);
  font-family: var(--font-family-display);
  font-size: clamp(1.4rem, 1.8vw, 1.9rem);
  letter-spacing: 0.1em;
}

.work-bottom {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.work-title {
  font-family: var(--font-family-display);
  font-size: clamp(1.45rem, 2vw, 2.1rem);
  font-weight: 600;
  line-height: 1.15;
  letter-spacing: -0.03em;
}

.work-arrow {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  font-size: 15px;
  transition:
    background 0.4s ease,
    border-color 0.4s ease,
    transform 0.5s var(--smooth);
}

.work-card:hover .work-arrow {
  border-color: transparent;
  background: linear-gradient(135deg, var(--orange), var(--deep));
  transform: translate(2px, -2px);
}

/* ---------- Skill 模板 ---------- */

.skill-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  width: 100%;
  max-width: 1680px;
  margin: clamp(40px, 4.5vw, 68px) auto 0;
}

.skill-card {
  display: grid;
  gap: 13px;
  cursor: pointer;
}

.skill-visual {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 20px;
  background: #0a0908;
}

.skill-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: saturate(0.94);
  transition:
    transform 1.1s var(--smooth),
    filter 0.5s ease;
}

.skill-card:hover .skill-visual img {
  filter: saturate(1.12);
  transform: scale(1.06);
}

.skill-index,
.prompt-index {
  position: absolute;
  top: 12px;
  left: 13px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(6, 5, 4, 0.52);
  color: #fff;
  font-family: var(--font-family-display);
  font-size: 9px;
  letter-spacing: 0.16em;
  backdrop-filter: blur(8px);
}

.skill-download {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
  background: rgba(6, 5, 4, 0.58);
  color: #fff;
  font-size: 13px;
  opacity: 0;
  transform: translateY(6px);
  backdrop-filter: blur(12px);
  cursor: pointer;
  transition:
    opacity 0.35s ease,
    transform 0.45s var(--smooth),
    background 0.35s ease;
}

.skill-card:hover .skill-download,
.skill-download:focus-visible {
  opacity: 1;
  transform: translateY(0);
}

.skill-download:hover {
  border-color: transparent;
  background: linear-gradient(90deg, var(--orange), var(--deep));
}

.skill-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.skill-info strong {
  overflow: hidden;
  color: rgba(245, 241, 236, 0.82);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.skill-arrow {
  color: rgba(245, 241, 236, 0.28);
  font-size: 13px;
  transition:
    color 0.3s ease,
    transform 0.4s var(--smooth);
}

.skill-card:hover .skill-arrow {
  color: var(--orange-bright);
  transform: translate(2px, -2px);
}

/* ---------- 提示词模板 ---------- */

.prompt-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: start;
  gap: 16px;
  width: 100%;
  max-width: 1680px;
  margin: clamp(40px, 4.5vw, 68px) auto 0;
}

.prompt-card {
  display: grid;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.prompt-card:nth-child(even) {
  margin-top: clamp(24px, 4vw, 56px);
}

.prompt-visual {
  position: relative;
  display: block;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: #0a0908;
}

.prompt-visual img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 1.1s var(--smooth);
}

.prompt-card:hover .prompt-visual img {
  transform: scale(1.07);
}

.prompt-visual::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(6, 5, 4, 0) 52%, rgba(6, 5, 4, 0.7) 100%);
  pointer-events: none;
}

.prompt-use {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(90deg, var(--orange), var(--deep));
  color: #fff;
  font-size: 13px;
  opacity: 0;
  transform: translateY(8px);
  transition:
    opacity 0.35s ease,
    transform 0.45s var(--smooth);
}

.prompt-card:hover .prompt-use,
.prompt-card:focus-visible .prompt-use {
  opacity: 1;
  transform: translateY(0);
}

.prompt-title {
  display: block;
  margin-top: 11px;
  overflow: hidden;
  color: rgba(245, 241, 236, 0.76);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ---------- 收尾 ---------- */

.outro {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 92svh;
  padding: 130px 40px 140px;
  overflow: hidden;
  border-top: 1px solid var(--line);
}

.outro-bg {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  opacity: 0.24;
  filter: saturate(0.9);
  -webkit-mask-image: radial-gradient(92% 82% at 50% 42%, #000 0%, transparent 74%);
  mask-image: radial-gradient(92% 82% at 50% 42%, #000 0%, transparent 74%);
  pointer-events: none;
}

.outro::after {
  content: '';
  position: absolute;
  bottom: -46%;
  left: 50%;
  width: 1100px;
  height: 780px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(236, 90, 0, 0.26), transparent 64%);
  filter: blur(30px);
  transform: translateX(-50%);
  pointer-events: none;
}

.outro-inner {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  text-align: center;
}

.outro-title {
  font-family: var(--font-family-display);
  font-size: clamp(2.7rem, 8.2vw, 9.2rem);
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.05em;
}

.outro-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: 46px;
}

.outro-btn {
  display: inline-flex;
  align-items: center;
  gap: 18px;
  height: 64px;
  padding: 0 10px 0 30px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: linear-gradient(90deg, var(--orange), var(--deep));
  color: #fff;
  font-family: var(--font-family);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  cursor: pointer;
  box-shadow: 0 24px 60px rgba(236, 90, 0, 0.28);
  transition:
    transform 0.5s var(--smooth),
    box-shadow 0.5s var(--smooth);
}

.outro-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 32px 82px rgba(236, 90, 0, 0.42);
}

.outro-btn-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  font-size: 16px;
}

.outro-ghost {
  padding: 6px 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font-family: var(--font-family);
  font-size: 12px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: color 0.3s ease, border-color 0.3s ease;
}

.outro-ghost:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
}

.to-top {
  position: absolute;
  right: 40px;
  bottom: 30px;
  z-index: 2;
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(245, 241, 236, 0.34);
  font-family: var(--font-family-display);
  font-size: 9.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.3s ease;
}

.to-top:hover {
  color: #fff;
}

/* ---------- 响应式 ---------- */

@media (max-width: 1180px) {
  .nav-links {
    gap: 22px;
    padding: 10px 20px;
  }

  .work-card {
    padding: 22px;
  }
}

@media (max-width: 1080px) {
  .nav {
    grid-template-areas:
      'brand cta'
      'links links';
    grid-template-columns: 1fr auto;
    row-gap: 10px;
    padding-bottom: 12px;
  }

  .brand {
    grid-area: brand;
  }

  .cta {
    grid-area: cta;
  }

  .nav-links {
    grid-area: links;
    justify-self: center;
  }

  .hero {
    padding-top: 152px;
  }

  .hero-main {
    grid-template-columns: minmax(0, 1fr) 250px;
    gap: 34px;
  }

  .index-name {
    font-size: 13.5px;
  }

  .skill-grid,
  .prompt-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .skill-grid > *:last-child,
  .prompt-grid > *:last-child {
    display: none;
  }
}

@media (max-width: 900px) {
  .nav {
    padding: 14px 20px 12px;
  }

  .hero {
    padding: 142px 20px 24px;
  }

  .hero-main {
    grid-template-columns: minmax(0, 1fr);
    align-content: end;
    align-items: start;
    gap: 34px;
    padding-bottom: 34px;
  }

  .hero-index {
    margin-top: 0;
  }

  .scroll-hint {
    display: none;
  }

  .section {
    padding-right: 20px;
    padding-left: 20px;
    scroll-margin-top: 130px;
  }

  .work-grid {
    grid-template-columns: 1fr;
    grid-template-rows: none;
    height: auto;
    gap: 16px;
  }

  .work-card {
    aspect-ratio: 4 / 5;
  }

  .work-card:first-child {
    grid-row: auto;
    aspect-ratio: 1 / 1;
  }

  .process {
    height: 200vh;
  }

  .process-sticky {
    padding: 0 20px;
  }

  .process-words {
    padding-right: 0;
  }

  .process-track {
    right: 20px;
  }

  .skill-grid,
  .prompt-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .skill-grid > *:last-child,
  .prompt-grid > *:last-child {
    display: block;
  }

  .outro {
    padding: 110px 20px 130px;
  }

  .to-top {
    right: 20px;
    bottom: 24px;
  }
}

@media (max-width: 640px) {
  .brand-text {
    font-size: 12px;
    letter-spacing: 0.14em;
  }

  .nav-links {
    gap: 16px;
    padding: 9px 16px;
  }

  .nav-links a,
  .nav-links button {
    font-size: 10px;
    letter-spacing: 0.08em;
  }

  .cta {
    height: 40px;
    padding-left: 15px;
    font-size: 10px;
  }

  .cta-icon {
    width: 28px;
    height: 28px;
  }

  .hero {
    padding-top: 134px;
  }

  .hero-title {
    font-size: clamp(3rem, 15vw, 5.4rem);
    line-height: 1.02;
  }

  .hero-line--2 {
    margin-left: 0;
  }

  .index-row {
    padding: 13px 0;
  }

  .process-word {
    font-size: clamp(3.4rem, 17vw, 5.6rem);
  }

  .section-title {
    font-size: clamp(2.2rem, 10vw, 3.4rem);
    line-height: 1.16;
  }

  .work-card {
    aspect-ratio: 1 / 1;
    border-radius: 22px;
    padding: 20px;
  }

  .prompt-card:nth-child(even) {
    margin-top: 28px;
  }

  .outro-title {
    font-size: clamp(2.3rem, 11vw, 3.8rem);
  }

  .outro-btn {
    height: 58px;
    padding-left: 24px;
  }
}

/* 触屏设备没有 hover，下载与箭头常驻显示 */
@media (hover: none) {
  .skill-download,
  .prompt-use {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-reveal] {
    opacity: 1;
    translate: none;
    transition: none;
  }

  .hero-title,
  .hero-index,
  .hero-foot {
    animation: none;
  }

  .scroll-hint i,
  .voice-bar,
  .caret {
    animation: none;
  }

  .process {
    height: auto;
  }

  .process-sticky {
    position: static;
    height: auto;
    padding-top: 110px;
    padding-bottom: 110px;
  }

  .process-word {
    color: rgba(245, 241, 236, 0.4);
  }

  .process-word.is-active {
    transform: none;
  }

  .process-track {
    display: none;
  }
}
</style>
