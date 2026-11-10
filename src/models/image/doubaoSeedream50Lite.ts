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
    // Seedream 4.0–5.0 原生支持多图输入（image 数组，最多 10 张），
    // 用于多图融合 / 图像编辑；前端通过 @图片N 在提示词中指定素材。
    imageReferenceMode: 'multi',
    imageReferenceLimit: 10,
  },
  adapter: {
    provider: 'doubao',
    models: ['Doubao-Seedream-5.0-lite'],
    endpoint: '/images/generations',
    buildRequestBody: (params) => buildOpenAiImageRequestBody(params, 'Doubao-Seedream-5.0-lite'),
  },
  example: createModelExample({
    title: '豆包 Seedream 多图融合示例',
    description: '把两张参考图作为 image 数组传入，在提示词中用「图1 / 图2」指定素材，完成多图融合。',
    request: {
      model: 'Doubao-Seedream-5.0-lite',
      prompt: '将图1 的红苹果放到图2 的木桌上，保持图2 的光线氛围',
      image: ['https://example.com/apple.png', 'https://example.com/desk.png'],
      size: '2048x2048',
      output_format: 'png',
      watermark: false,
      response_format: 'url',
    },
    code: `import { generateImage } from '@/api/aiping'

await generateImage({
  model: 'Doubao-Seedream-5.0-lite',
  prompt: '将图1 的红苹果放到图2 的木桌上，保持图2 的光线氛围',
  image: ['https://example.com/apple.png', 'https://example.com/desk.png'],
  size: '2048x2048',
  output_format: 'png',
  watermark: false,
  response_format: 'url',
})`,
  }),
}