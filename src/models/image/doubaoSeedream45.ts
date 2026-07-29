import { buildOpenAiImageRequestBody } from '@/api/providers/image/common'
import type { ImageModelModule } from '../types'
import { createModelExample } from '../types'

export const doubaoSeedream45Model: ImageModelModule = {
  id: 'Doubao-Seedream-4.5',
  displayName: 'Doubao Seedream 4.5',
  capability: {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    imageRequestMode: 'default',
  },
  adapter: {
    provider: 'doubao',
    models: ['Doubao-Seedream-4.5'],
    endpoint: '/images/generations',
    buildRequestBody: (params) => buildOpenAiImageRequestBody(params, 'Doubao-Seedream-4.5'),
  },
  example: createModelExample({
    title: '豆包 Seedream 4.5 文生图示例',
    description: '使用 Doubao-Seedream-4.5 根据文本提示词生成一张图片；如需参考图，可传入 image。',
    request: {
      model: 'Doubao-Seedream-4.5',
      prompt: '一座未来主义海边图书馆，落日金色光线，建筑摄影，超清细节',
      size: '1024x1024',
      response_format: 'url',
    },
    code: `import { generateImage } from '@/api/aiping'

await generateImage({
  model: 'Doubao-Seedream-4.5',
  prompt: '一座未来主义海边图书馆，落日金色光线，建筑摄影，超清细节',
  size: '1024x1024',
  response_format: 'url',
})`,
  }),
}