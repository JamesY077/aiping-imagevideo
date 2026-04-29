<template>
  <div v-if="visible" class="loading-overlay">
    <div class="spinner-wrapper">
      <div class="spinner" />
      <div class="spinner-dot"></div>
    </div>
    <p>{{ text }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ visible: boolean; text?: string }>()
</script>

<style scoped>
.loading-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(6px);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  z-index: 9999; color: white;
}

.spinner-wrapper {
  position: relative;
  width: 60px; height: 60px;
}

.spinner {
  width: 60px; height: 60px;
  border: 4px solid rgba(255,255,255,0.2);
  border-top-color: var(--color-accent-yellow);
  border-right-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-dot {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 12px; height: 12px;
  background: var(--color-accent-yellow);
  border: 2px solid white;
  border-radius: 50%;
  animation: pulse-dot 1s ease-in-out infinite;
}

p {
  margin-top: 16px;
  font-size: 14px;
  font-weight: 900;
  font-family: var(--font-pixel);
  font-size: 10px;
  letter-spacing: 1px;
}

@keyframes spin { to { transform: rotate(360deg); } }

@keyframes pulse-dot {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.3); }
}
</style>
