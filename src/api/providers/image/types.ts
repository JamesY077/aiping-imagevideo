import type { ImageGenerateRequest } from '@/types/api'

export type ImageProviderName = 'doubao' | 'glm' | 'moss' | 'minimax-image'

export interface ImageProviderRequest {
  endpoint: string
  body: Record<string, unknown>
}

export interface ImageProviderAdapter {
  provider: ImageProviderName
  models: string[]
  endpoint: string
  buildRequestBody: (params: ImageGenerateRequest) => Record<string, unknown>
  /**
   * 需要按参数切换端点或请求体结构时使用（例如 MiniMax-H3-Image 的文生图 / 图片编辑）。
   * 返回结果优先于 endpoint + buildRequestBody。
   */
  buildRequest?: (params: ImageGenerateRequest) => ImageProviderRequest
}
