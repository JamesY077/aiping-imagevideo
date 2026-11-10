/**
 * 本地图片通用预处理。
 *
 * 部分模型虽然支持 dataURI 图片直传，但多张原图会让请求体快速膨胀，甚至触发上游 503。
 * 这里把较大的本地图重采样为适合生成参考的 JPEG，在保证质量的前提下显著缩小请求体，
 * 也方便统一走 COS 上传服务转换为公网 URL。
 */

const MINIMAX_H3_IMAGE_MAX_SIDE = 1600
const MINIMAX_H3_IMAGE_TARGET_BYTES = 2 * 1024 * 1024
const MINIMAX_H3_IMAGE_JPEG_QUALITY = 0.85
const MINIMAX_H3_IMAGE_MIN_SIDE = 256
const MINIMAX_H3_IMAGE_API_MAX_SIDE = 5760

function isDataUri(value: string): boolean {
  return /^data:[^;]+;base64,/.test(value)
}

export function estimateDataUriBytes(dataUri: string): number {
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

function resizeDataUriToJpeg(dataUri: string, targetWidth: number, targetHeight: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(targetWidth))
    canvas.height = Math.max(1, Math.round(targetHeight))

    const context = canvas.getContext('2d')
    if (!context) {
      resolve(null)
      return
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    const image = new Image()
    image.onload = () => {
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', MINIMAX_H3_IMAGE_JPEG_QUALITY))
    }
    image.onerror = () => resolve(null)
    image.src = dataUri
  })
}

function downscaleDataUriToJpeg(dataUri: string, width: number, height: number): Promise<string | null> {
  const scale = Math.min(1, MINIMAX_H3_IMAGE_MAX_SIDE / Math.max(width, height))
  return resizeDataUriToJpeg(dataUri, width * scale, height * scale)
}

/**
 * 把 MiniMax-H3 的图片素材整理成更适合直传的 dataURI：
 * - 公网 URL 原样返回。
 * - 小尺寸、小体积的 dataURI 原样返回，避免无意义重编码。
 * - 大尺寸 / 大体积 dataURI 重采样为最长边 1600px 的 JPEG。
 */
export async function prepareLocalImageDataUri(value: string): Promise<string> {
  if (!isDataUri(value)) return value

  const sourceBytes = estimateDataUriBytes(value)
  const dimensions = await readDataUriDimensions(value)
  const largestSide = dimensions ? Math.max(dimensions.width, dimensions.height) : 0

  if (sourceBytes <= MINIMAX_H3_IMAGE_TARGET_BYTES && (!largestSide || largestSide <= MINIMAX_H3_IMAGE_MAX_SIDE)) {
    return value
  }

  if (!dimensions) return value

  const compressed = await downscaleDataUriToJpeg(value, dimensions.width, dimensions.height)
  if (!compressed) return value

  // 极少数已经高度优化的图片重编码后可能不降反升，保留原图。
  return estimateDataUriBytes(compressed) < sourceBytes ? compressed : value
}

/**
 * MiniMax-H3 图片合规预处理：
 * - 先执行通用压缩。
 * - 若最短边小于 256px，则等比放大到 256px，避免上游返回
 *   `image size 136x104, expected each side in [256, 5760]` 这类参数错误。
 * - 同时保证放大后最长边不超过 5760px；极端宽高比无法同时满足时返回原图，
 *   由上游给出明确错误，避免前端静默失真。
 */
export async function prepareMinimaxH3ImageDataUri(value: string): Promise<string> {
  const prepared = await prepareLocalImageDataUri(value)
  if (!isDataUri(prepared)) return prepared

  const dimensions = await readDataUriDimensions(prepared)
  if (!dimensions) return prepared

  const { width, height } = dimensions
  const minSide = Math.min(width, height)
  const maxSide = Math.max(width, height)

  if (minSide >= MINIMAX_H3_IMAGE_MIN_SIDE && maxSide <= MINIMAX_H3_IMAGE_API_MAX_SIDE) {
    return prepared
  }

  let scale = 1
  if (minSide < MINIMAX_H3_IMAGE_MIN_SIDE) {
    scale = Math.max(scale, MINIMAX_H3_IMAGE_MIN_SIDE / minSide)
  }
  if (maxSide * scale > MINIMAX_H3_IMAGE_API_MAX_SIDE) {
    scale = Math.min(scale, MINIMAX_H3_IMAGE_API_MAX_SIDE / maxSide)
  }

  const targetWidth = Math.round(width * scale)
  const targetHeight = Math.round(height * scale)
  const targetMinSide = Math.min(targetWidth, targetHeight)
  const targetMaxSide = Math.max(targetWidth, targetHeight)

  if (
    targetWidth === width &&
    targetHeight === height ||
    targetMinSide < MINIMAX_H3_IMAGE_MIN_SIDE ||
    targetMaxSide > MINIMAX_H3_IMAGE_API_MAX_SIDE
  ) {
    return prepared
  }

  const resized = await resizeDataUriToJpeg(prepared, targetWidth, targetHeight)
  return resized || prepared
}

/**
 * 参考图统一合规预处理：
 * - 先执行通用压缩（大图重采样）。
 * - 上游对 dataURI 的格式检测比较严格，实测 `image/webp` 会返回
 *   `invalid image format (detected format); received: ""`，因此统一把非 PNG/JPEG
 *   的图片重编码为 JPEG 后再直传。
 * Seedance 2 与 Seedream 5.0 Lite 共用这套预处理，只是后续的尺寸/体积校验不同。
 */
const REFERENCE_ACCEPTED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/jpg']

async function preparePngOrJpegImageDataUri(value: string): Promise<string> {
  const prepared = await prepareLocalImageDataUri(value)
  if (!isDataUri(prepared)) return prepared

  const mime = prepared.slice(5, prepared.indexOf(';')).toLowerCase()
  if (REFERENCE_ACCEPTED_IMAGE_MIMES.includes(mime)) return prepared

  const dimensions = await readDataUriDimensions(prepared)
  if (!dimensions) return prepared

  const jpeg = await resizeDataUriToJpeg(prepared, dimensions.width, dimensions.height)
  return jpeg || prepared
}

/** Seedance 2 图片合规预处理。 */
export function prepareSeedanceImageDataUri(value: string): Promise<string> {
  return preparePngOrJpegImageDataUri(value)
}

/** Seedream 5.0 Lite 图片合规预处理（同样统一为 PNG/JPEG）。 */
export function prepareSeedreamImageDataUri(value: string): Promise<string> {
  return preparePngOrJpegImageDataUri(value)
}
