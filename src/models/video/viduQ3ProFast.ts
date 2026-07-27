import { createViduProvider } from '@/api/providers/video/viduShared'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const viduQ3ProFastAliases = ['ViduQ3-Pro-Fast', 'viduq3-pro-fast', 'viduQ3-pro-fast']

export const viduQ3ProFastModel: VideoModelModule = {
  id: 'ViduQ3-Pro-Fast',
  displayName: 'Vidu Q3 Pro Fast',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    videoRequestMode: 'viduq3-fast',
  },
  adapter: createViduProvider({
    canonicalModel: 'viduq3-pro-fast',
    aliases: viduQ3ProFastAliases,
    defaultTextAspectRatio: '4:3',
    defaultTextResolution: '540p',
    defaultImageResolution: '1080p',
    textFallbackAspectRatios: ['4:3'],
    textFallbackResolutions: ['540p'],
    textFields: ['model', 'prompt', 'duration', 'aspect_ratio', 'resolution'],
    imageFields: ['model', 'prompt', 'duration', 'images', 'resolution'],
    enableSeed: false,
    enableStyle: false,
    enableMovementAmplitude: false,
    textFallbackFieldSets: [
      ['model', 'prompt', 'duration', 'aspect_ratio'],
      ['model', 'prompt', 'duration', 'resolution'],
      ['model', 'prompt', 'aspect_ratio', 'resolution'],
      ['model', 'prompt', 'duration'],
      ['model', 'prompt', 'aspect_ratio'],
      ['model', 'prompt'],
    ],
    imageFallbackFieldSets: [
      ['model', 'prompt', 'duration', 'images'],
      ['model', 'prompt', 'images', 'resolution'],
      ['model', 'prompt', 'images'],
    ],
  }),
  example: createModelExample({
    title: 'Vidu Q3 Pro Fast 视频生成示例',
    description: '使用 ViduQ3-Pro-Fast 快速生成 5 秒视频；传入 images 可切换为图生视频。',
    request: {
      model: 'ViduQ3-Pro-Fast',
      prompt: '一位宇航员在月球表面弹吉他，地球在远处升起，梦幻电影感',
      duration: 5,
      aspect_ratio: '4:3',
      resolution: '540p',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'ViduQ3-Pro-Fast',
  prompt: '一位宇航员在月球表面弹吉他，地球在远处升起，梦幻电影感',
  duration: 5,
  aspect_ratio: '4:3',
  resolution: '540p',
})`,
  }),
}