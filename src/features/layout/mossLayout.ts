import type { MossLayout, MossLayoutItem, MossLayoutLabel, MossLayoutSummary } from '@/types/layout'
import { getModelCapability } from '@/types/model'

/** AI Ping 侧 prompt 上限 4000 字符，布局 JSON 也受同一限制。 */
export const MOSS_LAYOUT_PROMPT_LIMIT = 4000

/** 单个元素描述与整图描述的软上限，避免 JSON 超长。 */
export const MOSS_LAYOUT_CAPTION_LIMIT = 220
export const MOSS_LAYOUT_SUMMARY_LIMIT = 600
export const MOSS_LAYOUT_MAX_ITEMS = 10

const LABELS: MossLayoutLabel[] = ['object', 'character', 'text']

export function isMossLayoutModel(modelId: string | null | undefined): boolean {
  return getModelCapability(modelId)?.imageRequestMode === 'moss'
}

export function createLayoutItemId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `layer_${crypto.randomUUID()}`
  }
  return `layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function cloneLayout(layout: MossLayout): MossLayout {
  return {
    ...layout,
    summary: { ...layout.summary, meta: layout.summary.meta ? [...layout.summary.meta] : undefined },
    items: layout.items.map((item) => ({ ...item })),
  }
}

export function normalizeLayoutLabel(value: unknown): MossLayoutLabel {
  return LABELS.includes(value as MossLayoutLabel) ? (value as MossLayoutLabel) : 'object'
}

/** 是否为整张参考图对应的背景层（不可移动 / 缩放）。 */
export function isBackgroundLayer(item: MossLayoutItem): boolean {
  return item.role === 'background'
}

/**
 * 用一张已上传 / 已生成的参考图创建可编辑布局：
 * 整张图作为铺满画布的背景层，用户可在此基础上继续添加元素图层。
 */
export function createLayoutFromImage(input: {
  width: number
  height: number
  aspectRatio: string
  caption?: string
}): MossLayout {
  const width = Math.max(1, Math.round(input.width))
  const height = Math.max(1, Math.round(input.height))
  return {
    width,
    height,
    aspectRatio: input.aspectRatio,
    summary: {
      caption: (input.caption || '').trim(),
      meta: ['reference'],
      canvas: 'single',
    },
    items: [
      {
        id: createLayoutItemId(),
        label: 'object',
        caption: '',
        role: 'background',
        x: 0,
        y: 0,
        width,
        height,
      },
    ],
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 把元素框约束到画布范围内，并保证整数坐标与最小尺寸。 */
export function clampLayoutItem(item: MossLayoutItem, width: number, height: number): MossLayoutItem {
  const minSize = 16
  const nextWidth = clamp(Math.round(item.width), minSize, width)
  const nextHeight = clamp(Math.round(item.height), minSize, height)
  return {
    ...item,
    x: clamp(Math.round(item.x), 0, width - nextWidth),
    y: clamp(Math.round(item.y), 0, height - nextHeight),
    width: nextWidth,
    height: nextHeight,
  }
}

export function clampLayout(layout: MossLayout): MossLayout {
  return {
    ...layout,
    items: layout.items.map((item) => clampLayoutItem(item, layout.width, layout.height)),
  }
}

/** 新建图层时使用的默认框：画布居中偏上，占 40%。 */
export function createDefaultLayoutItem(layout: MossLayout): MossLayoutItem {
  const width = Math.round(layout.width * 0.4)
  const height = Math.round(layout.height * 0.4)
  return {
    id: createLayoutItemId(),
    label: 'object',
    caption: '',
    x: Math.round((layout.width - width) / 2),
    y: Math.round((layout.height - height) / 2),
    width,
    height,
  }
}

export function normalizeSummary(raw: any, fallbackCaption: string): MossLayoutSummary {
  const caption = String(raw?.caption ?? '').trim() || fallbackCaption
  const meta = Array.isArray(raw?.meta)
    ? raw.meta.filter((item: unknown) => typeof item === 'string' && item.trim()).slice(0, 4)
    : ['poster']
  const canvas = ['single', 'multi_panel', 'collage'].includes(raw?.canvas) ? raw.canvas : 'single'
  return {
    caption: caption.slice(0, MOSS_LAYOUT_SUMMARY_LIMIT),
    meta: meta.length ? meta : ['poster'],
    canvas,
  }
}

/**
 * 把内部元素转换成模型需要的布局 JSON 字符串。
 * bbox 顺序为 `[y_min, x_min, y_max, x_max]`，原点在画布中心。
 */
export function toMossLayoutPrompt(layout: MossLayout): string {
  const { width, height } = layout
  const items = layout.items
    .filter((item) => !isBackgroundLayer(item))
    .filter((item) => item.caption.trim() || item.text?.trim())
    .slice(0, MOSS_LAYOUT_MAX_ITEMS)
    .map((item) => {
      const entry: Record<string, unknown> = {
        label: item.label,
        caption: (item.caption.trim() || item.text?.trim() || '').slice(0, MOSS_LAYOUT_CAPTION_LIMIT),
        bbox: [
          Math.round(item.y - height / 2),
          Math.round(item.x - width / 2),
          Math.round(item.y + item.height - height / 2),
          Math.round(item.x + item.width - width / 2),
        ],
      }
      if (item.label === 'text') {
        entry.text = item.text ?? ''
      }
      return entry
    })

  const prompt = JSON.stringify({
    summary: {
      meta: layout.summary.meta?.length ? layout.summary.meta : ['poster'],
      canvas: layout.summary.canvas || 'single',
      caption: layout.summary.caption.trim().slice(0, MOSS_LAYOUT_SUMMARY_LIMIT),
    },
    items,
    bbox_coord_space: 'abs_centralized',
    bbox_format: 'yxyx',
  })

  if (!items.length) {
    throw new Error('分层布局至少需要一个元素，请添加图层后再试。')
  }
  if (prompt.length > MOSS_LAYOUT_PROMPT_LIMIT) {
    throw new Error('布局内容过长，请精简元素描述或减少图层数量后重试。')
  }

  return prompt
}

/** 用像素坐标生成可读的位置标签（用于侧栏提示）。 */
export function describeItemPosition(item: MossLayoutItem, width: number, height: number): string {
  const centerX = item.x + item.width / 2
  const centerY = item.y + item.height / 2
  const horizontal = centerX < width / 3 ? '左' : centerX > (width * 2) / 3 ? '右' : '中'
  const vertical = centerY < height / 3 ? '上' : centerY > (height * 2) / 3 ? '下' : '中'
  return `${horizontal}${vertical}`
}
