export type ImageRequestMode = 'default' | 'jimeng-4' | 'seedream-5-lite'

const ASPECT_RATIO_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '16:9': { width: 1280, height: 720 },
  '3:2': { width: 1200, height: 800 },
  '4:3': { width: 1024, height: 768 },
  '1:1': { width: 1024, height: 1024 },
  '3:4': { width: 768, height: 1024 },
  '2:3': { width: 800, height: 1200 },
  '9:16': { width: 720, height: 1280 },
}

const VOLC_2K_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '16:9': { width: 2560, height: 1440 },
  '3:2': { width: 2496, height: 1664 },
  '4:3': { width: 2304, height: 1728 },
  '1:1': { width: 2048, height: 2048 },
  '3:4': { width: 1728, height: 2304 },
  '2:3': { width: 1664, height: 2496 },
  '9:16': { width: 1440, height: 2560 },
}

const SEEDREAM_5_LITE_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '16:9': { width: 2848, height: 1600 },
  '3:2': { width: 2496, height: 1664 },
  '4:3': { width: 2304, height: 1728 },
  '1:1': { width: 2048, height: 2048 },
  '3:4': { width: 1728, height: 2304 },
  '2:3': { width: 1664, height: 2496 },
  '9:16': { width: 1600, height: 2848 },
}

export function aspectRatioToDimensions(
  aspectRatio: string,
  mode: ImageRequestMode = 'default'
): { width: number; height: number } {
  if (mode === 'seedream-5-lite') {
    return SEEDREAM_5_LITE_SIZE_MAP[aspectRatio] || SEEDREAM_5_LITE_SIZE_MAP['1:1']
  }
  if (mode === 'jimeng-4') {
    return VOLC_2K_SIZE_MAP[aspectRatio] || VOLC_2K_SIZE_MAP['1:1']
  }
  return ASPECT_RATIO_SIZE_MAP[aspectRatio] || ASPECT_RATIO_SIZE_MAP['1:1']
}

export function aspectRatioToImageSize(
  aspectRatio: string,
  mode: ImageRequestMode = 'default',
  separator: '*' | 'x' = '*'
): string {
  const { width, height } = aspectRatioToDimensions(aspectRatio, mode)
  return `${width}${separator}${height}`
}

export function getKlingAspectRatio(aspectRatio: string): string {
  if (['16:9', '9:16', '1:1'].includes(aspectRatio)) return aspectRatio
  throw new Error('当前可灵视频模型仅支持 16:9、9:16、1:1，请切换比例或模型后重试。')
}
