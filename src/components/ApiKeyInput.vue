<template>
  <div class="api-key-input">
    <label>API Key</label>
    <div class="input-wrapper">
      <input
        :type="showKey ? 'text' : 'password'"
        v-model="localKey"
        placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
      />
      <button type="button" class="toggle-visibility" @click="showKey = !showKey">
        {{ showKey ? '隐藏' : '显示' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const localKey = ref(props.modelValue)
const showKey = ref(false)

watch(localKey, (value) => emit('update:modelValue', value))
watch(() => props.modelValue, (value) => {
  localKey.value = value
})
</script>

<style scoped>
.api-key-input {
  width: 100%;
}

label {
  display: block;
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}

.input-wrapper {
  display: flex;
  gap: 12px;
}

input {
  flex: 1;
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.9);
  color: var(--color-text);
  transition:
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    background var(--transition-base);
}

input:focus {
  outline: none;
  border-color: rgba(0, 113, 227, 0.35);
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.12);
  background: #fff;
}

input::placeholder {
  color: var(--color-text-hint);
}

.toggle-visibility {
  flex-shrink: 0;
  padding: 0 18px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.75);
  color: var(--color-text);
  transition:
    transform var(--transition-base),
    background var(--transition-base),
    border-color var(--transition-base);
}

.toggle-visibility:hover {
  transform: translateY(-1px);
  background: #fff;
  border-color: var(--color-border-strong);
}
</style>
