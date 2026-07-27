import { buildOpenAiImageRequestBody } from '@/api/providers/image/common'
import type { ImageModelModule } from '../types'
import { createModelExample } from '../types'

export const qwenImageEditPlusModel: ImageModelModule = {
  id: 'Qwen-Image-Edit-Plus',
  displayName: 'Qwen Image Edit Plus',
  capability: {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'requires-image-upload',
    requiresReference: true,
    imageRequestMode: 'default',
  },
  adapter: {
    provider: 'qwen',
    models: ['Qwen-Image-Edit-Plus'],
    endpoint: '/images/generations',
    buildRequestBody: (params) => buildOpenAiImageRequestBody(params, 'Qwen-Image-Edit-Plus'),
  },
  example: createModelExample({
    title: 'Qwen 图片编辑示例',
    description: '上传一张图片后，使用 Qwen-Image-Edit-Plus 按提示词编辑图片。',
    request: {
      model: 'Qwen-Image-Edit-Plus',
      prompt: '保持主体不变，将背景替换为雪山日落，并增强电影感光影',
      image: 'data:image/png;base64,<BASE64_IMAGE>',
      size: '1024x1024',
      response_format: 'url',
    },
    code: `import { generateImage } from '@/api/aiping'

await generateImage({
  model: 'Qwen-Image-Edit-Plus',
  prompt: '保持主体不变，将背景替换为雪山日落，并增强电影感光影',
  image: 'data:image/png;base64,<BASE64_IMAGE>',
  size: '1024x1024',
  response_format: 'url',
})`,
  }),
}