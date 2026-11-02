/**
 * 校验 Hailuo 主体参考：走项目真实链路（buildVideoParams + generateVideo），
 * 只验证任务能否创建成功，不轮询结果。
 */
import fs from 'node:fs'
import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
if (!KEY) {
  console.error('缺少 AIPING_API_KEY')
  process.exit(1)
}
const env = await startEnv({ apiKey: KEY, proxyPort: Number(process.env.PROXY_PORT || 5272) })
const assets = JSON.parse(fs.readFileSync('test-results/assets.json', 'utf8'))
const human = { name: 'humanImage.png', type: 'image', url: assets.humanImage, size: 0 }

try {
  const params = await env.bp.buildVideoParams(
    '保持主体一致，镜头缓慢环绕',
    'MiniMax-Hailuo-2.3',
    [{ ...human, name: 'Subject Reference' }],
    '16:9',
    6,
    'minimax-hailuo',
  )
  console.log('params:', JSON.stringify({ ...params, subject_reference: '[omitted]' }))
  const task = await env.api.generateVideo(params)
  console.log('create OK:', JSON.stringify(task).slice(0, 400))
} catch (error) {
  console.log('create FAIL:', JSON.stringify(describeError(error)).slice(0, 600))
  process.exitCode = 1
} finally {
  await env.close()
}
