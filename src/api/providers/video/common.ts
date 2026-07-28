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
  if (params.first_frame_image) body.first_frame_image = params.first_frame_image
  if (params.last_frame_image) body.last_frame_image = params.last_frame_image
  if (params.first_frame_url) body.first_frame_url = params.first_frame_url
  if (params.last_frame_url) body.last_frame_url = params.last_frame_url
  if (params.start_image) body.start_image = params.start_image
  if (params.end_image) body.end_image = params.end_image
  if (params.reference_images?.length) body.reference_images = params.reference_images
  if (params.subject_reference?.length) body.subject_reference = params.subject_reference
  if (params.video_list?.length) body.video_list = params.video_list
  if (params.seconds) body.seconds = params.seconds
  if (params.duration) body.duration = params.duration
  if (params.aspect_ratio) body.aspect_ratio = params.aspect_ratio
  if (params.ratio) body.ratio = params.ratio
  if (params.size) body.size = params.size
  body.resolution = params.resolution || '1080p'
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

export function buildKlingMultimodalVideoRequestBody(
  params: VideoGenerateRequest,
  defaultModel: string
): Record<string, unknown> {
  if (params.motion_control) {
    const body: Record<string, unknown> = {
      model_name: params.model_name || params.model || defaultModel,
      image_url: params.image_url || params.image || params.img_url || params.first_frame_url || params.first_frame_image,
      prompt: params.prompt,
      video_url: params.video_url,
      keep_original_sound: params.keep_original_sound || 'yes',
      character_orientation: params.character_orientation || 'image',
      mode: params.mode || 'pro',
      callback_url: params.callback_url || '',
      external_task_id: params.external_task_id || '',
    }

    Object.keys(body).forEach((key) => {
      if (body[key] === undefined || body[key] === '') {
        if (key !== 'callback_url' && key !== 'external_task_id') delete body[key]
      }
    })

    return body
  }

  const image = params.image || params.img_url || params.first_frame_url || params.first_frame_image
  const body: Record<string, unknown> = {
    model_name: params.model_name || params.model || defaultModel,
    prompt: params.prompt,
    negative_prompt: params.negative_prompt || '',
    duration: String(params.duration || params.seconds || 5),
    mode: params.mode || 'pro',
    sound: params.sound || (image ? 'off' : 'on'),
    callback_url: params.callback_url || '',
    external_task_id: params.external_task_id || '',
  }

  if (image) {
    body.image = image
    const imageTail = params.image_tail || params.last_frame_url || params.last_frame_image
    if (imageTail) body.image_tail = imageTail
  } else {
    body.aspect_ratio = params.aspect_ratio || params.ratio || '1:1'
  }

  return body
}

type KlingOmniImageListItem = {
  image_url: string
  type?: 'first_frame' | 'end_frame' | string
}

function normalizeKlingOmniImageList(params: VideoGenerateRequest): KlingOmniImageListItem[] {
  if (params.image_list?.length) {
    return params.image_list
      .filter((item) => !!item.image_url)
      .map((item) => ({
        image_url: item.image_url,
        ...(item.type ? { type: item.type } : {}),
      }))
  }

  const firstFrame = params.first_frame_url || params.first_frame_image
  const endFrame = params.last_frame_url || params.last_frame_image
  if (firstFrame || endFrame) {
    const frameImages: KlingOmniImageListItem[] = []
    if (firstFrame) frameImages.push({ image_url: firstFrame, type: 'first_frame' })
    if (endFrame) frameImages.push({ image_url: endFrame, type: 'end_frame' })
    return frameImages
  }

  const imageUrls = [
    params.image,
    params.img_url,
    ...(params.images || []),
  ].filter((url): url is string => !!url)

  return imageUrls.map((image_url) => ({ image_url }))
}

export function buildKlingOmniVideoRequestBody(
  params: VideoGenerateRequest,
  defaultModel: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model_name: params.model_name || params.model || defaultModel,
    prompt: params.prompt,
    duration: String(params.duration || params.seconds || 5),
    mode: params.mode || 'pro',
    aspect_ratio: params.aspect_ratio || params.ratio || '16:9',
    callback_url: params.callback_url || '',
    external_task_id: params.external_task_id || '',
  }

  const imageList = normalizeKlingOmniImageList(params)
  if (imageList.length) {
    body.image_list = imageList
  }

  return body
}

export function getKlingMultimodalVideoEndpoint(body: Record<string, unknown>): string {
  if (body.video_url && body.image_url) {
    return '/multimodal/kling/videos/motion-control'
  }

  return body.image
    ? '/multimodal/kling/videos/image2video'
    : '/multimodal/kling/videos/text2video'
}

export function getKlingOmniVideoEndpoint(): string {
  return '/multimodal/kling/videos/omni-video'
}

export function normalizeKlingMultimodalVideoGenerateResponse(data: any): VideoGenerateResponse {
  const task = data?.data || data
  const taskId = task?.task_id || data?.task_id || data?.id || ''
  const createdAt = task?.created_at || data?.created_at || Date.now()
  const model = task?.task_info?.model_name || data?.model_name || data?.model || task?.model || 'Kling'

  return {
    ...task,
    id: taskId,
    task_id: taskId,
    object: 'video.generation',
    created: Math.floor(Number(createdAt) / 1000) || Math.floor(Date.now() / 1000),
    status: task?.task_status || task?.status || 'pending',
    state: task?.task_status || task?.state,
    provider: task?.provider || data?.provider || 'kling',
    model,
  }
}
