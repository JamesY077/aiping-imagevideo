import type { VideoGenerateRequest, VideoGenerateResponse } from '@/types/api'
import type { VideoProviderAdapter } from './types'

/**
 * MiniMax-H3（海螺最新一代多模态视频模型，含 I2VA 场景）：
 * - 走 /multimodal/minimax/videos/video_generation，content 数组协议。
 * - content 元素通过 type 区分（text / image_url / video_url / audio_url），role 标注用途。
 * - 图生视频支持首帧 / 尾帧 / 首尾帧；多模态参考支持参考图、参考视频、参考音频。
 * - 图生视频与多模态参考互斥（first_frame / last_frame 不能和 reference_* 混用）。
 */

// 任务创建接口（相对 /api/v1，与 axios baseURL 拼接）。
export const MINIMAX_H3_TASKS_ENDPOINT = '/multimodal/minimax/videos/video_generation'
// 任务查询接口（创建 / H3-Context-IR / 再生成任务通用）。
export const MINIMAX_H3_QUERY_TASKS_ENDPOINT = '/multimodal/minimax/videos/query/video_generation'

export type MinimaxH3ContentRole =
  | 'first_frame'
  | 'last_frame'
  | 'reference_image'
  | 'reference_video'
  | 'reference_audio'

export interface MinimaxH3ContentItem {
  type: 'text' | 'image_url' | 'video_url' | 'audio_url'
  text?: string
  image_url?: { url: string }
  video_url?: { url: string }
  audio_url?: { url: string }
  role?: MinimaxH3ContentRole
}

/**
 * 收集可作为首帧的图片地址，兼容上游生成的图片和多个历史字段。
 * 优先级：purpose 标记的 start-frame > 显式 first_frame_* / image / img_url。
 */
export function collectMinimaxH3FirstFrame(params: VideoGenerateRequest): string | undefined {
  const candidates = [
    params.first_frame_url,
    params.first_frame_image,
    params.image,
    params.image_url,
    params.img_url,
    params.images?.[0],
    params.start_image,
  ]
  return candidates.find((value): value is string => typeof value === 'string' && !!value.trim())
}

/**
 * 收集可作为尾帧的图片地址。
 */
export function collectMinimaxH3LastFrame(params: VideoGenerateRequest): string | undefined {
  const candidates = [
    params.last_frame_url,
    params.last_frame_image,
    params.image_tail,
    params.end_image,
    ...(Array.isArray(params.images) && params.images.length >= 2 ? [params.images[1]] : []),
  ]
  return candidates.find((value): value is string => typeof value === 'string' && !!value.trim())
}

/**
 * 收集多模态参考图片（role=reference_image）。
 * 与首/尾帧互斥：一旦存在 first_frame / last_frame，这里返回空。
 */
export function collectMinimaxH3ReferenceImages(params: VideoGenerateRequest): string[] {
  const urls: string[] = []
  const push = (value?: string | null) => {
    if (typeof value === 'string' && value.trim()) urls.push(value.trim())
  }
  if (Array.isArray(params.reference_images)) params.reference_images.forEach(push)
  return Array.from(new Set(urls))
}

export function collectMinimaxH3ReferenceVideos(params: VideoGenerateRequest): string[] {
  const urls: string[] = []
  if (Array.isArray(params.reference_videos)) {
    params.reference_videos.forEach((value) => {
      if (typeof value === 'string' && value.trim()) urls.push(value.trim())
    })
  }
  return Array.from(new Set(urls))
}

export function collectMinimaxH3ReferenceAudios(params: VideoGenerateRequest): string[] {
  const urls: string[] = []
  if (Array.isArray(params.reference_audios)) {
    params.reference_audios.forEach((value) => {
      if (typeof value === 'string' && value.trim()) urls.push(value.trim())
    })
  }
  return Array.from(new Set(urls))
}

export interface MinimaxH3References {
  firstFrame?: string
  lastFrame?: string
  referenceImages?: string[]
  referenceVideos?: string[]
  referenceAudios?: string[]
}

/**
 * 把视频请求参数组装成 MiniMax-H3 content 数组。
 * 顺序：text → 首帧 → 尾帧 → 参考图 → 参考视频 → 参考音频。
 */
