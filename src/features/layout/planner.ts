import { chatCompletion } from '@/api/aiping'
import { buildTextExtraBody } from '@/models/text'
import type { MossLayout, MossLayoutItem } from '@/types/layout'
import {
  MOSS_LAYOUT_MAX_ITEMS,
  clampLayoutItem,
  createLayoutItemId,
  normalizeLayoutLabel,
  normalizeSummary,
} from './mossLayout'

/**
 * 负责把自然语言需求（以及后续的修改指令）转成 Moss 原生布局 JSON。
 * 使用文本模型输出内部坐标（左上角原点的 x/y/w/h），再转换成模型坐标。
 */
const PLANNER_MODEL = 'DeepSeek-V4-Flash'
const PLANNER_MAX_TOKENS = 1800

const CREATE_SYSTEM_PROMPT = `你是 MOSS-Image 的分层布局规划器。把用户的创作需求转换成严格 JSON 布局，用于图像生成。
只输出 JSON，不要解释，不要 Markdown 代码围栏。

JSON 结构：
{
  "summary": {
    "meta": ["poster"],
    "canvas": "single",
    "caption": "整张图的英文描述：场景、风格、光线、背景、整体构图"
  },
  "items": [
    {
      "label": "text" | "object" | "character",
      "caption": "该元素的英文视觉描述：外观、颜色、材质、字体样式、朝向",
      "text": "仅 text 元素需要：要渲染的原文",
      "bbox": [x, y, width, height]
    }
  ]
}

规则：
1. bbox 使用左上角原点的像素坐标，四个整数：[x, y, 宽, 高]，必须满足 0<=x、0<=y、x+宽<=画布宽、y+高<=画布高。
2. summary.caption 用英文描述整体画面与背景。不要把背景单独列成一个铺满画布的元素。
3. 元素 caption 用英文；text 元素必须给出 text 字段，并原样保留用户要求的文字（中文可保留中文），用 \\n 表示换行。
4. 默认规划 3-6 个元素；海报/信息图可包含标题与副标题；元素之间尽量不要重叠。
5. 必须严格遵循用户对位置、大小、层级的自然语言要求（如左上、顶部居中、画面中间偏右、底部、放大、缩小等）。
6. 画布尺寸以用户消息中给出的为准，所有 bbox 都基于该尺寸。`

const EDIT_SYSTEM_PROMPT = `你是 MOSS-Image 的分层布局编辑器。根据用户的修改指令调整现有布局，只输出 JSON，不要解释，不要 Markdown 代码围栏。

JSON 结构：
{
  "summary": { "meta": ["poster"], "canvas": "single", "caption": "修改后整张图的英文描述" },
  "items": [
    {
      "id": "已有元素的 id；新增元素省略该字段",
      "label": "text" | "object" | "character",
      "caption": "英文视觉描述",
      "text": "仅 text 元素需要",
      "bbox": [x, y, width, height],
      "remove": true
    }
  ]
}

规则：
1. bbox 使用左上角原点的像素坐标，四个整数，必须在画布内。
2. 没有被指令提到的元素必须原样保留：id、label、caption、text、bbox 全部不变，不要删改。
3. 新增元素省略 id；删除元素时带上 "remove": true。
4. summary.caption 必须反映修改后的整体画面。
5. text 元素保留用户要求的原文，用 \\n 表示换行。
6. 必须严格遵循用户对位置、大小、层级的自然语言要求。`

interface RawPlanItem {
  id?: unknown
  label?: unknown
  caption?: unknown
  text?: unknown
  bbox?: unknown
  remove?: unknown
}

function extractJsonObject(raw: string): any {
  const trimmed = raw
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) {
    throw new Error('布局模型没有返回合法 JSON。')
  }
  return JSON.parse(trimmed.slice(start, end + 1))
}

function readRawItems(raw: any): RawPlanItem[] {
  return Array.isArray(raw?.items) ? (raw.items as RawPlanItem[]) : []
}

function toInternalItem(raw: RawPlanItem, width: number, height: number): MossLayoutItem | null {
  let label = normalizeLayoutLabel(raw?.label)
  const caption = String(raw?.caption ?? '').trim()
  const textValue = typeof raw?.text === 'string' ? raw.text : ''
  if (!caption && !textValue.trim()) return null

  if (label === 'text' && !textValue.trim()) {
    // 没有原文的 text 元素按普通物体处理，避免下发空 text 字段。
    label = 'object'
  }

  const bbox = Array.isArray(raw?.bbox) ? raw.bbox.map((value) => Number(value)) : []
  if (bbox.length !== 4 || bbox.some((value) => !Number.isFinite(value))) return null

  const [x, y, itemWidth, itemHeight] = bbox
  return clampLayoutItem(
    {
      id: createLayoutItemId(),
      label,
      caption: caption || textValue.trim(),
      text: label === 'text' ? textValue : undefined,
      x,
      y,
      width: itemWidth,
      height: itemHeight,
    },
    width,
    height
  )
}

