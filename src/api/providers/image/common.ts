import type { ImageGenerateRequest } from '@/types/api'

export function buildOpenAiImageRequestBody(
  params: ImageGenerateRequest,
  defaultModel: string
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.model || defaultModel,
    prompt: params.prompt,
  }

  if (params.image) body.image = params.image
  if (params.size) body.size = params.size
  if (params.width) body.width = params.width
  if (params.height) body.height = params.height
  if (params.output_format) body.output_format = params.output_format
  if (typeof params.watermark === 'boolean') body.watermark = params.watermark
  if (params.extra_body) body.extra_body = params.extra_body
  if (params.n) body.n = params.n
  if (params.response_format) body.response_format = params.response_format

  return body
}
