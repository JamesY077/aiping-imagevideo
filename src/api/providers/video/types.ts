import type { VideoGenerateRequest, VideoGenerateResponse } from '@/types/api'

export type VideoProviderName = 'vidu' | 'minimax' | 'kling' | 'seedance'


export interface VideoProviderAdapter {
  provider: VideoProviderName
  models: string[]
  buildRequestBody: (params: VideoGenerateRequest) => Record<string, unknown>
  getEndpoint: (body: Record<string, unknown>) => string
  buildFallbackBodies?: (body: Record<string, unknown>) => Record<string, unknown>[]
  normalizeResponse?: (data: any) => VideoGenerateResponse
  statusEndpoints?: (taskId: string) => string[]
}
