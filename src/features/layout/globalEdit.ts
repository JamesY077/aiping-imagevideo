import type { MossLayout, MossLayoutItem, MossLayoutLabel } from '@/types/layout'
import { isBackgroundLayer } from '@/features/layout/mossLayout'

/**
 * 通用图片模型（非 Moss）没有原生分层能力。
 * 这里把图层布局转换成分层语义清晰的提示词，并配合参考图完成「近似分层」的编辑：
 * - 参考图作为底图；
 * - 图层描述 + 相对位置/尺寸提示模型把元素放到对应位置；
 * - 未提及区域要求尽量保持不变。
 */

function labelText(label: MossLayoutLabel): string {
  if (label === 'character') return '人物'
  if (label === 'text') return '文字'
  return '物体'
}

function itemContent(item: MossLayoutItem): string {
  return (item.caption || item.text || '').trim()
}

function itemPositionLine(item: MossLayoutItem, layout: MossLayout): string {
  const centerX = Math.round(((item.x + item.width / 2) / layout.width) * 100)
  const centerY = Math.round(((item.y + item.height / 2) / layout.height) * 100)
  const widthPct = Math.max(1, Math.round((item.width / layout.width) * 100))
  const heightPct = Math.max(1, Math.round((item.height / layout.height) * 100))
  return `中心位于画面水平 ${centerX}%、垂直 ${centerY}%，约占画面 ${widthPct}% × ${heightPct}%`
}

/**
 * 把布局与用户提示词拼成通用图片模型可理解的编辑指令。
 * 只有背景层且没有任何描述时会抛错，避免用户误发送空编辑。
 */
export function buildGlobalEditPrompt(layout: MossLayout, userPrompt = ''): string {
  const prompt = userPrompt.trim()
  const summary = layout.summary.caption.trim()
  const background = layout.items.find((item) => isBackgroundLayer(item))
  const backgroundCaption = background ? itemContent(background) : ''
  const layers = layout.items.filter(
    (item) => !isBackgroundLayer(item) && !!itemContent(item),
  )

  if (!prompt && !summary && !backgroundCaption && !layers.length) {
    throw new Error('请先填写整体画面描述，或至少添加一个有描述的图层后再生成。')
  }

  const lines = [
    '请以提供的参考图作为底图进行图像编辑。',
    '未在下面提及的区域，请尽量保持与参考图一致：主体身份、构图、光线、色调和背景都不要随意改变。',
  ]

  const overall = summary || backgroundCaption
  if (overall) lines.push(`整体画面：${overall}`)
  if (prompt && prompt !== overall) lines.push(`编辑要求：${prompt}`)

  if (layers.length) {
    lines.push('需要呈现或调整的图层：')
    layers.forEach((item, index) => {
      const content = itemContent(item)
      const textPart = item.label === 'text' && item.text?.trim()
        ? `，文字内容：「${item.text.trim()}」`
        : ''
      lines.push(
        `${index + 1}. ${labelText(item.label)}：${content}${textPart}；${itemPositionLine(item, layout)}。`,
      )
    })
    lines.push('图层中描述的物体如果参考图里没有，请自然添加；如果已经存在，请调整到指定位置和大小。')
  } else {
    lines.push('请按照整体画面与编辑要求重绘这张图。')
  }

  return lines.join('\n')
}
