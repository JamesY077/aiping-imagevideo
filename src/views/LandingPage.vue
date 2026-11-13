<template>
  <div class="loot-home">
    <div class="page-progress" aria-hidden="true">
      <span :style="{ transform: `scaleX(${pageProgress / 100})` }" />
    </div>
    <div class="noise" aria-hidden="true" />

    <header class="loot-nav" :class="{ 'is-scrolled': scrolled }">
      <div class="nav-left">
        <button class="brand" type="button" aria-label="ArtRealm 首页" @click="router.push('/')">
          <img class="brand-mark" :src="assetUrl('/logo1.webp')" alt="" />
          <span class="brand-text">ARTREALM<span class="brand-dot">.</span></span>
        </button>
      </div>

      <nav class="nav-pill" aria-label="主导航">
        <a href="#zones" @click.prevent="scrollToZones">创作分区</a>
        <a href="#manifesto" @click.prevent="scrollToManifesto">创作流程</a>
        <a href="#inspiration" @click.prevent="scrollToInspiration">模板库</a>
        <span class="nav-divider" aria-hidden="true" />
        <span class="nav-progress">{{ pageProgress }}%</span>
      </nav>

      <div class="nav-right">
        <button class="nav-text-btn" type="button" @click="goModel3D">3D 建模</button>
        <button class="cta-pill" type="button" @click="router.push('/setup')">
          <span>{{ hasSession ? '进入工坊' : '开始创作' }}</span>
          <span class="cta-pill-icon" aria-hidden="true">
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
      </div>
    </header>

    <main>
      <!-- Hero -->
      <section class="loot-hero" aria-labelledby="home-title">
        <div class="hero-atmosphere" :style="{ backgroundImage: `url(${assetUrl('/home-collage-bg.webp')})` }" aria-hidden="true" />

        <div class="hero-grid">
          <div class="hero-heading">
            <p class="hero-eyebrow" data-reveal>AI Creative Studio · ArtRealm</p>
            <h1 id="home-title" class="hero-title">
              <span class="hero-line hero-line--1" data-reveal>把灵感</span>
              <span class="hero-line hero-line--2" data-reveal>做成作品</span>
            </h1>
            <p class="hero-sub" data-reveal>
              图片、视频、配音与 3D 模型，四条生产线在同一块画布上。
              <span class="hero-sub-strong">从一句描述开始，到可交付的成片结束。</span>
            </p>
          </div>

          <aside class="hero-cards" aria-label="创作概览">
            <article
              class="hero-card hero-card--a"
              role="button"
              tabindex="0"
              data-reveal
              @click="enterZone(zones[1])"
              @keydown.enter.prevent="enterZone(zones[1])"
              @keydown.space.prevent="enterZone(zones[1])"
            >
              <span class="hero-card-kicker">Workspaces</span>
              <span class="hero-card-num">03</span>
              <span class="hero-card-title">创作工作台</span>
              <span class="hero-card-desc">Skill · 图片视频 · 配音</span>
              <span class="hero-card-arrow" aria-hidden="true">↗</span>
            </article>

            <article
              class="hero-card hero-card--b"
              role="button"
              tabindex="0"
              data-reveal
              @click="enterZone(zones[2])"
              @keydown.enter.prevent="enterZone(zones[2])"
              @keydown.space.prevent="enterZone(zones[2])"
            >
              <span class="hero-card-kicker">Model Matrix</span>
              <div class="hero-chips">
                <span>Seedream</span>
                <span>Seedance</span>
                <span>Kling</span>
                <span>MiniMax</span>
              </div>
              <span class="hero-card-num">12<span class="num-plus">+</span></span>
              <span class="hero-card-desc">图像 / 视频 / 语音 / 3D 模型</span>
              <span class="hero-card-arrow" aria-hidden="true">↗</span>
            </article>
          </aside>
        </div>

        <div class="hero-foot">
          <div class="hero-meta" data-reveal>
            <span class="meta-index">(01)</span>
            <p>
              把日常的创作流程，压缩成<span class="hl">一次对话</span>。素材、模型、画布与导出，都在这里。
            </p>
          </div>

          <button class="hero-ticker" type="button" data-reveal @click="useTypedPrompt">
            <span class="ticker-label">Prompt</span>
            <span class="ticker-text">{{ typewriterText }}<i class="ticker-caret" aria-hidden="true" /></span>
            <span class="ticker-action" aria-hidden="true">
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

          <div class="hero-scroll" aria-hidden="true">
            <span>Scroll</span>
            <span class="hero-scroll-line" />
          </div>
        </div>
      </section>

      <!-- 滚动驱动的创作流程 -->
      <section id="manifesto" class="manifesto" aria-label="创作流程">
        <div class="manifesto-sticky">
          <div class="manifesto-inner">
            <div class="manifesto-words">
              <p class="manifesto-kicker">How it works</p>
              <div
                v-for="(item, index) in manifestoWords"
                :key="item.word"
                class="manifesto-word"
                :class="{ 'is-active': activeManifesto === index }"
              >
                <span class="mw-index">{{ item.index }}</span>
                <span class="mw-text">{{ item.word }}</span>
                <span class="mw-en">{{ item.en }}</span>
              </div>
            </div>

            <div class="manifesto-side">
              <span class="manifesto-side-label">Process</span>
              <p>{{ manifestoWords[activeManifesto].desc }}</p>
              <span class="manifesto-side-count">0{{ activeManifesto + 1 }} / 03</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 三大分区 -->
      <section id="zones" class="loot-section zones-section">
        <header class="section-head">
          <div class="section-head-main">
            <span class="section-index" data-reveal>02 / Workspaces</span>
            <h2 class="section-title" data-reveal>
              三个工作台<br />
              <span class="title-accent">一条创作动线</span>
            </h2>
          </div>
          <p class="section-desc" data-reveal>
            从 Skill 规范到画面生成，再到声音演绎。选一个分区进入，其余交给模型与画布。
          </p>
        </header>

        <div class="zone-grid">
          <article
            v-for="zone in zones"
            :key="zone.key"
            class="zone-card"
            :class="[`zone-card--${zone.key}`, { 'is-soon': zone.soon }]"
            role="button"
            tabindex="0"
            data-reveal
            :aria-label="zone.cta"
            @click="enterZone(zone)"
            @keydown.enter.prevent="enterZone(zone)"
            @keydown.space.prevent="enterZone(zone)"
          >
            <div v-if="zone.image" class="zone-media-layer">
              <img :src="zone.image" alt="" loading="lazy" decoding="async" />
            </div>
            <div v-else class="zone-voice-art" aria-hidden="true">
              <span
                v-for="(height, index) in voiceWave"
                :key="index"
                class="voice-bar"
                :style="{ height: `${height}%`, animationDelay: `${index * 55}ms` }"
              />
            </div>

            <div class="zone-top">
              <span class="zone-step">{{ zone.index }}</span>
              <span class="zone-label">{{ zone.label }}</span>
              <span v-if="zone.soon" class="zone-badge">即将上线</span>
            </div>

            <div class="zone-body">
              <h3 class="zone-title">{{ zone.title }}</h3>
              <p class="zone-desc">{{ zone.desc }}</p>
              <div class="zone-tags">
                <span v-for="tag in zone.tags" :key="tag">{{ tag }}</span>
              </div>
              <div class="zone-cta">
                <span>{{ zone.cta }}</span>
                <span class="zone-cta-icon" aria-hidden="true">↗</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <!-- Skill 模板库 -->
      <section id="inspiration" class="loot-section library-section">
        <header class="section-head">
          <div class="section-head-main">
            <span class="section-index" data-reveal>03 / Skill Library</span>
            <h2 class="section-title" data-reveal>
              把风格<br />
              <span class="title-accent">变成可复用的规范</span>
            </h2>
          </div>
          <p class="section-desc" data-reveal>
            一句需求拆成完整创作规范，沉淀成 Skill。下载后可直接放进工作台复用与修改。
          </p>
        </header>

        <div class="skill-grid">
          <article
            v-for="(item, index) in skillTemplates"
            :key="item.title"
            class="skill-card"
            role="button"
            tabindex="0"
            data-reveal
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
                :aria-label="`下载 ${item.title} Skill 文件`"
                @click.stop="handleSkillDownloadClick(item)"
              >
                下载 <span aria-hidden="true">↓</span>
              </button>
            </div>
            <div class="skill-info">
              <strong>{{ item.title }}</strong>
              <span class="skill-arrow" aria-hidden="true">↗</span>
            </div>
          </article>
        </div>
      </section>

      <!-- 提示词模板库 -->
      <section class="loot-section prompt-section">
        <header class="section-head">
          <div class="section-head-main">
            <span class="section-index" data-reveal>04 / Prompt Library</span>
            <h2 class="section-title" data-reveal>
              复制一个起点<br />
              <span class="title-accent">更快抵达成片</span>
            </h2>
          </div>
          <p class="section-desc" data-reveal>
            产品图、电影感场景、UI 概念稿。点开任意模板，提示词会直接带进创作工坊。
          </p>
        </header>

        <div class="prompt-grid">
          <button
            v-for="(item, index) in templates"
            :key="item.title"
            class="prompt-card"
            type="button"
            data-reveal
            @click="handleTemplateClick(item)"
          >
            <span class="prompt-visual">
              <img :src="item.image" alt="" loading="lazy" decoding="async" />
              <span class="prompt-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="prompt-use">使用模板 ↗</span>
            </span>
            <span class="prompt-title">{{ item.title }}</span>
          </button>
        </div>
      </section>

      <!-- 收尾 CTA -->
      <section class="final-cta">
        <div class="final-bg" :style="{ backgroundImage: `url(${assetUrl('/home-collage-bg.webp')})` }" aria-hidden="true" />

        <div class="final-inner">
          <p class="final-kicker" data-reveal>Start Creating</p>
          <h2 class="final-title" data-reveal>
            灵感不用等<br />
            <span class="title-accent">现在就变成作品</span>
          </h2>
          <div class="final-actions" data-reveal>
            <button class="final-btn" type="button" @click="router.push('/setup')">
              <span>{{ hasSession ? '进入创作工坊' : '开始创作' }}</span>
              <span class="final-btn-icon" aria-hidden="true">↗</span>
            </button>
            <button class="final-ghost" type="button" @click="goModel3D">先看看 3D 建模 →</button>
          </div>
        </div>

        <div class="final-meta">
          <span>ArtRealm © 2026</span>
          <span>3D · Image · Video · Voice</span>
          <button type="button" @click="scrollToTop">回到顶部 ↑</button>
        </div>
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
  label: string
  title: string
  desc: string
  tags: string[]
  cta: string
  target: 'skill' | 'studio' | 'voice'
  image?: string
  soon?: boolean
}

