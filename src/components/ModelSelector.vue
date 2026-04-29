<template>
  <div class="model-selector">
    <select v-model="selectedModel" @change="onChange">
      <option :value="null">自动选择</option>
      <option v-for="model in models" :key="model.id" :value="model.id">
        {{ model.id }}{{ modelSupportsLocalUpload(model.id) ? ' · 支持上传' : '' }}
      </option>
    </select>
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
    if (!selectedModel.value && models.value.length > 0) {
      selectedModel.value = models.value[0].id
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

select {
  appearance: none;
  padding: 6px 36px 6px 12px;
  font-size: 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background:
    linear-gradient(45deg, transparent 50%, var(--color-text-secondary) 50%),
    linear-gradient(135deg, var(--color-text-secondary) 50%, transparent 50%),
    rgba(255, 255, 255, 0.82);
  background-position:
    calc(100% - 22px) calc(50% - 2px),
    calc(100% - 16px) calc(50% - 2px),
    0 0;
  background-size:
    6px 6px,
    6px 6px,
    100% 100%;
  background-repeat: no-repeat;
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
</style>
