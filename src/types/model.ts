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
  imageRequestMode?: 'default' | 'jimeng-4' | 'seedream-5-lite'
  videoRequestMode?: 'kling-v26' | 'kling-v3' | 'kling-o1'
}

export interface AspectRatioOption {
  value: string
  label: string
  boxWidth: number
  boxHeight: number
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

export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  '即梦图片生成 4.0': {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    imageRequestMode: 'jimeng-4',
  },
  'Doubao-Seedream-5.0-lite': {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    imageRequestMode: 'seedream-5-lite',
  },
  'Qwen-Image-2.0-Pro': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'default' },
  'Qwen-Image-Edit-Plus': {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    requiresReference: true,
    imageRequestMode: 'default',
  },
  'Kling-Video-O1': {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    videoRequestMode: 'kling-o1',
  },
  'Kling-V3-Omni': {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    videoRequestMode: 'kling-v3',
  },
  'Kling-V3': {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    videoRequestMode: 'kling-v3',
  },
  'Kling-V2.6': {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    videoRequestMode: 'kling-v26',
  },
  'MiniMax-Hailuo-2.3': { mediaType: 'video', inputs: ['text'] },
}

export function getModelCapability(modelId: string | null | undefined): ModelCapability | null {
  if (!modelId) return null
  return MODEL_CAPABILITIES[modelId] || null
}

export function modelSupportsUpload(modelId: string | null | undefined): boolean {
  const capability = getModelCapability(modelId)
  return !!capability && capability.inputs.some((input) => input !== 'text')
}

export function modelSupportsLocalUpload(modelId: string | null | undefined): boolean {
  const capability = getModelCapability(modelId)
  return !!capability && !!capability.localUploadInputs?.length
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
  if (mode === 'kling-v26' || mode === 'kling-v3' || mode === 'kling-o1') {
    return ['16:9', '9:16', '1:1']
  }
  return null
}

export function getModelsByMediaType(mediaType: MediaType, ids: string[]): string[] {
  return ids.filter((id) => MODEL_CAPABILITIES[id]?.mediaType === mediaType)
}
