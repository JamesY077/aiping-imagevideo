<template>
  <div class="image-result">
    <div class="image-wrapper">
      <img :src="result.url" alt="Generated image" referrerpolicy="no-referrer" />
      <div class="image-badge">Image</div>
    </div>
    <div class="info-bar">
      <span class="info-item model-info">
        <span v-if="result.provider" class="provider-tag">{{ result.provider }}</span>
        <span class="model-name">{{ result.model }}</span>
      </span>
      <span class="info-item cost">¥{{ result.cost.toFixed(4) }}</span>
    </div>
    <div class="actions">
      <button class="btn btn-primary" @click="download">下载图片</button>
      <button class="btn btn-secondary" @click="$emit('regenerate')">重新生成</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { GenerateResult } from '@/types/chat'

const props = defineProps<{ result: GenerateResult }>()
defineEmits<{ (e: 'regenerate'): void }>()

function download() {
  // 直接在新标签页打开图片（跨域 CDN 链接无法 fetch，右键另存为即可保存）
  window.open(props.result.url, '_blank', 'noopener,noreferrer')
}
</script>

<style scoped>
.image-result {
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-surface-strong);
}

.image-wrapper {
  position: relative;
  background: #f1f3f5;
}

.image-wrapper img {
  display: block;
  width: 100%;
}

.image-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: var(--color-text);
  font-size: 10px;
  font-weight: 700;
  backdrop-filter: blur(12px);
}

.info-bar,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
}

.info-bar {
  border-top: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: 11px;
}

.model-info {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.provider-tag {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0, 113, 227, 0.08);
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.model-name {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.actions {
  border-top: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.info-item.cost {
  color: var(--color-danger);
  font-weight: 700;
}

.btn {
  min-height: 30px;
  padding: 0 12px;
  font-size: 12px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  transition:
    transform var(--transition-base),
    background var(--transition-base),
    border-color var(--transition-base);
}

.btn:hover {
  transform: translateY(-1px);
}

.btn-primary {
  background: var(--color-primary);
  border-color: transparent;
  color: #fff;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.78);
  color: var(--color-text);
}
</style>
