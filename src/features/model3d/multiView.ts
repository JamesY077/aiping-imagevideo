/**
 * 多视角输入的本地归一化。
 *
 * 上游对多视角图片的一致性比较敏感：尺寸差异过大时同步校验会直接拒绝请求（400），
 * 四张手机原图也会让请求体膨胀到 5MB 以上、上传耗时明显。
 * 这里统一做三件事：
 *   1. 所有视角缩放到同一尺寸（最长边 1024，等比缩放后居中补白）；
 *   2. 统一重编码为 JPEG，显著缩小请求体；
 *   3. 尺寸与体积都已经合适时保持原图，避免无意义的质量损失。
 */

import type { MeshViewInput } from '@/api/model3d'

const VIEW_MAX_SIDE = 1024
const VIEW_JPEG_QUALITY = 0.88
/** 单张图片低于这个体积、且四个视角尺寸一致时，不再重编码。 */
const VIEW_BYTES_BUDGET = 600 * 1024

type ViewKey = keyof MeshViewInput
type LoadedView = { key: ViewKey; source: string; image: HTMLImageElement | null }
type ResolvedView = LoadedView & { image: HTMLImageElement }

const VIEW_ORDER: ViewKey[] = ['front', 'left', 'back', 'right']

function loadImage(source: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image.naturalWidth && image.naturalHeight ? image : null)
    image.onerror = () => resolve(null)
    image.src = source
  })
}

function dataUriBytes(dataUri: string): number {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.round((base64.length * 3) / 4) - padding
}

function isJpeg(dataUri: string): boolean {
  return dataUri.startsWith('data:image/jpeg')
}

function drawToJpeg(image: HTMLImageElement, width: number, height: number): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null

  // 白底：透明 PNG 直接转 JPEG 会变黑，补白更接近原图观感。
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)

  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale
  const drawHeight = image.naturalHeight * scale
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
  return canvas.toDataURL('image/jpeg', VIEW_JPEG_QUALITY)
}

export async function normalizeMultiViewImages(input: MeshViewInput): Promise<MeshViewInput> {
  const entries = VIEW_ORDER.filter((key) => Boolean(input[key])).map((key) => ({ key, source: input[key] as string }))
  if (!entries.length) return input

  const loaded: LoadedView[] = await Promise.all(
    entries.map(async (entry) => ({ key: entry.key, source: entry.source, image: await loadImage(entry.source) })),
  )
  const usable = loaded.filter((entry): entry is ResolvedView => Boolean(entry.image))
  if (!usable.length) return input

  const largestWidth = Math.max(...usable.map((entry) => entry.image.naturalWidth))
  const largestHeight = Math.max(...usable.map((entry) => entry.image.naturalHeight))
  const scale = Math.min(1, VIEW_MAX_SIDE / Math.max(largestWidth, largestHeight))
  const targetWidth = Math.max(2, Math.round(largestWidth * scale))
  const targetHeight = Math.max(2, Math.round(largestHeight * scale))

  const uniform =
    usable.length === entries.length &&
    usable.every(
      (entry) =>
        entry.image.naturalWidth === targetWidth &&
        entry.image.naturalHeight === targetHeight &&
        isJpeg(entry.source) &&
        dataUriBytes(entry.source) <= VIEW_BYTES_BUDGET,
    )
  if (uniform) return input

  const normalized: MeshViewInput = { ...input }
  usable.forEach((entry) => {
    normalized[entry.key] = drawToJpeg(entry.image, targetWidth, targetHeight) || entry.source
  })
  return normalized
}
