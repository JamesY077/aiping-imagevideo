import {
  buildMinimaxH3ImageRequestBody,
  buildMinimaxH3ImageRequest,
} from '@/api/providers/image/minimax'
import type { ImageModelModule } from '../types'
import { createModelExample } from '../types'

/**
 * MiniMax-H3-Image：开源 SOTA 图像生成与编辑模型。
 * - 文生图 / 图片编辑共用同一套模型能力；
 * - 支持最多 16 张参考图；
 * - 输出尺寸支持 2K（约 4MP）/ 4K（约 16MP）两档，4K 为官方推荐的最佳画质档位。
 */
export const minimaxH3ImageModel: ImageModelModule = {
  id: 'MiniMax-H3-Image',
  displayName: 'MiniMax H3 Image',
  capability: {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    imageRequestMode: 'minimax-h3-image',
    imageReferenceMode: 'multi',
    imageReferenceLimit: 16,
    // 2K 约 400 万像素；4K 为官方推荐的约 1600 万像素最佳画质档位。
    imageResolutions: ['2K', '4K'],
  },
  adapter: {
    provider: 'minimax-image',
    models: ['MiniMax-H3-Image'],
    endpoint: '/images/generations',
    buildRequestBody: (params) => buildMinimaxH3ImageRequestBody(params, 'MiniMax-H3-Image'),
    buildRequest: (params) => buildMinimaxH3ImageRequest(params, 'MiniMax-H3-Image'),
  },
  example: createModelExample({
    title: 'MiniMax-H3-Image 文生图示例',
    description: '使用 MiniMax-H3-Image 生成 16:9 图片（2K / 4K 可选），支持多参考图编辑。',
    request: {
      model: 'MiniMax-H3-Image',
      prompt: '一只橘猫趴在窗台上晒太阳，午后暖光，胶片质感',
      size: '2720x1536',
      n: 1,
      response_format: 'url',
    },
    code: `import { generateImage } from '@/api/aiping'

await generateImage({
  model: 'MiniMax-H3-Image',
  prompt: '一只橘猫趴在窗台上晒太阳，午后暖光，胶片质感',
  size: '2720x1536',
  n: 1,
  response_format: 'url',
})`,
  }),
}

/**
 * MiniMax-H3-Image-Highspeed：参数与标准版一致，出图速度更快。
 */
export const minimaxH3ImageHighspeedModel: ImageModelModule = {
  id: 'MiniMax-H3-Image-Highspeed',
  displayName: 'MiniMax H3 Image Highspeed',
  capability: {
    mediaType: 'image',
    inputs: ['text', 'image'],
    localUploadInputs: ['image'],
    availabilityNote: 'supports-image-upload',
    imageRequestMode: 'minimax-h3-image',
    imageReferenceMode: 'multi',
    imageReferenceLimit: 16,
    // 2K 约 400 万像素；4K 为官方推荐的约 1600 万像素最佳画质档位。
    imageResolutions: ['2K', '4K'],
  },
  adapter: {
    provider: 'minimax-image',
    models: ['MiniMax-H3-Image-Highspeed'],
    endpoint: '/images/generations',
    buildRequestBody: (params) =>
      buildMinimaxH3ImageRequestBody(params, 'MiniMax-H3-Image-Highspeed'),
    buildRequest: (params) =>
      buildMinimaxH3ImageRequest(params, 'MiniMax-H3-Image-Highspeed'),
  },
  example: createModelExample({
    title: 'MiniMax-H3-Image-Highspeed 文生图示例',
    description: '使用 MiniMax-H3-Image-Highspeed 快速生成图片（2K / 4K 可选），参数与标准版一致。',
    request: {
      model: 'MiniMax-H3-Image-Highspeed',
      prompt: '一只橘猫趴在窗台上晒太阳，午后暖光，胶片质感',
      size: '2720x1536',
      n: 1,
      response_format: 'url',
    },
    code: `import { generateImage } from '@/api/aiping'

await generateImage({
  model: 'MiniMax-H3-Image-Highspeed',
  prompt: '一只橘猫趴在窗台上晒太阳，午后暖光，胶片质感',
  size: '2720x1536',
  n: 1,
  response_format: 'url',
})`,
  }),
}
