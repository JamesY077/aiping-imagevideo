import { createViduProvider } from '@/api/providers/video/viduShared'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

export const viduQ3ProAliases = ['ViduQ3-Pro', 'viduq3-pro', 'viduQ3-pro']

export const viduQ3ProModel: VideoModelModule = {
  id: 'ViduQ3-Pro',
  displayName: 'Vidu Q3 Pro',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    videoRequestMode: 'viduq3-fast',
  },
  adapter: createViduProvider({
    canonicalModel: 'ViduQ3-Pro',
    aliases: viduQ3ProAliases,
    defaultTextAspectRatio: '4:3',
    defaultTextResolution: '1080p',
    defaultImageResolution: '1080p',
    textFallbackAspectRatios: ['4:3'],
    textFallbackResolutions: ['1080p'],
    imageFallbackFieldSets: [
      ['model', 'prompt', 'duration', 'images'],
      ['model', 'prompt', 'images', 'resolution'],
      ['model', 'prompt', 'images'],
    ],
  }),
  example: createModelExample({
    title: 'Vidu Q3 Pro 视频生成示例',
    description: '使用 ViduQ3-Pro 生成视频；文生视频默认使用 4:3 和 1080p。',
    request: {
      model: 'ViduQ3-Pro',
      prompt: '一条金色锦鲤跃出荷塘，水珠在阳光下闪闪发光，慢动作',
      duration: 5,
      aspect_ratio: '4:3',
      resolution: '1080p',
      movement_amplitude: 'auto',
      style: 'general',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'ViduQ3-Pro',
  prompt: '一条金色锦鲤跃出荷塘，水珠在阳光下闪闪发光，慢动作',
  duration: 5,
  aspect_ratio: '4:3',
  resolution: '1080p',
  movement_amplitude: 'auto',
  style: 'general',
})`,
  }),
}
