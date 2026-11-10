import { AppError } from '@/utils/errors'
import {
  prepareLocalImageDataUri,
  prepareMinimaxH3ImageDataUri,
  prepareSeedanceImageDataUri,
  prepareSeedreamImageDataUri,
} from '@/features/generate/localImage'

/**
 * 参考素材（图片 / 音频 / 视频）处理工具
 * ------------------------------------------------------------------
 * 各模型对本地素材的接受度不同（下面每条都是实测结论）：
 * - Seedance 2 系列：参考图、参考音频支持 base64 dataURI 直传；参考视频只接受公网 URL。
 * - MiniMax-H3：参考图、参考视频、参考音频均支持 dataURI 直传。
 * - Seedream 5.0 Lite：参考图支持 dataURI，但多图参考时请求体较大，优先换成公网 URL。
 * - 其他模型：配置了上传服务时，把 base64 图片换成公网 URL，避免大请求体导致上游 503。
 *
 * 因此上传服务（server/upload-service → 腾讯云 COS）主要服务两个场景：
 * Seedance 2 系列的**本地参考视频**，以及 Seedream 5.0 Lite 的**多图参考**。
 * 未配置或服务不可用时自动降级为 dataURI 直传，不影响单图场景。
 * 上传服务地址与鉴权 token 通过前端环境变量配置：
 *   VITE_UPLOAD_SERVICE_URL   例如 https://artrealm.nextmak.cn/upload
 *   VITE_UPLOAD_SERVICE_TOKEN 与服务端 UPLOAD_TOKEN 一致
 * ------------------------------------------------------------------
 */

const UPLOAD_SERVICE_URL = import.meta.env.VITE_UPLOAD_SERVICE_URL || ''
const UPLOAD_SERVICE_TOKEN = import.meta.env.VITE_UPLOAD_SERVICE_TOKEN || ''

/** 是否为 base64 dataURI（data:xxx;base64,...）。 */
export function isDataUri(value: string): boolean {
  return /^data:[^;]+;base64,/.test(value)
}

/** 是否配置了上传服务。 */
export function hasUploadService(): boolean {
  return !!UPLOAD_SERVICE_URL
}

/** Seedance 2.0 参考图的官方尺寸/比例限制，用于在上传前提前拦截。 */
const SEEDANCE_IMAGE_RULES = {
  minSide: 300,
  maxSide: 6000,
  minRatio: 0.4,
  maxRatio: 2.5,
  maxBytes: 30 * 1024 * 1024,
} as const

/** Seedream 5.0 Lite 参考图限制：单张 ≤ 10MB，边长 ≤ 6000px，宽高比 [1/16, 16]，最多 10 张。 */
const SEEDREAM_IMAGE_RULES = {
  maxSide: 6000,
  minRatio: 1 / 16,
  maxRatio: 16,
  maxBytes: 10 * 1024 * 1024,
} as const

function estimateDataUriBytes(dataUri: string): number {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1)
  if (!base64) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

function readDataUriDimensions(dataUri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null)
      return
    }

    const image = new Image()
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        resolve(null)
        return
      }
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => resolve(null)
    image.src = dataUri
  })
}

async function assertSeedanceImageValid(dataUri: string): Promise<void> {
  const bytes = estimateDataUriBytes(dataUri)
  if (bytes > SEEDANCE_IMAGE_RULES.maxBytes) {
    throw new AppError('这张图片文件太大，Seedance 2.0 要求图片不超过 30MB。请压缩图片后重试。')
  }

  const dimensions = await readDataUriDimensions(dataUri)
  if (!dimensions) return

  const { width, height } = dimensions
  const ratio = width / height

  if (ratio < SEEDANCE_IMAGE_RULES.minRatio) {
    throw new AppError(
      '这张参考图太窄了，Seedance 2.0 暂不支持。请换一张更接近常见横图/竖图比例的图片（宽高比需在 0.4 到 2.5 之间，例如 9:16、3:4、1:1、4:3、16:9）。',
    )
  }

  if (ratio > SEEDANCE_IMAGE_RULES.maxRatio) {
    throw new AppError(
      '这张参考图太宽了，Seedance 2.0 暂不支持。请换一张更接近常见横图/竖图比例的图片（宽高比需在 0.4 到 2.5 之间，例如 9:16、3:4、1:1、4:3、16:9）。',
    )
  }

  if (width < SEEDANCE_IMAGE_RULES.minSide || height < SEEDANCE_IMAGE_RULES.minSide) {
    throw new AppError(
      `这张参考图尺寸太小，Seedance 2.0 要求最短边至少 300 像素（当前为 ${width}×${height}）。请换一张更大的图片后重试。`,
    )
  }

  if (width > SEEDANCE_IMAGE_RULES.maxSide || height > SEEDANCE_IMAGE_RULES.maxSide) {
    throw new AppError(
      `这张参考图尺寸太大，Seedance 2.0 要求最长边不超过 6000 像素（当前为 ${width}×${height}）。请缩小图片后重试。`,
    )
  }
}

