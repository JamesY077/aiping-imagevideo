import type { UploadedFile } from '@/types/chat'

export interface ImageDimensions {
  width: number
  height: number
}

/** 把浏览器 File 包装成生成链路使用的 UploadedFile。 */
export function createUploadedFile(
  file: File,
  type: UploadedFile['type'],
  dimensions?: ImageDimensions,
): UploadedFile {
  return {
    name: file.name,
    type,
    url: URL.createObjectURL(file),
    size: file.size,
    file,
    dimensions,
  }
}

/** 释放 blob URL（远程图片与 dataURI 不处理）。 */
export function releaseUploadedFile(file: UploadedFile | null | undefined) {
  if (file?.file && file.url.startsWith('blob:')) {
    URL.revokeObjectURL(file.url)
  }
}

export function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  const [meta, base64] = dataUrl.split(',')
  const mime = type || meta.match(/data:([^;]+)/)?.[1] || 'image/png'
  const binary = atob(base64 || '')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new File([bytes], name, { type: mime })
}

/** 读取本地图片尺寸（用于扩图比例校验、结果尺寸标注）。 */
export function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const dimensions = {
        width: image.naturalWidth,
        height: image.naturalHeight,
      }
      URL.revokeObjectURL(objectUrl)
      if (!dimensions.width || !dimensions.height) {
        reject(new Error('无法读取图片尺寸'))
        return
      }
      resolve(dimensions)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('无法读取图片尺寸'))
    }
    image.src = objectUrl
  })
}

/** 已上传图片的尺寸：优先取缓存，其次从 File 读取并写回。 */
export async function resolveUploadedImageDimensions(
  uploadedFile: UploadedFile,
): Promise<ImageDimensions | null> {
  if (uploadedFile.dimensions) return uploadedFile.dimensions
  if (!uploadedFile.file) return null
  const dimensions = await getImageDimensions(uploadedFile.file)
  uploadedFile.dimensions = dimensions
  return dimensions
}
