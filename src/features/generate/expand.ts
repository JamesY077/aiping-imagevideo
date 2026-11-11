import type { UploadedFile } from '@/types/chat'
import { canvasToBlob, loadUploadedImage } from '@/features/generate/imageSource'

/**
 * 扩图输出尺寸：Qwen-Image-2.0-Pro 支持 512*512 ~ 2048*2048，
 * 这里统一使用 2K 档位，尽量保留原图细节。
 */
const EXPAND_TARGET_SIZE_MAP: Record<string, { width: number; height: number }> = {
  '21:9': { width: 2048, height: 878 },
  '16:9': { width: 2048, height: 1152 },
  '3:2': { width: 2048, height: 1365 },
  '4:3': { width: 2048, height: 1536 },
  '1:1': { width: 2048, height: 2048 },
  '3:4': { width: 1536, height: 2048 },
  '2:3': { width: 1365, height: 2048 },
  '9:16': { width: 1152, height: 2048 },
}

export interface ExpandTargetSize {
  width: number
  height: number
  /** 请求图片接口时使用的 size 字符串，如 2048*1152。 */
  size: string
}

export function getExpandTargetSize(aspectRatio: string): ExpandTargetSize {
  const dimensions = EXPAND_TARGET_SIZE_MAP[aspectRatio] || EXPAND_TARGET_SIZE_MAP['1:1']
  return {
    ...dimensions,
    size: `${dimensions.width}*${dimensions.height}`,
  }
}

/**
 * 把原图放到目标比例的画布中央，四周用原图的模糊放大版本填充，
 * 作为 Qwen 图生图的输入。这样模型能看到完整的画面边界，而不是被裁切。
 */
export async function createExpandedUploadedFile(
  source: UploadedFile,
  aspectRatio: string,
): Promise<UploadedFile | null> {
  if (typeof document === 'undefined') return null

  let loaded: Awaited<ReturnType<typeof loadUploadedImage>> = null
  try {
    loaded = await loadUploadedImage(source)
    if (!loaded) return null

    const target = getExpandTargetSize(aspectRatio)
    const canvas = document.createElement('canvas')
    canvas.width = target.width
    canvas.height = target.height
    const context = canvas.getContext('2d')
    if (!context) return null

    const { image } = loaded
    const imageWidth = image.naturalWidth
    const imageHeight = image.naturalHeight

    // 背景：用原图铺满并模糊，给模型提供与边缘一致的颜色和氛围。
    const coverScale = Math.max(target.width / imageWidth, target.height / imageHeight) * 1.06
    const coverWidth = imageWidth * coverScale
    const coverHeight = imageHeight * coverScale
    context.fillStyle = '#11100e'
    context.fillRect(0, 0, target.width, target.height)
    context.save()
    context.filter = 'blur(28px)'
    context.globalAlpha = 0.98
    context.drawImage(
      image,
      (target.width - coverWidth) / 2,
      (target.height - coverHeight) / 2,
      coverWidth,
      coverHeight,
    )
    context.restore()

    // 前景：完整保留原图，等比缩放后居中；不裁切、不拉伸。
    const scale = Math.min(target.width / imageWidth, target.height / imageHeight)
    const drawWidth = imageWidth * scale
    const drawHeight = imageHeight * scale
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      (target.width - drawWidth) / 2,
      (target.height - drawHeight) / 2,
      drawWidth,
      drawHeight,
    )

    const blob = await canvasToBlob(canvas)
    if (!blob) return null

    const file = new File(
      [blob],
      `expand-${aspectRatio.replace(':', 'x')}-${Date.now()}.png`,
      { type: 'image/png' },
    )

    return {
      name: file.name,
      type: 'image',
      // 消息区仍展示用户原图；这里只把扩展后的文件交给生成接口。
      url: source.url,
      size: file.size,
      file,
      dimensions: { width: target.width, height: target.height },
    }
  } catch (error) {
    console.warn('[expand] 预扩画布生成失败，将降级为原图直接扩图。', error)
    return null
  } finally {
    loaded?.cleanup()
  }
}
