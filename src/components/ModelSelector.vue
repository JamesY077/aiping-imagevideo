<template>
  <div class="model-selector">
    <select v-model="selectedModel" @change="onChange">
      <option :value="null">自动选择</option>
      <option v-for="model in models" :key="model.id" :value="model.id">
        {{ model.id }}{{ modelSupportsLocalUpload(model.id) ? ' · 支持上传' : '' }}
      </option>
    </select>
    <span class="select-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M4 6.5L8 10L12 6.5"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { getModels } from '@/api/aiping'
import type { Model } from '@/types/api'
import type { MediaType } from '@/types/model'
import { getModelsByMediaType, modelSupportsLocalUpload } from '@/types/model'

const props = defineProps<{
  mediaType: MediaType
  modelValue: string | null
}>()

const emit = defineEmits<{ (e: 'update:modelValue', value: string | null): void }>()

const selectedModel = ref<string | null>(props.modelValue)
const models = ref<Model[]>([])
const allModels = ref<Model[]>([])

watch(() => props.modelValue, (v) => {
  selectedModel.value = v
})

watch(() => props.mediaType, () => {
  filterModels()
  if (!models.value.find((m) => m.id === selectedModel.value)) {
    selectedModel.value = models.value.length > 0 ? models.value[0].id : null
    emit('update:modelValue', selectedModel.value)
  }
})

function filterModels() {
  const allowedIds = new Set(getModelsByMediaType(props.mediaType, allModels.value.map((m) => m.id)))
  models.value = allModels.value
    .filter((m) => allowedIds.has(m.id))
    .sort((a, b) => a.id.localeCompare(b.id, 'zh-CN'))
}

onMounted(async () => {
  try {
    const response = await getModels()
    allModels.value = response.data
    filterModels()
    if (!models.value.find((m) => m.id === selectedModel.value)) {
      selectedModel.value = models.value.length > 0 ? models.value[0].id : null
      emit('update:modelValue', selectedModel.value)
    }
  } catch {
    // ignore
  }
})

function onChange() {
  emit('update:modelValue', selectedModel.value)
}
</script>

<style scoped>
.model-selector,
select {
  width: 100%;
}

.model-selector {
  position: relative;
}

select {
  appearance: none;
  -webkit-appearance: none;
  padding: 6px 38px 6px 12px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  color: var(--color-text);
  outline: none;
  transition:
    border-color var(--transition-base),
    box-shadow var(--transition-base),
    background var(--transition-base);
}

select:focus {
  border-color: rgba(0, 113, 227, 0.35);
  box-shadow: 0 0 0 4px rgba(0, 113, 227, 0.12);
  background-color: #fff;
}

.select-icon {
  position: absolute;
  top: 50%;
  right: 12px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transform: translateY(-50%);
  pointer-events: none;
}

.select-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
