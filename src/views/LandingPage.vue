<template>
  <div class="home-page">
    <div class="aurora aurora-a" aria-hidden="true" />
    <div class="aurora aurora-b" aria-hidden="true" />
    <div class="aurora aurora-c" aria-hidden="true" />
    <div class="grain" aria-hidden="true" />

    <header class="home-header">
      <button class="brand-logo" type="button" aria-label="ArtRealm 首页" @click="router.push('/')">
        <img class="brand-mark" :src="assetUrl('/logo1.webp')" alt="" />
        <span class="brand-name">ArtRealm</span>
      </button>

      <nav class="home-nav" aria-label="主导航">
        <a class="nav-link" href="#zones" @click.prevent="scrollToZones">创作分区</a>
        <a class="nav-link" href="#inspiration" @click.prevent="scrollToInspiration">Skill 模板库</a>
      </nav>

      <button class="login-btn" type="button" @click="router.push('/setup')">
        {{ hasSession ? '创作工坊' : 'Login' }}
      </button>
    </header>

    <main class="home-main">
      <section class="hero" aria-labelledby="home-title">
        <p class="hero-kicker">AI Creative Studio</p>
        <h1 id="home-title">
          四个工作台，<br />
          <span class="hero-gradient">一条完整的创作动线</span>
        </h1>
        <p class="hero-subtitle">
          从一句灵感到成片，从平面到三维。选择你的创作分区，其余交给模型与画布。
        </p>

        <div class="typewriter-card" aria-label="创作灵感">
          <span class="typewriter-label">Creative Prompt</span>
          <p class="typewriter-line">{{ typewriterText }}<span class="typewriter-caret" aria-hidden="true" /></p>
        </div>
      </section>

      <section id="zones" class="zone-grid" aria-label="创作分区">
        <article
          v-for="zone in zones"
          :key="zone.key"
          class="zone-card"
          :class="[`zone-${zone.key}`, { 'is-soon': zone.soon }]"
          role="button"
          tabindex="0"
          :aria-label="zone.cta"
          @click="enterZone(zone)"
          @keydown.enter.prevent="enterZone(zone)"
          @keydown.space.prevent="enterZone(zone)"
        >
          <span class="zone-index" aria-hidden="true">{{ zone.index }}</span>
          <span class="zone-glow" aria-hidden="true" />

          <span class="zone-head">
            <span class="zone-icon" aria-hidden="true">{{ zone.icon }}</span>
            <span v-if="zone.soon" class="zone-badge">即将上线</span>
          </span>

          <h2 class="zone-title">{{ zone.title }}</h2>
          <p class="zone-desc">{{ zone.desc }}</p>

          <div class="zone-tags">
            <span v-for="tag in zone.tags" :key="tag" class="zone-tag">{{ tag }}</span>
          </div>

          <span class="zone-cta">
            {{ zone.cta }}
            <span class="zone-arrow" aria-hidden="true">→</span>
          </span>
        </article>
      </section>
    </main>

    <section id="inspiration" class="template-section skill-template-section" aria-labelledby="skill-template-title">
      <div class="template-head">
        <div>
          <p class="section-kicker">Reusable Workflow</p>
          <h2 id="skill-template-title">Skill 模板库</h2>
          <p class="template-desc">
            每个 Skill 都是一份可复用的创作规范。点一下就能带上规范进入生图工作台，也可以下载 Markdown 自行修改。
          </p>
        </div>
      </div>

      <div class="template-grid">
        <article
          v-for="item in skillTemplates"
          :key="item.id"
          class="template-card skill-template-card"
          role="button"
          tabindex="0"
          @click="applySkill(item.id)"
          @keydown.enter.prevent="applySkill(item.id)"
          @keydown.space.prevent="applySkill(item.id)"
        >
          <span class="template-visual template-skill has-image">
            <img :src="item.image" alt="" class="template-image" loading="lazy" decoding="async" />
            <button
              class="skill-download-btn"
              type="button"
              :aria-label="`下载 ${item.title} Skill 文件`"
              @click.stop="downloadSkill(item.id)"
              @keydown.enter.stop
              @keydown.space.stop
            >
              下载
            </button>
          </span>
          <strong>{{ item.title }}</strong>
          <p class="skill-card-desc">{{ item.desc }}</p>
        </article>
      </div>

      <div class="preset-head">
        <div>
          <p class="section-kicker">Style Presets</p>
          <h3>内置风格 Skill</h3>
          <p>{{ presetSkills.length }} 种风格规范，点选后进入生图页会自动生效；悬停卡片右上角可单独下载。</p>
        </div>
        <span class="preset-selected">已选 {{ skillStore.selectedStyleSkillIds.length }} 个</span>
      </div>

      <div class="preset-grid">
        <article
          v-for="skill in presetSkills"
          :key="skill.id"
          class="preset-card"
          :class="{ active: skillStore.selectedStyleSkillIds.includes(skill.id) }"
        >
          <button class="preset-apply" type="button" @click="applySkill(skill.id)">
            <span class="preset-visual">
              <img
                v-if="skill.thumbnail"
                :src="assetUrl(skill.thumbnail)"
                :alt="skill.name"
                loading="lazy"
                decoding="async"
              />
            </span>
            <span class="preset-name">{{ skill.name }}</span>
          </button>
          <button
            class="preset-download"
            type="button"
            :aria-label="`下载 ${skill.name} Skill 文件`"
            @click="downloadSkill(skill.id)"
          >
            ↓
          </button>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { hasActiveApiSession } from '@/api/config'
