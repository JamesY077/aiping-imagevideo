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
  videoRequestMode?: 'kling-v26' | 'kling-v3' | 'kling-omni' | 'kling-o1' | 'viduq3-fast' | 'minimax-hailuo' | 'seedance-2'

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

export type VideoGenerationMode =
  | 'text2video'
  | 'image2video'
  | 'startEnd2video'
  | 'subjectReference2video'
  | 'motionControl2video'
  | 'multimodalReference2video'
  | 'editVideo'



export interface VideoModeOption {
  value: VideoGenerationMode
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
  if (mode === 'seedance-2') {
    return ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
  }
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
    case 'seedance-2':
      return [
        { value: 5, label: '5s' },
        { value: 8, label: '8s' },
      ]
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

const VIDEO_MODE_LABELS: Record<VideoGenerationMode, string> = {
  text2video: '文生视频',
  image2video: '图生视频',
  startEnd2video: '首尾帧生视频',
  subjectReference2video: '主体参考视频',
  motionControl2video: '动作控制',
  multimodalReference2video: '多模态参考',
  editVideo: '编辑视频',
}



function buildVideoModeOptions(modes: VideoGenerationMode[]): VideoModeOption[] {
  return modes.map((value) => ({ value, label: VIDEO_MODE_LABELS[value] }))
}

/**
 * 返回指定视频模型支持的所有生成模式。
 * - viduq3-fast（Vidu Q3）：文生 / 图生 / 首尾帧
 * - minimax-hailuo（MiniMax Hailuo）：文生 / 图生 / 首尾帧 / 主体参考
 * - kling-v26 / kling-v3：文生 / 图生 / 动作控制
 * - kling-omni：文生 / 图生 / 首尾帧
 * - 其他（含默认）：文生 / 图生
 */
export function getSupportedVideoModes(modelId: string | null | undefined): VideoModeOption[] {
  const mode = getModelCapability(modelId)?.videoRequestMode
  switch (mode) {
    case 'viduq3-fast':
    case 'kling-omni':
      return buildVideoModeOptions(['text2video', 'image2video', 'startEnd2video'])
    case 'minimax-hailuo':
      return buildVideoModeOptions([
        'text2video',
        'image2video',
        'startEnd2video',
        'subjectReference2video',
      ])
    case 'kling-v26':
    case 'kling-v3':
      return buildVideoModeOptions(['text2video', 'image2video', 'motionControl2video'])
    case 'seedance-2':
      return buildVideoModeOptions([
        'text2video',
        'image2video',
        'multimodalReference2video',
        'editVideo',
      ])
    default:

      return buildVideoModeOptions(['text2video', 'image2video'])
  }
}


export function getModelsByMediaType(mediaType: MediaType, ids: string[]): string[] {
  return ids.filter((id) => !isHiddenModelAlias(id) && MODEL_CAPABILITIES[id]?.mediaType === mediaType)
}

/** seedance2.0 系列分组名称（三款 Doubao-Seedance-2.0 模型同属该组）。 */
export const SEEDANCE_2_GROUP_LABEL = 'seedance2.0 系列'

/**
 * 白名单提示文案：seedance2.0 系列仅支持 AI Ping 白名单用户调用。
 * 用户在简易模式 / 无限画布中选中该系列模型时弹窗提示。
 */
export const SEEDANCE_2_WHITELIST_NOTICE =
  '该系列模型仅支持 AI Ping 白名单用户使用，若您已经是白名单用户则可以正常完成调用，反之则无法正常调用。尽请谅解。'

/** 判断某个模型是否属于 seedance2.0 系列（基于 videoRequestMode）。 */
export function isSeedance2Model(modelId: string | null | undefined): boolean {
  return getModelCapability(modelId)?.videoRequestMode === 'seedance-2'
}