const zones: CreativeZone[] = [
  {
    key: 'skill',
    index: '01',
    label: 'Skill Studio',
    title: 'Skill 创作',
    desc: '把一句话需求拆成可复用的创作规范，沉淀为标准 Skill，随时应用与修改。',
    tags: ['模板库', '标准化 Markdown', '本地应用'],
    cta: '进入 Skill 工作台',
    target: 'skill',
    image: assetUrl('/skill-wkw-neon-loneliness-style.webp'),
  },
  {
    key: 'media',
    index: '02',
    label: 'Image & Video',
    title: '图片视频生成',
    desc: '文生图、图生视频、首尾帧与多模态参考，同一个工作台完成全部画面创作。',
    tags: ['Seedream', 'Seedance', 'MiniMax H3', 'Kling'],
    cta: '进入创作工坊',
    target: 'studio',
    image: assetUrl('/template-f1.webp'),
  },
  {
    key: 'voice',
    index: '03',
    label: 'Voice Studio',
    title: '配音创作',
    desc: '文本转语音与声音复刻：音色、语速、语调、音量都能调，10 秒样本就能复刻自己的声音。',
    tags: ['MiniMax Speech 2.8', '声音复刻', '情绪演绎'],
    cta: '进入配音工作台',
    target: 'voice',
  },
]

