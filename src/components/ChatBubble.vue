<template>
  <div :class="['message', message.type]">
    <div class="avatar">
      <span v-if="message.type === 'user'" class="avatar-icon">我</span>
      <span v-else-if="message.type === 'system'" class="avatar-icon">🤖</span>
      <span v-else class="avatar-icon">AI</span>
    </div>
    <div class="bubble">
      <div class="content">
        <p v-if="message.content">{{ message.content }}</p>
        <div v-if="message.uploadedFile" class="file-preview">
          <img v-if="message.uploadedFile.type === 'image'" :src="message.uploadedFile.url" class="preview-img" />
          <video v-else :src="message.uploadedFile.url" class="preview-video" controls />
          <span class="file-name">{{ message.uploadedFile.name }}</span>
        </div>
      </div>
      <div v-if="message.generateStatus" class="generate-result">
        <div v-if="message.generateStatus === 'pending' || message.generateStatus === 'processing'" class="inline-loading">
          <div class="inline-spinner" />
          <span class="loading-text">{{ message.generateStatus === 'pending' ? '准备生成中' : '生成进行中' }}</span>
        </div>
        <div v-if="message.generateStatus === 'processing' && message.progress" class="progress-bar">
          <div class="progress-fill" :style="{ width: `${message.progress}%` }"></div>
          <span class="progress-text">{{ message.progress }}%</span>
        </div>
        <ImageResult
          v-if="message.generateStatus === 'completed' && message.generateResult?.type === 'image'"
          :result="message.generateResult"
          @regenerate="$emit('regenerate', message)"
        />
        <VideoResult
          v-if="message.generateStatus === 'completed' && message.generateResult?.type === 'video'"
          :result="message.generateResult"
          @regenerate="$emit('regenerate', message)"
        />
        <div v-if="message.generateStatus === 'failed'" class="error">
          <span>{{ message.error || '生成失败' }}</span>
          <button class="retry-btn" @click="$emit('regenerate', message)">重新尝试</button>
        </div>
      </div>
      <div class="meta">
        <span class="time">{{ formatTime(message.timestamp) }}</span>
        <CostDisplay v-if="message.generateResult" :cost="message.generateResult.cost" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ImageResult from './ImageResult.vue'
import VideoResult from './VideoResult.vue'
import CostDisplay from './CostDisplay.vue'
import { formatTime } from '@/utils/format'
import type { Message } from '@/types/chat'

defineProps<{ message: Message }>()
defineEmits<{ (e: 'regenerate', message: Message): void }>()
</script>

<style scoped>
.message {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: flex-start;
  animation: fade-up 0.35s ease;
}

.message.user {
  flex-direction: row-reverse;
}

.avatar {
  position: sticky;
  top: 88px;
  flex-shrink: 0;
}

.avatar-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 9px;
  font-weight: 700;
  backdrop-filter: blur(14px);
}

.bubble {
  width: min(100%, 680px);
  padding: 7px 11px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid var(--color-border);
  box-shadow: var(--color-shadow-soft);
  backdrop-filter: blur(18px);
}

.message.user .bubble {
  background: var(--color-user-bubble);
  border-color: transparent;
}

.message.system .bubble {
  background: rgba(255, 255, 255, 0.92);
}

.content p {
  font-size: 12px;
  line-height: 1.5;
  color: var(--color-text);
  word-break: break-word;
}

.message.user .content p,
.message.user .time {
  color: rgba(255, 255, 255, 0.96);
}

.file-preview {
  margin-top: 8px;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.24);
}

.preview-img,
.preview-video {
  display: block;
  max-height: 180px;
  width: 100%;
  object-fit: cover;
}

.file-name {
  display: block;
  padding: 6px 10px;
  font-size: 11px;
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
}

.generate-result {
  margin-top: 6px;
}

.inline-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.inline-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(0, 113, 227, 0.18);
  border-top-color: var(--color-primary);
  animation: spin 0.75s linear infinite;
}

.loading-text,
.time,
.progress-text {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.progress-bar {
  position: relative;
  margin-top: 10px;
  height: 8px;
  border-radius: 999px;
  background: rgba(29, 29, 31, 0.08);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #0071e3 0%, #54a8ff 100%);
  transition: width var(--transition-base);
}

.progress-text {
  display: inline-block;
  margin-top: 8px;
}

.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 11px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  flex-wrap: wrap;
}

.retry-btn {
  min-height: 22px;
  padding: 0 8px;
  font-size: 11px;
  border: none;
  border-radius: 999px;
  background: #fff;
  color: var(--color-text);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 767px) {
  .message {
    gap: 10px;
    margin-bottom: 18px;
  }

  .avatar {
    top: 72px;
  }

  .avatar-icon {
    width: 36px;
    height: 36px;
  }

  .bubble {
    width: 100%;
    padding: 16px;
    border-radius: 20px;
  }
}
</style>
