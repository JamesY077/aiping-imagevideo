import type { ImageGenerateRequest } from '@/types/api'
import type { ImageProviderAdapter } from './types'
import { imageModelModules, qwenImage20ProModel } from '@/models/image'

export const imageProviders: ImageProviderAdapter[] = imageModelModules.map((model) => model.adapter)

export function getImageProvider(params: ImageGenerateRequest): ImageProviderAdapter {
  const model = params.model?.toLowerCase()
  return imageProviders.find((provider) => model && provider.models.some((candidate) => candidate.toLowerCase() === model)) || qwenImage20ProModel.adapter
}
