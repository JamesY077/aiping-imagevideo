/**
 * 验证 MiniMax-H3 是否接受 base64 dataURI 的参考视频（不经上传服务）。
 * 直接按 H3 content 协议 POST，创建成功即说明支持。
 */
import fs from 'node:fs'
import http from 'node:http'
import { startProxy, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
const PORT = 5283
const proxy = await startProxy(PORT)
const ENDPOINT = '/api/v1/multimodal/minimax/videos/video_generation'

function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body)
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${KEY}`,
          'content-length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let b = ''
        res.on('data', (d) => (b += d))
        res.on('end', () => resolve({ status: res.statusCode, body: b.slice(0, 500) }))
      },
    )
    req.on('error', (e) => resolve({ status: 0, body: e.message }))
    req.end(data)
  })
}

const videoBuf = fs.readFileSync('/private/var/folders/0_/qg5tdh2j49x3v_6wfnp8kf3r0000gn/T/opencode/v.mp4')
const videoDataUri = `data:video/mp4;base64,${videoBuf.toString('base64')}`
const pngDataUri = `data:image/png;base64,${fs.readFileSync('test-results/landscape-small.png').toString('base64')}`

try {
  const r1 = await post(ENDPOINT, {
    model: 'MiniMax-H3',
    content: [
      { type: 'text', text: '参考视频中的运动与镜头节奏' },
      { type: 'video_url', role: 'reference_video', video_url: { url: videoDataUri } },
    ],
    resolution: '768P',
    duration: 5,
  })
  console.log('H3 视频 dataURI =>', r1.status, r1.body)

  const r2 = await post(ENDPOINT, {
    model: 'MiniMax-H3',
    content: [
      { type: 'text', text: '参考图片与视频' },
      { type: 'image_url', role: 'reference_image', image_url: { url: pngDataUri } },
      { type: 'video_url', role: 'reference_video', video_url: { url: videoDataUri } },
    ],
    resolution: '768P',
    duration: 5,
  })
  console.log('H3 图+视频 dataURI =>', r2.status, r2.body)
} catch (error) {
  console.error('探测失败:', JSON.stringify(describeError(error)).slice(0, 400))
} finally {
  proxy.close()
}
