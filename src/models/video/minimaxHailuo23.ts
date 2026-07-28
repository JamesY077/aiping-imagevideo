import { buildOpenAiVideoRequestBody, normalizeOpenAiVideoGenerateResponse } from '@/api/providers/video/common'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const minimaxHailuo23Model: VideoModelModule = {
  id: 'MiniMax-Hailuo-2.3',
  displayName: 'MiniMax Hailuo 2.3',
  capability: {
    mediaType: 'video',
    inputs: ['text'],
  },
  adapter: {
    provider: 'minimax',
    models: ['MiniMax-Hailuo-2.3'],
    buildRequestBody: (params) => buildOpenAiVideoRequestBody(params, 'MiniMax-Hailuo-2.3'),
    getEndpoint: () => '/videos',
    normalizeResponse: normalizeOpenAiVideoGenerateResponse,
  },
  example: createModelExample({
    title: 'MiniMax 海螺文生视频示例',
    description: '使用 MiniMax-Hailuo-2.3 根据文本提示词生成视频。',
    request: {
      model: 'MiniMax-Hailuo-2.3',
      prompt: '一个温暖的咖啡馆清晨，阳光穿过窗户，咖啡蒸汽缓慢升起',
      duration: 6,
      resolution: '1080p',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'MiniMax-Hailuo-2.3',
  prompt: '一个温暖的咖啡馆清晨，阳光穿过窗户，咖啡蒸汽缓慢升起',
  duration: 6,
  resolution: '1080p',
})`,
  }),
}