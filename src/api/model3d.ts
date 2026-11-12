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
}

export interface MotionTaskInput {
  model: string
  video: string
  startSeconds: number
  durationSeconds: number
  bboxes?: number[][] | null
}

/** 只走异步轮询；不传 options.priority（账户 mq_priority 固定，传大了会被上游 400）。 */
function buildOptions() {
  return { block: false }
}

export async function createMeshTask(input: MeshTaskInput): Promise<TaskCreateResponse> {
  const body: Record<string, unknown> = {
    model: input.model,
    with_texture: input.withTexture,
    options: buildOptions(),
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
    options: buildOptions(),
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
  // 扩展名由下方的副标题单独展示，标题里不再重复，右栏更紧凑。
  if (kind === 'mesh') return '3D 模型'
  if (kind === 'motion') return '动捕数据'
  if (kind === 'video') return isPreview ? '预览视频' : '视频片段'
  if (kind === 'audio') return '音频'
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

const ASSET_SORT_ORDER: Record<TaskAssetKind, number> = {
  mesh: 0,
  motion: 1,
  video: 2,
  audio: 3,
  image: 4,
  other: 5,
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
  // 模型文件最重要，排在预览图和预览视频前面，翻页第一页就能拿到。
  return list.sort((a, b) => ASSET_SORT_ORDER[a.kind] - ASSET_SORT_ORDER[b.kind])
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
  {
    pattern: /input image failed moderation/i,
    text: '参考图未通过内容审核：请换用主体清晰、背景干净、不含文字 / 水印的图片；多视角可先只传正视图提交，再逐个补其他视角来定位问题图片。',
  },
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

/**
 * 上游参数校验错误里的字段名 -> 中文。
 * FastAPI 风格的错误体是 `{ detail: [{ loc: ['body','input_images','front'], msg }] }`，
 * 直接把 `input_images.front` 抛给用户很难懂。
 */
const FIELD_LABELS: Record<string, string> = {
  model: '模型',
  prompt: '提示词',
  input_image: '参考图',
  input_images: '多视角图片',
  'input_images.front': '正视图',
  'input_images.left': '左视图',
  'input_images.back': '背视图',
  'input_images.right': '右视图',
  input_video: '视频',
  start_time_seconds: '起始时间',
  duration_seconds: '片段时长',
  bboxes: '人物框',
}

function fieldLabel(loc: unknown): string {
  if (!Array.isArray(loc)) return ''
  const path = loc.filter((item) => typeof item === 'string' && item !== 'body').join('.')
  return FIELD_LABELS[path] || path
}

/** FastAPI 的 detail 可能是字符串，也可能是 [{ loc, msg }] 数组。 */
function detailMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail.trim()
  if (!Array.isArray(detail)) return ''

  return detail
    .map((item) => {
      if (typeof item === 'string') return item
      const entry = item as { msg?: unknown; loc?: unknown }
      const message = typeof entry?.msg === 'string' ? entry.msg.trim() : ''
      if (!message) return ''
      const label = fieldLabel(entry?.loc)
      // Pydantic 的默认文案对用户没意义，这里换成人话。
      if (/^field required$/i.test(message)) return label ? `缺少${label}` : '缺少必填参数'
      if (/^string (type expected|should be a valid string)$/i.test(message)) return label ? `${label}格式不正确` : '参数格式不正确'
      return label ? `${label}：${message}` : message
    })
    .filter(Boolean)
    .join('；')
}

/** 参数类错误（400 / 422）里常见的上游英文提示 -> 中文。 */
const PARAM_ERROR_TRANSLATIONS: { pattern: RegExp; text: string }[] = [
  { pattern: /(aspect ratio|resolution|image size|dimension)/i, text: '图片尺寸或比例不符合上游要求，请改用方向统一、接近正方形的图片后重试。' },
  { pattern: /(unsupported|not supported|invalid).*(image|format|file)/i, text: '图片格式不受支持，请改用 JPG / PNG / WebP 后重试。' },
  { pattern: /(image|file).*(too (large|big)|size limit|exceeds)/i, text: '图片体积或分辨率超出上限，请压缩后重试。' },
  { pattern: /(duplicate|same (image|view))/i, text: '多视角图片重复，请为每个视角上传不同角度的图片。' },
  { pattern: /(moderation|safety|nsfw)/i, text: '图片未通过内容审核，请换用主体清晰、不含文字 / 水印 / 敏感内容的图片后重试。' },
]

function translateParamError(raw: string): string {
  const matched = PARAM_ERROR_TRANSLATIONS.find((item) => item.pattern.test(raw))
  return matched ? matched.text : raw
}

/** axios 错误 -> 用户可读文案（AIPing 错误体是 { code, msg, data }，上游校验可能是 { detail }）。 */
export function taskRequestError(error: unknown, fallback = '请求失败，请稍后重试。'): string {
  const anyError = error as {
    response?: { status?: number; data?: unknown }
    message?: string
    code?: string
  }
  const status = anyError?.response?.status
  if (status === 401 || status === 403) return 'API Key 无效或权限不足，请重新登录后再试。'
  if (status === 404) return '任务不存在或已过期。'
  if (status === 429) return '请求过于频繁，已达到并发或 RPM 限制，请稍后再试。'
  if (anyError?.code === 'ECONNABORTED') return '请求超时，请检查网络后重试。'

  let data = anyError?.response?.data
  if (typeof data === 'string') {
    const text = data.trim()
    // 上游偶尔直接返回纯文本；能解析成 JSON 的按结构读，避免把整段 JSON 抛给用户。
    if (text.startsWith('{') || text.startsWith('[')) {
      try {
        data = JSON.parse(text)
      } catch {
        // 不是合法 JSON，保留原文
      }
    }
  }

  const payload = (typeof data === 'object' && data !== null ? data : {}) as {
    msg?: string
    message?: string
    error?: string | { message?: string }
    detail?: unknown
  }
  const raw =
    payload.msg ||
    payload.message ||
    (typeof payload.error === 'string' ? payload.error : payload.error?.message) ||
    detailMessage(payload.detail) ||
    (typeof data === 'string' ? data.slice(0, 200) : '') ||
    ''

  if (raw.includes('No provider is currently available')) return '上游服务商暂时不可用，请稍后重试。'
  if (/rate limit|concurren/i.test(raw)) return '请求过于频繁或并发已满，请稍后再试。'

  if (raw) {
    const translated = translateError(raw)
    if (translated !== raw) return translated
    if (status === 400 || status === 422) {
      const paramError = translateParamError(raw)
      // 参数类提示是推测出的中文，附上上游原文，方便用户/我们判断真实原因。
      return paramError === raw ? raw : `${paramError}（上游提示：${raw}）`
    }
    return raw
  }

  // 兜底也不能只剩一句英文 status text，至少告诉用户是哪一步失败。
  if (status === 400 || status === 422) return '请求参数被上游拒绝，请检查图片与模型选择后重试。'
  return anyError?.message || fallback
}
