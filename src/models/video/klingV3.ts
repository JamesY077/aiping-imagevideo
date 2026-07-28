import {
  buildKlingMultimodalVideoRequestBody,
  getKlingMultimodalVideoEndpoint,
  normalizeKlingMultimodalVideoGenerateResponse,
} from '@/api/providers/video/common'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const klingV3Model: VideoModelModule = {
  id: 'Kling-V3',
  displayName: 'Kling V3',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image', 'video'],
    localUploadInputs: ['image', 'video'],
    availabilityNote: 'supports-image-video-upload',
    videoRequestMode: 'kling-v3',
  },
  adapter: {
    provider: 'kling',
    models: ['Kling-V3'],
    buildRequestBody: (params) => buildKlingMultimodalVideoRequestBody(params, 'Kling-V3'),
    getEndpoint: getKlingMultimodalVideoEndpoint,
    normalizeResponse: normalizeKlingMultimodalVideoGenerateResponse,
  },
  example: createModelExample({
    title: 'Kling V3 视频生成示例',
    description: '使用 Kling-V3 生成 5 秒视频，支持文生视频和图生视频。',
    request: {
      model: 'Kling-V3',
      prompt: '无人机航拍穿越峡谷，清晨阳光照亮河流，史诗感',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '1080p',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'Kling-V3',
  prompt: '无人机航拍穿越峡谷，清晨阳光照亮河流，史诗感',
  duration: 5,
  aspect_ratio: '16:9',
  resolution: '1080p',
})`,
  }),
}