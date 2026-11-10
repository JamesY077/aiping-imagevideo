import type { ImageModelModule } from '../types'
import { createModelExample } from '../types'
import { buildMossImageRequestBody } from '@/api/providers/image/moss'

/**
 * Moss-Image-SFT：仅支持文生图（不支持参考图 / 一次多张）。
 * 批量生成由 useGenerate 的并发单张请求补齐，不使用 OpenAI 的 n 参数。
 */
export const mossImageSftModel: ImageModelModule = {
  id: 'Moss-Image-SFT',
  displayName: 'Moss Image SFT',
  capability: {
    mediaType: 'image',
    inputs: ['text'],
    imageRequestMode: 'moss',
  },
  adapter: {
    provider: 'moss',
    models: ['Moss-Image-SFT'],
    endpoint: '/images/generations',
    buildRequestBody: (params) => buildMossImageRequestBody(params),
  },
  example: createModelExample({
    title: 'Moss Image 文生图示例',
    description: '使用 Moss-Image-SFT 根据文本提示词生成图片；该模型仅支持文生图，不支持参考图。',
    request: {
      model: 'Moss-Image-SFT',
      prompt: '一个宇航员在都市街头漫步，电影级光影，超清细节',
      size: '1024x1024',
      response_format: 'url',
    },
    code: `import { generateImage } from '@/api/aiping'

await generateImage({
  model: 'Moss-Image-SFT',
  prompt: '一个宇航员在都市街头漫步，电影级光影，超清细节',
  size: '1024x1024',
  response_format: 'url',
})`,
  }),
}
