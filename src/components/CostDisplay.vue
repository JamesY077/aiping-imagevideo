<template>
  <span class="cost-display">¥{{ cost.toFixed(4) }}</span>
</template>

<script setup lang="ts">
defineProps<{ cost: number }>()
</script>

<style scoped>
.cost-display {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--color-danger-soft);
  color: var(--color-danger);
  font-size: 11px;
  font-weight: 700;
}
</style>
