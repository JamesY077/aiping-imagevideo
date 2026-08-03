export type MessageType = 'system' | 'user' | 'assistant'

export type GenerateStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed'

export type GenerateType = 'image' | 'video'

export interface GenerateResult {
  type: GenerateType
  url: string
  model: string
  provider?: string
  cost: number
  costText?: string
  aspectRatio?: string
  createdAt?: number
  thumbnail?: string
  duration?: number
  size?: {
    width: number
    height: number
  }
}

export interface Message {
  id: string
  type: MessageType
  content: string
  timestamp: number
  generateType?: GenerateType
  generateStatus?: GenerateStatus
  generateResult?: GenerateResult
  error?: string
  progress?: number
  uploadedFile?: UploadedFile
  uploadedFiles?: UploadedFile[]
  duration?: number
  aspectRatio?: string
  model?: string
}

export interface MotionControlOptions {
  keep_original_sound: 'yes' | 'no'
  character_orientation: 'image' | 'video'
}

export type UploadedFilePurpose =
  | 'subject-reference'
  | 'motion-control-image'
  | 'motion-control-video'
  | 'multimodal-image'
  | 'multimodal-video'
  | 'multimodal-audio'
  | 'start-frame'
  | 'end-frame'
  | 'reference-image'


export interface UploadedFile {
  name: string
  type: 'image' | 'video' | 'audio'
  url: string
  size: number
  file?: File
  purpose?: UploadedFilePurpose
  /** 多模态参考模式下用于 @ 引用的稳定标识（如 图片1 / 视频1 / 音频1）。 */
  refLabel?: string
  motionControlOptions?: MotionControlOptions
  dimensions?: {
    width: number
    height: number
  }
}

