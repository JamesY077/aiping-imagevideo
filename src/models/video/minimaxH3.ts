import { createMinimaxH3Provider } from '@/api/providers/video/minimaxH3Shared'
import type { VideoModelModule } from '../types'
import { createModelExample } from '../types'

/**
 * MiniMax-H3：海螺最新一代多模态视频模型。
 * - 走 /multimodal/minimax/videos/video_generation，content 数组协议。
 * - 支持文生视频、图生视频（首帧/尾帧/首尾帧）与多模态参考（参考图/参考视频/参考音频）。
 * - resolution 可选 768P / 2K；duration 4-15 秒。
 */
export const minimaxH3Model: VideoModelModule = {
  id: 'MiniMax-H3',
  displayName: 'MiniMax H3',
  capability: {
    mediaType: 'video',
    inputs: ['text', 'image', 'video', 'audio'],
    localUploadInputs: ['image', 'video', 'audio'],
    availabilityNote: 'supports-multimodal-upload',
    videoRequestMode: 'minimax-h3',
  },
  adapter: createMinimaxH3Provider(),
  example: createModelExample({
    title: 'MiniMax-H3 视频生成示例',
    description: '使用 MiniMax-H3 生成视频；传入首帧图片可切换为图生视频，支持首尾帧与多模态参考。',
    request: {
      model: 'MiniMax-H3',
      prompt: '镜头缓慢推近，画面中的主体开始自然运动',
      duration: 5,
      aspect_ratio: '16:9',
      resolution: '768P',
    },
    code: `import { generateVideo } from '@/api/aiping'

await generateVideo({
  model: 'MiniMax-H3',
  prompt: '镜头缓慢推近，画面中的主体开始自然运动',
  duration: 5,
  aspect_ratio: '16:9',
  resolution: '768P',
})`,
  }),
}
