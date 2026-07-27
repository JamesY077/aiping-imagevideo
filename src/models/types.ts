import type { ImageGenerateRequest, ImageGenerateResponse, VideoGenerateRequest, VideoGenerateResponse } from '@/types/api'
import type { ModelCapability } from '@/types/model'
import type { ImageProviderAdapter } from '@/api/providers/image/types'
import type { VideoProviderAdapter } from '@/api/providers/video/types'

export type ModelExample<TRequest, TResponse> = {
  title: string
  description: string
  request: TRequest
  code: string
  run: (generate: (request: TRequest) => Promise<TResponse>) => Promise<TResponse>
}

export interface BaseModelModule<TRequest, TResponse, TAdapter> {
  id: string
  displayName: string
  capability: ModelCapability
  adapter: TAdapter
  example: ModelExample<TRequest, TResponse>
}

export type ImageModelModule = BaseModelModule<ImageGenerateRequest, ImageGenerateResponse, ImageProviderAdapter>
export type VideoModelModule = BaseModelModule<VideoGenerateRequest, VideoGenerateResponse, VideoProviderAdapter>

export function createModelExample<TRequest, TResponse>(params: Omit<ModelExample<TRequest, TResponse>, 'run'>): ModelExample<TRequest, TResponse> {
  return {
    ...params,
    run: (generate) => generate(params.request),
  }
}