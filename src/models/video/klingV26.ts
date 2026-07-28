import {
  buildKlingMultimodalVideoRequestBody,
  getKlingMultimodalVideoEndpoint,
  normalizeKlingMultimodalVideoGenerateResponse,
} from '@/api/providers/video/common'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const klingV26Model: VideoModelModule = {
  id: 'Kling-V2.6',
  displayName: 'Kling V2.6',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image', 'video'],
    localUploadInputs: ['image', 'video'],
    availabilityNote: 'supports-image-video-upload',
    videoRequestMode: 'kling-v26',
  },
  adapter: {
    provider: 'kling',
    models: ['Kling-V2.6'],
    buildRequestBody: (params) => buildKlingMultimodalVideoRequestBody(params, 'Kling-V2.6'),
    getEndpoint: getKlingMultimodalVideoEndpoint,
    normalizeResponse: normalizeKlingMultimodalVideoGenerateResponse,
  },
  example: createModelExample({
    title: 'Kling V2.6 视频生成示例',
    description: '使用 Kling-V2.6 生成视频，默认支持 5s/10s。',
    request: {
      model_name: 'Kling-V2.6',
      prompt: '水墨风山水画动起来，云雾流动，仙鹤飞过远山',
      negative_prompt: '',
      duration: 5,
      mode: 'pro',
      sound: 'on',
      aspect_ratio: '16:9',
      callback_url: '',
      external_task_id: '',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model_name: 'Kling-V2.6',
  prompt: '水墨风山水画动起来，云雾流动，仙鹤飞过远山',
  negative_prompt: '',
  duration: 5,
  mode: 'pro',
  sound: 'on',
  aspect_ratio: '16:9',
  callback_url: '',
  external_task_id: '',
})`,
  }),
}