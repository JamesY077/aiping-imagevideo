<template>
  <div class="home-page">
    <header class="home-header">
      <button class="brand-logo" type="button" aria-label="ArtRealm 首页">
        <img class="brand-mark" src="/logo1.webp" alt="" />
        <span class="brand-name">ArtRealm</span>
      </button>

      <div class="nav-spacer" aria-hidden="true" />

      <button class="login-btn" type="button" @click="router.push('/setup')">Login</button>
    </header>

    <main class="home-main">
      <section class="hero-copy" aria-labelledby="home-title">
        <p class="hero-kicker">AI Creative Engine</p>
        <h1 id="home-title">一句话生成高质感视觉资产</h1>
        <p class="hero-subtitle">输入创意，上传参考图，快速进入简易模式完成图片生成与灵感迭代。</p>
      </section>

      <div class="typewriter-card" aria-label="创作灵感">
        <span class="typewriter-label">Creative Prompt</span>
        <p class="typewriter-line">{{ typewriterText }}<span class="typewriter-caret" aria-hidden="true" /></p>
      </div>
    </main>

    <section class="template-section skill-template-section" aria-labelledby="skill-template-title">
      <div class="template-head">
        <h2 id="skill-template-title">Skill模板库</h2>
      </div>

      <div class="template-grid">
        <article
          v-for="item in skillTemplates"
          :key="item.title"
          class="template-card skill-template-card"
          role="button"
          tabindex="0"
          @click="handleSkillTemplateClick"
          @keydown.enter.prevent="handleSkillTemplateClick"
          @keydown.space.prevent="handleSkillTemplateClick"
        >
          <span class="template-visual" :class="[item.theme, { 'has-image': item.image }]">
            <img v-if="item.image" :src="item.image" alt="" class="template-image" />
            <span v-else class="visual-glow" />
            <button
              class="skill-download-btn"
              type="button"
              :aria-label="`下载 ${item.title} Skill 文件`"
              @click.stop="handleSkillDownloadClick(item)"
            >
              下载
            </button>
          </span>
          <strong>{{ item.title }}</strong>
        </article>
      </div>
    </section>

    <section class="template-section prompt-template-section" aria-labelledby="template-title">
      <div class="template-head">
        <h2 id="template-title">提示词模板库</h2>
      </div>

      <div class="template-grid">
        <button
          v-for="item in templates"
          :key="item.title"
          class="template-card"
          type="button"
          @click="handleTemplateClick(item)"
        >
          <span class="template-visual" :class="[item.theme, { 'has-image': item.image, 'is-zoomed': item.title === '影视爆炸现场' }]">
            <img v-if="item.image" :src="item.image" alt="" class="template-image" />
            <span v-else class="visual-glow" />
          </span>
          <strong>{{ item.title }}</strong>
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { hasActiveApiSession } from '@/api/config'

const LANDING_PENDING_PROMPT_KEY = 'artrealm_landing_pending_prompt'

const router = useRouter()

const skillTemplates = [
  {
    title: '王家卫式霓虹孤独风格',
    theme: 'template-skill',
    image: '/skill-wkw-neon-loneliness-style.webp',
    fileUrl: '/skills/wkw-neon-loneliness-style.md',
    fileName: 'wkw-neon-loneliness-style.md',
  },
  {
    title: '剪纸定格动画',
    theme: 'template-skill',
    image: '/skill-papercut-stop-motion-explainer.webp',
    fileUrl: '/skills/papercut-stop-motion-explainer.md',
    fileName: 'papercut-stop-motion-explainer.md',
  },
  {
    title: '手绘发光动画实拍融合',
    theme: 'template-skill',
    image: '/skill-handdrawn-live-video-generator.webp',
    fileUrl: '/skills/handdrawn-live-video-generator.md',
    fileName: 'handdrawn-live-video-generator.md',
  },
  {
    title: '极简旅行海报',
    theme: 'template-skill',
    image: '/skill-photo-to-minimal-vector-travel-poster.webp',
    fileUrl: '/skills/photo-to-minimal-vector-travel-poster.md',
    fileName: 'photo-to-minimal-vector-travel-poster.md',
  },
]

