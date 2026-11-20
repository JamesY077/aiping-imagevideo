<template>
  <header class="studio-header" :style="{ '--studio-accent': accent }">
    <div class="studio-header-main">
      <button class="studio-brand" type="button" aria-label="返回 ArtRealm 首页" @click="router.push('/')">
        <img class="studio-brand-logo" :src="assetUrl('/logo1.webp')" alt="" />
        <span class="studio-brand-name">ArtRealm</span>
      </button>

      <div class="studio-heading">
        <span class="studio-kicker">{{ kicker }}</span>
        <h1 class="studio-heading-title">{{ title }}</h1>
        <p v-if="subtitle" class="studio-heading-sub">{{ subtitle }}</p>
      </div>

      <div class="studio-header-actions">
        <slot name="actions" />
        <button class="studio-action" type="button" @click="router.push('/settings')">设置</button>
      </div>
    </div>

    <p class="studio-save-notice" role="note">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" />
        <path d="M12 8.2v.02M12 11.2v5" />
      </svg>
      温馨提示：生成结果仅保留在当前页面，请及时下载或另存；刷新、关闭页面后可能无法恢复。
    </p>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { assetUrl } from '@/utils/assets'

withDefaults(
  defineProps<{
    kicker: string
    title: string
    subtitle?: string
    accent?: string
  }>(),
  { accent: '#8b7dff', subtitle: '' },
)

const router = useRouter()
</script>

<style scoped>
.studio-header {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 10px;
  padding: 18px 28px 12px;
}

.studio-header-main {
  display: flex;
  align-items: center;
  gap: 20px;
}

/* 顶部居中的保存提醒：所有创作页共用，语言保持克制不抢主操作 */
.studio-save-notice {
  display: inline-flex;
  align-self: center;
  align-items: center;
  gap: 6px;
  max-width: min(100%, 720px);
  padding: 4px 14px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.028);
  color: rgba(255, 255, 255, 0.44);
  font-size: 11px;
  line-height: 1.6;
  letter-spacing: 0.01em;
  text-align: center;
}

.studio-save-notice svg {
  flex: none;
  width: 12px;
  height: 12px;
  opacity: 0.75;
}

.studio-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  font: inherit;
  cursor: pointer;
  transition:
    background var(--transition-base),
    border-color var(--transition-base);
}

.studio-brand:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
}

.studio-brand-logo {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
}

.studio-brand-name {
  font-family: var(--font-family-display);
  font-size: 13.5px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.studio-heading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.studio-heading-title {
  font-family: var(--font-family-display);
  font-size: clamp(18px, 1.5vw, 22px);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.2;
  color: #fff;
}

.studio-heading-sub {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--studio-text-hint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.studio-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.studio-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 15px;
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.045);
  color: rgba(255, 255, 255, 0.76);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background var(--transition-base),
    border-color var(--transition-base),
    color var(--transition-base);
}

.studio-action:hover {
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.18);
  color: #fff;
}

@media (max-width: 1080px) {
  .studio-heading-sub {
    display: none;
  }
}

@media (max-width: 860px) {
  .studio-header {
    padding: 14px 16px 10px;
    gap: 8px;
  }

  .studio-header-main {
    flex-wrap: wrap;
    gap: 10px 12px;
  }

  /* 标题给出基准宽度，操作区放不下时自动换到下一行，不再被模型名挤成竖排 */
  .studio-heading {
    flex: 1 1 200px;
  }

  .studio-save-notice {
    width: 100%;
    padding: 6px 10px;
    border-radius: 12px;
    font-size: 10.5px;
  }

  .studio-brand-name {
    display: none;
  }

  .studio-brand {
    padding: 5px;
  }

  .studio-action {
    min-height: 32px;
    padding: 0 11px;
    font-size: 12px;
  }
}
</style>
