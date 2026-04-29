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
  imageRequestMode?: 'default' | 'jimeng-width-height' | 'seedream'
  videoRequestMode?: 'default' | 'kling-v26' | 'kling-v3' | 'kling-o1' | 'wan-i2v'
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
  'Qwen-Image-2.0': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'default' },
  'Qwen-Image-2.0-Pro': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'default' },
  'Doubao-Seedream-5.0-lite': {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    imageRequestMode: 'seedream',
  },
  'Doubao-Seedream-4.5': {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    imageRequestMode: 'seedream',
  },
  'GLM-Image': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'default' },
  'Kling-V2-New': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'default' },
  '即梦图片生成 4.0': {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    imageRequestMode: 'jimeng-width-height',
  },
  '即梦文生图 3.0': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'jimeng-width-height' },
  '即梦文生图 3.1': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'jimeng-width-height' },
  'Qwen-Image': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'default' },
  'Kolors': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'default' },
  'Wan2.5-T2I-Preview': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'default' },
  'Doubao-Seedream-4.0': {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    imageRequestMode: 'seedream',
  },
  'Qwen-Image-Plus': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'default' },
  'HunyuanImage-3.0': { mediaType: 'image', inputs: ['text'], imageRequestMode: 'default' },
  'Wan2.5-I2I-Preview': {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    requiresReference: true,
    imageRequestMode: 'default',
  },
  'Qwen-Image-Edit': {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    requiresReference: true,
    imageRequestMode: 'default',
  },
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
  'Wan2.6-T2V': { mediaType: 'video', inputs: ['text'], videoRequestMode: 'default' },
  'Doubao-Seedance-1.0-Pro-Fast': { mediaType: 'video', inputs: ['text'] },
  '即梦视频生成 3.0 Pro': { mediaType: 'video', inputs: ['text'] },
  'Wan2.6-I2V': {
    mediaType: 'video',
    inputs: ['text', 'image'],
    requiresReference: true,
    videoRequestMode: 'wan-i2v',
  },
  'MiniMax-Hailuo-02': { mediaType: 'video', inputs: ['text'] },
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

export function getModelsByMediaType(mediaType: MediaType, ids: string[]): string[] {
  return ids.filter((id) => MODEL_CAPABILITIES[id]?.mediaType === mediaType)
}
