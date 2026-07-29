<template>
  <div class="model-selector" :class="{ compact }">
    <select v-model="selectedModel" @change="onChange">
      <option v-for="model in models" :key="model.id" :value="model.id">
        {{ formatModelLabel(model.id) }}
      </option>
    </select>
    <span class="select-icon" aria-hidden="true">
      <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6.5L8 10L12 6.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { getModels } from '@/api/aiping'
import type { Model } from '@/types/api'
import type { MediaType } from '@/types/model'
import { BUILT_IN_MODELS, getModelAvailabilityLabel, getModelsByMediaType } from '@/types/model'

const props = defineProps<{
  mediaType: MediaType
  modelValue: string | null
  compact?: boolean
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
  models.value = allModels.value.filter((m) => allowedIds.has(m.id)).sort((a, b) => a.id.localeCompare(b.id, 'zh-CN'))
}

function buildFallbackModels(): Model[] {
  return BUILT_IN_MODELS
    .filter((model) => model.mediaType === props.mediaType)
    .map((model): Model => ({
      id: model.id,
      object: 'model',
      created: 0,
      owned_by: 'built-in',
      permission: [],
      root: model.id,
      parent: null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id, 'zh-CN'))
}

onMounted(async () => {
  try {
    const response = await getModels()
    allModels.value = response.data
    filterModels()
    if (models.value.length === 0) {
      models.value = buildFallbackModels()
    }
    if (!models.value.find((m) => m.id === selectedModel.value)) {
      selectedModel.value = models.value.length > 0 ? models.value[0].id : null
      emit('update:modelValue', selectedModel.value)
    }
  } catch {
    models.value = buildFallbackModels()
    if (!models.value.find((m) => m.id === selectedModel.value)) {
      selectedModel.value = models.value.length > 0 ? models.value[0].id : null
      emit('update:modelValue', selectedModel.value)
    }
  }
})

function onChange() {
  emit('update:modelValue', selectedModel.value)
}

function formatModelLabel(modelId: string): string {
  const label = getModelAvailabilityLabel(modelId)
  return label ? `${modelId} · ${label}` : modelId
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

.model-selector.compact {
  max-width: 100%;
}

select {
  appearance: none;
  -webkit-appearance: none;
  min-height: 46px;
  padding: 0 42px 0 16px;
  font-size: 14px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: #fff;
  color: var(--color-text);
  outline: none;
}

.compact select {
  min-height: 28px;
  padding: 0 26px 0 8px;
  border-radius: 10px;
  font-size: 11px;
}

select:focus {
  border-color: var(--color-border-strong);
}

.select-icon {
  position: absolute;
  top: 50%;
  right: 14px;
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transform: translateY(-50%);
  pointer-events: none;
}

.compact .select-icon {
  right: 10px;
  width: 14px;
  height: 14px;
}

.select-icon svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
