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

export interface UploadedFile {
  name: string
  type: 'image' | 'video'
  url: string
  size: number
  file?: File
  dimensions?: {
    width: number
    height: number
  }
}
