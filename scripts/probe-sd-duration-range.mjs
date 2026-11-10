/**
 * 探测 Seedance 系列的时长边界：可接受的 duration 取值。
 * 用法：MODEL=Doubao-Seedance-2.5 DURATIONS=4,6,7,16,20 node scripts/probe-sd-duration-range.mjs
 */
import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
const MODEL = process.env.MODEL || 'Doubao-Seedance-2.5'
const durations = (process.env.DURATIONS || '4,6,7,10,12,15,16,20').split(',').map(Number)

const env = await startEnv({ apiKey: KEY, proxyPort: 5290 })

for (const duration of durations) {
  try {
    const task = await env.api.generateVideo({
      prompt: '城市夜景，霓虹灯，镜头缓慢横移，电影质感',
      model: MODEL,
      duration,
      aspect_ratio: '16:9',
    })
    console.log(`${MODEL} ${duration}s: OK id=${task.id}`)
  } catch (error) {
    const info = describeError(error)
    const msg = info.upstream?.error?.message || info.message
    console.log(`${MODEL} ${duration}s: FAIL ${String(msg).slice(0, 200)}`)
  }
}

await env.close()
