import { ref, computed } from 'vue'
import { getModels } from '@/api/aiping'
import type { Model } from '@/types/api'
import type { ModelIOType } from '@/types/model'

// 模型分类映射
const MODEL_IO_MAP: Record<string, ModelIOType> = {
  // 文字 → 图片
  '即梦图片生成 4.0': 'text2image',
  'Doubao-Seedream-5.0-lite': 'text2image',
  'Qwen-Image-2.0-Pro': 'text2image',

  // 图片 → 图片
  'Qwen-Image-Edit-Plus': 'image2image',

  // 文字 → 视频
  'Kling-Video-O1': 'text2video',
  'Kling-V3-Omni': 'text2video',
  'Kling-V3': 'text2video',
  'Kling-V2.6': 'text2video',
  'MiniMax-Hailuo-2.3': 'text2video',
}

export function useModels(ioType: ModelIOType) {
  const allModels = ref<Model[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const filteredModels = computed(() => {
    return allModels.value
      .filter((m) => MODEL_IO_MAP[m.id] === ioType)
      .sort((a, b) => a.id.localeCompare(b.id, 'zh-CN'))
  })

  async function fetchModels() {
    loading.value = true
    error.value = null
    try {
      const response = await getModels()
      allModels.value = response.data
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : '获取模型列表失败'
    } finally {
      loading.value = false
    }
  }

  return { filteredModels, loading, error, fetchModels }
}
