/**
 * 真机链路：Seedance + 本地参考视频 → 本地 upload-service → COS 公网 URL → 创建任务。
 * 前置：本机 127.0.0.1:3100 已运行 server/upload-service（带真实 COS 配置）。
 */
import fs from 'node:fs'
import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
const VIDEO = process.env.PROBE_VIDEO || '/private/var/folders/0_/qg5tdh2j49x3v_6wfnp8kf3r0000gn/T/opencode/v.mp4'
const TOKEN = process.env.UPLOAD_TOKEN

process.env.VITE_UPLOAD_SERVICE_URL = 'http://127.0.0.1:3100/upload'
process.env.VITE_UPLOAD_SERVICE_TOKEN = TOKEN || ''

const env = await startEnv({ apiKey: KEY, proxyPort: 5286 })
const videoDataUri = `data:video/mp4;base64,${fs.readFileSync(VIDEO).toString('base64')}`
console.log('参考视频大小:', (videoDataUri.length / 1024 / 1024).toFixed(2), 'MB')

try {
  const task = await env.api.generateVideo({
    prompt: '参考视频中的运动与镜头节奏，生成一段同风格画面',
    model: 'Doubao-Seedance-2.0-fast',
    reference_videos: [videoDataUri],
    aspect_ratio: '16:9',
    duration: 5,
  })
  console.log('Seedance 本地视频真机链路: OK id=' + task.id)
} catch (error) {
  console.log('Seedance 本地视频真机链路: FAIL', JSON.stringify(describeError(error)).slice(0, 600))
  process.exitCode = 1
} finally {
  await env.close()
}