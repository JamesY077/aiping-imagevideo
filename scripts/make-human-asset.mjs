/**
 * 生成「完整上半身」人像素材，用于可灵动作控制（motion control）用例。
 * 可灵要求参考图里能清晰识别完整上半身，风景/静物图会被判为识别失败。
 *
 * 用法：
 *   AIPING_API_KEY='QC-...' node scripts/make-human-asset.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { startEnv, describeError } from './lib/env.mjs'

const STATE = path.resolve('test-results/assets.json')
const KEY = process.env.AIPING_API_KEY
if (!KEY) {
  console.error('缺少 AIPING_API_KEY')
  process.exit(1)
}

const PROMPT =
  '正面全身站姿的年轻亚洲女性，穿浅色运动上衣与长裤，双手自然下垂，' +
  '完整上半身与腰部清晰可见，人物居中，纯浅灰色摄影棚背景，均匀柔光，' +
  '写实人像摄影，清晰五官，无遮挡，无裁切'

const env = await startEnv({ apiKey: KEY })
try {
  const { bp, api } = env
  const params = await bp.buildImageParams(PROMPT, 'Doubao-Seedream-5.0-lite', null, '3:4', 'seedream-5-lite')
  const res = await api.generateImage(params)
  const url = res?.data?.[0]?.url
  if (!url) throw new Error('未返回图片地址：' + JSON.stringify(res).slice(0, 500))

  const assets = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {}
  assets.humanImage = url
  assets.humanImageAt = new Date().toISOString()
  fs.writeFileSync(STATE, JSON.stringify(assets, null, 2))
  console.log('humanImage saved:', url)
} catch (error) {
  console.error('生成人像素材失败:', JSON.stringify(describeError(error), null, 2))
  process.exitCode = 1
} finally {
  await env.close()
}
