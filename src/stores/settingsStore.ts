import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MediaType } from '@/types/model'

export const useSettingsStore = defineStore('settings', () => {
  const mediaType = ref<MediaType>('image')
  const selectedModel = ref<string | null>(null)
  const aspectRatio = ref('1:1')

  function loadFromStorage() {
    const saved = localStorage.getItem('settings')
    if (saved) {
      const settings = JSON.parse(saved)
      mediaType.value = settings.mediaType || 'image'
      selectedModel.value = settings.selectedModel || null
      aspectRatio.value = settings.aspectRatio || (mediaType.value === 'video' ? '16:9' : '1:1')
    }
  }

  function saveToStorage() {
    localStorage.setItem(
      'settings',
      JSON.stringify({
        mediaType: mediaType.value,
        selectedModel: selectedModel.value,
        aspectRatio: aspectRatio.value,
      })
    )
  }

  function setMediaType(nextType: MediaType) {
    mediaType.value = nextType
    if (nextType === 'video' && aspectRatio.value === '1:1') {
      aspectRatio.value = '16:9'
    }
    saveToStorage()
  }

  return {
    mediaType,
    selectedModel,
    aspectRatio,
    loadFromStorage,
    saveToStorage,
    setMediaType,
  }
})
