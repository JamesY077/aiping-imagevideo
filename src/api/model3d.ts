/**
 * V2Fun 3D 建模 / 视频动捕接口封装。
 *
 * 统一走 AIPing 的多模态异步任务协议：
 *   创建 -> 202/201 + task_uuid；查询 -> status/progress/result/metadata。
 * 请求体固定 `options.block = false`，由前端轮询查询接口。
 *
 * 文档：https://aiping.cn/docs/API/v2fun-api
 */

import client from '@/api/aiping'
import { assetExtension } from '@/features/model3d/models'

export const MESH_TASKS_ENDPOINT = '/multimodal/v2fun/3d_models/meshes'
export const MOTION_TASKS_ENDPOINT = '/multimodal/v2fun/videos/motion_detections'

export type TaskStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

export interface TaskCreateResponse {
  task_uuid: string
  task_type: string
  model: string
  status: TaskStatus
  created_at: number
  queue_position?: number | null
  estimated_queue_time?: number | null
  request_id?: string
}

export interface AssetDownload {
  asset_path: string
  download_url: string
  download_expires_at?: number
}

export interface MeshMetadata {
  reference_images?: string[] | null
  preview_image?: string | null
  t_pose_model?: string | null
  preview_video?: string | null
  mesh_info?: Record<string, unknown> | null
  downloads?: AssetDownload[] | null
}

export interface MeshTaskResult {
  task_uuid: string
  task_type?: string
  model?: string
  status: TaskStatus
  created_at?: number
  completed_at?: number | null
  failed_at?: number | null
  progress?: number | null
  stage?: string | null
  result?: string[] | null
  metadata?: MeshMetadata[] | null
  request_id?: string
  message?: string
  msg?: string
  error?: string | { message?: string }
}

export interface MotionMetadata {
  video?: string | null
  requested_bboxes?: number[][] | null
  tracked_bboxes?: number[][] | null
  tracked_indexes?: number[] | null
  query_start_time_seconds?: number
  query_duration_seconds?: number
  effective_query_duration_seconds?: number
  video_clip?: string | null
  audio_clip?: string | null
  fps?: number
  motions?: unknown
  downloads?: AssetDownload[] | null
}

export interface MotionTaskResult {
  task_uuid: string
  task_type?: string
  model?: string
  status: TaskStatus
  created_at?: number
  completed_at?: number | null
  failed_at?: number | null
  progress?: number | null
  stage?: string | null
  result?: string[] | null
  metadata?: MotionMetadata | null
  request_id?: string
  message?: string
  msg?: string
  error?: string | { message?: string }
}

export interface MeshViewInput {
  front?: string
  left?: string
  back?: string
  right?: string
}

export interface MeshTaskInput {
  model: string
  mode: 'text' | 'image' | 'multi'
  prompt?: string
  image?: string
  views?: MeshViewInput
  withTexture: boolean
  hdTexture: boolean
  pbrTexture: boolean
  priority?: number
}

export interface MotionTaskInput {
  model: string
  video: string
  startSeconds: number
  durationSeconds: number
  bboxes?: number[][] | null
  priority?: number
}

function buildOptions(priority?: number) {
  const options: Record<string, unknown> = { block: false }
  if (typeof priority === 'number' && priority > 0) options.priority = Math.round(priority)
  return options
}

export async function createMeshTask(input: MeshTaskInput): Promise<TaskCreateResponse> {
  const body: Record<string, unknown> = {
    model: input.model,
    with_texture: input.withTexture,
    options: buildOptions(input.priority),
  }

  if (input.withTexture) {
    body.hd_texture = input.hdTexture
    body.pbr_texture = input.pbrTexture
  }

  if (input.mode === 'text') {
    body.prompt = input.prompt?.trim() || ''
  } else if (input.mode === 'image') {
    body.input_image = input.image
  } else {
    const views: Record<string, string> = {}
    Object.entries(input.views || {}).forEach(([key, value]) => {
      if (value) views[key] = value
    })
    body.input_images = views
  }

  const response = await client.post<TaskCreateResponse>(MESH_TASKS_ENDPOINT, body, { timeout: 120000 })
  return response.data
}

export async function getMeshTask(taskId: string): Promise<MeshTaskResult> {
  const response = await client.get<MeshTaskResult>(`${MESH_TASKS_ENDPOINT}/${taskId}`, { timeout: 30000 })
  return response.data
}

export async function createMotionTask(input: MotionTaskInput): Promise<TaskCreateResponse> {
  const body: Record<string, unknown> = {
    model: input.model,
    input_video: input.video,
    start_time_seconds: input.startSeconds,
    duration_seconds: input.durationSeconds,
    options: buildOptions(input.priority),
  }
  if (input.bboxes?.length) body.bboxes = input.bboxes

  const response = await client.post<TaskCreateResponse>(MOTION_TASKS_ENDPOINT, body, { timeout: 120000 })
  return response.data
}

export async function getMotionTask(taskId: string): Promise<MotionTaskResult> {
  const response = await client.get<MotionTaskResult>(`${MOTION_TASKS_ENDPOINT}/${taskId}`, { timeout: 30000 })
  return response.data
}

/* -------------------------------------------------------------- 产物归一化 */

export type TaskAssetKind = 'mesh' | 'video' | 'motion' | 'audio' | 'image' | 'other'

export interface TaskAsset {
  path: string
  url: string
  label: string
  ext: string
  kind: TaskAssetKind
  expiresAt?: number
}