/**
 * Seedream 5.0 Lite 参考图校验：
 * - 单张不超过 10MB；
 * - 每条边不超过 6000px；
 * - 宽高比在 [1/16, 16] 之间。
 */
async function assertSeedreamImageValid(dataUri: string): Promise<void> {
  if (!/^data:image\//i.test(dataUri)) {
    throw new AppError('参考图格式不正确，请重新选择图片后重试。', { code: 'IMAGE_INVALID' })
  }

  const bytes = estimateDataUriBytes(dataUri)
  if (bytes > SEEDREAM_IMAGE_RULES.maxBytes) {
    throw new AppError('这张图片文件太大，Seedream 5.0 Lite 要求单张不超过 10MB。请压缩图片后重试。')
  }

  const dimensions = await readDataUriDimensions(dataUri)
  if (!dimensions) return

  const { width, height } = dimensions
  const ratio = width / height

  if (ratio < SEEDREAM_IMAGE_RULES.minRatio || ratio > SEEDREAM_IMAGE_RULES.maxRatio) {
    throw new AppError(
      `这张参考图比例过于极端，Seedream 5.0 Lite 暂不支持。请换一张宽高比在 1:16 到 16:1 之间的图片（当前为 ${width}×${height}）。`,
    )
  }

  if (width > SEEDREAM_IMAGE_RULES.maxSide || height > SEEDREAM_IMAGE_RULES.maxSide) {
    throw new AppError(
      `这张参考图尺寸太大，Seedream 5.0 Lite 要求每条边不超过 6000 像素（当前为 ${width}×${height}）。请缩小图片后重试。`,
    )
  }
}

type UploadAssetKind = 'image' | 'audio' | 'video'

const UPLOAD_ASSET_LABEL: Record<UploadAssetKind, string> = {
  image: '图片',
  audio: '音频',
  video: '视频',
}

/** 参考音频体积上限，避免超大文件把上传服务和上游请求拖垮。 */
const AUDIO_MAX_BYTES = 30 * 1024 * 1024
/** 参考视频体积上限：火山 Seedance 2 系列要求参考视频不超过 50MB。 */
const VIDEO_MAX_BYTES = 50 * 1024 * 1024

function resolveUploadServiceError(
  status: number,
  detail: string,
  kind: UploadAssetKind = 'image',
): AppError {
  const label = UPLOAD_ASSET_LABEL[kind]

  if (status === 401 || status === 403) {
    return new AppError(`${label}上传服务鉴权失败，请检查上传服务的 token 配置。`, {
      code: 'UPLOAD_SERVICE_AUTH',
    })
  }

  if (status === 413) {
    return new AppError(`${label}文件太大，请压缩后重试。`, { code: 'UPLOAD_SERVICE_TOO_LARGE' })
  }

  if (status === 404 || status === 405) {
    return new AppError(
      `${label}上传接口返回 404/405：线上服务器还没有正确配置 /upload 反向代理。` +
        '请按 DEPLOYMENT.md 给 Nginx 加上 /upload 反代，并确认上传服务已在服务器运行。',
      { code: 'UPLOAD_SERVICE_UNAVAILABLE' },
    )
  }

  if (status >= 500) {
    return new AppError(`${label}上传服务暂时不可用，请稍后重试。`, { code: 'UPLOAD_SERVICE_UNAVAILABLE' })
  }

  return new AppError(`${label}上传失败：${detail || '请稍后重试'}`, { code: 'UPLOAD_SERVICE_FAILED' })
}

/** 把 base64 dataURI POST 到 COS 代理服务，返回公网 HTTPS URL。 */
async function postAssetToUploadService(kind: UploadAssetKind, dataUri: string): Promise<string> {
  const label = UPLOAD_ASSET_LABEL[kind]

  if (!UPLOAD_SERVICE_URL) {
    throw new AppError(`当前未配置${label}上传服务，无法把本地${label}转换为公网 URL。`, {
      code: 'UPLOAD_SERVICE_UNAVAILABLE',
    })
  }

  let resp: Response
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (UPLOAD_SERVICE_TOKEN) headers.Authorization = `Bearer ${UPLOAD_SERVICE_TOKEN}`

    resp = await fetch(UPLOAD_SERVICE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ [kind]: dataUri }),
    })
  } catch {
    throw new AppError(`${label}上传服务连接失败，请确认上传服务已启动且网络可达。`, {
      code: 'UPLOAD_SERVICE_UNAVAILABLE',
    })
  }

  if (!resp.ok) {
    let detail = ''
    try {
      const data = await resp.json()
      detail = data?.error || JSON.stringify(data)
    } catch {
      detail = await resp.text().catch(() => '')
    }
    throw resolveUploadServiceError(resp.status, detail, kind)
  }

  let data: any
  try {
    data = await resp.json()
  } catch {
    throw new AppError(
      `${label}上传服务返回异常响应（不是 JSON），请检查 /upload 反向代理是否指向 server/upload-service。`,
      { code: 'UPLOAD_SERVICE_UNAVAILABLE' },
    )
  }
  if (!data?.url || typeof data.url !== 'string') {
    throw new AppError(`${label}上传成功，但没有拿到${label}地址，请稍后重试。`, {
      code: 'UPLOAD_SERVICE_FAILED',
    })
  }
  return data.url
}

