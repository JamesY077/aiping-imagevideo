import type { UploadedFile } from '@/types/chat'
import type { MossLayout, MossLayoutItem } from '@/types/layout'
import { isBackgroundLayer } from './mossLayout'
import { canvasToBlob, loadUploadedImage } from '@/features/generate/imageSource'

/** 画布合成长边上限：既能保留足够细节，又避免请求体过大。 */
const COMPOSE_MAX_SIDE = 2048

export function getAssetLayers(layout: MossLayout): MossLayoutItem[] {
  return layout.items.filter((item) => !isBackgroundLayer(item) && !!item.assetUrl)
}

export function hasAssetLayers(layout: MossLayout): boolean {
  return getAssetLayers(layout).length > 0
}

/** 把素材图层转成可直接下发给多图参考模型的 UploadedFile。 */
export function assetLayerToUploadedFile(item: MossLayoutItem, index: number): UploadedFile {
  return {
    name: item.assetFile?.name || `图层素材-${index + 1}.png`,
    type: 'image',
    url: item.assetUrl || '',
    size: item.assetFile?.size || 0,
    file: item.assetFile,
  }
}

/**
 * 把底图与所有素材图层按 bbox 合成成一张图片。
 *
 * 用于单图输入模型（如图层编辑时的 Seedream）：模型拿到的参考图里，
 * 素材已经出现在用户拖拽的位置，因此布局还原度更高；
 * 提示词里会要求保留素材外观并自然融合。
 */
export async function composeLayoutWithAssets(
  base: UploadedFile,
  layout: MossLayout,
): Promise<UploadedFile | null> {
  const assetLayers = getAssetLayers(layout)
  if (!assetLayers.length) return null
  if (typeof document === 'undefined') return null

  let baseLoaded: Awaited<ReturnType<typeof loadUploadedImage>> = null
  try {
    baseLoaded = await loadUploadedImage(base)
    if (!baseLoaded) return null

    const longestSide = Math.max(layout.width, layout.height)
    const scale = Math.min(1, COMPOSE_MAX_SIDE / longestSide)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(layout.width * scale))
    canvas.height = Math.max(1, Math.round(layout.height * scale))

    const context = canvas.getContext('2d')
    if (!context) return null
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'

    // 底图铺满整个画布（布局尺寸与底图原始尺寸一致）。
    context.drawImage(baseLoaded.image, 0, 0, canvas.width, canvas.height)

    for (const item of assetLayers) {
      if (!item.assetUrl) continue
      let loaded: Awaited<ReturnType<typeof loadUploadedImage>> = null
      try {
        loaded = await loadUploadedImage({
          name: item.assetFile?.name || 'layer-asset',
          type: 'image',
          url: item.assetUrl,
          size: item.assetFile?.size || 0,
          file: item.assetFile,
        })
        if (!loaded) continue

        const boxX = item.x * scale
        const boxY = item.y * scale
        const boxWidth = Math.max(1, item.width * scale)
        const boxHeight = Math.max(1, item.height * scale)
        const imageWidth = loaded.image.naturalWidth
        const imageHeight = loaded.image.naturalHeight
        if (!imageWidth || !imageHeight) continue

        // 等比缩放到图层框内，完整保留素材内容，不裁切、不拉伸。
        const fit = Math.min(boxWidth / imageWidth, boxHeight / imageHeight)
        const drawWidth = imageWidth * fit
        const drawHeight = imageHeight * fit
        const drawX = boxX + (boxWidth - drawWidth) / 2
        const drawY = boxY + (boxHeight - drawHeight) / 2

        context.drawImage(loaded.image, drawX, drawY, drawWidth, drawHeight)
      } finally {
        loaded?.cleanup()
      }
    }

    const blob = await canvasToBlob(canvas)
    if (!blob) return null

    const file = new File([blob], `layer-composed-${Date.now()}.png`, { type: 'image/png' })
    return {
      name: file.name,
      type: 'image',
      // 聊天区仍展示用户原图；这里只把合成结果交给生成接口。
      url: base.url,
      size: file.size,
      file,
      dimensions: { width: canvas.width, height: canvas.height },
    }
  } catch (error) {
    console.warn('[layerCompose] 素材图层合成失败', error)
    throw new Error('素材图层合成失败：底图或素材存在跨域限制，请换用支持多图参考的模型，或重新上传底图后再试。')
  } finally {
    baseLoaded?.cleanup()
  }
}
