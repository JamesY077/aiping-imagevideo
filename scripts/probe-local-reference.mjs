/**
 * 验证 Seedance / MiniMax-H3 的本地素材链路：
 * 1. Seedance 本地图片：压缩后以 dataURI 直传，创建任务成功，**不调用**上传服务。
 * 2. Seedance 本地视频：先 POST 到上传服务换公网 URL，再创建任务成功。
 * 3. MiniMax-H3 本地视频：以 dataURI 直传，创建任务成功，**不调用**上传服务。
 *
 * 上传服务用本地 mock 承接（返回一个真实公网视频地址），不需要真实 COS。
 */
import fs from 'node:fs'
import http from 'node:http'
import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
if (!KEY) {
  console.error('缺少 AIPING_API_KEY')
  process.exit(1)
}

const UPLOAD_PORT = 5280
const PROXY_PORT = 5281
const uploads = []
// 上游需要真正能下载的公网素材，这里用公共 CC 视频/图片代替 COS 返回地址。
const MOCK_VIDEO_URL = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
const MOCK_IMAGE_URL =
  'https://artrealm-image-1314455608.cos.ap-beijing.myqcloud.com/site-assets/template-landscape.webp'

const uploadServer = http.createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body)
      const kind = parsed.video ? 'video' : parsed.audio ? 'audio' : 'image'
      uploads.push({ kind, bytes: body.length })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ url: kind === 'video' ? MOCK_VIDEO_URL : MOCK_IMAGE_URL }))
    } catch (error) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: error.message }))
    }
  })
})
await new Promise((resolve) => uploadServer.listen(UPLOAD_PORT, '127.0.0.1', resolve))

// Vite 会把 process.env 里 VITE_ 前缀的变量注入 import.meta.env，从而覆盖 .env。
// INLINE_ONLY=1 用于模拟“线上未部署上传服务”的场景，验证图片 dataURI 兜底。
process.env.VITE_UPLOAD_SERVICE_URL =
  process.env.INLINE_ONLY === '1' ? '' : `http://127.0.0.1:${UPLOAD_PORT}/upload`
process.env.VITE_UPLOAD_SERVICE_TOKEN = ''

const env = await startEnv({ apiKey: KEY, proxyPort: PROXY_PORT })

const pngBytes = fs.readFileSync('test-results/landscape-small.png')
const imageDataUri = `data:image/png;base64,${pngBytes.toString('base64')}`
// Seedance 走 mock 上传，内容不重要；H3 用真实 mp4，确保 dataURI 能被上游解析。
const fakeVideo = Buffer.alloc(64 * 1024, 1)
const videoDataUri = `data:video/mp4;base64,${fakeVideo.toString('base64')}`
const realVideoPath = '/private/var/folders/0_/qg5tdh2j49x3v_6wfnp8kf3r0000gn/T/opencode/v.mp4'
const realVideoDataUri = fs.existsSync(realVideoPath)
  ? `data:video/mp4;base64,${fs.readFileSync(realVideoPath).toString('base64')}`
  : videoDataUri

async function create(name, params) {
  const before = uploads.length
  try {
    const task = await env.api.generateVideo(params)
    const used = uploads.slice(before)
    console.log(`${name}: OK id=${task.id} uploads=${JSON.stringify(used)}`)
  } catch (error) {
    console.log(`${name}: FAIL`, JSON.stringify(describeError(error)).slice(0, 500))
    process.exitCode = 1
  }
}

try {
  console.log(
    'dataURI 大小: image=',
    (imageDataUri.length / 1024 / 1024).toFixed(2),
    'MB, sdVideo=',
    (videoDataUri.length / 1024).toFixed(0),
    'KB, h3Video=',
    (realVideoDataUri.length / 1024 / 1024).toFixed(2),
    'MB',
  )

  await create('Seedance 本地图片', {
    prompt: '参考图片中的画面，镜头缓慢推进',
    model: 'Doubao-Seedance-2.0-fast',
    reference_images: [imageDataUri],
    aspect_ratio: '16:9',
    duration: 5,
  })

  await create('Seedance 本地视频', {
    prompt: '参考视频中的运动与镜头节奏',
    model: 'Doubao-Seedance-2.0-fast',
    reference_videos: [videoDataUri],
    aspect_ratio: '16:9',
    duration: 5,
  })

  await create('MiniMax-H3 本地视频', {
    prompt: '参考视频中的运动与镜头节奏',
    model: 'MiniMax-H3',
    reference_videos: [realVideoDataUri],
    resolution: '768P',
    duration: 5,
  })
} finally {
  await env.close()
  await new Promise((resolve) => uploadServer.close(resolve))
}