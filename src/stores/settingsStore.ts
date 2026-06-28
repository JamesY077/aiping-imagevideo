import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDefaultVideoDuration, type MediaType } from '@/types/model'

export const DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT = `你是一名专业的 AI 图像与视频提示词优化助手。
请在保留用户原意的前提下，补全主体、场景、构图、镜头、光线、风格、材质、色彩、细节和质量描述。
只输出润色后的提示词，不要解释，不要添加标题，不要使用 Markdown。`

export const useSettingsStore = defineStore('settings', () => {
  const mediaType = ref<MediaType>('image')
  const selectedModel = ref<string | null>(null)
  const aspectRatio = ref('1:1')
  const videoDuration = ref(6)
  const promptPolishModel = ref('')
  const promptPolishSystemPrompt = ref('')

  function loadFromStorage() {
    const saved = localStorage.getItem('settings')
    if (saved) {
      const settings = JSON.parse(saved)
      mediaType.value = settings.mediaType || 'image'
      selectedModel.value = settings.selectedModel || null
      aspectRatio.value = settings.aspectRatio || (mediaType.value === 'video' ? '16:9' : '1:1')
      videoDuration.value = settings.videoDuration || getDefaultVideoDuration(selectedModel.value)
      promptPolishModel.value = settings.promptPolishModel || ''
      promptPolishSystemPrompt.value = settings.promptPolishSystemPrompt || ''
    }
  }

  function saveToStorage() {
    localStorage.setItem(
      'settings',
      JSON.stringify({
        mediaType: mediaType.value,
        selectedModel: selectedModel.value,
        aspectRatio: aspectRatio.value,
        videoDuration: videoDuration.value,
        promptPolishModel: promptPolishModel.value,
        promptPolishSystemPrompt: promptPolishSystemPrompt.value,
      })
    )
  }

  function setMediaType(nextType: MediaType) {
    mediaType.value = nextType
    if (nextType === 'video' && aspectRatio.value === '1:1') {
      aspectRatio.value = '16:9'
    }
    if (nextType === 'video') {
      videoDuration.value = getDefaultVideoDuration(selectedModel.value)
    }
    saveToStorage()
  }

  return {
    mediaType,
    selectedModel,
    aspectRatio,
    videoDuration,
    promptPolishModel,
    promptPolishSystemPrompt,
    loadFromStorage,
    saveToStorage,
    setMediaType,
  }
})
