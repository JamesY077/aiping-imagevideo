<template>
  <header class="studio-header" :style="{ '--studio-accent': accent }">
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
  align-items: center;
  gap: 20px;
  padding: 18px 28px 14px;
  flex: 0 0 auto;
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
    gap: 12px;
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
