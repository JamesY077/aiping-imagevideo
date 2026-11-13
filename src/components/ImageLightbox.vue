<template>
  <Teleport to="body">
    <div class="lightbox" role="dialog" aria-modal="true" aria-label="图片预览" @click.self="$emit('close')">
      <div class="lightbox-top">
        <span class="lightbox-counter">{{ index + 1 }} / {{ results.length }}</span>
        <span class="lightbox-model">{{ result?.model }}</span>
        <button class="lightbox-close" type="button" aria-label="关闭预览" @click="$emit('close')">✕</button>
      </div>

      <button
        v-if="results.length > 1"
        class="lightbox-nav lightbox-prev"
        type="button"
        aria-label="上一张"
        @click="step(-1)"
      >
        ‹
      </button>

      <div class="lightbox-stage">
        <img :src="result?.url" alt="生成结果预览" referrerpolicy="no-referrer" />
      </div>

      <button
        v-if="results.length > 1"
        class="lightbox-nav lightbox-next"
        type="button"
        aria-label="下一张"
        @click="step(1)"
      >
        ›
      </button>

      <div class="lightbox-actions">
        <span class="lightbox-meta">
          <span v-if="result?.aspectRatio">{{ result.aspectRatio }}</span>
          <span v-if="result?.size">{{ result.size.width }} × {{ result.size.height }}</span>
        </span>
        <div class="lightbox-buttons">
          <button class="lb-btn lb-btn-primary" type="button" @click="download">下载</button>
          <button class="lb-btn" type="button" @click="$emit('regenerate')">重生成</button>
          <button class="lb-btn" type="button" @click="$emit('expand')">扩图</button>
          <button v-if="result?.layout" class="lb-btn lb-btn-layers" type="button" @click="$emit('editLayers')">
            图层 {{ result.layout.items.length }}
          </button>
          <button v-if="prompt" class="lb-btn" type="button" @click="copyPrompt">复制提示词</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { GenerateResult } from '@/types/chat'

const props = defineProps<{
  results: GenerateResult[]
  index: number
  prompt?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:index', value: number): void
  (e: 'regenerate'): void
  (e: 'expand'): void
  (e: 'editLayers'): void
}>()

const result = computed(() => props.results[props.index] || null)

function step(delta: number) {
  const total = props.results.length
  if (total < 2) return
  emit('update:index', (props.index + delta + total) % total)
}

function download() {
  const target = result.value
  if (!target) return
  const link = document.createElement('a')
  link.href = target.url
  link.download = `aiping-image-${Date.now()}.png`
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function copyPrompt() {
  if (!props.prompt) return
  try {
    await navigator.clipboard.writeText(props.prompt)
  } catch {
    // 剪贴板不可用时静默失败，不打断看图
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
  else if (event.key === 'ArrowLeft') step(-1)
  else if (event.key === 'ArrowRight') step(1)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  flex-direction: column;
  padding: 18px 18px 0;
  background: rgba(6, 7, 10, 0.94);
  backdrop-filter: blur(18px);
}

.lightbox-top {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  min-height: 34px;
}

.lightbox-counter {
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.lightbox-model {
  overflow: hidden;
  color: rgba(255, 255, 255, 0.4);
  font-size: 11.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lightbox-close {
  margin-left: auto;
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.8);
  font-size: 13px;
  cursor: pointer;
}

.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
}

.lightbox-stage {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  min-height: 0;
  padding: 14px 0;
}

.lightbox-stage img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 10px;
  object-fit: contain;
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55);
}

.lightbox-nav {
  position: absolute;
  top: 50%;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  background: rgba(16, 18, 24, 0.8);
  color: rgba(255, 255, 255, 0.8);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  transform: translateY(-50%);
}

.lightbox-nav:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

.lightbox-prev {
  left: 18px;
}

.lightbox-next {
  right: 18px;
}

.lightbox-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 0 0 auto;
  padding: 12px 4px 18px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
}

.lightbox-meta {
  display: flex;
  gap: 10px;
  color: rgba(255, 255, 255, 0.42);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.lightbox-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}

.lb-btn {
  min-height: 32px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.82);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.lb-btn:hover {
  border-color: rgba(217, 205, 184, 0.36);
  background: rgba(217, 205, 184, 0.14);
  color: #fff;
}

.lb-btn-primary {
  border-color: transparent;
  background: linear-gradient(135deg, #f4efe6, #d8cbb4);
  color: #16130f;
}

.lb-btn-primary:hover {
  background: linear-gradient(135deg, #fbf7f0, #e7dcc9);
  color: #16130f;
}

.lb-btn-layers {
  border-color: rgba(246, 196, 83, 0.4);
  background: rgba(246, 196, 83, 0.14);
  color: #f6e3b0;
}

@media (max-width: 720px) {
  .lightbox {
    padding: 12px 12px 0;
  }

  .lightbox-nav {
    width: 36px;
    height: 36px;
    font-size: 18px;
  }

  .lightbox-prev {
    left: 6px;
  }

  .lightbox-next {
    right: 6px;
  }

  .lightbox-actions {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding-bottom: 12px;
  }

  .lightbox-meta {
    justify-content: center;
  }

  .lightbox-buttons {
    justify-content: center;
    margin-left: 0;
  }
}
</style>
