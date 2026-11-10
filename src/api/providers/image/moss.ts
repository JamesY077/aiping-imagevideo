import type { ImageGenerateRequest } from '@/types/api'
import { AppError } from '@/utils/errors'
import { buildOpenAiImageRequestBody } from './common'

/** Moss 只支持一个固定的模型 ID。 */
export const MOSS_IMAGE_MODEL_ID = 'Moss-Image-SFT'

// 实测（aiping.cn，2026-11-10）：size 必须是 WxH（x 分隔），每边 256-2048
// 且能被 16 整除，总像素不超过 2097152；无 size 时默认 1024x1024。
const MOSS_MIN_SIDE = 256
const MOSS_MAX_SIDE = 2048
const MOSS_SIDE_STEP = 16
const MOSS_MAX_PIXELS = 2097152

function isValidMossSize(width: number, height: number): boolean {
  const sidesValid = [width, height].every(
    (side) => side >= MOSS_MIN_SIDE && side <= MOSS_MAX_SIDE && side % MOSS_SIDE_STEP === 0
  )
  return sidesValid && width * height <= MOSS_MAX_PIXELS
}

/**
 * 把项目内的 `1024*1024` 尺寸转换为 Moss 要求的 `1024x1024`，
 * 并在超出上游约束时给出可读提示，避免透传上游的英文 400 错误。
 */
export function normalizeMossImageSize(size: string): string {
  const match = size.trim().match(/^(\d+)\s*[x*×]\s*(\d+)$/i)
  if (!match) {
    throw new AppError('Moss 的图片尺寸格式应为「宽x高」，例如 1024x1024。')
  }

  const width = Number(match[1])
  const height = Number(match[2])
  if (!isValidMossSize(width, height)) {
    throw new AppError(
      'Moss 图片尺寸需满足：每边 256-2048 且能被 16 整除，总像素不超过 2097152。请切换比例后重试。'
    )
  }

  return `${width}x${height}`
}

/**
 * Moss 的请求体：
 * - 仅支持文生图：不接受 image / width / height / n
 * - size 必须为 WxH，且不能携带 output_format / watermark（实测会被判为非法请求）
 * - response_format 只支持 url
 * - extra_body 属于 AI Ping 网关参数，可以原样透传
 */
export function buildMossImageRequestBody(params: ImageGenerateRequest): Record<string, unknown> {
  const body = buildOpenAiImageRequestBody(params, MOSS_IMAGE_MODEL_ID)

  delete body.image
  delete body.width
  delete body.height
  delete body.n
  delete body.output_format
  delete body.watermark

  if (typeof body.size === 'string' && body.size.trim()) {
    body.size = normalizeMossImageSize(body.size)
  } else {
    delete body.size
  }

  if (body.response_format !== 'url') {
    delete body.response_format
  }

  return body
}
