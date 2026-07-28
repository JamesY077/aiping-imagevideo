import { buildOpenAiVideoRequestBody, normalizeOpenAiVideoGenerateResponse } from '@/api/providers/video/common'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const minimaxHailuo23Aliases = ['MiniMax-Hailuo-2.3']
export const minimaxHailuoStartEndAliases = ['MiniMax-Hailuo-02']
export const minimaxS2VAliases = ['S2V-01']

function buildMinimaxVideoRequestBody(params: Parameters<typeof buildOpenAiVideoRequestBody>[0]) {
  const body = buildOpenAiVideoRequestBody(params, 'MiniMax-Hailuo-2.3')

  delete body.aspect_ratio
  delete body.ratio
  body.duration = Number(body.duration || body.seconds || 6)
  body.resolution = String(body.resolution || body.size || '1080P').toUpperCase()
  delete body.seconds
  delete body.size
  if (body.last_frame_image) {
    body.model = 'MiniMax-Hailuo-02'
  }
  if (body.subject_reference) {
    body.model = 'S2V-01'
    delete body.duration
    delete body.resolution
  }

  return body
}

export const minimaxHailuo23Model: VideoModelModule = {
  id: 'MiniMax-Hailuo-2.3',
  displayName: 'MiniMax Hailuo 2.3',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    videoRequestMode: 'minimax-hailuo',
  },
  adapter: {
    provider: 'minimax',
    models: [...minimaxHailuo23Aliases, ...minimaxHailuoStartEndAliases, ...minimaxS2VAliases],
    buildRequestBody: buildMinimaxVideoRequestBody,
    getEndpoint: () => '/video_generation',
    normalizeResponse: normalizeOpenAiVideoGenerateResponse,
  },
  example: createModelExample({
    title: 'MiniMax 海螺文生视频示例',
    description: '使用 MiniMax-Hailuo-2.3 根据文本提示词生成视频。',
    request: {
      model: 'MiniMax-Hailuo-2.3',
      prompt: '一个温暖的咖啡馆清晨，阳光穿过窗户，咖啡蒸汽缓慢升起',
      seconds: 6,
      size: '1080P',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'MiniMax-Hailuo-2.3',
  prompt: '一个温暖的咖啡馆清晨，阳光穿过窗户，咖啡蒸汽缓慢升起',
  seconds: 6,
  size: '1080P',
})`,
  }),
}