const templates = [
  {
    title: 'F1 飞驰赛车',
    prompt: 'F1 方程式赛车在赛道上高速飞驰，低机位广角镜头，车身运动模糊，轮胎带起火花与水雾，雨后赛道反光，电影级运动摄影，浅景深，强烈速度感，超清细节',
    theme: 'template-race',
    image: '/template-f1.webp',
  },
  {
    title: 'iPhone 17 产品电商图',
    prompt: 'iPhone 17 旗舰手机产品电商主图，钛金属边框高光，深色科技感背景，蓝紫渐变轮廓光，镜头模组与屏幕清晰展示，悬浮构图，商业产品摄影，高级质感，超清渲染',
    theme: 'template-product',
    image: '/template-iphone17.webp',
  },
  {
    title: '科技感网页 UI',
    prompt: '未来科技感网页 UI 界面设计，深色模式仪表盘，玻璃拟态数据卡片，蓝紫渐变数据可视化图表，悬浮导航栏，清晰信息层级，高清界面设计，现代极简',
    theme: 'template-tech',
    image: '/template-webui.webp',
  },
  {
    title: '卡通兔子',
    prompt: '可爱卡通兔子角色，软萌大眼睛，奶油白毛绒质感，治愈系绘本插画风格，柔和自然光，浅色温馨场景，精致细节，迪士尼级角色设计',
    theme: 'template-commerce',
    image: '/template-rabbit.webp',
  },
  {
    title: '无线耳机结构解析',
    prompt: '无线头戴式降噪耳机爆炸分解产品图，精密声学结构与内部电子组件清晰展示，USB-C 充电口、电池、驱动单元、麦克风阵列与记忆棉耳罩，工业设计图纸风格，深色科技背景，商业产品渲染，超清细节',
    theme: 'template-commerce',
    image: '/template-headphones.webp',
  },
  {
    title: '影视爆炸现场',
    prompt: '电影级爆炸现场，橙红色火球与黑色浓烟升腾，尘土碎片飞溅，冲击波，逆光剪影，广角构图，逼真影视特效，超高细节',
    theme: 'template-monster',
    image: '/template-landscape.webp',
  },
  {
    title: '中世纪战士',
    prompt: '中世纪战士角色，厚重金属铠甲，战损做旧，斗篷，手持长剑，阴天战场背景，电影级写实人像，戏剧性侧光，细腻质感，史诗氛围',
    theme: 'template-hero',
    image: '/template-festival.webp',
  },
  {
    title: '专业相机三视图',
    prompt: '专业数码相机产品三视图与爆炸分解展示，黑色机身，35mm f/2.0 定焦镜头，标注尺寸、按键与接口，工业设计图纸风格，商业产品展示，超清渲染',
    theme: 'template-commerce',
    image: '/template-camera.webp',
  },
]

const typewriterPhrases = [
  'F1 方程式赛车在赛道上飞驰。',
  'iPhone 17 旗舰手机产品电商主图。',
  '未来科技感网页 UI 界面设计。',
  '治愈系卡通兔子角色。',
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

  router.push({ path: '/setup', query: { redirect: 'landing' } })
}

function handleSkillTemplateClick() {
  router.push({ path: '/setup', query: { redirect: 'landing' } })
}

function handleSkillDownloadClick(item: { fileUrl: string; fileName: string }) {
  const link = document.createElement('a')
  link.href = item.fileUrl
  link.download = item.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

onMounted(() => {
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
    radial-gradient(circle at 50% 50%, rgba(8, 14, 30, 0.02), rgba(2, 4, 12, 0.34) 64%, rgba(0, 0, 0, 0.66) 100%),
    url('/home-collage-bg.webp') center top / cover no-repeat;
  isolation: isolate;
}

.home-page::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.44) 0%, rgba(0, 0, 0, 0.10) 42%, rgba(0, 0, 0, 0.72) 100%),
    radial-gradient(circle at 88% 23%, rgba(52, 229, 255, 0.16), transparent 0 22%);
}

.home-header {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  width: min(100% - 48px, 1280px);
  height: 86px;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  padding: 0;
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
  text-shadow: 0 8px 28px rgba(0, 0, 0, 0.38);
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

.nav-spacer {
  width: 1px;
  height: 1px;
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
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(18px) saturate(140%);
}

.login-btn:hover {
  border-color: rgba(255, 255, 255, 0.34);
  background: var(--color-pale-glass-bg-hover);
}

.home-main {
  position: relative;
  z-index: 2;
  width: min(100% - 48px, 1120px);
  min-height: auto;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120px 0 28px;
}

.hero-copy {
  width: min(100%, 760px);
  margin-bottom: 28px;
  text-align: center;
  text-shadow: 0 12px 36px rgba(0, 0, 0, 0.42);
}

.hero-kicker {
  margin-bottom: 12px;
  background: linear-gradient(135deg, #f7e3c8 0%, #efb79a 52%, #e99aab 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hero-copy h1 {
  color: rgba(255, 255, 255, 0.96);
  font-family: var(--font-family-display);
  font-size: clamp(34px, 5vw, 64px);
  font-weight: 800;
  line-height: 1.02;
  letter-spacing: -0.07em;
}

.hero-subtitle {
  width: min(100%, 560px);
  margin: 16px auto 0;
  color: rgba(225, 240, 255, 0.72);
  font-size: 15px;
  line-height: 1.7;
}

.typewriter-card {
  position: relative;
  width: min(100%, 820px);
  min-height: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 26px;
  border: 1px solid rgba(255, 226, 204, 0.18);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(34, 25, 28, 0.88), rgba(12, 8, 10, 0.84)),
    radial-gradient(circle at 78% 0%, rgba(255, 181, 138, 0.16), transparent 0 38%);
  box-shadow:
    0 30px 90px rgba(0, 0, 0, 0.52),
    inset 0 1px 0 rgba(255, 235, 220, 0.18);
  backdrop-filter: blur(22px) saturate(120%);
}

.typewriter-card::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    linear-gradient(135deg, rgba(255, 226, 200, 0.14), transparent 38%),
    linear-gradient(315deg, rgba(255, 190, 170, 0.08), transparent 48%);
  mix-blend-mode: screen;
}