export function buildMinimaxH3Content(
  prompt: string,
  references: MinimaxH3References
): MinimaxH3ContentItem[] {
  const content: MinimaxH3ContentItem[] = [{ type: 'text', text: prompt }]

  if (references.firstFrame) {
    content.push({
      type: 'image_url',
      image_url: { url: references.firstFrame },
      role: 'first_frame',
    })
  }
  if (references.lastFrame) {
    content.push({
      type: 'image_url',
      image_url: { url: references.lastFrame },
      role: 'last_frame',
    })
  }
  for (const url of references.referenceImages || []) {
    content.push({
      type: 'image_url',
      image_url: { url },
      role: 'reference_image',
    })
  }
  for (const url of references.referenceVideos || []) {
    content.push({
      type: 'video_url',
      video_url: { url },
      role: 'reference_video',
    })
  }
  for (const url of references.referenceAudios || []) {
    content.push({
      type: 'audio_url',
      audio_url: { url },
      role: 'reference_audio',
    })
  }

  return content
}

/**
 * 同步构造请求体（适配器兜底路径）。
 * 首/尾帧和参考图支持 base64 dataURI 直传；参考视频/音频仍需公网 URL。
 */
export function buildMinimaxH3RequestBody(
  params: VideoGenerateRequest,
  canonicalModel: string
): Record<string, unknown> {
  const firstFrame = collectMinimaxH3FirstFrame(params)
  const lastFrame = collectMinimaxH3LastFrame(params)
  const referenceImages = collectMinimaxH3ReferenceImages(params)
  const referenceVideos = collectMinimaxH3ReferenceVideos(params)
  const referenceAudios = collectMinimaxH3ReferenceAudios(params)

  const hasFrames = !!firstFrame || !!lastFrame
  const hasReferenceMedia = referenceImages.length > 0 || referenceVideos.length > 0 || referenceAudios.length > 0

  const content = hasFrames
    ? buildMinimaxH3Content(params.prompt, { firstFrame, lastFrame })
    : buildMinimaxH3Content(params.prompt, {
        referenceImages,
        referenceVideos,
        referenceAudios,
      })

  const resolution = params.resolution === '2K' ? '2K' : '768P'
  const duration = Math.min(15, Math.max(4, Math.round(Number(params.duration || params.seconds || 5))))

  const body: Record<string, unknown> = {
    model: params.model || canonicalModel,
    content,
    resolution,
    duration,
  }

  const ratio = params.aspect_ratio || params.ratio
  if (ratio && ratio !== 'adaptive') body.ratio = ratio
  else if (!hasFrames && !hasReferenceMedia) body.ratio = '16:9' // 纯文生必须给具体比例

  if (typeof params.watermark === 'boolean') body.aigc_watermark = params.watermark
  if (params.callback_url) body.callback_url = params.callback_url

  return body
}

export function getMinimaxH3Endpoint(): string {
  return MINIMAX_H3_TASKS_ENDPOINT
}

/**
 * 归一化 MiniMax-H3 任务创建结果。
 * 同步返回体通常包含 { task_id, status, ... }，与查询任务返回体结构一致。
 */
export function normalizeMinimaxH3Response(data: any): VideoGenerateResponse {
  const task = data?.data || data
  const taskId = task?.task_id || data?.task_id || task?.id || data?.id || ''
  const createdAt = task?.created_at || data?.created_at || Date.now()
  return {
    ...task,
    id: taskId,
    task_id: taskId,
    object: 'video.generation',
    created: Math.floor(Number(createdAt) / 1000) || Math.floor(Date.now() / 1000),
    status: task?.status || 'pending',
    state: task?.status || task?.state,
    provider: 'minimax-h3',
    model: task?.model || data?.model || 'MiniMax-H3',
  } as VideoGenerateResponse
}

export function createMinimaxH3Provider(): VideoProviderAdapter {
  return {
    // 独立标识 minimax-h3：任务创建走专属端点，状态查询需区分于 MiniMax-Hailuo。
    provider: 'minimax-h3',
    models: ['MiniMax-H3'],
    buildRequestBody: (params) => buildMinimaxH3RequestBody(params, 'MiniMax-H3'),
    getEndpoint: getMinimaxH3Endpoint,
    normalizeResponse: normalizeMinimaxH3Response,
  }
}
