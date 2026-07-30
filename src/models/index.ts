import type { ImageModelModule, VideoModelModule } from './types'
import { imageModelModules } from './image'
import { videoModelModules } from './video'

export type { BaseModelModule, ImageModelModule, ModelExample, VideoModelModule } from './types'
export { imageModelModules } from './image'
export { videoModelModules } from './video'
export {
  textModelModules,
  DEFAULT_TEXT_MODEL_ID,
  getTextModelModule,
  isTextModel,
  buildTextExtraBody,
} from './text'
export type { TextModelModule } from './text'

export const modelModules = [...imageModelModules, ...videoModelModules] as Array<ImageModelModule | VideoModelModule>

export const modelExamples = modelModules.map((model) => ({
  id: model.id,
  mediaType: model.capability.mediaType,
  example: model.example,
}))

export function getModelModule(modelId: string | null | undefined): ImageModelModule | VideoModelModule | null {
  if (!modelId) return null
  const normalizedModelId = modelId.toLowerCase()
  return modelModules.find((model) => {
    if (model.id.toLowerCase() === normalizedModelId) return true
    return model.adapter.models.some((alias) => alias.toLowerCase() === normalizedModelId)
  }) || null
}