function postImageToUploadService(dataUri: string): Promise<string> {
  return postAssetToUploadService('image', dataUri)
}

/** 严格上传：任何失败都抛出，用于必须拿到公网 URL 的场景（Seedance 2.0）。 */
async function uploadImageToPublicUrl(dataUri: string): Promise<string> {
  return postImageToUploadService(dataUri)
}

/** 尽力上传：服务未配置 / 未反代 / 宕机时返回 null，调用方可降级为 dataURI 直传。 */
async function tryUploadImageToPublicUrl(dataUri: string): Promise<string | null> {
  try {
    return await postImageToUploadService(dataUri)
  } catch (error: any) {
    if (error instanceof AppError && error.code === 'UPLOAD_SERVICE_UNAVAILABLE') {
      return null
    }
    throw error
  }
}

/**
 * 需要公网图片 URL 的场景专用：先做尺寸/比例校验，再上传为公网 URL。
 * 注意：Seedance 参考图本身支持 dataURI（见 ensureSeedanceImageForModel），
 * 这个函数只给确实要求公网 URL 的调用方使用。
 */
export async function uploadDataUriToPublicUrl(dataUri: string): Promise<string> {
  if (!UPLOAD_SERVICE_URL) {
    throw new AppError(
      '当前未配置文件上传服务，无法把本地图片转换成公网图片 URL。' +
        '请在前端 .env 配置 VITE_UPLOAD_SERVICE_URL（并部署 server/upload-service），' +
        '或改用画布中已生成的图片作为参考。',
    )
  }

  await assertSeedanceImageValid(dataUri)
  return uploadImageToPublicUrl(dataUri)
}

/**
 * 参考音频：MiniMax-H3 与 Seedance 2 系列都接受 base64 dataURI（均实测 200），
 * 因此这里只做格式/体积校验后原样直传，**不依赖上传服务**。
 */
export async function prepareReferenceAudioForModel(value: string): Promise<string> {
  if (!isDataUri(value)) return value

  if (!/^data:audio\//i.test(value)) {
    throw new AppError('参考音频格式不正确，请重新选择音频文件后重试。', {
      code: 'AUDIO_INVALID',
    })
  }

  if (estimateDataUriBytes(value) > AUDIO_MAX_BYTES) {
    throw new AppError('这段参考音频文件太大，请选择 30MB 以内的音频后重试。', {
      code: 'AUDIO_TOO_LARGE',
    })
  }

  return value
}

/**
 * Seedance 2 专用图片处理：
 * - 上游实测支持 `data:image/...;base64,...` 内联直传，因此**不强制**上传服务；
 * - 先压缩大图并做官方尺寸/比例校验，避免请求体过大或参数不合法；
 * - 配置了上传服务时优先换公网 URL，服务不可用时自动降级为 dataURI，保证生成不被卡住。
 */
export async function ensureSeedanceImageForModel(value: string): Promise<string> {
  if (!isDataUri(value)) return value

  const preparedDataUri = await prepareSeedanceImageDataUri(value)
  await assertSeedanceImageValid(preparedDataUri)

  if (!UPLOAD_SERVICE_URL) return preparedDataUri

  const publicUrl = await tryUploadImageToPublicUrl(preparedDataUri)
  if (publicUrl) return publicUrl

  console.warn('[upload] 图片上传服务不可用，Seedance 本次降级为 dataURI 直传。')
  return preparedDataUri
}

/**
 * Seedream 5.0 Lite 专用图片处理（对齐 Seedance 2 系列的处理方式）：
 * - 本地 dataURI 先压缩并转成 PNG/JPEG，再做尺寸/体积校验；
 * - 配置了上传服务时优先换公网 URL，服务不可用时自动降级为 dataURI 直传；
 * - 已是 http/https 的地址原样返回。
 * 多张参考图由调用方逐张处理后再以 image 数组下发。
 */
