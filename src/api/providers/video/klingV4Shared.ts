import type { VideoGenerateRequest, VideoGenerateResponse, VideoStatusResponse } from '@/types/api'

/**
 * 可灵 4.0 新版视频接口（2026-11 上线）。
 *
 * 与旧版可灵接口不同，4.0 使用「能力 + 模型」路径：
 * - 文生视频：POST /multimodal/kling/text-to-video/{model}
 * - 图生视频：POST /multimodal/kling/image-to-video/{model}
 * - 全能参考：POST /multimodal/kling/omni-video/{model}
 * - 任务查询：GET  /multimodal/kling/tasks?task_ids={taskId}
 *
 * 请求体也不再使用 model_name / image / duration 这一套旧字段，而是：
 * - 文生：{ prompt, settings: { duration, resolution, aspect_ratio } }
 * - 图生 / 全能参考：{ contents: [{ type: 'prompt' | 'first_frame' | ..., text / url / id }], settings }
 *
 * 能力差异（以 AIPing 文档为准）：
 * - Kling-4.0：720p / 1080p，时长 3-30s；图生视频支持首帧、中间帧、尾帧（最多 10 张关键帧）。
 * - Kling-4.0-Flash：仅 720p，时长 3-20s；图生视频只支持首帧。
 */

type KlingV4Capability = 'text' | 'image' | 'omni'

interface KlingV4Limits {
  maxDuration: number
  resolutions: string[]
  supportsKeyframes: boolean
}

const KLING_V4_INTERNAL_MODE_KEY = '__kling_v4_mode'

export function getKlingV4Limits(model: string | null | undefined): KlingV4Limits {
  const normalized = String(model || '').toLowerCase()
  if (normalized.includes('flash')) {
    return { maxDuration: 20, resolutions: ['720p'], supportsKeyframes: false }
  }
  return { maxDuration: 30, resolutions: ['720p', '1080p'], supportsKeyframes: true }
}

export function resolveKlingV4Duration(model: string | null | undefined, requested: number | undefined): number {
  const limits = getKlingV4Limits(model)
  const parsed = Math.round(Number(requested || 10))
  const value = Number.isFinite(parsed) ? parsed : 10
  return Math.min(limits.maxDuration, Math.max(3, value))
}

export function resolveKlingV4Resolution(model: string | null | undefined, requested: string | null | undefined): string {
  const limits = getKlingV4Limits(model)
  const normalized = String(requested || '').toLowerCase()
  if (limits.resolutions.includes(normalized)) return normalized
  return limits.resolutions[limits.resolutions.length - 1] || '720p'
}

function buildKlingV4Options(params: VideoGenerateRequest): Record<string, unknown> {
  const options: Record<string, unknown> = {}
  if (params.callback_url) options.callback_url = params.callback_url
  if (params.external_task_id) options.external_task_id = params.external_task_id
  if (typeof params.watermark === 'boolean') {
    options.watermark_info = { enabled: params.watermark }
  }
  return options
}

function buildKlingV4RequestBodyInternal(
  params: VideoGenerateRequest,
  defaultModel: string,
  capability: KlingV4Capability,
): Record<string, unknown> {
  const model = params.model || defaultModel
  const limits = getKlingV4Limits(model)
  const duration = resolveKlingV4Duration(model, params.duration || params.seconds)
  const resolution = resolveKlingV4Resolution(model, params.resolution)
  const options = buildKlingV4Options(params)

  if (capability === 'omni') {
    const referenceImages = (params.reference_images || []).filter((url): url is string => !!url)
    // 前端 @ 引用使用「@图片N」，可灵 4.0 要求使用素材 id（@image_N），这里做一次映射。
    const prompt = String(params.prompt || '').replace(/@图片(\d+)/g, (_match, index: string) => `@image_${index}`)
    const contents: Array<Record<string, unknown>> = [
      { type: 'prompt', text: prompt },
      ...referenceImages.map((url, index) => ({
        type: 'refer_image',
        url,
        // 4.0 支持在提示词中用 @image_N 指定参考图；Flash 不支持 omni，正常不会走到这里。
        id: `image_${index + 1}`,
      })),
    ]

    return {
      [KLING_V4_INTERNAL_MODE_KEY]: 'omni',
      model,
      contents,
      settings: {
        duration,
        resolution,
        aspect_ratio: params.aspect_ratio || params.ratio || 'adaptive',
      },
      ...(Object.keys(options).length ? { options } : {}),
    }
  }

  if (capability === 'image') {
    const firstFrame = params.image || params.img_url || params.first_frame_url || params.first_frame_image
    const lastFrame = params.image_tail || params.last_frame_url || params.last_frame_image
    const contents: Array<Record<string, unknown>> = [
      { type: 'prompt', text: params.prompt },
    ]

    if (firstFrame) {
      contents.push({
        type: 'first_frame',
        url: firstFrame,
        // Flash 只支持首帧且不需要引用 ID；4.0 建议带 id 以便在提示词里用 @frame_1 精确控制。
        ...(limits.supportsKeyframes ? { id: 'frame_1' } : {}),
      })
    }
    if (lastFrame && limits.supportsKeyframes) {
      contents.push({ type: 'last_frame', url: lastFrame, id: 'frame_2' })
    }

    return {
      [KLING_V4_INTERNAL_MODE_KEY]: 'image',
      model,
      contents,
      settings: {
        duration,
        resolution,
      },
      ...(Object.keys(options).length ? { options } : {}),
    }
  }

  return {
    [KLING_V4_INTERNAL_MODE_KEY]: 'text',
    model,
    prompt: params.prompt,
    settings: {
      duration,
      resolution,
      aspect_ratio: params.aspect_ratio || params.ratio || '16:9',
    },
    ...(Object.keys(options).length ? { options } : {}),
  }
}