.typewriter-label {
  background: linear-gradient(135deg, #f7e3c8 0%, #efb79a 48%, #e99aab 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-family: "Georgia", "Times New Roman", serif;
  font-style: italic;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.typewriter-line {
  position: relative;
  z-index: 1;
  min-height: 1.6em;
  margin: 0;
  color: rgba(255, 245, 236, 0.92);
  font-family: var(--font-family-display);
  font-size: clamp(14px, 1.1vw, 17px);
  font-weight: 500;
  line-height: 1.6;
  letter-spacing: 0.01em;
  text-align: center;
  white-space: pre-wrap;
}

.typewriter-caret {
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 3px;
  vertical-align: -0.14em;
  background: linear-gradient(180deg, #ffe6c7, #efb79a);
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

.template-section {
  position: relative;
  z-index: 2;
  width: min(100% - 40px, 1520px);
  margin: -12px auto 64px;
  padding: 20px 0 0;
}

.skill-template-section {
  margin-bottom: 44px;
}

.prompt-template-section {
  margin-top: 0;
}

.template-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.template-head h2 {
  color: rgba(255, 255, 255, 0.88);
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.04em;
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

.template-visual {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 12px;
  background: #0a0a0d;
  box-shadow: 0 18px 54px rgba(0, 0, 0, 0.28);
}

.template-visual::before,
.template-visual::after,
.visual-glow {
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

.visual-glow {
  filter: blur(18px);
  opacity: 0.58;
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

.template-visual.is-zoomed .template-image {
  transform: scale(1.08);
}

.template-product::before {
  background: linear-gradient(135deg, #101722, #741a48 70%), radial-gradient(circle at 36% 38%, #f3ebce, transparent 0 20%);
}

.template-b2b::before {
  background: linear-gradient(135deg, #2d7ab5, #d8eef6), radial-gradient(circle at 62% 44%, #ffffff, transparent 0 18%);
}

.template-tech::before {
  background: radial-gradient(ellipse at 50% 50%, #dfeeff, transparent 0 16%), linear-gradient(135deg, #04080d, #182232);
}

.template-race::before {
  background: linear-gradient(135deg, #d9e3e6, #1d2d36), radial-gradient(ellipse at 50% 68%, #101010, transparent 0 28%);
}

.template-monster::before {
  background: linear-gradient(135deg, #2d1e1b, #e07936), radial-gradient(circle at 50% 50%, #1a100c, transparent 0 24%);
}

.template-commerce::before {
  background: radial-gradient(circle at 64% 42%, #101010, transparent 0 18%), linear-gradient(135deg, #120303, #8e1113);
}

.template-hero::before {
  background: linear-gradient(135deg, #bd2b23, #082f44 72%), radial-gradient(circle at 38% 45%, #f1a165, transparent 0 18%);
}

.template-stage::before {
  background: linear-gradient(135deg, #dfe7ef, #46556d), radial-gradient(ellipse at 52% 74%, #ffffff, transparent 0 24%);
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

@media (max-width: 1100px) {
  .template-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .home-main {
    width: min(100% - 28px, 1120px);
  }

  .hero-copy h1 {
    font-size: clamp(30px, 8vw, 48px);
  }

  .typewriter-card {
    min-height: 88px;
    padding: 16px;
  }

  .typewriter-line {
    font-size: 14px;
  }

  .template-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .home-header {
    height: 74px;
    width: min(100% - 32px, 1280px);
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
    padding-top: 96px;
    padding-bottom: 42px;
  }

  .hero-copy {
    text-align: left;
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

  .template-grid {
    grid-template-columns: 1fr;
  }
}
</style>