const skillTemplates = [
  {
    title: '王家卫式霓虹孤独风格',
    theme: 'template-skill',
    image: assetUrl('/skill-wkw-neon-loneliness-style.webp'),
    fileUrl: '/skills/wkw-neon-loneliness-style.md',
    fileName: 'wkw-neon-loneliness-style.md',
  },
  {
    title: '剪纸定格动画',
    theme: 'template-skill',
    image: assetUrl('/skill-papercut-stop-motion-explainer.webp'),
    fileUrl: '/skills/papercut-stop-motion-explainer.md',
    fileName: 'papercut-stop-motion-explainer.md',
  },
  {
    title: '手绘发光动画实拍融合',
    theme: 'template-skill',
    image: assetUrl('/skill-handdrawn-live-video-generator.webp'),
    fileUrl: '/skills/handdrawn-live-video-generator.md',
    fileName: 'handdrawn-live-video-generator.md',
  },
  {
    title: '极简旅行海报',
    theme: 'template-skill',
    image: assetUrl('/skill-photo-to-minimal-vector-travel-poster.webp'),
    fileUrl: '/skills/photo-to-minimal-vector-travel-poster.md',
    fileName: 'photo-to-minimal-vector-travel-poster.md',
  },
]

const templates = [
  {
    title: 'F1 飞驰赛车',
    prompt: 'F1 方程式赛车在赛道上高速飞驰，低机位广角镜头，车身运动模糊，轮胎带起火花与水雾，雨后赛道反光，电影级运动摄影，浅景深，强烈速度感，超清细节',
    theme: 'template-race',
    image: assetUrl('/template-f1.webp'),
  },
  {
    title: 'iPhone 17 产品电商图',
    prompt: 'iPhone 17 旗舰手机产品电商主图，钛金属边框高光，深色科技感背景，蓝紫渐变轮廓光，镜头模组与屏幕清晰展示，悬浮构图，商业产品摄影，高级质感，超清渲染',
    theme: 'template-product',
    image: assetUrl('/template-iphone17.webp'),
  },
  {
    title: '科技感网页 UI',
    prompt: '未来科技感网页 UI 界面设计，深色模式仪表盘，玻璃拟态数据卡片，蓝紫渐变数据可视化图表，悬浮导航栏，清晰信息层级，高清界面设计，现代极简',
    theme: 'template-tech',
    image: assetUrl('/template-webui.webp'),
  },
  {
    title: '卡通兔子',
    prompt: '可爱卡通兔子角色，软萌大眼睛，奶油白毛绒质感，治愈系绘本插画风格，柔和自然光，浅色温馨场景，精致细节，迪士尼级角色设计',
    theme: 'template-commerce',
    image: assetUrl('/template-rabbit.webp'),
  },
  {
    title: '无线耳机结构解析',
    prompt: '无线头戴式降噪耳机爆炸分解产品图，精密声学结构与内部电子组件清晰展示，USB-C 充电口、电池、驱动单元、麦克风阵列与记忆棉耳罩，工业设计图纸风格，深色科技背景，商业产品渲染，超清细节',
    theme: 'template-commerce',
    image: assetUrl('/template-headphones.webp'),
  },
  {
    title: '影视爆炸现场',
    prompt: '电影级爆炸现场，橙红色火球与黑色浓烟升腾，尘土碎片飞溅，冲击波，逆光剪影，广角构图，逼真影视特效，超高细节',
    theme: 'template-monster',
    image: assetUrl('/template-landscape.webp'),
  },
  {
    title: '中世纪战士',
    prompt: '中世纪战士角色，厚重金属铠甲，战损做旧，斗篷，手持长剑，阴天战场背景，电影级写实人像，戏剧性侧光，细腻质感，史诗氛围',
    theme: 'template-hero',
    image: assetUrl('/template-festival.webp'),
  },
  {
    title: '专业相机三视图',
    prompt: '专业数码相机产品三视图与爆炸分解展示，黑色机身，35mm f/2.0 定焦镜头，标注尺寸、按键与接口，工业设计图纸风格，商业产品展示，超清渲染',
    theme: 'template-commerce',
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
  { index: '01', word: '生成', en: 'Generate', desc: '一句描述直接产出画面、视频或 3D 模型，不用来回切换工具。' },
  { index: '02', word: '编排', en: 'Orchestrate', desc: '模板、参考图与镜头语言放在同一块画布上，边生成边调整。' },
  { index: '03', word: '交付', en: 'Deliver', desc: '图片、视频、配音与 3D 资产一次导出，直接进入下一步工作。' },
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

/** 页面进度与滚动状态：顶部细进度条 + 导航百分比 + 流程分区的词语高亮。 */
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

  const manifesto = document.getElementById('manifesto')
  if (!manifesto) return
  const rect = manifesto.getBoundingClientRect()
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

function scrollToManifesto() {
  document.getElementById('manifesto')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollToInspiration() {
  document.getElementById('inspiration')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

/** 点 hero 底部的打字机提示词，直接把完整句子带进工坊。 */
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
.loot-home {
  --orange: #ec5a00;
  --orange-bright: #ff7243;
  --red: #641005;
  --ink: #060504;
  --line: rgba(255, 255, 255, 0.12);
  --muted: rgba(245, 241, 236, 0.52);
  --smooth: cubic-bezier(0.16, 1, 0.3, 1);

  position: relative;
  isolation: isolate;
  width: 100%;
  min-height: 100dvh;
  overflow-x: clip;
  background: var(--ink);
  color: #f5f1ec;
}

/* ---------- 全局装饰 ---------- */

.page-progress {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 70;
  width: 100%;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
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
  translate: 0 26px;
  transition:
    opacity 0.85s var(--smooth),
    translate 0.85s var(--smooth);
}

[data-reveal].is-visible {
  opacity: 1;
  translate: 0 0;
}

/* ---------- 导航 ---------- */

.loot-nav {
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

.loot-nav.is-scrolled {
  background: linear-gradient(180deg, rgba(6, 5, 4, 0.82), rgba(6, 5, 4, 0.18) 78%, transparent);
  backdrop-filter: blur(12px);
}

.nav-left {
  display: flex;
  align-items: center;
}

.brand {
  display: inline-flex;
  align-items: center;
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

.nav-pill {
  display: inline-flex;
  align-items: center;
  gap: 26px;
  padding: 11px 20px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.045);
  backdrop-filter: blur(24px) saturate(140%);
}

.nav-pill a {
  color: rgba(245, 241, 236, 0.62);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-decoration: none;
  text-transform: uppercase;
  transition: color 0.25s ease;
}

.nav-pill a:hover {
  color: #fff;
}

.nav-divider {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.18);
}

.nav-progress {
  min-width: 34px;
  color: var(--orange-bright);
  font-family: var(--font-family-display);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.08em;
  text-align: right;
}

.nav-right {
  display: flex;
  align-items: center;
  justify-self: end;
  gap: 18px;
}

.nav-text-btn {
  padding: 0;
  border: 0;
  background: transparent;
  color: rgba(245, 241, 236, 0.62);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.25s ease;
}

.nav-text-btn:hover {
  color: #fff;
}

.cta-pill {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  height: 44px;
  padding: 0 6px 0 20px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: linear-gradient(90deg, var(--orange), var(--red));
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 16px 40px rgba(236, 90, 0, 0.24);
  transition:
    transform 0.45s var(--smooth),
    box-shadow 0.45s var(--smooth);
}

.cta-pill:hover {
  transform: translateY(-2px);
  box-shadow: 0 22px 54px rgba(236, 90, 0, 0.36);
}

.cta-pill-icon {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
}

.cta-pill svg {
  width: 13px;
  height: 13px;
}

/* ---------- Hero ---------- */

.loot-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100svh;
  padding: 118px 40px 30px;
  overflow: hidden;
}

.hero-atmosphere {
  position: absolute;
  inset: -6% -8% 0;
  z-index: 0;
  background-position: center 28%;
  background-size: cover;
  opacity: 0.24;
  filter: saturate(0.9) contrast(1.05);
  -webkit-mask-image: radial-gradient(120% 92% at 68% 18%, #000 0%, transparent 70%);
  mask-image: radial-gradient(120% 92% at 68% 18%, #000 0%, transparent 70%);
  pointer-events: none;
}

.loot-hero::before {
  content: '';
  position: absolute;
  top: -32%;
  right: -6%;
  z-index: 0;
  width: 780px;
  height: 780px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(236, 90, 0, 0.22), transparent 66%);
  filter: blur(30px);
  pointer-events: none;
}

.hero-grid {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
  align-items: end;
  gap: 44px;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
  padding-bottom: 40px;
  flex: 1;
}

.hero-heading {
  min-width: 0;
}

.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 14px;
  color: rgba(245, 241, 236, 0.42);
  font-family: var(--font-family-display);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.hero-eyebrow::before {
  content: '';
  width: 46px;
  height: 1px;
  background: var(--orange);
}

.hero-title {
  margin: 28px 0 0;
  font-family: var(--font-family-display);
  font-weight: 500;
  font-size: clamp(3.4rem, 9.6vw, 10.8rem);
  line-height: 0.94;
  letter-spacing: -0.055em;
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
  margin-left: clamp(0px, 7vw, 150px);
  background: linear-gradient(92deg, #ffffff 0%, #ffb27a 46%, #ec5a00 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-sub {
  max-width: 430px;
  margin-top: 32px;
  color: var(--muted);
  font-size: 13.5px;
  line-height: 1.8;
}

.hero-sub-strong {
  display: block;
  margin-top: 6px;
  color: rgba(245, 241, 236, 0.86);
}

.hero-cards {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16px;
  padding-bottom: 6px;
}

.hero-card:focus-visible {
  border-color: var(--orange-bright);
  outline: none;
  box-shadow:
    0 0 0 3px rgba(236, 90, 0, 0.35),
    0 30px 70px rgba(0, 0, 0, 0.45);
}

.hero-card {
  position: relative;
  display: grid;
  gap: 8px;
  width: min(100%, 318px);
  padding: 20px 22px 22px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 24px;
  background:
    linear-gradient(150deg, rgba(255, 255, 255, 0.11) 0%, rgba(255, 255, 255, 0.03) 52%, rgba(255, 255, 255, 0.06) 100%);
  box-shadow:
    0 30px 70px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(22px) saturate(135%);
  cursor: pointer;
  transition:
    border-color 0.45s ease,
    transform 0.65s var(--smooth),
    box-shadow 0.65s var(--smooth);
}

.hero-card--a {
  transform: rotate(-1.6deg);
}

.hero-card--b {
  transform: rotate(1.2deg) translateX(-18px);
}

.hero-card:hover {
  border-color: rgba(236, 90, 0, 0.55);
  transform: rotate(0deg) translateY(-6px);
  box-shadow:
    0 40px 90px rgba(0, 0, 0, 0.55),
    0 0 60px -18px rgba(236, 90, 0, 0.45);
}

.hero-card-kicker {
  color: rgba(245, 241, 236, 0.42);
  font-family: var(--font-family-display);
  font-size: 9.5px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.hero-card-num {
  font-family: var(--font-family-display);
  font-size: 54px;
  font-weight: 500;
  line-height: 0.9;
  letter-spacing: -0.05em;
  background: linear-gradient(92deg, #fff 0%, #ffb27a 62%, #ec5a00 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.num-plus {
  font-size: 0.5em;
  vertical-align: super;
}

.hero-card-title {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.hero-card-desc {
  color: rgba(245, 241, 236, 0.46);
  font-size: 11px;
  letter-spacing: 0.05em;
}

.hero-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.hero-chips span {
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 999px;
  color: rgba(245, 241, 236, 0.6);
  font-size: 9.5px;
  letter-spacing: 0.06em;
}

.hero-card-arrow {
  position: absolute;
  top: 16px;
  right: 18px;
  color: rgba(245, 241, 236, 0.4);
  font-size: 14px;
  transition: color 0.35s ease, transform 0.45s var(--smooth);
}

.hero-card:hover .hero-card-arrow {
  color: var(--orange-bright);
  transform: translate(2px, -2px);
}

.hero-foot {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 320px) minmax(0, 1fr) auto;
  align-items: center;
  gap: 28px;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
  padding-top: 22px;
  border-top: 1px solid var(--line);
}

.hero-meta {
  display: flex;
  gap: 12px;
  color: var(--muted);
  font-size: 11.5px;
  line-height: 1.65;
}

.meta-index {
  flex: 0 0 auto;
  padding-top: 2px;
  color: var(--orange-bright);
  font-family: var(--font-family-display);
  font-size: 9.5px;
  letter-spacing: 0.18em;
}

.hl {
  color: #fff;
}

.hero-ticker {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  padding: 13px 16px;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  text-align: left;
  backdrop-filter: blur(18px);
  cursor: pointer;
  transition: border-color 0.35s ease, background 0.35s ease;
}

.hero-ticker:hover {
  border-color: rgba(236, 90, 0, 0.45);
  background: rgba(236, 90, 0, 0.07);
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

.ticker-caret {
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

.ticker-action {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(245, 241, 236, 0.72);
}

.ticker-action svg {
  width: 12px;
  height: 12px;
}

.hero-ticker:hover .ticker-action {
  background: var(--orange);
  color: #fff;
}

.hero-scroll {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  color: rgba(245, 241, 236, 0.32);
  font-family: var(--font-family-display);
  font-size: 9px;
  letter-spacing: 0.26em;
  text-transform: uppercase;
}

.hero-scroll-line {
  width: 1px;
  height: 44px;
  background: linear-gradient(180deg, var(--orange), transparent);
  animation: scroll-pulse 2.2s ease-in-out infinite;
}

@keyframes scroll-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scaleY(0.72);
    transform-origin: top;
  }
  50% {
    opacity: 1;
    transform: scaleY(1);
    transform-origin: top;
  }
}

/* ---------- 滚动流程 ---------- */

.manifesto {
  position: relative;
  height: 260vh;
}

.manifesto-sticky {
  position: sticky;
  top: 0;
  display: grid;
  place-items: center;
  height: 100svh;
  padding: 0 40px;
  overflow: hidden;
}

.manifesto-inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  align-items: end;
  gap: 60px;
  width: 100%;
  max-width: 1560px;
}

.manifesto-words {
  display: grid;
  min-width: 0;
}

.manifesto-kicker {
  margin-bottom: 26px;
  color: rgba(245, 241, 236, 0.32);
  font-family: var(--font-family-display);
  font-size: 10px;
  letter-spacing: 0.32em;
  text-transform: uppercase;
}

.manifesto-word {
  display: flex;
  align-items: baseline;
  gap: clamp(12px, 2vw, 32px);
  color: rgba(245, 241, 236, 0.14);
  font-family: var(--font-family-display);
  font-size: clamp(3rem, 9vw, 9.6rem);
  font-weight: 500;
  line-height: 1.12;
  letter-spacing: -0.05em;
  transition:
    color 0.5s ease,
    transform 0.8s var(--smooth);
}

.manifesto-word.is-active {
  color: #fff;
  transform: translateX(clamp(12px, 3vw, 52px));
}

.manifesto-word.is-active .mw-text {
  background: linear-gradient(92deg, #ffffff 0%, #ff9a5c 55%, var(--orange) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.mw-index {
  color: rgba(245, 241, 236, 0.3);
  font-size: 0.16em;
  letter-spacing: 0.2em;
}

.manifesto-word.is-active .mw-index {
  color: var(--orange);
}

.mw-en {
  color: rgba(245, 241, 236, 0.22);
  font-size: 0.13em;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.manifesto-word.is-active .mw-en {
  color: rgba(255, 114, 67, 0.6);
}

.manifesto-side {
  display: grid;
  align-content: space-between;
  gap: 16px;
  min-height: 168px;
  padding: 4px 0 6px 24px;
  border-left: 1px solid var(--line);
}

.manifesto-side-label {
  color: var(--orange-bright);
  font-family: var(--font-family-display);
  font-size: 9.5px;
  letter-spacing: 0.26em;
  text-transform: uppercase;
}

.manifesto-side p {
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.8;
}

.manifesto-side-count {
  color: rgba(245, 241, 236, 0.32);
  font-family: var(--font-family-display);
  font-size: 10px;
  letter-spacing: 0.22em;
}

/* ---------- 分区通用 ---------- */

.loot-section {
  position: relative;
  padding: clamp(90px, 10vw, 150px) 40px;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 60px;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto 52px;
  padding-bottom: 26px;
  border-bottom: 1px solid var(--line);
}

.section-head-main {
  display: grid;
  gap: 18px;
}

.section-index {
  color: var(--orange-bright);
  font-family: var(--font-family-display);
  font-size: 10px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
}

.section-title {
  font-family: var(--font-family-display);
  font-size: clamp(2.5rem, 5.6vw, 6rem);
  font-weight: 500;
  line-height: 1.1;
  letter-spacing: -0.045em;
}

.title-accent {
  background: linear-gradient(92deg, #ffffff 0%, #ffb27a 42%, var(--orange) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.section-desc {
  max-width: 330px;
  padding-bottom: 6px;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.8;
}

/* ---------- 三大工作台 ---------- */

.zones-section {
  scroll-margin-top: 96px;
}

.zone-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
}

.zone-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 540px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 30px;
  background: #0a0908;
  cursor: pointer;
  transition:
    transform 0.65s var(--smooth),
    border-color 0.5s ease,
    box-shadow 0.65s var(--smooth);
}

.zone-card:hover,
.zone-card:focus-visible {
  border-color: rgba(236, 90, 0, 0.55);
  outline: none;
  transform: translateY(-8px);
  box-shadow: 0 42px 96px rgba(0, 0, 0, 0.58);
}

.zone-media-layer,
.zone-voice-art {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.zone-media-layer img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.6;
  transform: scale(1.02);
  transition:
    transform 1.4s var(--smooth),
    opacity 0.6s ease;
}

.zone-card:hover .zone-media-layer img {
  opacity: 0.78;
  transform: scale(1.08);
}

.zone-voice-art {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 34px;
  background:
    radial-gradient(120% 90% at 50% 32%, rgba(236, 90, 0, 0.36), transparent 58%),
    radial-gradient(90% 80% at 18% 18%, rgba(100, 16, 5, 0.75), transparent 62%),
    #0a0705;
}

.voice-bar {
  flex: 1;
  min-height: 4px;
  max-height: 44%;
  border-radius: 999px;
  background: linear-gradient(180deg, #ff9a5c, rgba(236, 90, 0, 0.18));
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

.zone-card::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    180deg,
    rgba(6, 5, 4, 0.04) 0%,
    rgba(6, 5, 4, 0.62) 46%,
    rgba(6, 5, 4, 0.95) 78%,
    #060504 100%
  );
  pointer-events: none;
}

.zone-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 24px 24px 0;
}

.zone-step {
  color: var(--orange-bright);
  font-family: var(--font-family-display);
  font-size: 11.5px;
  letter-spacing: 0.2em;
}

.zone-label {
  color: rgba(245, 241, 236, 0.48);
  font-family: var(--font-family-display);
  font-size: 9.5px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.zone-badge {
  margin-left: auto;
  padding: 5px 10px;
  border: 1px solid rgba(255, 178, 122, 0.4);
  border-radius: 999px;
  background: rgba(236, 90, 0, 0.14);
  color: #ffd0b3;
  font-size: 10px;
  letter-spacing: 0.08em;
}

.zone-body {
  position: relative;
  z-index: 2;
  display: grid;
  gap: 14px;
  margin-top: auto;
  padding: 24px;
}

.zone-title {
  font-family: var(--font-family-display);
  font-size: clamp(1.6rem, 2.2vw, 2.2rem);
  font-weight: 600;
  letter-spacing: -0.03em;
}

.zone-desc {
  max-width: 34ch;
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.75;
}

.zone-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.zone-tags span {
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(245, 241, 236, 0.66);
  font-size: 10px;
  letter-spacing: 0.05em;
}

.zone-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-top: 2px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.13);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.zone-cta-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 50%;
  font-size: 14px;
  transition:
    background 0.4s ease,
    border-color 0.4s ease,
    transform 0.5s var(--smooth);
}

.zone-card:hover .zone-cta-icon {
  border-color: transparent;
  background: linear-gradient(135deg, var(--orange), var(--red));
  transform: translate(2px, -2px);
}

/* ---------- 模板库 ---------- */

.library-section {
  scroll-margin-top: 96px;
}

.skill-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
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

.skill-index {
  position: absolute;
  top: 12px;
  left: 13px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(6, 5, 4, 0.52);
  color: #fff;
  font-family: var(--font-family-display);
  font-size: 9.5px;
  letter-spacing: 0.18em;
  backdrop-filter: blur(8px);
}

.skill-download {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(6, 5, 4, 0.58);
  color: #fff;
  font-size: 10.5px;
  letter-spacing: 0.08em;
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
  background: linear-gradient(90deg, var(--orange), var(--red));
  border-color: transparent;
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
  color: rgba(245, 241, 236, 0.3);
  font-size: 13px;
  transition: color 0.3s ease, transform 0.4s var(--smooth);
}

.skill-card:hover .skill-arrow {
  color: var(--orange-bright);
  transform: translate(2px, -2px);
}

.prompt-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  width: 100%;
  max-width: 1560px;
  margin: 0 auto;
}

.prompt-card {
  display: grid;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
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
  background: linear-gradient(180deg, rgba(6, 5, 4, 0) 46%, rgba(6, 5, 4, 0.78) 100%);
  pointer-events: none;
}

.prompt-index {
  position: absolute;
  top: 11px;
  left: 12px;
  z-index: 2;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(6, 5, 4, 0.5);
  color: #fff;
  font-family: var(--font-family-display);
  font-size: 9px;
  letter-spacing: 0.16em;
  backdrop-filter: blur(8px);
}

.prompt-use {
  position: absolute;
  bottom: 12px;
  left: 12px;
  z-index: 2;
  padding: 8px 12px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--orange), var(--red));
  color: #fff;
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
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
  margin-top: 10px;
  overflow: hidden;
  color: rgba(245, 241, 236, 0.76);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* ---------- 收尾 ---------- */

.final-cta {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 100svh;
  padding: 130px 40px 150px;
  overflow: hidden;
  border-top: 1px solid var(--line);
}

.final-bg {
  position: absolute;
  inset: 0;
  background-position: center;
  background-size: cover;
  opacity: 0.26;
  filter: saturate(0.9);
  -webkit-mask-image: radial-gradient(92% 82% at 50% 42%, #000 0%, transparent 74%);
  mask-image: radial-gradient(92% 82% at 50% 42%, #000 0%, transparent 74%);
  pointer-events: none;
}

.final-cta::after {
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

.final-inner {
  position: relative;
  z-index: 2;
  display: grid;
  justify-items: center;
  text-align: center;
}

.final-kicker {
  margin-bottom: 26px;
  color: var(--orange-bright);
  font-family: var(--font-family-display);
  font-size: 10px;
  letter-spacing: 0.34em;
  text-transform: uppercase;
}

.final-title {
  font-family: var(--font-family-display);
  font-size: clamp(2.9rem, 8.4vw, 9.4rem);
  font-weight: 500;
  line-height: 1.12;
  letter-spacing: -0.05em;
}

.final-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 22px;
  margin-top: 46px;
}

.final-btn {
  display: inline-flex;
  align-items: center;
  gap: 18px;
  height: 64px;
  padding: 0 10px 0 30px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: linear-gradient(90deg, var(--orange), var(--red));
  color: #fff;
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 24px 60px rgba(236, 90, 0, 0.28);
  transition:
    transform 0.5s var(--smooth),
    box-shadow 0.5s var(--smooth);
}

.final-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 32px 82px rgba(236, 90, 0, 0.42);
}

.final-btn-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  font-size: 16px;
}

.final-ghost {
  padding: 6px 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  font-size: 12px;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: color 0.3s ease, border-color 0.3s ease;
}

.final-ghost:hover {
  border-color: rgba(255, 255, 255, 0.4);
  color: #fff;
}

.final-meta {
  position: absolute;
  right: 40px;
  bottom: 30px;
  left: 40px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: rgba(245, 241, 236, 0.34);
  font-family: var(--font-family-display);
  font-size: 9.5px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.final-meta button {
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  cursor: pointer;
  transition: color 0.3s ease;
}

.final-meta button:hover {
  color: #fff;
}

/* ---------- 响应式 ---------- */

@media (max-width: 1180px) {
  .nav-pill {
    gap: 18px;
  }

  .hero-card {
    width: min(100%, 280px);
  }

  .zone-card {
    min-height: 500px;
  }
}

/* 平板宽度下三列会挤到 300px，改成 2 列 + 整行第三张，排版更稳。 */
@media (max-width: 1080px) and (min-width: 901px) {
  .zone-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .zone-card:last-child {
    grid-column: 1 / -1;
    min-height: 420px;
  }

  .zone-card:last-child .zone-body {
    max-width: 620px;
  }
}

@media (max-width: 1080px) {
  .loot-nav {
    grid-template-areas:
      'brand cta'
      'nav nav';
    grid-template-columns: 1fr auto;
    row-gap: 10px;
    padding-bottom: 12px;
  }

  .nav-left {
    grid-area: brand;
  }

  .nav-right {
    grid-area: cta;
  }

  .nav-pill {
    grid-area: nav;
    justify-self: center;
    gap: 20px;
    padding: 9px 18px;
  }

  .loot-hero {
    padding-top: 150px;
  }

  .hero-grid {
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 32px;
  }

  .hero-card {
    width: 100%;
    padding: 18px;
  }

  .hero-card-num {
    font-size: 44px;
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
  .loot-nav {
    padding: 14px 20px 12px;
  }

  .loot-hero {
    padding: 140px 20px 24px;
  }

  .hero-grid {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
    gap: 34px;
    padding-top: 24px;
  }

  .hero-cards {
    flex-direction: row;
    align-items: stretch;
    justify-content: flex-start;
    padding-bottom: 0;
  }

  .hero-card {
    flex: 1 1 0;
    width: auto;
    transform: none !important;
  }

  .hero-card--b {
    transform: none;
  }

  .hero-foot {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .hero-ticker {
    grid-column: 1 / -1;
    grid-row: 1;
  }

  .hero-scroll {
    display: none;
  }

  .loot-section {
    padding-right: 20px;
    padding-left: 20px;
  }

  .section-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 22px;
  }

  .section-desc {
    max-width: 46ch;
  }

  .zone-grid {
    grid-template-columns: 1fr;
  }

  .zone-card {
    min-height: 430px;
  }

  .manifesto {
    height: 200vh;
  }

  .manifesto-sticky {
    padding: 0 20px;
  }

  .manifesto-inner {
    grid-template-columns: minmax(0, 1fr);
    gap: 30px;
    align-items: start;
  }

  .manifesto-side {
    min-height: 0;
    padding-left: 18px;
  }

  .skill-grid,
  .prompt-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .skill-grid > *:last-child,
  .prompt-grid > *:last-child {
    display: block;
  }

  .final-cta {
    padding: 110px 20px 140px;
  }

  .final-meta {
    right: 20px;
    left: 20px;
  }

  .final-meta span:nth-child(2) {
    display: none;
  }
}

@media (max-width: 640px) {
  .brand-text {
    font-size: 12px;
    letter-spacing: 0.14em;
  }

  .nav-text-btn {
    display: none;
  }

  .cta-pill {
    height: 40px;
    padding-left: 15px;
    font-size: 10px;
  }

  .cta-pill-icon {
    width: 28px;
    height: 28px;
  }

  .loot-hero {
    padding-top: 132px;
  }

  .hero-title {
    font-size: clamp(2.9rem, 12.4vw, 5rem);
    line-height: 1.02;
  }

  .hero-line--2 {
    margin-left: 0;
  }

  .hero-sub {
    margin-top: 20px;
    font-size: 12.5px;
    line-height: 1.7;
  }

  .hero-cards {
    flex-direction: column;
    gap: 10px;
  }

  .hero-card {
    flex: none;
    padding: 14px 16px;
    border-radius: 18px;
    gap: 6px;
  }

  .hero-card-num {
    font-size: 34px;
  }

  .hero-foot {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .hero-meta {
    grid-row: 2;
  }

  .hero-ticker {
    grid-row: 1;
  }

  .manifesto-word {
    font-size: clamp(2.6rem, 15vw, 4.4rem);
    line-height: 1.16;
  }

  .manifesto-word.is-active {
    transform: translateX(10px);
  }

  .mw-en {
    display: none;
  }

  .section-title {
    font-size: clamp(2.1rem, 10vw, 3.2rem);
    line-height: 1.24;
  }

  .zone-card {
    min-height: 400px;
    border-radius: 24px;
  }

  .zone-body {
    padding: 20px;
  }

  .skill-grid,
  .prompt-grid {
    gap: 12px;
  }

  .skill-visual {
    border-radius: 14px;
  }

  .prompt-visual {
    border-radius: 14px;
  }

  .skill-download {
    opacity: 1;
    transform: none;
    right: 8px;
    bottom: 8px;
    padding: 6px 10px;
  }

  .skill-info strong,
  .prompt-title {
    font-size: 11.5px;
  }

  .final-title {
    font-size: clamp(2.4rem, 11.5vw, 4rem);
  }

  .final-btn {
    height: 58px;
    padding-left: 24px;
  }

  .final-meta {
    font-size: 8.5px;
    letter-spacing: 0.14em;
  }
}

/* 触屏设备没有 hover，下载与"使用模板"常驻显示 */
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

  .hero-scroll-line,
  .voice-bar,
  .ticker-caret {
    animation: none;
  }

  .manifesto {
    height: auto;
  }

  .manifesto-sticky {
    position: static;
    height: auto;
    padding-top: 110px;
    padding-bottom: 110px;
  }

  .manifesto-word {
    color: rgba(245, 241, 236, 0.4);
  }

  .manifesto-word.is-active {
    transform: none;
  }
}
</style>
