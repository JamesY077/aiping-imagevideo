<template>
  <article class="result-card image-result">
    <button class="media-frame" type="button" :style="thumbnailStyle" @click="openPreview">
      <img :src="result.url" alt="Generated image" referrerpolicy="no-referrer" />
      <span class="media-chip">图片</span>
      <span class="media-overlay">点击查看原图</span>
    </button>

    <div class="result-body">
      <div class="title-stack">
        <span v-if="result.provider" class="provider-pill">{{ result.provider }}</span>
        <h3 class="result-title">{{ result.model }}</h3>
      </div>

      <dl class="meta-list">
        <div class="meta-pair">
          <dt>比例</dt>
          <dd>{{ ratioLabel }}</dd>
        </div>
        <div v-if="result.size" class="meta-pair">
          <dt>尺寸</dt>
          <dd>{{ result.size.width }} × {{ result.size.height }}</dd>
        </div>
        <div v-if="createdTimeLabel" class="meta-pair">
          <dt>生成时间</dt>
          <dd>{{ createdTimeLabel }}</dd>
        </div>
      </dl>
    </div>

    <footer class="result-actions">
      <button class="action-btn action-btn-primary" type="button" @click="download">下载图片</button>
      <button class="action-btn" type="button" @click="openPreview">查看原图</button>
      <button class="action-btn action-btn-subtle" type="button" @click="$emit('regenerate')">重新生成</button>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GenerateResult } from '@/types/chat'

const props = defineProps<{ result: GenerateResult }>()
defineEmits<{ (e: 'regenerate'): void }>()

const ratioLabel = computed(() => {
  if (props.result.aspectRatio) return props.result.aspectRatio
  const width = props.result.size?.width
  const height = props.result.size?.height
  if (width && height) return `${width}:${height}`
  return '未知'
})

const createdTimeLabel = computed(() => {
  if (!props.result.createdAt) return ''
  return new Date(props.result.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
})

const thumbnailStyle = computed(() => {
  const width = props.result.size?.width
  const height = props.result.size?.height
  if (!width || !height) {
    return {
      aspectRatio: '1 / 1',
    }
  }

  return {
    aspectRatio: `${width} / ${height}`,
  }
})

function download() {
  const link = document.createElement('a')
  link.href = props.result.url
  link.download = `aiping-image-${Date.now()}.png`
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function openPreview() {
  window.open(props.result.url, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.result-card {
  display: grid;
  grid-template-columns: minmax(112px, 192px) minmax(0, 1fr);
  gap: 16px;
  width: min(100%, 560px);
  padding: 16px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.72));
  border: 1px solid rgba(30, 41, 59, 0.08);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(18px);
}

.media-frame {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 0;
  border-radius: 20px;
  padding: 0;
  background: linear-gradient(180deg, rgba(245, 247, 251, 0.96), rgba(237, 241, 247, 0.92));
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.18);
  cursor: zoom-in;
}

.media-frame img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

.media-chip,
.media-overlay {
  position: absolute;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 11px;
}

.media-chip {
  top: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--color-text);
  font-weight: 700;
}

.media-overlay {
  right: 10px;
  bottom: 10px;
  background: rgba(18, 24, 38, 0.62);
  color: rgba(255, 255, 255, 0.94);
}

.result-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.title-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.provider-pill {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  font-size: 11px;
  font-weight: 700;
}

.result-title {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--color-text);
  word-break: break-word;
}

.meta-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.meta-pair {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.14);
}

.meta-pair dt {
  font-size: 11px;
  color: var(--color-text-hint);
}

.meta-pair dd {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text);
  word-break: break-word;
}

.result-actions {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 4px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.10);
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  font-weight: 600;
  transition:
    transform var(--transition-base),
    background var(--transition-base),
    border-color var(--transition-base),
    box-shadow var(--transition-base);
}

.action-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.20);
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.action-btn-primary {
  background: var(--color-theme-gradient);
  border-color: transparent;
  color: #08080a;
  box-shadow: 0 12px 24px rgba(95, 75, 139, 0.22);
}

.action-btn-primary:hover {
  background: var(--color-theme-gradient-hover);
  border-color: transparent;
  color: #08080a;
  box-shadow: 0 14px 28px rgba(95, 75, 139, 0.26);
}

.action-btn-primary:active {
  background: var(--color-theme-gradient-active);
  border-color: transparent;
  color: #08080a;
  transform: translateY(0);
  box-shadow: 0 8px 18px rgba(95, 75, 139, 0.2);
}

.action-btn-primary:focus-visible {
  background: var(--color-theme-gradient-hover);
  border-color: transparent;
}

.action-btn-subtle {
  margin-left: auto;
}

@media (max-width: 767px) {
  .result-card {
    grid-template-columns: 1fr;
  }

  .media-frame {
    width: min(100%, 220px);
  }

  .meta-list {
    grid-template-columns: 1fr;
  }

  .result-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .action-btn,
  .action-btn-subtle {
    width: 100%;
    margin-left: 0;
  }
}
</style>
