import { buildOpenAiVideoRequestBody, normalizeOpenAiVideoGenerateResponse } from '@/api/providers/video/common'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const klingV3Model: VideoModelModule = {
  id: 'Kling-V3',
  displayName: 'Kling V3',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    videoRequestMode: 'kling-v3',
  },
  adapter: {
    provider: 'kling',
    models: ['Kling-V3'],
    buildRequestBody: (params) => buildOpenAiVideoRequestBody(params, 'Kling-V3'),
    getEndpoint: () => '/videos',
    normalizeResponse: normalizeOpenAiVideoGenerateResponse,
  },
  example: createModelExample({
    title: 'Kling V3 视频生成示例',
    description: '使用 Kling-V3 生成 5 秒视频，支持文生视频和图生视频。',
    request: {
      model: 'Kling-V3',
      prompt: '无人机航拍穿越峡谷，清晨阳光照亮河流，史诗感',
      duration: 5,
      aspect_ratio: '16:9',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'Kling-V3',
  prompt: '无人机航拍穿越峡谷，清晨阳光照亮河流，史诗感',
  duration: 5,
  aspect_ratio: '16:9',
})`,
  }),
}