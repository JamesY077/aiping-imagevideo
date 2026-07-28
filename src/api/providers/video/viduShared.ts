import type { VideoProviderAdapter } from './types'
import { buildOpenAiVideoRequestBody } from './common'

export interface ViduModelConfig {
  canonicalModel: string
  aliases: string[]
  defaultTextAspectRatio: string
  defaultTextResolution: string
  defaultImageResolution: string
  textFallbackAspectRatios?: string[]
  textFallbackResolutions?: string[]
  textFields?: string[]
  imageFields?: string[]
  enableSeed?: boolean
  enableStyle?: boolean
  enableMovementAmplitude?: boolean
  textFallbackFieldSets?: string[][]
  imageFallbackFieldSets?: string[][]
}

const DEFAULT_TEXT_FIELDS = [
  'model',
  'prompt',
  'duration',
  'aspect_ratio',
  'resolution',
  'style',
  'movement_amplitude',
  'seed',
  'payload',
  'off_peak',
]

const DEFAULT_IMAGE_FIELDS = [
  'model',
  'prompt',
  'duration',
  'images',
  'start_image',
  'end_image',
  'resolution',
  'movement_amplitude',
  'seed',
  'payload',
  'off_peak',
]

function createRandomSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000)
}

export function isViduImageToVideoBody(body: Record<string, unknown>): boolean {
  return !!(body.images || body.image || body.img_url || body.first_frame_url || body.last_frame_url || body.start_image || body.end_image)
}

export function isViduStartEndToVideoBody(body: Record<string, unknown>): boolean {
  if (typeof body.start_image === 'string' && typeof body.end_image === 'string') return true
  if (typeof body.first_frame_url === 'string' && typeof body.last_frame_url === 'string') return true
  return Array.isArray(body.images) && body.images.filter((image) => typeof image === 'string' && !!image).length >= 2
}

export function getViduEndpoint(body: Record<string, unknown>): string {
  if (isViduStartEndToVideoBody(body)) return '/videos/vidu/start-end2video'
  return isViduImageToVideoBody(body)
    ? '/videos/vidu/img2video'
    : '/videos/vidu/text2video'
}

export function normalizeViduResponse(data: any) {
  if (data?.task_id && !data.id) {
    return {
      ...data,
      id: data.task_id,
      object: data.object || 'video.generation',
      created: data.created || (data.created_at ? Math.floor(new Date(data.created_at).getTime() / 1000) : Math.floor(Date.now() / 1000)),
      status: data.status || data.state || 'pending',
      provider: data.provider || 'vidu',
      model: data.model,
    }
  }
  return data ? { ...data, provider: data.provider || 'vidu' } : data
}

function normalizeViduImages(body: Record<string, unknown>) {
  const images: string[] = []

  if (Array.isArray(body.images)) {
    images.push(...body.images.filter((image): image is string => typeof image === 'string' && !!image))
  }
  if (typeof body.image === 'string' && body.image) images.push(body.image)
  if (typeof body.img_url === 'string' && body.img_url) images.push(body.img_url)
  if (typeof body.first_frame_url === 'string' && body.first_frame_url) images.push(body.first_frame_url)
  if (typeof body.last_frame_url === 'string' && body.last_frame_url) images.push(body.last_frame_url)
  if (typeof body.start_image === 'string' && body.start_image) images.push(body.start_image)
  if (typeof body.end_image === 'string' && body.end_image) images.push(body.end_image)

  delete body.image
  delete body.img_url
  delete body.first_frame_url
  delete body.last_frame_url
  delete body.start_image
  delete body.end_image

  if (images.length) {
    body.images = Array.from(new Set(images)).slice(0, 2)
  } else {
    delete body.images
  }
}

function pruneViduFields(body: Record<string, unknown>, allowedFields: string[]) {
  const allowed = new Set(allowedFields)
  for (const key of Object.keys(body)) {
    if (!allowed.has(key)) {
      delete body[key]
    }
  }
}

function pickViduFields(body: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const field of fields) {
    if (body[field] !== undefined) {
      picked[field] = body[field]
    }
  }
  return picked
}

function pushUniqueViduBody(target: Record<string, unknown>[], body: Record<string, unknown>) {
  const key = JSON.stringify(body)
  if (!target.some((candidate) => JSON.stringify(candidate) === key)) {
    target.push(body)
  }
}

