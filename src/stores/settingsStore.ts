import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getDefaultVideoDuration, type MediaType } from '@/types/model'

export const DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT = `你是一名专业的 AI 图像与视频提示词优化助手。
请在保留用户原意的前提下，补全主体、场景、构图、镜头、光线、风格、材质、色彩、细节和质量描述。
只输出润色后的提示词，不要解释，不要添加标题，不要使用 Markdown。`

// 文本节点系统提示词：所有文本模型在生成前都会经过这段系统提示词，
// 用于明确自己的身份和边界（对应 PRD - 文本节点 - 系统提示词）。
export const DEFAULT_TEXT_SYSTEM_PROMPT = `你是文本创作与润色助手。
请在完全尊重用户原意与表达意图的前提下，对文字进行梳理、扩写或润色，让内容更清晰流畅、更具表现力。
不要改变用户想表达的核心内容、观点与风格倾向，不要新增用户未提及的重要事实或设定。
只输出处理后的文本正文，不要解释说明，不要添加标题，不要使用 Markdown 标记。`

// 图片节点系统提示词：图片节点开启 AI 润色时，对 prompt 进行优化所使用的系统提示词。
export const DEFAULT_IMAGE_SYSTEM_PROMPT = `你是 AI 图像提示词优化助手。
请在保留用户原始创意、主体与画面意图的前提下，把描述补充得更完整、更利于出图。
可适度补全构图、镜头、光线、色彩、材质、风格与画质等细节，但不要替换或偏离用户指定的主体、场景与风格。
只输出优化后的提示词正文，不要解释，不要添加标题，不要使用 Markdown。`

// 视频节点系统提示词：视频节点开启 AI 润色时，对 prompt 进行优化所使用的系统提示词。
export const DEFAULT_VIDEO_SYSTEM_PROMPT = `你是 AI 视频提示词优化助手。
请在保留用户原始创意、主体与叙事意图的前提下，把描述补充得更适合生成视频。
可适度补全画面主体、动作与运镜、镜头节奏、场景氛围、光线与风格等要素，但不要替换或偏离用户指定的核心内容与风格。
只输出优化后的提示词正文，不要解释，不要添加标题，不要使用 Markdown。`


export const useSettingsStore = defineStore('settings', () => {
  const mediaType = ref<MediaType>('image')
  const selectedModel = ref<string | null>(null)
  const aspectRatio = ref('1:1')
  const videoDuration = ref(6)
  const promptPolishModel = ref('')
  const promptPolishSystemPrompt = ref('')
  const textSystemPrompt = ref('')

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
      textSystemPrompt.value = settings.textSystemPrompt || ''
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
        textSystemPrompt: textSystemPrompt.value,
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
    textSystemPrompt,
    loadFromStorage,
    saveToStorage,
    setMediaType,
  }
})