import { assetUrl } from '@/utils/assets'
import {
  STYLE_SKILL_OPTIONS,
  getBuiltinSkill,
  getBuiltinSkillContent,
} from '@/features/skill/builtin'
import { useSkillStore } from '@/stores/skillStore'

const router = useRouter()
const skillStore = useSkillStore()
const hasSession = ref(false)

interface CreativeZone {
  key: 'skill' | 'media' | 'model3d' | 'voice'
  index: string
  icon: string
  title: string
  desc: string
  tags: string[]
  cta: string
  target: 'skill' | 'image' | 'model3d' | 'voice'
  soon?: boolean
}

const zones: CreativeZone[] = [
  {
    key: 'skill',
    index: '01',
    icon: '✦',
    title: 'Skill 创作',
    desc: '把一句话需求拆成可复用的创作规范，沉淀为标准 Skill，随时应用与修改。',
    tags: ['模板库', '标准化 Markdown', '本地应用'],
    cta: '进入 Skill 工作台',
    target: 'skill',
  },
  {
    key: 'media',
    index: '02',
    icon: '◈',
    title: '图片生成',
    desc: '文生图、图生图、扩图与风格 Skill 多选，批量出图后横向比较。视频生成在同一工作台的独立入口。',
    tags: ['Seedream', '风格 Skill', '批量出图', '多图参考'],
    cta: '进入图片工作台',
    target: 'image',
  },
  {
    key: 'model3d',
    index: '03',
    icon: '◇',
    title: '3D 建模',
    desc: '文生 3D、图生 3D 与多视角重建：一句话或一张图，直接得到可预览、可下载的三维模型。',
    tags: ['V2Fun', '文生 3D', '图生 3D', '多视角重建'],
    cta: '进入 3D 工作台',
    target: 'model3d',
  },
  {
    key: 'voice',
    index: '04',
    icon: '♪',
    title: '配音创作',
    desc: '文本转语音与声音复刻：音色、语速、语调、音量都能调，10 秒样本就能复刻自己的声音。',
    tags: ['MiniMax Speech 2.8', '声音复刻', '情绪演绎'],
    cta: '进入配音工作台',
    target: 'voice',
  },
]

const FEATURED_SKILLS: Array<{ id: string; title: string; desc: string }> = [
  {
    id: 'wkw-neon-loneliness-style',
    title: '王家卫式霓虹孤独',
    desc: '霓虹单光源、湿面反光与长曝光拖影，把普通场景压成电影里的孤独片段。',
  },
  {
    id: 'papercut-stop-motion-explainer',
    title: '剪纸定格动画',
    desc: '分层纸艺布景与逐帧手工运动，把抽象知识讲成可触摸的纸片世界。',
  },
  {
    id: 'handdrawn-live-video-generator',
    title: '手绘发光实拍融合',
    desc: '粗糙蜡笔线条在真实空间里点燃、变形、逃跑，做出会发光的实拍涂鸦。',
  },
  {
    id: 'photo-to-minimal-vector-travel-poster',
    title: '极简旅行海报',
    desc: '从照片提炼主视觉，重构成留白克制、色块干净的高级矢量海报。',
  },
]

const skillTemplates = FEATURED_SKILLS.map((item) => ({
  ...item,
  image: assetUrl(getBuiltinSkill(item.id)?.thumbnail || ''),
}))

