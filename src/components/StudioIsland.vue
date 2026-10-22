<template>
  <nav class="studio-island" :class="`tone-${tone}`" aria-label="创作分区快速切换">
    <button
      class="island-item island-home"
      type="button"
      title="返回首页"
      aria-label="返回首页"
      @click="go('/')"
    >
      <span class="island-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
          <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" stroke-linejoin="round" />
        </svg>
      </span>
      <span class="island-label">首页</span>
    </button>

    <span class="island-divider" aria-hidden="true" />

    <button
      v-for="item in items"
      :key="item.path"
      class="island-item"
      :class="{ active: item.path === activePath }"
      :style="{ '--item-accent': item.accent, '--item-accent-soft': item.accentSoft }"
      type="button"
      :title="item.label"
      :aria-label="item.label"
      :aria-current="item.path === activePath ? 'page' : undefined"
      @click="go(item.path)"
    >
      <span class="island-icon" aria-hidden="true">{{ item.icon }}</span>
      <span class="island-label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

withDefaults(defineProps<{ tone?: 'dark' | 'light' }>(), { tone: 'dark' })

const router = useRouter()
const route = useRoute()

const items = [
  {
    path: '/skill',
    label: 'Skill 创作',
    icon: '✦',
    accent: '#a78bfa',
    accentSoft: 'rgba(167, 139, 250, 0.22)',
  },
  {
    path: '/studio',
    label: '图片视频生成',
    icon: '◈',
    accent: '#38bdf8',
    accentSoft: 'rgba(56, 189, 248, 0.20)',
  },
  {
    path: '/voice',
    label: '配音创作',
    icon: '♪',
    accent: '#fb923c',
    accentSoft: 'rgba(251, 146, 60, 0.22)',
  },
]

const activePath = computed(() => items.find((item) => route.path.startsWith(item.path))?.path || '')

function go(path: string) {
  if (route.path !== path) router.push(path)
}
</script>

<style scoped>
.studio-island {
  position: fixed;
  left: 14px;
  top: 50%;
  z-index: 90;
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 58px;
  padding: 9px 8px;
  transform: translateY(-50%);
  overflow: hidden;
  border-radius: 999px;
  transition:
    width 280ms cubic-bezier(0.16, 1, 0.3, 1),
    background 220ms ease,
    border-color 220ms ease;
}

/* 深色页面上的胶囊 */
.studio-island.tone-dark {
  border: 1px solid rgba(255, 255, 255, 0.10);
  background: rgba(10, 12, 20, 0.74);
  box-shadow:
    0 26px 64px rgba(0, 0, 0, 0.48),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(22px) saturate(150%);
}

/* 浅色页面（Skill 创作）上的胶囊 */
.studio-island.tone-light {
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(255, 255, 255, 0.82);
  box-shadow:
    0 22px 54px rgba(15, 23, 42, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(22px) saturate(150%);
}

.studio-island:hover,
.studio-island:focus-within {
  width: 188px;
}

.studio-island.tone-dark:hover,
.studio-island.tone-dark:focus-within {
  background: rgba(10, 12, 20, 0.9);
}

.studio-island.tone-light:hover,
.studio-island.tone-light:focus-within {
  background: rgba(255, 255, 255, 0.95);
}

.island-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: background 180ms ease;
}

.tone-dark .island-item {
  color: rgba(226, 232, 246, 0.62);
}

.tone-light .island-item {
  color: rgba(51, 65, 85, 0.72);
}

.tone-dark .island-item:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.94);
}

.tone-light .island-item:hover {
  background: rgba(15, 23, 42, 0.06);
  color: rgba(15, 23, 42, 0.92);
}

.island-icon {
  flex: 0 0 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  font-size: 14px;
  line-height: 1;
  transition:
    background 180ms ease,
    color 180ms ease,
    box-shadow 220ms ease;
}

.island-icon svg {
  width: 17px;
  height: 17px;
}

.tone-dark .island-icon {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(226, 232, 246, 0.78);
}

.tone-light .island-icon {
  background: rgba(15, 23, 42, 0.06);
  color: rgba(51, 65, 85, 0.82);
}

.island-label {
  opacity: 0;
  white-space: nowrap;
  transition: opacity 120ms ease;
}

.studio-island:hover .island-label,
.studio-island:focus-within .island-label {
  opacity: 1;
  transition-delay: 70ms;
}

.island-divider {
  width: 22px;
  height: 1px;
  margin: 5px auto;
  transition: width 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.tone-dark .island-divider {
  background: rgba(255, 255, 255, 0.12);
}

.tone-light .island-divider {
  background: rgba(15, 23, 42, 0.12);
}

.studio-island:hover .island-divider,
.studio-island:focus-within .island-divider {
  width: 100%;
}

/* 当前所在分区 */
.island-item.active .island-icon {
  background: var(--item-accent-soft);
  color: var(--item-accent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--item-accent) 42%, transparent),
    0 0 22px -6px var(--item-accent);
}

.tone-dark .island-item.active {
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
}

.tone-light .island-item.active {
  background: rgba(15, 23, 42, 0.05);
  color: rgba(15, 23, 42, 0.96);
}

.tone-dark .island-item.active .island-label {
  color: #fff;
}

/* 触屏 / 窄屏：只显示图标，不展开 */
@media (hover: none), (max-width: 900px) {
  .studio-island,
  .studio-island:hover,
  .studio-island:focus-within {
    left: 8px;
    width: 52px;
    padding: 8px 6px;
  }

  .studio-island .island-label {
    display: none;
  }

  .island-icon {
    flex-basis: 36px;
    width: 36px;
    height: 36px;
  }
}
</style>
