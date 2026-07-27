import type { VideoGenerateRequest, VideoGenerateResponse } from '@/types/api'

export function buildOpenAiVideoRequestBody(
  params: VideoGenerateRequest,
  defaultModel: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.model || defaultModel,
    prompt: params.prompt,
  }

  if (params.image) body.image = params.image
  if (params.images?.length) body.images = params.images
  if (params.img_url) body.img_url = params.img_url
  if (params.first_frame_url) body.first_frame_url = params.first_frame_url
  if (params.last_frame_url) body.last_frame_url = params.last_frame_url
  if (params.reference_images?.length) body.reference_images = params.reference_images
  if (params.video_list?.length) body.video_list = params.video_list
  if (params.duration) body.duration = params.duration
  if (params.aspect_ratio) body.aspect_ratio = params.aspect_ratio
  if (params.ratio) body.ratio = params.ratio
  if (params.size) body.size = params.size
  if (params.resolution) body.resolution = params.resolution
  if (typeof params.audio === 'boolean') body.audio = params.audio
  if (params.movement_amplitude) body.movement_amplitude = params.movement_amplitude
  if (typeof params.off_peak === 'boolean') body.off_peak = params.off_peak
  if (typeof params.watermark === 'boolean') body.watermark = params.watermark
  if (typeof params.seed === 'number') body.seed = params.seed
  if (params.style) body.style = params.style
  if (typeof params.payload === 'string') body.payload = params.payload
  if (params.extra_body) body.extra_body = params.extra_body

  return body
}

export function normalizeOpenAiVideoGenerateResponse(data: any): VideoGenerateResponse {
  return data
}
