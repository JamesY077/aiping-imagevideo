import { modelModules } from '@/models'

export type ModelIOType = 'text2image' | 'text2video' | 'image2image' | 'image2video'

export type MediaType = 'image' | 'video'
export type ModelInputType = 'text' | 'image' | 'video'

export interface ModelOption {
  id: string
  name: string
  ioType: ModelIOType
  pricing?: {
    input?: number
    output?: number
  }
}

export interface ModelCapability {
  mediaType: MediaType
  inputs: ModelInputType[]
  localUploadInputs?: ModelInputType[]
  requiresReference?: boolean
  availabilityNote?: 'supports-image-upload' | 'supports-video-upload' | 'supports-image-video-upload' | 'requires-image-upload' | 'requires-video-upload'
  imageRequestMode?: 'default' | 'seedream-5-lite'
  videoRequestMode?: 'kling-v26' | 'kling-v3' | 'kling-omni' | 'kling-o1' | 'viduq3-fast' | 'minimax-hailuo'
}

export interface BuiltInModelDescriptor {
  id: string
  mediaType: MediaType
}

export interface AspectRatioOption {
  value: string
  label: string
  boxWidth: number
  boxHeight: number
}

export interface VideoDurationOption {
  value: number
  label: string
}

export const ASPECT_RATIO_OPTIONS: AspectRatioOption[] = [
  { value: '16:9', label: '16:9', boxWidth: 28, boxHeight: 16 },
  { value: '3:2', label: '3:2', boxWidth: 24, boxHeight: 16 },
  { value: '4:3', label: '4:3', boxWidth: 22, boxHeight: 16 },
  { value: '1:1', label: '1:1', boxWidth: 18, boxHeight: 18 },
  { value: '3:4', label: '3:4', boxWidth: 16, boxHeight: 22 },
  { value: '2:3', label: '2:3', boxWidth: 16, boxHeight: 24 },
  { value: '9:16', label: '9:16', boxWidth: 16, boxHeight: 28 },
]

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = Object.fromEntries(
  modelModules.flatMap((model) => [
    [model.id, model.capability],
    ...model.adapter.models.map((alias) => [alias, model.capability] as const),
  ])
)

const HIDDEN_MODEL_ALIASES = new Set(['MiniMax-Hailuo-02', 'S2V-01'].map((id) => id.toLowerCase()))

export function isHiddenModelAlias(modelId: string | null | undefined): boolean {
  return !!modelId && HIDDEN_MODEL_ALIASES.has(modelId.toLowerCase())
}

export const BUILT_IN_MODELS: BuiltInModelDescriptor[] = Object.keys(MODEL_CAPABILITIES)
  .filter((id) => !isHiddenModelAlias(id))
  .map((id) => ({
  id,
  mediaType: MODEL_CAPABILITIES[id].mediaType,
}))

export function getModelCapability(modelId: string | null | undefined): ModelCapability | null {
  if (!modelId) return null
  return MODEL_CAPABILITIES[modelId] || MODEL_CAPABILITIES[Object.keys(MODEL_CAPABILITIES).find((id) => id.toLowerCase() === modelId.toLowerCase()) || ''] || null
}

export function modelSupportsUpload(modelId: string | null | undefined): boolean {
  const capability = getModelCapability(modelId)
  return !!capability && capability.inputs.some((input) => input !== 'text')
}

export function modelSupportsLocalUpload(modelId: string | null | undefined): boolean {
  const capability = getModelCapability(modelId)
  return !!capability && !!capability.localUploadInputs?.length
}

export function getModelAvailabilityLabel(modelId: string | null | undefined): string {
  const capability = getModelCapability(modelId)
  const note = capability?.availabilityNote

  if (
    capability?.mediaType === 'video' &&
    capability.inputs.includes('text') &&
    capability.inputs.includes('image') &&
    note === 'supports-image-upload'
  ) {
    return '支持文生/图生视频'
  }

  switch (note) {
    case 'supports-image-upload':
      return '支持上传图片'
    case 'supports-video-upload':
      return '支持上传视频'
    case 'supports-image-video-upload':
      return '支持上传图片/视频'
    case 'requires-image-upload':
      return '仅上传图片后可用'
    case 'requires-video-upload':
      return '仅上传视频后可用'
    default:
      return ''
  }
}

export function modelRequiresReference(modelId: string | null | undefined): boolean {
  return !!getModelCapability(modelId)?.requiresReference
}

export function getLocalUploadAccept(modelId: string | null | undefined): string {
  const capability = getModelCapability(modelId)
  const inputs = capability?.localUploadInputs ?? []
  if (inputs.includes('image') && inputs.includes('video')) {
    return 'image/*,video/*'
  }
  if (inputs.includes('video')) {
    return 'video/*'
  }
  if (inputs.includes('image')) {
    return 'image/*'
  }
  return ''
}

export function getSupportedAspectRatios(modelId: string | null | undefined): string[] | null {
  const mode = getModelCapability(modelId)?.videoRequestMode
  if (mode === 'viduq3-fast' || mode === 'minimax-hailuo') {
    return ['16:9', '9:16', '1:1', '4:3']
  }
  if (mode === 'kling-v26' || mode === 'kling-v3' || mode === 'kling-omni' || mode === 'kling-o1') {
    return ['16:9', '9:16', '1:1']
  }
  return null
}

export function getSupportedVideoDurations(modelId: string | null | undefined): VideoDurationOption[] | null {
  const mode = getModelCapability(modelId)?.videoRequestMode

  switch (mode) {
    case 'kling-v26':
    case 'kling-v3':
    case 'kling-omni':
    case 'kling-o1':
      return [
        { value: 5, label: '5s' },
        { value: 10, label: '10s' },
      ]
    case 'viduq3-fast':
    case 'minimax-hailuo':
      return [
        { value: mode === 'viduq3-fast' ? 5 : 6, label: mode === 'viduq3-fast' ? '5s' : '6s' },
      ]
    default:
      return [
        { value: 6, label: '6s' },
      ]
  }
}

export function getDefaultVideoDuration(modelId: string | null | undefined): number {
  return getSupportedVideoDurations(modelId)?.[0]?.value ?? 6
}

export function getModelsByMediaType(mediaType: MediaType, ids: string[]): string[] {
  return ids.filter((id) => !isHiddenModelAlias(id) && MODEL_CAPABILITIES[id]?.mediaType === mediaType)
}