/** 根据请求参数自动判断走文生 / 图生 / 全能参考接口。 */
export function buildKlingV4RequestBody(
  params: VideoGenerateRequest,
  defaultModel: string,
): Record<string, unknown> {
  const capability: KlingV4Capability = params.reference_images?.length
    ? 'omni'
    : params.image || params.img_url || params.first_frame_url || params.first_frame_image
      ? 'image'
      : 'text'

  return buildKlingV4RequestBodyInternal(params, defaultModel, capability)
}

/** 从请求体读取能力类型（由 buildKlingV4RequestBody 写入内部字段）。 */
export function detectKlingV4Capability(body: Record<string, unknown>): KlingV4Capability {
  const value = body[KLING_V4_INTERNAL_MODE_KEY]
  return value === 'omni' || value === 'image' ? value : 'text'
}

/** 生成创建任务接口路径。model 由 URL 指定，因此需要按模型名拼接。 */
export function getKlingV4Endpoint(
  body: Record<string, unknown>,
  defaultModel = 'Kling-4.0',
): string {
  const model = encodeURIComponent(String(body.model || defaultModel))
  const capability = detectKlingV4Capability(body)
  const path = capability === 'omni'
    ? 'omni-video'
    : capability === 'image'
      ? 'image-to-video'
      : 'text-to-video'
  return `/multimodal/kling/${path}/${model}`
}

/** 移除仅用于前端路由判断 / 日志的内部字段，避免被上游判为非法参数。 */
export function stripKlingV4InternalFields(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body }
  delete next[KLING_V4_INTERNAL_MODE_KEY]
  // 新版接口由 URL 路径指定模型，请求体里不再需要 model 字段。
  delete next.model
  return next
}

export function normalizeKlingV4VideoGenerateResponse(
  data: any,
  providerCreateEndpoint = '',
  model = '',
): VideoGenerateResponse {
  const task = data?.data || data
  const taskId = task?.id || task?.task_id || ''
  const createTime = Number(task?.create_time || task?.created_at || Date.now())

  return {
    ...task,
    id: taskId,
    task_id: taskId,
    object: 'video.generation',
    created: Math.floor(createTime / 1000) || Math.floor(Date.now() / 1000),
    status: task?.status || 'submitted',
    state: task?.status,
    provider: 'kling-v4',
    providerCreateEndpoint,
    model: task?.model || model,
  }
}

/**
 * 归一化新版可灵任务查询结果：
 * {
 *   code, message,
 *   data: [{ id, status, message, outputs: [{ type: 'video', url, duration }], billing: [...] }]
 * }
 */
export function normalizeKlingV4VideoStatus(data: any, taskId: string): VideoStatusResponse {
  const raw = Array.isArray(data?.data)
    ? data.data[0]
    : Array.isArray(data?.data?.result)
      ? data.data.result[0]
      : data?.data || data

  const outputs = Array.isArray(raw?.outputs) ? raw.outputs : []
  const videoOutput = outputs.find((item: any) => item?.type === 'video') || outputs[0]
  const status = raw?.status || 'processing'
  const duration = Number(videoOutput?.duration ?? raw?.usage?.output_duration) || 0
  const billingAmount = Array.isArray(raw?.billing) ? Number(raw.billing[0]?.amount) : NaN

  return {
    ...raw,
    id: raw?.id || taskId,
    task_id: raw?.id || taskId,
    status,
    state: status,
    video_url: videoOutput?.url,
    seconds: duration || undefined,
    data: videoOutput?.url
      ? [{
          url: videoOutput.url,
          thumbnail: videoOutput.cover_url || videoOutput.thumbnail,
          watermarked_url: videoOutput.watermark_url,
          duration,
        }]
      : undefined,
    error: status === 'failed' ? (raw?.message || '视频生成失败，请调整提示词或素材后重试。') : undefined,
    provider: 'kling-v4',
    model: raw?.model || '',
    usage: Number.isFinite(billingAmount) ? { total_cost: billingAmount } : raw?.usage,
  }
}
