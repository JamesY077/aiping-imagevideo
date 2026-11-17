import type { ImageGenerateRequest } from '@/types/api'

export type ImageProviderName = 'doubao' | 'glm' | 'moss'

export interface ImageProviderAdapter {
  provider: ImageProviderName
  models: string[]
  endpoint: string
  buildRequestBody: (params: ImageGenerateRequest) => Record<string, unknown>
}
