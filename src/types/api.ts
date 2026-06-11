export interface ModelPermission {
  id: string
  object: string
  created: number
  allow_create_engine: boolean
  allow_sampling: boolean
  allow_logprobs: boolean
  allow_search_indices: boolean
  allow_view: boolean
  allow_fine_tuning: boolean
  organization: string
  group: string | null
  is_blocking: boolean
}

export interface ModelPricing {
  input?: number
  output?: number
}

export interface Model {
  id: string
  object: 'model'
  created: number
  owned_by: string
  permission: ModelPermission[]
  root: string
  parent: string | null
  pricing?: ModelPricing
}

export interface ModelsResponse {
  object: 'list'
  data: Model[]
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  model: string
  messages: ChatMessage[]
  temperature?: number
}

export interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

export interface ImageGenerateRequest {
  model?: string
  prompt: string
  image?: string
  size?: string
  width?: number
  height?: number
  output_format?: 'png' | 'jpeg'
  watermark?: boolean
  extra_body?: Record<string, unknown>
  n?: number
  response_format?: 'url' | 'b64_json'
}

export interface ImageGenerateResponse {
  created: number
  model?: string
  provider?: string
  data: Array<{
    url?: string
    b64_json?: string
  }>
}

export interface VideoGenerateRequest {
  model?: string
  prompt: string
  image?: string
  img_url?: string
  first_frame_url?: string
  last_frame_url?: string
  reference_images?: string[]
  video_list?: string[]
  duration?: number
  aspect_ratio?: string
  ratio?: string
  size?: string
}

export interface VideoGenerateResponse {
  id: string
  object: 'video.generation'
  created: number
  status: 'pending'
  model: string
}

export interface VideoStatusResponse {
  id: string
  object?: string
  created?: number
  status: string
  model: string
  progress?: number
  video_url?: string
  seconds?: number
  size?: string
  provider?: string
  data?: Array<{
    url: string
    thumbnail?: string
    duration: number
  }>
  error?: string
}
