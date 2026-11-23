import {
  buildKlingV4RequestBody,
  getKlingV4Endpoint,
  normalizeKlingV4VideoGenerateResponse,
} from '@/api/providers/video/klingV4Shared'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

/**
 * 可灵 4.0：AIPing 新版视频接口。
 * - 720p / 1080p，时长 3-30s，支持文生、图生（首/尾帧）与全能参考（多图）。
 * - 走 /multimodal/kling/{text-to-video|image-to-video|omni-video}/Kling-4.0。
 */
export const klingV4Model: VideoModelModule = {
  id: 'Kling-4.0',
  displayName: 'Kling 4.0',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    videoRequestMode: 'kling-v4',
    videoDurations: [5, 10, 15, 20, 30],
    videoResolutions: ['720p', '1080p'],
  },
  adapter: {
    provider: 'kling-v4',
    models: ['Kling-4.0'],
    buildRequestBody: (params) => buildKlingV4RequestBody(params, 'Kling-4.0'),
    getEndpoint: (body) => getKlingV4Endpoint(body, 'Kling-4.0'),
    normalizeResponse: normalizeKlingV4VideoGenerateResponse,
  },
  example: createModelExample({
    title: 'Kling 4.0 视频生成示例',
    description: '使用 Kling-4.0 生成 5 秒视频，支持文生视频与多关键帧图生视频。',
    request: {
      model: 'Kling-4.0',
      prompt: '一只金色机械蝴蝶从花丛中飞起，微距镜头，浅景深，晨光',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '1080p',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'Kling-4.0',
  prompt: '一只金色机械蝴蝶从花丛中飞起，微距镜头，浅景深，晨光',
  duration: 5,
  aspect_ratio: '16:9',
  resolution: '1080p',
})`,
  }),
}

/**
 * 可灵 4.0 Flash：轻量版。
 * - 仅 720p，时长 3-20s；图生视频只支持首帧。
 * - 走同一套新版接口，/multimodal/kling/image-to-video/Kling-4.0-Flash。
 */
export const klingV4FlashModel: VideoModelModule = {
  id: 'Kling-4.0-Flash',
  displayName: 'Kling 4.0 Flash',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    videoRequestMode: 'kling-v4',
    videoDurations: [5, 10, 15, 20],
    videoResolutions: ['720p'],
  },
  adapter: {
    provider: 'kling-v4',
    models: ['Kling-4.0-Flash'],
    buildRequestBody: (params) => buildKlingV4RequestBody(params, 'Kling-4.0-Flash'),
    getEndpoint: (body) => getKlingV4Endpoint(body, 'Kling-4.0-Flash'),
    normalizeResponse: normalizeKlingV4VideoGenerateResponse,
  },
  example: createModelExample({
    title: 'Kling 4.0 Flash 视频生成示例',
    description: '使用 Kling-4.0-Flash 生成 5 秒 720p 视频，适合高频、低成本的快速出片。',
    request: {
      model: 'Kling-4.0-Flash',
      prompt: '镜头缓慢推近，咖啡杯上的热气在晨光中缓缓升起',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '720p',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'Kling-4.0-Flash',
  prompt: '镜头缓慢推近，咖啡杯上的热气在晨光中缓缓升起',
  duration: 5,
  aspect_ratio: '16:9',
  resolution: '720p',
})`,
  }),
}
