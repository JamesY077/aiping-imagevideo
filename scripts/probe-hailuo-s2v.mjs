/**
 * 探测 MiniMax 主体参考（subject_reference）在 AI Ping 平台上被接受的请求形态。
 * 只发创建请求，不轮询；400 会立即返回，用于定位参数问题。
 */
import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
if (!KEY) {
  console.error('缺少 AIPING_API_KEY')
  process.exit(1)
}
const env = await startEnv({ apiKey: KEY, proxyPort: Number(process.env.PROXY_PORT || 5272) })
const assets = JSON.parse((await import('node:fs')).readFileSync('test-results/assets.json', 'utf8'))
const subject = [{ type: 'character', image: [assets.humanImage] }]

const variants = [
  { name: 'A: model=S2V-01', body: { model: 'S2V-01', prompt: '保持主体一致，镜头缓慢环绕', subject_reference: subject } },
  { name: 'B: model=MiniMax-Hailuo-2.3', body: { model: 'MiniMax-Hailuo-2.3', prompt: '保持主体一致，镜头缓慢环绕', subject_reference: subject } },
  { name: 'C: model=S2V-01 + 6s/1080P', body: { model: 'S2V-01', prompt: '保持主体一致，镜头缓慢环绕', subject_reference: subject, duration: 6, resolution: '1080P' } },
  { name: 'D: model=MiniMax-Hailuo-02', body: { model: 'MiniMax-Hailuo-02', prompt: '保持主体一致，镜头缓慢环绕', subject_reference: subject } },
]

try {
  for (const variant of variants) {
    try {
      const res = await env.api.generateVideo({ ...variant.body })
      console.log(variant.name, '=> OK', JSON.stringify(res).slice(0, 300))
    } catch (error) {
      const d = describeError(error)
      console.log(variant.name, '=> FAIL', JSON.stringify({ status: d.status, message: d.message, upstream: d.upstream, upstreamText: d.upstreamText }).slice(0, 600))
    }
  }
} finally {
  await env.close()
}
