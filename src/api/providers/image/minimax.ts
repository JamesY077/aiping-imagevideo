import type { ImageGenerateRequest } from '@/types/api'
import type { ImageProviderRequest } from './types'

/**
 * MiniMax-H3-Image / MiniMax-H3-Image-Highspeed 走 AIPing 的 OpenAI 兼容图片接口：
 *
 * - 文生图：POST /images/generations，body 使用显式 `size`（宽x高）。
 * - 图片编辑：POST /images/edits，参考图放在 `images: [{ image_url }]`，
 *   且必须是服务端可访问的 HTTPS 地址（本地文件由上传服务先转成公网 URL）。
 *
 * 两种模式的 size / aspect_ratio / area 互斥，这里始终只传 `size`。
 * 提示词中的 `@图片N` 是前端素材引用语法，MiniMax 文档使用「图N」，下发前做一次映射。
 */

export const MINIMAX_H3_IMAGE_GENERATIONS_ENDPOINT = '/images/generations'
export const MINIMAX_H3_IMAGE_EDITS_ENDPOINT = '/images/edits'

function collectReferenceImages(image: ImageGenerateRequest['image']): string[] {
  if (!image) return []
  const list = Array.isArray(image) ? image : [image]
  return list.filter((url): url is string => typeof url === 'string' && !!url)
}

export function buildMinimaxH3ImageRequest(
  params: ImageGenerateRequest,
  defaultModel: string,
): ImageProviderRequest {
  const references = collectReferenceImages(params.image)
  const isEdit = references.length > 0
  const prompt = String(params.prompt || '').replace(/@图片(\d+)/g, '图$1')

  const body: Record<string, unknown> = {
    model: params.model || defaultModel,
    prompt,
  }

  if (params.size) body.size = params.size
  if (params.n) body.n = params.n
  body.response_format = params.response_format || 'url'
  if (params.output_format) body.output_format = params.output_format
  if (typeof params.disable_prompt_enhanced === 'boolean') {
    body.disable_prompt_enhanced = params.disable_prompt_enhanced
  }
  // 前端统一通过 watermark 控制可见水印，MiniMax 的字段名是 aigc_watermark。
  if (typeof params.watermark === 'boolean') body.aigc_watermark = params.watermark
  if (typeof params.aigc_watermark === 'boolean') body.aigc_watermark = params.aigc_watermark
  if (params.extra_body) body.extra_body = params.extra_body

  if (isEdit) {
    body.images = references.map((url) => ({ image_url: url }))
    return { endpoint: MINIMAX_H3_IMAGE_EDITS_ENDPOINT, body }
  }

  return { endpoint: MINIMAX_H3_IMAGE_GENERATIONS_ENDPOINT, body }
}

/** 供 ImageProviderAdapter.buildRequestBody 使用；端点由 buildRequest 决定。 */
export function buildMinimaxH3ImageRequestBody(
  params: ImageGenerateRequest,
  defaultModel: string,
): Record<string, unknown> {
  return buildMinimaxH3ImageRequest(params, defaultModel).body
}
