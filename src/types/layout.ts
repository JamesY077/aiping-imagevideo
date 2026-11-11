/**
 * Moss-Image 原生 Layout（布局）描述。
 *
 * 模型要求把布局 JSON 作为 prompt 传入，bbox 使用「画布中心为原点」的
 * `[y_min, x_min, y_max, x_max]` 绝对像素坐标；UI 侧统一使用更直观的
 * 左上角原点 `x / y / width / height`，在生成请求前再做一次转换。
 */

export type MossLayoutLabel = 'object' | 'character' | 'text'

export interface MossLayoutItem {
  /** 仅前端使用的稳定 id，不会下发给模型。 */
  id: string
  label: MossLayoutLabel
  /** 元素的英文视觉描述（外观、颜色、材质、字体样式等）。 */
  caption: string
  /** 仅 text 元素使用：要渲染的原文。 */
  text?: string
  /**
   * 背景/底图层：整张参考图铺满画布，位置固定，生成时作为底图。
   * 通用图片模型没有原生分层能力时，用它承载上传的参考图。
   */
  role?: 'background'
  /** 左上角原点坐标与尺寸，单位为目标画布像素。 */
  x: number
  y: number
  width: number
  height: number
}

export interface MossLayoutSummary {
  caption: string
  meta?: string[]
  canvas?: 'single' | 'multi_panel' | 'collage'
}

export interface MossLayout {
  /** 目标画布尺寸，bbox 坐标基于该尺寸。 */
  width: number
  height: number
  /** 生成时的比例，重新生成时沿用。 */
  aspectRatio: string
  summary: MossLayoutSummary
  items: MossLayoutItem[]
}
