/**
 * 复现/验证：Doubao-Seedance-2.5 多模态参考（图片 + 视频）时，
 * 上游要求 ratio 必须是 adaptive（任务被识别为视频续写）。
 * 这里显式传 aspect_ratio=16:9，验证前端会自动改成 adaptive 并创建成功。
 */
import fs from 'node:fs'
import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
const TOKEN = process.env.UPLOAD_TOKEN
const VIDEO = process.env.PROBE_VIDEO || '/private/var/folders/0_/qg5tdh2j49x3v_6wfnp8kf3r0000gn/T/opencode/v5s.mp4'

process.env.VITE_UPLOAD_SERVICE_URL = 'http://127.0.0.1:3100/upload'
process.env.VITE_UPLOAD_SERVICE_TOKEN = TOKEN || ''

const env = await startEnv({ apiKey: KEY, proxyPort: 5287 })

const png = `data:image/png;base64,${fs.readFileSync('test-results/landscape-small.png').toString('base64')}`
const video = `data:video/mp4;base64,${fs.readFileSync(VIDEO).toString('base64')}`

const cases = [
  ['图片+视频，比例 16:9', { reference_images: [png], reference_videos: [video], aspect_ratio: '16:9' }],
  ['图片+视频，比例 9:16', { reference_images: [png], reference_videos: [video], aspect_ratio: '9:16' }],
  ['纯图片，比例 16:9（不应改动）', { reference_images: [png], aspect_ratio: '16:9' }],
]

for (const [name, extra] of cases) {
  try {
    const task = await env.api.generateVideo({
      prompt: '参考图1的人物外观，参考视频1的动作节奏与镜头运动，生成一段同风格视频',
      model: 'Doubao-Seedance-2.5',
      duration: 5,
      ...extra,
    })
    console.log(`${name}: OK id=${task.id}`)
  } catch (error) {
    console.log(`${name}: FAIL`, JSON.stringify(describeError(error)).slice(0, 400))
    process.exitCode = 1
  }
}

await env.close()
