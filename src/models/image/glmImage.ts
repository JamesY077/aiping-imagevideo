import { buildOpenAiImageRequestBody } from '@/api/providers/image/common'
import type { ImageModelModule } from '../types'
import { createModelExample } from '../types'

export const glmImageModel: ImageModelModule = {
  id: 'GLM-Image',
  displayName: 'GLM Image',
  capability: {
    mediaType: 'image',
    inputs: ['text'],
    imageRequestMode: 'default',
  },
  adapter: {
    provider: 'glm',
    models: ['GLM-Image'],
    endpoint: '/images/generations',
    buildRequestBody: (params) => buildOpenAiImageRequestBody(params, 'GLM-Image'),
  },
  example: createModelExample({
    title: 'GLM 文生图示例',
    description: '使用 GLM-Image 根据文本提示词生成图片。',
    request: {
      model: 'GLM-Image',
      prompt: '赛博朋克风格的未来上海街头，霓虹灯，雨夜，广角镜头',
      size: '1024x1024',
      response_format: 'url',
    },
    code: `import { generateImage } from '@/api/aiping'

await generateImage({
  model: 'GLM-Image',
  prompt: '赛博朋克风格的未来上海街头，霓虹灯，雨夜，广角镜头',
  size: '1024x1024',
  response_format: 'url',
})`,
  }),
}