const featuredSkillIds = new Set(FEATURED_SKILLS.map((item) => item.id))
/** 首页精选已单列，风格网格只展示其余内置 Skill，避免重复。 */
const presetSkills = STYLE_SKILL_OPTIONS.filter((skill) => !featuredSkillIds.has(skill.id))

const typewriterPhrases = [
  '雨夜霓虹里，一个人慢慢走过街角。',
  '把这张照片变成极简旅行海报。',
  '用剪纸定格动画讲讲水循环。',
  '一句话生成一个可旋转的 3D 手办。',
]

const typewriterText = ref('')
let typewriterTimer: number | undefined
let phraseIndex = 0
let charIndex = 0
let deleting = false

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

function scrollToInspiration() {
  document.getElementById('inspiration')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  router.push(zone.target === 'skill' ? '/skill' : `/${zone.target}`)
}

function openImageWorkspace() {
  if (hasActiveApiSession()) {
    router.push({ path: '/image', query: { mode: 'simple', type: 'image' } })
    return
  }
  router.push({ path: '/setup', query: { redirect: 'image' } })
}

/** 首页应用 Skill：先选中这份规范，再进入生图页（Skill 选择会持久化到本地）。 */
function applySkill(id: string) {
  const skill = getBuiltinSkill(id)
  if (skill && skill.category !== 'quality' && !skillStore.selectedStyleSkillIds.includes(id)) {
    skillStore.toggleStyleSkill(id)
  }
  openImageWorkspace()
}

