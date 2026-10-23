import type { UploadedFile } from '@/types/chat'

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

function loadImage(source: string, crossOrigin = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    if (crossOrigin) image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        reject(new Error('图片尺寸为空'))
        return
      }
      resolve(image)
    }
    image.onerror = () => reject(new Error('图片读取失败'))
    image.src = source
  })
}

async function loadSourceImage(source: UploadedFile): Promise<{ image: HTMLImageElement; cleanup: () => void } | null> {
  if (source.file) {
    const objectUrl = URL.createObjectURL(source.file)
    try {
      return {
        image: await loadImage(objectUrl),
        cleanup: () => URL.revokeObjectURL(objectUrl),
      }
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  }

  if (!source.url) return null

  const isLocalUrl = source.url.startsWith('blob:') || source.url.startsWith('data:')
  if (isLocalUrl) {
    return {
      image: await loadImage(source.url),
      cleanup: () => {},
    }
  }

  // 生成结果通常是远程 URL。优先 fetch 成 Blob，避免 Canvas 被跨域污染；
  // 若服务端未开放 CORS，则尝试匿名图片加载，失败时由调用方降级为原图直传。
  try {
    const response = await fetch(source.url, { mode: 'cors', credentials: 'omit' })
    if (!response.ok) throw new Error(`图片下载失败：${response.status}`)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      return {
        image: await loadImage(objectUrl),
        cleanup: () => URL.revokeObjectURL(objectUrl),
      }
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  } catch {
    return {
      image: await loadImage(source.url, true),
      cleanup: () => {},
    }
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png')
  })
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

  let loaded: Awaited<ReturnType<typeof loadSourceImage>> = null
  try {
    loaded = await loadSourceImage(source)
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
