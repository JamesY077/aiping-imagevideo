import { buildOpenAiVideoRequestBody, normalizeOpenAiVideoGenerateResponse } from '@/api/providers/video/common'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const klingVideoO1Model: VideoModelModule = {
  id: 'Kling-Video-O1',
  displayName: 'Kling Video O1',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image', 'video'],
    localUploadInputs: ['image', 'video'],
    availabilityNote: 'supports-image-video-upload',
    videoRequestMode: 'kling-o1',
  },
  adapter: {
    provider: 'kling',
    models: ['Kling-Video-O1'],
    buildRequestBody: (params) => buildOpenAiVideoRequestBody(params, 'Kling-Video-O1'),
    getEndpoint: () => '/videos',
    normalizeResponse: normalizeOpenAiVideoGenerateResponse,
  },
  example: createModelExample({
    title: 'Kling O1 文生/图生/视频参考示例',
    description: 'Kling-Video-O1 支持文本、图片和视频参考输入生成视频。',
    request: {
      model: 'Kling-Video-O1',
      prompt: '镜头缓慢推进，一辆复古跑车穿过雨夜霓虹街道，电影感',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '1080p',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'Kling-Video-O1',
  prompt: '镜头缓慢推进，一辆复古跑车穿过雨夜霓虹街道，电影感',
  duration: 5,
  aspect_ratio: '16:9',
  resolution: '1080p',
})`,
  }),
}