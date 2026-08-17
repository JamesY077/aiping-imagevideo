import { AppError } from '@/utils/errors'

/**
 * 图片上传工具（Seedance 2.0 参考图专用）
 * ------------------------------------------------------------------
 * 火山 Seedance 2.0 的 CreateAsset 只接受公网 http/https URL，不接受本地
 * base64。因此本地上传的参考图需先经过「上传代理服务」换成公网 URL
 * （见 server/upload-service）。
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

/**
 * 把一张 base64 dataURI 上传到上传代理服务，返回公网 HTTPS URL。
 * 若未配置上传服务，抛出带指引的错误。
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

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (UPLOAD_SERVICE_TOKEN) headers.Authorization = `Bearer ${UPLOAD_SERVICE_TOKEN}`

    const resp = await fetch(UPLOAD_SERVICE_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image: dataUri }),
    })

    if (!resp.ok) {
      let detail = ''
      try {
        const data = await resp.json()
        detail = data?.error || JSON.stringify(data)
      } catch {
        detail = await resp.text().catch(() => '')
      }
      if (resp.status === 401 || resp.status === 403) {
        throw new AppError('图片上传服务鉴权失败，请检查上传服务的 token 配置。')
      }
      if (resp.status === 413) {
        throw new AppError('图片文件太大，请压缩后重试。')
      }
      if (resp.status >= 500) {
        throw new AppError('图片上传服务暂时不可用，请稍后重试。')
      }
      throw new AppError(`图片上传失败：${detail || '请稍后重试'}`)
    }

    const data = await resp.json()
    if (!data?.url || typeof data.url !== 'string') {
      throw new AppError('图片上传成功，但没有拿到图片地址，请稍后重试。')
    }
    return data.url
  } catch (error: any) {
    if (error instanceof AppError) throw error
    throw new AppError('图片上传失败，请检查网络后重试。')
  }
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
