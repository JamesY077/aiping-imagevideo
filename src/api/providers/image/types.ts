import type { ImageGenerateRequest } from '@/types/api'

export type ImageProviderName = 'doubao' | 'qwen' | 'glm'

export interface ImageProviderAdapter {
  provider: ImageProviderName
  models: string[]
  endpoint: string
  buildRequestBody: (params: ImageGenerateRequest) => Record<string, unknown>
}
