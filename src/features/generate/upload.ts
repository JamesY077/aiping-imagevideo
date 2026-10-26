import { AppError } from '@/utils/errors'
import {
  prepareLocalImageDataUri,
  prepareMinimaxH3ImageDataUri,
} from '@/features/generate/localImage'

/**
 * 图片上传工具（本地图片统一走 COS 上传代理）
 * ------------------------------------------------------------------
 * 火山 Seedance 2.0 的 CreateAsset 必须使用公网 URL；其他支持本地图片的模型
 * 在配置了上传服务后，也会统一把 base64 图片换成公网 URL，避免大请求体导致上游 503。
 *
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

type UploadAssetKind = 'image' | 'audio'

const UPLOAD_ASSET_LABEL: Record<UploadAssetKind, string> = {
  image: '图片',
  audio: '音频',
}

/** 参考音频体积上限，避免超大文件把上传服务和上游请求拖垮。 */
const AUDIO_MAX_BYTES = 30 * 1024 * 1024

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

  const data = await resp.json()
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
 * Seedance 2.0 专用：本地上传图片必须先经尺寸/比例校验，再上传为公网 URL。
 */
export async function uploadDataUriToPublicUrl(dataUri: string): Promise<string> {
  if (!UPLOAD_SERVICE_URL) {
    throw new AppError(
      'Seedance 2.0 的参考图需要公网图片 URL，但当前未配置图片上传服务。' +
        '请在前端 .env 配置 VITE_UPLOAD_SERVICE_URL（并部署 server/upload-service），' +
        '或改用画布中已生成的图片作为参考。',
    )
  }

  await assertSeedanceImageValid(dataUri)
  return uploadImageToPublicUrl(dataUri)
}

/**
 * Seedance 2.0 / MiniMax-H3 专用：本地音频必须换成公网 URL。
 *
 * 这两个模型的 reference_audio.audio_url 不接受 base64 dataURI；
 * 配音音频库的 Blob、本地上传的音频都会先经过这里上传。
 */
export async function ensurePublicAudioUrlForModel(value: string): Promise<string> {
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

  if (!UPLOAD_SERVICE_URL) {
    throw new AppError(
      'Seedance 2.0 / MiniMax-H3 的参考音频需要公网 URL，但当前未配置文件上传服务。' +
        '请在前端 .env 配置 VITE_UPLOAD_SERVICE_URL（并部署 server/upload-service），' +
        '或改用公网可访问的音频地址。',
      { code: 'UPLOAD_SERVICE_UNAVAILABLE' },
    )
  }

  return postAssetToUploadService('audio', value)
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
