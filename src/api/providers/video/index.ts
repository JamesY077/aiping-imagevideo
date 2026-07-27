import type { VideoGenerateRequest } from '@/types/api'
import type { VideoProviderAdapter } from './types'
import { klingV26Model, videoModelModules } from '@/models/video'

export const videoProviders: VideoProviderAdapter[] = videoModelModules.map((model) => model.adapter)

export function getVideoProvider(params: VideoGenerateRequest): VideoProviderAdapter {
  const model = params.model?.toLowerCase()
  return videoProviders.find((provider) => model && provider.models.some((candidate) => candidate.toLowerCase() === model)) || klingV26Model.adapter
}
