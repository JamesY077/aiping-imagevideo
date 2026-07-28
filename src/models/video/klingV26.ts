import { buildOpenAiVideoRequestBody, normalizeOpenAiVideoGenerateResponse } from '@/api/providers/video/common'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const klingV26Model: VideoModelModule = {
  id: 'Kling-V2.6',
  displayName: 'Kling V2.6',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    videoRequestMode: 'kling-v26',
  },
  adapter: {
    provider: 'kling',
    models: ['Kling-V2.6'],
    buildRequestBody: (params) => buildOpenAiVideoRequestBody(params, 'Kling-V2.6'),
    getEndpoint: () => '/videos',
    normalizeResponse: normalizeOpenAiVideoGenerateResponse,
  },
  example: createModelExample({
    title: 'Kling V2.6 视频生成示例',
    description: '使用 Kling-V2.6 生成视频，默认支持 5s/10s。',
    request: {
      model: 'Kling-V2.6',
      prompt: '水墨风山水画动起来，云雾流动，仙鹤飞过远山',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '1080p',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'Kling-V2.6',
  prompt: '水墨风山水画动起来，云雾流动，仙鹤飞过远山',
  duration: 5,
  aspect_ratio: '16:9',
  resolution: '1080p',
})`,
  }),
}