import {
  buildKlingOmniVideoRequestBody,
  getKlingOmniVideoEndpoint,
  normalizeKlingMultimodalVideoGenerateResponse,
} from '@/api/providers/video/common'
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
    videoRequestMode: 'kling-omni',
  },
  adapter: {
    provider: 'kling',
    models: ['Kling-V3-Omni'],
    buildRequestBody: (params) => buildKlingOmniVideoRequestBody(params, 'Kling-V3-Omni'),
    getEndpoint: getKlingOmniVideoEndpoint,
    normalizeResponse: normalizeKlingMultimodalVideoGenerateResponse,
  },
  example: createModelExample({
    title: 'Kling V3 Omni 视频生成示例',
    description: '使用 Kling-V3-Omni 进行文生视频，也可传入 image 做图生视频。',
    request: {
      model_name: 'Kling-V3-Omni',
      prompt: '让<<<image_1>>>中的机械蝴蝶从花丛中飞起，微距摄影，浅景深',
      image_list: [
        {
          image_url: 'https://example.com/reference.png',
        },
      ],
      duration: 5,
      mode: 'pro',
      aspect_ratio: '16:9',
      callback_url: '',
      external_task_id: '',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model_name: 'Kling-V3-Omni',
  prompt: '让<<<image_1>>>中的机械蝴蝶从花丛中飞起，微距摄影，浅景深',
  image_list: [
    {
      image_url: 'https://example.com/reference.png',
    },
  ],
  duration: 5,
  mode: 'pro',
  aspect_ratio: '16:9',
  callback_url: '',
  external_task_id: '',
})`,
  }),
}