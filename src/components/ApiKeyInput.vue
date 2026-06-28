<template>
  <div class="api-key-input">
    <label>API 密钥</label>
    <div class="input-wrapper">
      <input :type="showKey ? 'text' : 'password'" v-model="localKey" placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx" />
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
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text-secondary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.input-wrapper {
  display: flex;
  gap: 10px;
}

input {
  flex: 1;
  min-width: 0;
  padding: 15px 16px;
  border: 1px solid var(--color-border);
  border-radius: 18px;
  background: #fff;
  color: var(--color-text);
  outline: none;
}

input:focus {
  border-color: var(--color-border-strong);
}

input::placeholder {
  color: var(--color-text-hint);
}

.toggle-visibility {
  flex-shrink: 0;
  min-height: 50px;
  padding: 0 18px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: #fff;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
}
</style>
