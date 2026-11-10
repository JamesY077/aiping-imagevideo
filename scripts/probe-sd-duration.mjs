/**
 * 探测 Seedance 系列的真实时长上限：
 * 前端 `getSupportedVideoDurations` 里 seedance-2 只写了 5s / 8s，
 * 这里直接调上游验证 10s / 12s / 15s 是否被接受（文生视频 + 参考图）。
 */
import fs from 'node:fs'
import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
const env = await startEnv({ apiKey: KEY, proxyPort: 5288 })

const png = `data:image/png;base64,${fs.readFileSync('test-results/landscape-small.png').toString('base64')}`

async function tryCreate(name, params) {
  try {
    const task = await env.api.generateVideo({
      prompt: '海边日落，镜头缓慢推进，暖色调，电影质感',
      ...params,
    })
    console.log(`${name}: OK id=${task.id}`)
    return true
  } catch (error) {
    const info = describeError(error)
    const msg = info.upstream?.error?.message || info.message
    console.log(`${name}: FAIL ${String(msg).slice(0, 220)}`)
    return false
  }
}

for (const model of ['Doubao-Seedance-2.5', 'Doubao-Seedance-2.0-fast']) {
  for (const duration of [5, 8, 10, 12, 15]) {
    await tryCreate(`${model} 文生 ${duration}s`, { model, duration, aspect_ratio: '16:9' })
  }
}

// 参考图场景（i2v）单独验证一次长时长
await tryCreate('Doubao-Seedance-2.5 参考图 10s', {
  model: 'Doubao-Seedance-2.5',
  duration: 10,
  aspect_ratio: '16:9',
  reference_images: [png],
})
await tryCreate('Doubao-Seedance-2.5 参考图 15s', {
  model: 'Doubao-Seedance-2.5',
  duration: 15,
  aspect_ratio: '16:9',
  reference_images: [png],
})

await env.close()
