import type { UploadedFile } from '@/types/chat'

/**
 * 浏览器端读取图片的通用工具。
 *
 * 生成结果通常是远程 URL，直接画进 Canvas 会污染画布导致无法导出；
 * 因此优先 fetch 成 Blob，服务端未开放 CORS 时再尝试匿名图片加载。
 */

export function loadImageElement(source: string, crossOrigin = false): Promise<HTMLImageElement> {
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

export interface LoadedImage {
  image: HTMLImageElement
  cleanup: () => void
}

export async function loadUploadedImage(source: UploadedFile): Promise<LoadedImage | null> {
  if (source.file) {
    const objectUrl = URL.createObjectURL(source.file)
    try {
      return {
        image: await loadImageElement(objectUrl),
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
      image: await loadImageElement(source.url),
      cleanup: () => {},
    }
  }

  try {
    const response = await fetch(source.url, { mode: 'cors', credentials: 'omit' })
    if (!response.ok) throw new Error(`图片下载失败：${response.status}`)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      return {
        image: await loadImageElement(objectUrl),
        cleanup: () => URL.revokeObjectURL(objectUrl),
      }
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  } catch {
    return {
      image: await loadImageElement(source.url, true),
      cleanup: () => {},
    }
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png'): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type)
  })
}
