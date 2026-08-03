import {
  buildKlingOmniVideoRequestBody,
  getKlingOmniVideoEndpoint,
  normalizeKlingOmniVideoGenerateResponse,
} from '@/api/providers/video/common'

import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const klingVideoO1Model: VideoModelModule = {
  id: 'Kling-Video-O1',
  displayName: 'Kling Video O1',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    videoRequestMode: 'kling-omni',
  },
  adapter: {
    provider: 'kling',
    models: ['Kling-Video-O1'],
    buildRequestBody: (params) => buildKlingOmniVideoRequestBody(params, 'Kling-Video-O1'),
    getEndpoint: getKlingOmniVideoEndpoint,
    normalizeResponse: normalizeKlingOmniVideoGenerateResponse,

  },
  example: createModelExample({
    title: 'Kling O1 Omni 视频生成示例',
    description: 'Kling-Video-O1 使用 omni-video 接口，支持文本和图片参考输入生成视频。',
    request: {
      model_name: 'Kling-Video-O1',
      prompt: '让<<<image_1>>>中的人物向镜头挥手',
      image_list: [
        {
          image_url: 'https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/multi-1.png',
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
  model_name: 'Kling-Video-O1',
  prompt: '让<<<image_1>>>中的人物向镜头挥手',
  image_list: [
    {
      image_url: 'https://p2-kling.klingai.com/kcdn/cdn-kcdn112452/kling-qa-test/multi-1.png',
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