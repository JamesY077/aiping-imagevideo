import { buildOpenAiImageRequestBody } from '@/api/providers/image/common'
import type { ImageModelModule } from '../types'
import { createModelExample } from '../types'

export const qwenImage20ProModel: ImageModelModule = {
  id: 'Qwen-Image-2.0-Pro',
  displayName: 'Qwen Image 2.0 Pro',
  capability: {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    requiresReference: true,
    imageRequestMode: 'default',
  },
  adapter: {
    provider: 'qwen',
    models: ['Qwen-Image-2.0-Pro'],
    endpoint: '/images/generations',
    buildRequestBody: (params) => buildOpenAiImageRequestBody(params, 'Qwen-Image-2.0-Pro'),
  },
  example: createModelExample({
    title: 'Qwen Image 文生图/参考图示例',
    description: '使用 Qwen-Image-2.0-Pro 生成图片；如需参考图，可传入 image。',
    request: {
      model: 'Qwen-Image-2.0-Pro',
      prompt: '国风插画，一座漂浮在云海中的山间书院，清晨柔光',
      size: '1024x1024',
      response_format: 'url',
    },
    code: `import { generateImage } from '@/api/aiping'

await generateImage({
  model: 'Qwen-Image-2.0-Pro',
  prompt: '国风插画，一座漂浮在云海中的山间书院，清晨柔光',
  size: '1024x1024',
  response_format: 'url',
})`,
  }),
}