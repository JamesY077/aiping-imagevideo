<template>
  <div class="studio-page voice-page" :style="{ '--studio-accent': accent }">
    <StudioIsland />

    <StudioHeader
      kicker="Voice Studio"
      title="配音创作"
      subtitle="文本转语音、音色演绎与多角色对白将在这里完成"
      accent="#fb923c"
    >
      <template #actions>
        <span class="studio-chip">施工中</span>
      </template>
    </StudioHeader>

    <main class="voice-main">
      <section class="voice-hero">
        <p class="voice-kicker">Voice Studio</p>
        <h1>配音创作</h1>
        <p class="voice-subtitle">
          为画面配上情绪与节奏。文本转语音、音色演绎与多角色对白将在这里完成，
          工作台正在搭建中。
        </p>
        <span class="voice-status">
          <span class="status-dot" aria-hidden="true" />
          施工中 · 交互与接口待接入
        </span>
      </section>

      <section class="voice-grid" aria-label="规划中的能力">
        <article v-for="item in plannedFeatures" :key="item.title" class="studio-panel feature-card">
          <span class="feature-icon" aria-hidden="true">{{ item.icon }}</span>
          <h2>{{ item.title }}</h2>
          <p>{{ item.desc }}</p>
          <span class="feature-state">{{ item.state }}</span>
        </article>
      </section>

      <section class="studio-panel model-panel" aria-labelledby="voice-model-title">
        <div class="panel-head">
          <div>
            <p class="panel-kicker">Ready Models</p>
            <h2 id="voice-model-title">已接入的语音模型</h2>
          </div>
          <span class="panel-count">{{ voiceModels.length }} 个</span>
        </div>

        <ul class="model-list">
          <li v-for="model in voiceModels" :key="model.id" class="model-item">
            <div class="model-main">
              <strong>{{ model.displayName }}</strong>
              <p>{{ model.description }}</p>
            </div>
            <span class="model-tag">{{ model.capability.expressive ? '情绪演绎' : '基础合成' }}</span>
          </li>
        </ul>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { VOICE_MODELS } from '@/features/voice/models'
import StudioHeader from '@/components/StudioHeader.vue'
import StudioIsland from '@/components/StudioIsland.vue'

const accent = 'var(--studio-accent-voice)'
const voiceModels = VOICE_MODELS

const plannedFeatures = [
  {
    icon: '✎',
    title: '文本转语音',
    desc: '粘贴脚本、控制断句与停顿，一键生成可直接入片的旁白。',
    state: '规划中',
  },
  {
    icon: '◍',
    title: '音色库',
    desc: '内置音色挑选与自定义音色管理，按角色分配声音。',
    state: '规划中',
  },
  {
    icon: '≈',
    title: '情绪与语速',
    desc: '情绪、语速、音量与音高独立调节，让语气更贴合画面。',
    state: '规划中',
  },
  {
    icon: '❑',
    title: '多角色对白',
    desc: '同一段脚本拆分多个角色，自动排队合成并拼接成完整音频。',
    state: '规划中',
  },
]
</script>

<style scoped>
.voice-page {
  color: #fff;
}

.voice-main {
  position: relative;
  z-index: 2;
  width: min(100% - 48px, 1080px);
  margin: 0 auto;
  padding: 56px 0 96px;
}

.voice-kicker {
  margin-bottom: 14px;
  background: linear-gradient(135deg, #ffd7a8, #ff9f7a 60%, #c2a8ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.30em;
  text-transform: uppercase;
}

.voice-hero h1 {
  font-family: var(--font-family-display);
  font-size: clamp(34px, 5vw, 60px);
  font-weight: 800;
  line-height: 1.04;
  letter-spacing: -0.055em;
}

.voice-subtitle {
  width: min(100%, 620px);
  margin-top: 18px;
  color: rgba(214, 224, 245, 0.62);
  font-size: 15px;
  line-height: 1.75;
}

.voice-status {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-top: 24px;
  padding: 8px 15px;
  border: 1px solid rgba(255, 200, 150, 0.24);
  border-radius: 999px;
  background: rgba(255, 170, 110, 0.08);
  color: rgba(255, 214, 176, 0.9);
  font-size: 12.5px;
  font-weight: 600;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffb46b;
  box-shadow: 0 0 0 4px rgba(255, 180, 107, 0.16);
  animation: status-pulse 2s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.voice-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-top: 48px;
}

.feature-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 196px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 22px;
  background: linear-gradient(165deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 200, 150, 0.28);
  border-radius: 12px;
  background: rgba(255, 180, 120, 0.10);
  color: #ffd9b0;
  font-size: 17px;
}

.feature-card h2 {
  color: rgba(255, 255, 255, 0.92);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.feature-card p {
  color: rgba(214, 224, 245, 0.55);
  font-size: 12.5px;
  line-height: 1.7;
}

.feature-state {
  margin-top: auto;
  color: rgba(255, 196, 150, 0.62);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
}

.model-panel {
  margin-top: 28px;
  padding: 24px 26px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(20, 20, 32, 0.72), rgba(10, 10, 18, 0.72));
}

.panel-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.panel-kicker {
  margin-bottom: 6px;
  color: rgba(190, 200, 230, 0.42);
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.panel-head h2 {
  color: rgba(255, 255, 255, 0.88);
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.panel-count {
  color: rgba(214, 224, 245, 0.42);
  font-size: 12px;
  font-weight: 600;
}

.model-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.03);
}

.model-main strong {
  display: block;
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  font-weight: 700;
}

.model-main p {
  margin-top: 4px;
  color: rgba(214, 224, 245, 0.5);
  font-size: 12.5px;
  line-height: 1.6;
}

.model-tag {
  flex-shrink: 0;
  padding: 5px 11px;
  border: 1px solid rgba(160, 200, 255, 0.22);
  border-radius: 999px;
  background: rgba(120, 170, 255, 0.10);
  color: rgba(190, 220, 255, 0.82);
  font-size: 11px;
  font-weight: 700;
}

@media (max-width: 960px) {
  .voice-page {
    padding-left: 72px;
  }

  .voice-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .nav-actions {
    display: none;
  }
}

@media (max-width: 640px) {
  .voice-page {
    padding-left: 62px;
  }

  .voice-main {
    width: min(100% - 28px, 1080px);
    padding-top: 32px;
  }

  .voice-grid {
    grid-template-columns: 1fr;
  }

  .model-panel {
    padding: 20px;
  }
}
</style>