/** 内置 Skill 的正文就在前端包里，直接生成 Markdown 下载，不依赖 public 文件。 */
function downloadSkill(id: string) {
  const content = getBuiltinSkillContent(id)
  if (!content.trim()) return
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${id}.md`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

onMounted(() => {
  hasSession.value = hasActiveApiSession()
  skillStore.loadFromStorage()
  runTypewriter()
})

onBeforeUnmount(() => {
  if (typewriterTimer !== undefined) {
    window.clearTimeout(typewriterTimer)
  }
})
</script>


<style scoped>
.home-page {
  position: relative;
  min-height: 100dvh;
  overflow-x: hidden;
  color: #fff;
  background:
    radial-gradient(circle at 50% -10%, rgba(70, 60, 140, 0.30), transparent 55%),
    linear-gradient(180deg, #05060b 0%, #06070d 42%, #04050a 100%);
  isolation: isolate;
}

.aurora {
  position: absolute;
  z-index: 0;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.55;
  pointer-events: none;
  animation: aurora-drift 18s ease-in-out infinite alternate;
}

.aurora-a {
  top: -220px;
  left: 8%;
  width: 620px;
  height: 520px;
  background: radial-gradient(circle, rgba(139, 122, 255, 0.55), transparent 68%);
}

.aurora-b {
  top: -140px;
  right: 4%;
  width: 560px;
  height: 480px;
  background: radial-gradient(circle, rgba(52, 211, 235, 0.38), transparent 66%);
  animation-delay: -6s;
}

.aurora-c {
  top: 420px;
  left: 38%;
  width: 680px;
  height: 420px;
  background: radial-gradient(circle, rgba(255, 148, 120, 0.20), transparent 70%);
  animation-delay: -11s;
}

@keyframes aurora-drift {
  from {
    transform: translate3d(-24px, 0, 0) scale(1);
  }
  to {
    transform: translate3d(28px, 26px, 0) scale(1.08);
  }
}

.grain {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: 0.16;
  background-image: radial-gradient(rgba(255, 255, 255, 0.22) 0.5px, transparent 0.5px);
  background-size: 3px 3px;
  mix-blend-mode: overlay;
}

.home-header {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  width: min(100% - 48px, 1280px);
  height: 86px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
}

.brand-logo,
.login-btn,
.template-card {
  border: 0;
  font: inherit;
}

.brand-logo {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 0;
  color: #fff;
  background: transparent;
  cursor: pointer;
}

.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  object-fit: cover;
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.32),
    0 0 34px rgba(255, 255, 255, 0.10),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.brand-name {
  font-family: var(--font-family-display);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.06em;
}

.home-nav {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(11, 13, 22, 0.55);
  backdrop-filter: blur(18px);
}

.nav-link {
  padding: 8px 16px;
  border-radius: 999px;
  color: rgba(226, 232, 246, 0.66);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
  transition: color var(--transition-base), background var(--transition-base);
}

.nav-link:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
}

.login-btn {
  justify-self: end;
  min-width: 92px;
  min-height: 42px;
  padding: 0 22px;
  border: 1px solid var(--color-pale-glass-border);
  border-radius: 999px;
  background: var(--color-pale-glass-bg);
  color: rgba(226, 234, 255, 0.96);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(18px) saturate(140%);
  transition: border-color var(--transition-base), background var(--transition-base);
}

.login-btn:hover {
  border-color: rgba(255, 255, 255, 0.34);
  background: var(--color-pale-glass-bg-hover);
}

.home-main {
  position: relative;
  z-index: 2;
  width: min(100% - 48px, 1180px);
  margin: 0 auto;
  padding: 150px 0 20px;
}

.hero {
  text-align: center;
  margin-bottom: 56px;
}

.hero-kicker {
  margin-bottom: 16px;
  background: linear-gradient(135deg, #cfc4ff 0%, #8ee6ff 55%, #ffc9a8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.34em;
  text-transform: uppercase;
}

.hero h1 {
  color: rgba(255, 255, 255, 0.97);
  font-family: var(--font-family-display);
  font-size: clamp(34px, 5.6vw, 68px);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.055em;
  text-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
}

.hero-gradient {
  background: linear-gradient(100deg, #ffffff 0%, #d9d2ff 38%, #8fe7ff 72%, #ffd6b8 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-subtitle {
  width: min(100%, 560px);
  margin: 20px auto 0;
  color: rgba(214, 224, 245, 0.62);
  font-size: 15px;
  line-height: 1.75;
}

.typewriter-card {
  position: relative;
  width: min(100%, 760px);
  min-height: 92px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 34px auto 0;
  padding: 20px 26px;
  border: 1px solid rgba(190, 205, 255, 0.16);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(19, 21, 35, 0.86), rgba(8, 9, 16, 0.82)),
    radial-gradient(circle at 82% 0%, rgba(139, 122, 255, 0.20), transparent 0 42%);
  box-shadow:
    0 30px 90px rgba(0, 0, 0, 0.52),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(22px) saturate(120%);
}

.typewriter-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    linear-gradient(135deg, rgba(160, 170, 255, 0.12), transparent 40%),
    linear-gradient(315deg, rgba(120, 220, 255, 0.08), transparent 46%);
  mix-blend-mode: screen;
}

.typewriter-label {
  background: linear-gradient(135deg, #cfc4ff 0%, #8ee6ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-family: "Georgia", "Times New Roman", serif;
  font-style: italic;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.typewriter-line {
  position: relative;
  z-index: 1;
  min-height: 1.6em;
  margin: 0;
  color: rgba(240, 244, 255, 0.9);
  font-family: var(--font-family-display);
  font-size: clamp(14px, 1.1vw, 17px);
  font-weight: 500;
  line-height: 1.6;
  text-align: center;
  white-space: pre-wrap;
}

.typewriter-caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 3px;
  vertical-align: -0.14em;
  background: linear-gradient(180deg, #cfc4ff, #8ee6ff);
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

/* ---------- 四大分区 ---------- */
.zone-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  scroll-margin-top: 110px;
}

.zone-card {
  --zone-accent: #b9a8ff;
  --zone-accent-strong: #e6ddff;
  --zone-glow: rgba(150, 120, 255, 0.34);

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 320px;
  padding: 24px 22px 22px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 28px;
  background:
    linear-gradient(165deg, rgba(255, 255, 255, 0.075) 0%, rgba(255, 255, 255, 0.022) 46%, rgba(255, 255, 255, 0.05) 100%);
  box-shadow:
    0 26px 70px rgba(0, 0, 0, 0.36),
    inset 0 1px 0 rgba(255, 255, 255, 0.10);
  backdrop-filter: blur(20px) saturate(130%);
  cursor: pointer;
  transition:
    transform var(--transition-slow),
    border-color var(--transition-slow),
    box-shadow var(--transition-slow);
}

.zone-media {
  --zone-accent: #7fe0ff;
  --zone-accent-strong: #d6f7ff;
  --zone-glow: rgba(56, 189, 248, 0.34);
}

.zone-model3d {
  --zone-accent: #8ef0c4;
  --zone-accent-strong: #dcfff0;
  --zone-glow: rgba(52, 211, 153, 0.30);
}

.zone-voice {
  --zone-accent: #ffcf8a;
  --zone-accent-strong: #ffe9c9;
  --zone-glow: rgba(251, 146, 60, 0.30);
}

.zone-card:hover,
.zone-card:focus-visible {
  transform: translateY(-6px);
  border-color: color-mix(in srgb, var(--zone-accent) 42%, transparent);
  box-shadow:
    0 40px 100px rgba(0, 0, 0, 0.46),
    0 0 0 1px color-mix(in srgb, var(--zone-accent) 22%, transparent),
    0 0 70px -12px var(--zone-glow);
  outline: none;
}

.zone-glow {
  position: absolute;
  top: -60px;
  right: -40px;
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--zone-glow), transparent 68%);
  filter: blur(28px);
  opacity: 0.9;
  pointer-events: none;
  transition: opacity var(--transition-slow), transform var(--transition-slow);
}

.zone-card:hover .zone-glow {
  opacity: 1;
  transform: scale(1.12);
}

.zone-index {
  position: absolute;
  right: 20px;
  bottom: 8px;
  color: rgba(255, 255, 255, 0.05);
  font-family: var(--font-family-display);
  font-size: 96px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.08em;
  pointer-events: none;
}

.zone-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.zone-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 46px;
  border: 1px solid color-mix(in srgb, var(--zone-accent) 34%, transparent);
  border-radius: 15px;
  background: color-mix(in srgb, var(--zone-accent) 12%, transparent);
  color: var(--zone-accent-strong);
  font-size: 20px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
}

.zone-badge {
  padding: 5px 11px;
  border: 1px solid color-mix(in srgb, var(--zone-accent) 40%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--zone-accent) 12%, transparent);
  color: var(--zone-accent-strong);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.zone-title {
  margin-top: 4px;
  color: #fff;
  font-family: var(--font-family-display);
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.zone-desc {
  color: rgba(214, 224, 245, 0.60);
  font-size: 13.5px;
  line-height: 1.72;
}

.zone-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: auto;
}

.zone-tag {
  padding: 5px 10px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(220, 230, 250, 0.62);
  font-size: 11.5px;
  font-weight: 600;
}

.zone-cta {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--zone-accent-strong);
  font-size: 13px;
  font-weight: 700;
}

.zone-arrow {
  display: inline-block;
  transition: transform var(--transition-base);
}

.zone-card:hover .zone-arrow {
  transform: translateX(5px);
}

.zone-card.is-soon .zone-title {
  color: rgba(255, 255, 255, 0.86);
}

/* ---------- Skill 模板库 ---------- */
.template-section {
  position: relative;
  z-index: 2;
  width: min(100% - 48px, 1180px);
  margin: 0 auto 64px;
  padding-top: 20px;
}

.skill-template-section {
  margin-top: 52px;
  scroll-margin-top: 110px;
}

.template-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.section-kicker {
  margin-bottom: 6px;
  color: rgba(190, 200, 230, 0.42);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.template-head h2 {
  color: rgba(255, 255, 255, 0.88);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.04em;
}

.template-desc {
  max-width: 640px;
  margin-top: 8px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 12.5px;
  line-height: 1.7;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.template-card {
  min-width: 0;
  padding: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.76);
  text-align: left;
}

.skill-template-card {
  cursor: pointer;
}

.template-card strong {
  display: block;
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.72);
  font-size: 15px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.skill-card-desc {
  display: -webkit-box;
  margin: 6px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: rgba(255, 255, 255, 0.4);
  font-size: 11.5px;
  line-height: 1.6;
}

.template-visual {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 14px;
  background: #0a0a0d;
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.28);
  transition: transform var(--transition-base), border-color var(--transition-base);
}

.template-visual::before,
.template-visual::after {
  content: '';
  position: absolute;
  inset: 0;
}

.template-visual::before {
  opacity: 0.96;
}

.template-visual::after {
  background: linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.36));
}

.template-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.skill-download-btn {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  min-height: 34px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(5, 12, 26, 0.58);
  color: rgba(255, 255, 255, 0.92);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(14px) saturate(140%);
}

.skill-download-btn:hover {
  border-color: rgba(105, 240, 255, 0.44);
  background: rgba(9, 24, 52, 0.68);
}

.template-visual.has-image::before {
  display: none;
}

.template-skill::before {
  background:
    radial-gradient(circle at 68% 36%, rgba(255, 176, 202, 0.28), transparent 0 16%),
    linear-gradient(135deg, #061b2e, #3c0d3a 72%);
}

.template-card:hover .template-visual {
  transform: translateY(-2px);
  border-color: rgba(116, 230, 255, 0.28);
}

/* ---------- 内置风格 Skill ---------- */

.preset-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin: 40px 0 14px;
  padding-top: 26px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.preset-head h3 {
  color: rgba(255, 255, 255, 0.86);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.preset-head p {
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  line-height: 1.6;
}

.preset-selected {
  flex: 0 0 auto;
  padding: 5px 11px;
  border: 1px solid rgba(116, 230, 255, 0.2);
  border-radius: 999px;
  background: rgba(116, 230, 255, 0.08);
  color: rgba(214, 247, 255, 0.82);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 12px;
}

.preset-card {
  position: relative;
  min-width: 0;
}

.preset-apply {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.preset-visual {
  position: relative;
  display: block;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 16px;
  background: #0a0a0d;
  transition: transform var(--transition-base), border-color var(--transition-base), box-shadow var(--transition-base);
}

.preset-visual img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform var(--transition-slow);
}

.preset-card:hover .preset-visual {
  transform: translateY(-2px);
  border-color: rgba(116, 230, 255, 0.32);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
}

.preset-card:hover .preset-visual img {
  transform: scale(1.045);
}

.preset-card.active .preset-visual {
  border-color: rgba(116, 230, 255, 0.6);
  box-shadow:
    0 0 0 1px rgba(116, 230, 255, 0.45),
    0 0 28px -8px rgba(116, 230, 255, 0.5);
}

.preset-card.active .preset-visual::after {
  content: '✓';
  position: absolute;
  top: 7px;
  left: 7px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(116, 230, 255, 0.92);
  color: #041018;
  font-size: 11px;
  font-weight: 800;
}

.preset-name {
  display: block;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.62);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.preset-card.active .preset-name {
  color: rgba(234, 252, 255, 0.92);
}

.preset-download {
  position: absolute;
  top: 7px;
  right: 7px;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  background: rgba(6, 10, 18, 0.62);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  cursor: pointer;
  opacity: 0;
  backdrop-filter: blur(10px);
  transition: opacity var(--transition-base), background var(--transition-base);
}

.preset-card:hover .preset-download,
.preset-download:focus-visible {
  opacity: 1;
}

.preset-download:hover {
  background: rgba(9, 24, 52, 0.78);
}

@media (max-width: 1100px) {
  .zone-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .template-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .preset-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 960px) {
  .home-nav {
    display: none;
  }

  .zone-card {
    min-height: 284px;
  }

  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .home-main {
    width: min(100% - 28px, 1120px);
  }

  .hero h1 {
    font-size: clamp(30px, 8vw, 48px);
  }

  .typewriter-card {
    min-height: 88px;
    padding: 16px;
  }

  .typewriter-line {
    font-size: 14px;
  }
}

@media (max-width: 640px) {
  .home-header {
    height: 74px;
    width: min(100% - 32px, 1280px);
    grid-template-columns: 1fr auto;
  }

  .brand-mark {
    width: 30px;
    height: 30px;
    border-radius: 10px;
  }

  .brand-name {
    font-size: 18px;
  }

  .login-btn {
    min-width: 76px;
    min-height: 38px;
    padding: 0 16px;
  }

  .home-main {
    padding-top: 112px;
  }

  .hero {
    text-align: left;
    margin-bottom: 36px;
  }

  .hero-subtitle {
    margin-left: 0;
  }

  .typewriter-card {
    border-radius: 20px;
    padding: 14px;
  }

  .typewriter-line {
    font-size: 15px;
  }

  .zone-card {
    min-height: 262px;
    padding: 22px;
    border-radius: 24px;
  }

  .zone-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .zone-index {
    font-size: 76px;
  }

  .preset-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    margin-top: 30px;
    padding-top: 20px;
  }

  .preset-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 9px;
  }

  .preset-name {
    font-size: 11.5px;
  }

  .template-section {
    width: min(100% - 24px, 1180px);
    margin-bottom: 44px;
  }

  .template-head h2 {
    font-size: 18px;
  }

  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .template-card strong {
    margin-top: 7px;
    font-size: 13px;
  }

  .template-visual {
    border-radius: 10px;
  }

  .skill-download-btn {
    right: 7px;
    bottom: 7px;
    min-width: 56px;
    min-height: 28px;
    padding: 0 10px;
    font-size: 11px;
  }
}
</style>
