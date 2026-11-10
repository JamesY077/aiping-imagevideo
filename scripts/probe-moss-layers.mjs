/**
 * 端到端验证 Moss 分层能力（走真实 App 代码路径）：
 *   自然语言 -> planMossLayout -> 布局 JSON -> Moss 出图
 *   -> editMossLayout（自然语言改布局）-> Moss 重新出图
 * 用法：AIPING_API_KEY=... node scripts/probe-moss-layers.mjs
 */
import fs from 'node:fs'
import { startEnv, describeError } from './lib/env.mjs'

const OUT_DIR = process.env.OUT_DIR || '/private/var/folders/0_/qg5tdh2j49x3v_6wfnp8kf3r0000gn/T/opencode'
const env = await startEnv({ apiKey: process.env.AIPING_API_KEY, proxyPort: 5296 })

async function download(url, name) {
  const response = await fetch(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  const path = `${OUT_DIR}/${name}.png`
  fs.writeFileSync(path, buffer)
  return path
}

async function render(layout, name) {
  const prompt = env.layout.toMossLayoutPrompt(layout)
  const result = await env.api.generateImage({
    model: 'Moss-Image-SFT',
    prompt,
    size: `${layout.width}x${layout.height}`,
  })
  const url = result.data?.[0]?.url
  if (!url) throw new Error('没有返回图片 URL')
  const path = await download(url, name)
  return { url, path, promptChars: prompt.length }
}

function printLayout(label, layout) {
  console.log(`\n[${label}] ${layout.width}x${layout.height} aspect=${layout.aspectRatio}`)
  console.log('summary:', layout.summary.caption.slice(0, 120))
  for (const [index, item] of layout.items.entries()) {
    console.log(
      `  ${index + 1}. ${item.label} "${(item.text || item.caption).slice(0, 40)}" x=${item.x} y=${item.y} w=${item.width} h=${item.height} id=${item.id}`
    )
  }
}

try {
  const layout = await env.planner.planMossLayout({
    idea: '做一张咖啡店开业海报：标题「早安咖啡」放在顶部居中，一杯拉花咖啡在画面中间偏右，左下角放小号英文副标题「OPEN DAILY 8AM」，背景是温暖的米色。',
    width: 1024,
    height: 1024,
    aspectRatio: '1:1',
  })
  printLayout('规划结果', layout)

  const first = await render(layout, 'moss-layer-first')
  console.log('首次生成:', first.promptChars, 'chars ->', first.path)

  const edited = await env.planner.editMossLayout({
    layout,
    instruction: '把标题改成「营业中」并移到左下角竖排；咖啡杯移到画面正中偏左并放大一点；右下角新增一行小字「手冲 · 拿铁 · 冷萃」。其他保持不变。',
  })
  printLayout('修改后', edited)

  const second = await render(edited, 'moss-layer-second')
  console.log('修改后生成:', second.promptChars, 'chars ->', second.path)
} catch (error) {
  const info = describeError(error)
  console.error('FAIL', info.message, info.upstreamText || '')
  process.exitCode = 1
} finally {
  await env.close()
}