function applyViduDefaults(body: Record<string, unknown>, config: ViduModelConfig) {
  body.model = config.canonicalModel
  body.duration = body.duration || 5

  if (config.enableSeed !== false && typeof body.seed !== 'number') {
    body.seed = createRandomSeed()
  } else if (config.enableSeed === false) {
    delete body.seed
  }

  const isImageToVideo = isViduImageToVideoBody(body)
  if (isImageToVideo) {
    normalizeViduImages(body)
    body.resolution = body.resolution || config.defaultImageResolution
    delete body.aspect_ratio
    delete body.ratio
    delete body.size
    delete body.style
  } else {
    delete body.images
    delete body.image
    delete body.img_url
    delete body.first_frame_url
    delete body.last_frame_url
    delete body.reference_images
    delete body.video_list
    delete body.ratio
    delete body.size
    delete body.audio
    delete body.watermark
    delete body.extra_body
    body.aspect_ratio = body.aspect_ratio || config.defaultTextAspectRatio
    body.resolution = body.resolution || config.defaultTextResolution
    if (config.enableStyle !== false) {
      body.style = body.style || 'general'
    } else {
      delete body.style
    }
  }

  if (config.enableMovementAmplitude !== false) {
    body.movement_amplitude = body.movement_amplitude || 'auto'
  } else {
    delete body.movement_amplitude
  }

  pruneViduFields(
    body,
    isImageToVideo
      ? (config.imageFields || DEFAULT_IMAGE_FIELDS)
      : (config.textFields || DEFAULT_TEXT_FIELDS)
  )
}

export function buildViduRequestBody(params: Parameters<VideoProviderAdapter['buildRequestBody']>[0], config: ViduModelConfig): Record<string, unknown> {
  const body = buildOpenAiVideoRequestBody(params, config.canonicalModel)
  applyViduDefaults(body, config)
  return body
}

export function buildViduFallbackBodies(body: Record<string, unknown>, config: ViduModelConfig): Record<string, unknown>[] {
  const fallbackBodies: Record<string, unknown>[] = []

  if (isViduImageToVideoBody(body)) {
    for (const fields of config.imageFallbackFieldSets || []) {
      pushUniqueViduBody(fallbackBodies, pickViduFields(body, fields))
    }
    return fallbackBodies
  }

  const resolutions = config.textFallbackResolutions || []
  for (const resolution of resolutions) {
    if (resolution && resolution !== body.resolution) {
      fallbackBodies.push({ ...body, resolution })
    }
  }

  const aspectRatios = config.textFallbackAspectRatios || []
  for (const aspectRatio of aspectRatios) {
    if (aspectRatio && aspectRatio !== body.aspect_ratio) {
      fallbackBodies.push({
        ...body,
        aspect_ratio: aspectRatio,
        resolution: config.defaultTextResolution,
      })
    }
  }

  if (body.aspect_ratio !== config.defaultTextAspectRatio || body.resolution !== config.defaultTextResolution) {
    fallbackBodies.push({
      ...body,
      aspect_ratio: config.defaultTextAspectRatio,
      resolution: config.defaultTextResolution,
    })
  }

  const minimalTextBody: Record<string, unknown> = {
    model: config.canonicalModel,
    prompt: body.prompt,
    duration: body.duration || 5,
    aspect_ratio: config.defaultTextAspectRatio,
    resolution: config.defaultTextResolution,
  }

  if (config.enableMovementAmplitude !== false) minimalTextBody.movement_amplitude = body.movement_amplitude || 'auto'
  if (config.enableSeed !== false && typeof body.seed === 'number') minimalTextBody.seed = body.seed
  if (config.enableStyle !== false && body.style) minimalTextBody.style = body.style
  if (typeof body.payload === 'string') minimalTextBody.payload = body.payload
  if (typeof body.off_peak === 'boolean') minimalTextBody.off_peak = body.off_peak
  pruneViduFields(minimalTextBody, config.textFields || DEFAULT_TEXT_FIELDS)

  fallbackBodies.push(minimalTextBody)

  const requiredOnlyBody: Record<string, unknown> = {
    model: config.canonicalModel,
    prompt: body.prompt,
    duration: body.duration || 5,
    aspect_ratio: config.defaultTextAspectRatio,
    resolution: config.defaultTextResolution,
  }
  pruneViduFields(requiredOnlyBody, config.textFields || DEFAULT_TEXT_FIELDS)
  pushUniqueViduBody(fallbackBodies, requiredOnlyBody)

  for (const fields of config.textFallbackFieldSets || []) {
    pushUniqueViduBody(fallbackBodies, pickViduFields(body, fields))
  }

  return fallbackBodies
}

export function createViduProvider(config: ViduModelConfig): VideoProviderAdapter {
  return {
    provider: 'vidu',
    models: config.aliases,
    buildRequestBody: (params) => buildViduRequestBody(params, config),
    getEndpoint: getViduEndpoint,
    buildFallbackBodies: (body) => buildViduFallbackBodies(body, config),
    normalizeResponse: normalizeViduResponse,
  }
}
