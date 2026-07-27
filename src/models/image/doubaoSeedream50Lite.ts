import { buildOpenAiImageRequestBody } from '@/api/providers/image/common'
import type { ImageModelModule } from '../types'
import { createModelExample } from '../types'

export const doubaoSeedream50LiteModel: ImageModelModule = {
  id: 'Doubao-Seedream-5.0-lite',
  displayName: 'Doubao Seedream 5.0 Lite',
  capability: {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    imageRequestMode: 'seedream-5-lite',
  },
  adapter: {
    provider: 'doubao',
    models: ['Doubao-Seedream-5.0-lite'],
    endpoint: '/images/generations',
    buildRequestBody: (params) => buildOpenAiImageRequestBody(params, 'Doubao-Seedream-5.0-lite'),
  },
  example: createModelExample({
    title: '豆包 Seedream 文生图示例',
    description: '使用豆包 Seedream 5.0 Lite 根据文本提示词生成一张 1:1 图片。',
    request: {
      model: 'Doubao-Seedream-5.0-lite',
      prompt: '一只戴着太空头盔的橘猫，电影级光影，超清细节',
      size: '1024x1024',
      response_format: 'url',
    },
    code: `import { generateImage } from '@/api/aiping'

await generateImage({
  model: 'Doubao-Seedream-5.0-lite',
  prompt: '一只戴着太空头盔的橘猫，电影级光影，超清细节',
  size: '1024x1024',
  response_format: 'url',
})`,
  }),
}