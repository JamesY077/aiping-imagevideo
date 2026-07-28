import { buildOpenAiVideoRequestBody, normalizeOpenAiVideoGenerateResponse } from '@/api/providers/video/common'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const klingV3OmniModel: VideoModelModule = {
  id: 'Kling-V3-Omni',
  displayName: 'Kling V3 Omni',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    videoRequestMode: 'kling-v3',
  },
  adapter: {
    provider: 'kling',
    models: ['Kling-V3-Omni'],
    buildRequestBody: (params) => buildOpenAiVideoRequestBody(params, 'Kling-V3-Omni'),
    getEndpoint: () => '/videos',
    normalizeResponse: normalizeOpenAiVideoGenerateResponse,
  },
  example: createModelExample({
    title: 'Kling V3 Omni 视频生成示例',
    description: '使用 Kling-V3-Omni 进行文生视频，也可传入 image 做图生视频。',
    request: {
      model: 'Kling-V3-Omni',
      prompt: '一只机械蝴蝶从花丛中飞起，微距摄影，浅景深',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '1080p',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'Kling-V3-Omni',
  prompt: '一只机械蝴蝶从花丛中飞起，微距摄影，浅景深',
  duration: 5,
  aspect_ratio: '16:9',
  resolution: '1080p',
})`,
  }),
}