function parseItems(raw: any, width: number, height: number): MossLayoutItem[] {
  return readRawItems(raw)
    .slice(0, MOSS_LAYOUT_MAX_ITEMS)
    .map((item) => toInternalItem(item, width, height))
    .filter((item): item is MossLayoutItem => !!item)
}

async function requestLayout(prompt: string, system: string): Promise<any> {
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const content = await chatCompletion({
        model: PLANNER_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: PLANNER_MAX_TOKENS,
        extra_body: buildTextExtraBody(PLANNER_MODEL),
      })
      return extractJsonObject(content)
    } catch (error) {
      lastError = error
    }
  }
  const message = lastError instanceof Error ? lastError.message : '布局规划失败，请稍后重试。'
  throw new Error(`无法生成分层布局：${message}`)
}

export interface PlanMossLayoutInput {
  idea: string
  width: number
  height: number
  aspectRatio: string
}

/** 首次生成：把自然语言需求转成 Moss 布局。 */
export async function planMossLayout(input: PlanMossLayoutInput): Promise<MossLayout> {
  const { idea, width, height, aspectRatio } = input
  const raw = await requestLayout(
    `画布尺寸：${width}x${height}（宽 ${width} 像素，高 ${height} 像素）。\n创作需求：${idea}`,
    CREATE_SYSTEM_PROMPT
  )

  const items = parseItems(raw, width, height)
  if (!items.length) {
    throw new Error('无法生成分层布局：模型没有返回可用的元素，请把需求描述得更具体一些。')
  }

  return {
    width,
    height,
    aspectRatio,
    summary: normalizeSummary(raw?.summary, idea),
    items,
  }
}

export interface EditMossLayoutInput {
  layout: MossLayout
  instruction: string
}

/**
 * 编辑：根据自然语言指令更新布局。
 * 未被指令提到的旧元素会被保留，避免模型漏写导致图层丢失。
 */
export async function editMossLayout(input: EditMossLayoutInput): Promise<MossLayout> {
  const { layout, instruction } = input
  if (!instruction.trim()) return layout

  const compactLayout = {
    width: layout.width,
    height: layout.height,
    summary: layout.summary,
    items: layout.items.map((item) => ({
      id: item.id,
      label: item.label,
      caption: item.caption,
      ...(item.label === 'text' ? { text: item.text ?? '' } : {}),
      bbox: [item.x, item.y, item.width, item.height],
    })),
  }

  const raw = await requestLayout(
    `画布尺寸：${layout.width}x${layout.height}。\n当前布局：${JSON.stringify(compactLayout)}\n修改指令：${instruction}`,
    EDIT_SYSTEM_PROMPT
  )

  const existing = new Map(layout.items.map((item) => [item.id, item]))
  const next = layout.items.map((item) => ({ ...item }))
  const nextById = new Map(next.map((item) => [item.id, item]))
  let touched = false

  for (const rawItem of readRawItems(raw).slice(0, MOSS_LAYOUT_MAX_ITEMS + 4)) {
    const rawId = typeof rawItem.id === 'string' ? rawItem.id : ''
    const target = rawId ? existing.get(rawId) : null

    if (target) {
      if (rawItem.remove === true) {
        const index = next.findIndex((item) => item.id === target.id)
        if (index >= 0) next.splice(index, 1)
        nextById.delete(target.id)
        touched = true
        continue
      }

      const current = nextById.get(target.id)
      if (!current) continue
      const label = normalizeLayoutLabel(rawItem.label ?? current.label)
      const caption = String(rawItem.caption ?? current.caption).trim() || current.caption
      const textValue = typeof rawItem.text === 'string' ? rawItem.text : current.text
      const nextLabel = label === 'text' && !String(textValue ?? '').trim() ? 'object' : label
      const bbox = Array.isArray(rawItem.bbox) ? rawItem.bbox.map((value) => Number(value)) : null
      const hasBbox = !!bbox && bbox.length === 4 && bbox.every((value) => Number.isFinite(value))

      const updated = {
        ...current,
        label: nextLabel,
        caption,
        text: nextLabel === 'text' ? textValue : undefined,
        ...(hasBbox
          ? { x: bbox[0], y: bbox[1], width: bbox[2], height: bbox[3] }
          : {}),
      }
      const clamped = clampLayoutItem(updated, layout.width, layout.height)
      nextById.set(target.id, clamped)
      const index = next.findIndex((item) => item.id === target.id)
      if (index >= 0) next.splice(index, 1, clamped)
      touched = true
      continue
    }

    if (rawItem.remove === true) continue
    const added = toInternalItem(rawItem, layout.width, layout.height)
    if (added) {
      next.push(added)
      nextById.set(added.id, added)
      touched = true
    }
  }

  if (!touched && !raw?.summary?.caption) {
    return layout
  }
  if (!next.length) {
    throw new Error('修改后布局为空，请至少保留一个图层。')
  }

  return {
    ...layout,
    summary: raw?.summary?.caption ? normalizeSummary(raw.summary, layout.summary.caption) : layout.summary,
    items: next,
  }
}