function assetKind(path: string): TaskAssetKind {
  const ext = assetExtension(path)
  if (ext === '.ply' || ext === '.glb' || ext === '.gltf') return 'mesh'
  if (ext === '.bvh' || ext === '.fbx' || ext === '.npz') return 'motion'
  if (ext === '.mp4' || ext === '.webm' || ext === '.mov') return 'video'
  if (ext === '.mp3' || ext === '.wav' || ext === '.m4a') return 'audio'
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return 'image'
  return 'other'
}

function assetLabel(path: string, kind: TaskAssetKind, isPreview: boolean): string {
  const ext = assetExtension(path).replace('.', '').toUpperCase()
  if (kind === 'mesh') return `3D 模型 · ${ext}`
  if (kind === 'motion') return `动捕数据 · ${ext}`
  if (kind === 'video') return isPreview ? '预览视频' : '视频片段'
  if (kind === 'audio') return `音频 · ${ext}`
  if (kind === 'image') return '预览图'
  return `产物 · ${ext || 'FILE'}`
}

function pushAsset(list: TaskAsset[], download: AssetDownload, isPreview = false) {
  if (!download?.download_url) return
  if (list.some((item) => item.path === download.asset_path)) return
  const kind = assetKind(download.asset_path)
  list.push({
    path: download.asset_path,
    url: download.download_url,
    kind,
    ext: assetExtension(download.asset_path),
    label: assetLabel(download.asset_path, kind, isPreview),
    expiresAt: download.download_expires_at,
  })
}

export function collectMeshAssets(task: MeshTaskResult | null): TaskAsset[] {
  if (!task?.metadata?.length) return []
  const list: TaskAsset[] = []
  task.metadata.forEach((meta) => {
    const previewVideo = meta.preview_video || ''
    const previewImage = meta.preview_image || ''
    ;(meta.downloads || []).forEach((download) => {
      const isPreview =
        (previewVideo && download.asset_path === previewVideo) || (previewImage && download.asset_path === previewImage)
      pushAsset(list, download, Boolean(isPreview))
    })
  })
  return list
}

/** 找到可旋转查看的模型产物（优先 ply / glb）。 */
export function pickMeshAsset(assets: TaskAsset[]): TaskAsset | null {
  return assets.find((asset) => asset.kind === 'mesh') || null
}

export function pickPreviewVideo(assets: TaskAsset[]): TaskAsset | null {
  return assets.find((asset) => asset.kind === 'video' && asset.label === '预览视频') || assets.find((asset) => asset.kind === 'video') || null
}

export function collectMotionAssets(task: MotionTaskResult | null): TaskAsset[] {
  const meta = task?.metadata
  if (!meta) return []
  const list: TaskAsset[] = []
  const clip = meta.video_clip || ''
  ;(meta.downloads || []).forEach((download) => {
    pushAsset(list, download, Boolean(clip && download.asset_path === clip))
  })
  return list
}

/** 常见上游英文错误 -> 中文文案（V2Fun 的审核类错误都是英文短句）。 */
const ERROR_TRANSLATIONS: { pattern: RegExp; text: string }[] = [
  { pattern: /task execution failed[,.]?\s*please retry later/i, text: '上游处理失败（服务商临时异常），请稍后重试。' },
  { pattern: /input image failed moderation/i, text: '参考图未通过内容审核，请更换图片后重试。' },
  { pattern: /input video failed moderation/i, text: '参考视频未通过内容审核，请更换视频后重试。' },
  { pattern: /input (text|prompt) failed moderation/i, text: '提示词未通过内容审核，请修改后重试。' },
  { pattern: /no (human|person|people).*(detected|found)/i, text: '未在视频中检测到人物，请更换包含清晰人物的片段。' },
  { pattern: /video.*(too (short|long)|duration)/i, text: '视频时长不在允许范围内，请调整起始时间与时长后重试。' },
]

function translateError(raw: string): string {
  const matched = ERROR_TRANSLATIONS.find((item) => item.pattern.test(raw))
  return matched ? matched.text : raw
}

/** 从任务结果里尽量读出一句可展示的错误。 */
export function taskFailureMessage(task: MeshTaskResult | MotionTaskResult | null): string {
  if (!task) return '任务执行失败'
  const error = task.error
  if (typeof error === 'string' && error.trim()) return translateError(error.trim())
  if (error && typeof error === 'object' && error.message) return translateError(error.message)
  return task.message || task.msg || '任务执行失败，请调整输入后重试。'
}

/** axios 错误 -> 用户可读文案（AIPing 错误体是 { code, msg, data }）。 */
export function taskRequestError(error: unknown, fallback = '请求失败，请稍后重试。'): string {
  const anyError = error as {
    response?: { status?: number; data?: { msg?: string; message?: string; error?: string | { message?: string } } }
    message?: string
    code?: string
  }
  const status = anyError?.response?.status
  if (status === 401 || status === 403) return 'API Key 无效或权限不足，请重新登录后再试。'
  if (status === 404) return '任务不存在或已过期。'
  if (status === 429) return '请求过于频繁，已达到并发或 RPM 限制，请稍后再试。'
  const data = anyError?.response?.data
  const raw =
    data?.msg ||
    data?.message ||
    (typeof data?.error === 'string' ? data.error : data?.error?.message) ||
    anyError?.message ||
    ''
  if (anyError?.code === 'ECONNABORTED') return '请求超时，请检查网络后重试。'
  if (raw.includes('No provider is currently available')) return '上游服务商暂时不可用，请稍后重试。'
  return raw || fallback
}