export async function ensureSeedreamImageForModel(value: string): Promise<string> {
  if (!isDataUri(value)) return value

  const preparedDataUri = await prepareSeedreamImageDataUri(value)
  await assertSeedreamImageValid(preparedDataUri)

  if (!UPLOAD_SERVICE_URL) return preparedDataUri

  const publicUrl = await tryUploadImageToPublicUrl(preparedDataUri)
  if (publicUrl) return publicUrl

  console.warn('[upload] 图片上传服务不可用，Seedream 本次降级为 dataURI 直传。')
  return preparedDataUri
}

/**
 * MiniMax-H3 专用：本地参考视频可以直接以 base64 dataURI 直传（实测 200），
 * 与 MiniMax 的原生使用方式一致，不需要部署上传服务。
 */
export async function ensureMinimaxH3VideoForModel(value: string): Promise<string> {
  if (!isDataUri(value)) return value

  if (!/^data:video\//i.test(value)) {
    throw new AppError('参考视频格式不正确，请重新选择视频文件后重试。', {
      code: 'VIDEO_INVALID',
    })
  }

  if (estimateDataUriBytes(value) > VIDEO_MAX_BYTES) {
    throw new AppError('这段参考视频文件太大，请选择 50MB 以内的视频后重试。', {
      code: 'VIDEO_TOO_LARGE',
    })
  }

  return value
}

/**
 * Seedance 2 专用：本地参考视频必须换成公网 URL。
 *
 * 实测火山 Seedance 的 `reference_video` 只接受 web url，传 base64 会返回：
 * `reference_video must be provided as a web url`。
 * （MiniMax-H3 不受此限制，见 ensureMinimaxH3VideoForModel）
 */
export async function ensurePublicVideoUrlForModel(value: string): Promise<string> {
  if (!isDataUri(value)) return value

  if (!/^data:video\//i.test(value)) {
    throw new AppError('参考视频格式不正确，请重新选择视频文件后重试。', {
      code: 'VIDEO_INVALID',
    })
  }

  if (estimateDataUriBytes(value) > VIDEO_MAX_BYTES) {
    throw new AppError('这段参考视频文件太大，请选择 50MB 以内的视频后重试。', {
      code: 'VIDEO_TOO_LARGE',
    })
  }

  if (!UPLOAD_SERVICE_URL) {
    throw new AppError(
      'Seedance 2 系列的本地参考视频需要先转成公网 URL，但当前没有配置文件上传服务。' +
        '你可以改用公网可访问的视频地址，或部署 server/upload-service 后配置 VITE_UPLOAD_SERVICE_URL。',
      { code: 'UPLOAD_SERVICE_UNAVAILABLE' },
    )
  }

  return postAssetToUploadService('video', value)
}

/**
 * 通用图片上传：
 * - 已是 http/https：原样返回。
 * - 是 base64 dataURI：先压缩大图，再上传为公网 URL。
 * - 未配置上传服务时，返回压缩后的 dataURI，尽量兼容支持 base64 的模型。
 */
export async function ensurePublicImageUrlForModel(value: string): Promise<string> {
  if (!isDataUri(value)) return value

  const preparedDataUri = await prepareLocalImageDataUri(value)
  if (!UPLOAD_SERVICE_URL) return preparedDataUri

  const publicUrl = await tryUploadImageToPublicUrl(preparedDataUri)
  if (publicUrl) return publicUrl

  // 上传服务未正确部署时降级为压缩后的 dataURI 直传，避免一个服务配置问题卡死生成。
  console.warn('[upload] 图片上传服务不可用，本次降级为 dataURI 直传。')
  return preparedDataUri
}

/**
 * MiniMax-H3 专用图片上传：
 * 在上传 COS 前先按 H3 官方尺寸限制（最短边至少 256px）做一次合规处理。
 */
export async function ensureMinimaxH3ImageForModel(value: string): Promise<string> {
  if (!isDataUri(value)) return value

  const preparedDataUri = await prepareMinimaxH3ImageDataUri(value)
  if (!UPLOAD_SERVICE_URL) return preparedDataUri

  const publicUrl = await tryUploadImageToPublicUrl(preparedDataUri)
  if (publicUrl) return publicUrl

  console.warn('[upload] 图片上传服务不可用，MiniMax-H3 本次降级为 dataURI 直传。')
  return preparedDataUri
}

/**
 * 确保一个图片地址是公网 URL：
 * - 已是 http/https：原样返回。
 * - 是 base64 dataURI：上传换成公网 URL。
 */
export async function ensurePublicImageUrl(value: string): Promise<string> {
  if (isDataUri(value)) {
    return uploadDataUriToPublicUrl(value)
  }
  return value
}
