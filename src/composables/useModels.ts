import { ref, computed } from 'vue'
import { getModels } from '@/api/aiping'
import type { Model } from '@/types/api'
import type { ModelIOType } from '@/types/model'

// 模型分类映射
const MODEL_IO_MAP: Record<string, ModelIOType> = {
  // 文字 → 图片
  'Qwen-Image-2.0': 'text2image',
  'Qwen-Image-2.0-Pro': 'text2image',
  'Doubao-Seedream-5.0-lite': 'text2image',
  'Doubao-Seedream-4.5': 'text2image',
  'GLM-Image': 'text2image',
  'Kling-V2-New': 'text2image',
  '即梦图片生成 4.0': 'text2image',
  '即梦文生图 3.0': 'text2image',
  '即梦文生图 3.1': 'text2image',
  'Qwen-Image': 'text2image',
  'Kolors': 'text2image',
  'Wan2.5-T2I-Preview': 'text2image',
  'Doubao-Seedream-4.0': 'text2image',
  'Qwen-Image-Plus': 'text2image',
  'HunyuanImage-3.0': 'text2image',

  // 图片 → 图片
  'Wan2.5-I2I-Preview': 'image2image',
  'Qwen-Image-Edit': 'image2image',
  'Qwen-Image-Edit-Plus': 'image2image',

  // 文字 → 视频
  'Kling-Video-O1': 'text2video',
  'Kling-V3-Omni': 'text2video',
  'Kling-V3': 'text2video',
  'MiniMax-Hailuo-2.3': 'text2video',
  'viduq3-pro-text2video': 'text2video',
  'viduq3-turbo-text2video': 'text2video',
  '即梦视频生成 3.0 Pro': 'text2video',
  'Wan2.6-T2V': 'text2video',
  'Kling-V1.5': 'text2video',
  'Kling-V2': 'text2video',
  'Kling-V2.1': 'text2video',
  'Kling-V1': 'text2video',
  'Kling-V2.6': 'text2video',
  'viduq2-text2video': 'text2video',

  // 图片 → 视频
  'viduq3-pro-img2video': 'image2video',
  'viduq3-pro-start-end2video': 'image2video',
  'viduq3-turbo-img2video': 'image2video',
  'Wan2.6-I2V': 'image2video',
  'Wan2.6-R2V': 'image2video',
  'viduq2-pro-start-end2video': 'image2video',
  'viduq2-pro-img2video': 'image2video',
  'viduq2-pro-reference2video': 'image2video',
  'viduq2-turbo-img2video': 'image2video',
  'viduq2-turbo-start-end2video': 'image2video',
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
