/**
 * 探测 Seedance 2.0 是否接受 base64 dataURI 作为参考视频：
 * 1. 生成一张图 → 2. 用 Seedance 生成 5s 视频 → 3. 把视频转成 dataURI 再发起编辑/参考请求。
 * 目的：确认本地视频能否内联直传（免公网 URL / 免上传服务）。
 */
import http from 'node:http'
import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
if (!KEY) {
  console.error('缺少 AIPING_API_KEY')
  process.exit(1)
}
const PORT = Number(process.env.PROXY_PORT || 5273)
const env = await startEnv({ apiKey: KEY, proxyPort: PORT })

function post(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body)
    const req = http.request({
      hostname: '127.0.0.1', port: PORT, path, method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${KEY}`,
        'content-length': Buffer.byteLength(data),
      },
    }, (res) => {
      let b = ''
      res.on('data', (d) => (b += d))
      res.on('end', () => resolve({ status: res.statusCode, body: b.slice(0, 600) }))
    })
    req.on('error', (e) => resolve({ status: 0, body: e.message }))
    req.end(data)
  })
}

const ENDPOINT = '/api/v1/multimodal/sd/videos/contents/generations/tasks'

try {
  console.log('1) 生成参考图...')
  const imgParams = await env.bp.buildImageParams('清晨的湖面，写实风景摄影', 'Doubao-Seedream-5.0-lite', null, '16:9', 'seedream-5-lite')
  const imgRes = await env.api.generateImage(imgParams)
  const imageUrl = imgRes?.data?.[0]?.url
  console.log('   图片就绪')

  console.log('2) 生成 5s 参考视频（优先 Seedance-fast，失败回退 MiniMax-H3）...')
  async function createVideo(model, requestMode) {
    const params = await env.bp.buildVideoParams('镜头缓慢推进，湖面薄雾流动', model, null, '16:9', 5, requestMode, 'off', requestMode === 'minimax-h3' ? '768P' : null, 'text2video')
    const t = await env.api.generateVideo(params)
    return env.vid.pollVideoStatus(t.id, undefined, {
      provider: t.provider,
      providerCreateEndpoint: t.providerCreateEndpoint,
      duration: 5,
      resolution: requestMode === 'minimax-h3' ? '768P' : null,
      timeoutMs: 15 * 60_000,
      interval: 5000,
    })
  }
  let final
  try {
    final = await createVideo('Doubao-Seedance-2.0-fast', 'seedance-2')
  } catch (error) {
    console.log('   Seedance 失败，改用 MiniMax-H3:', String(error?.message || error).slice(0, 120))
    final = await createVideo('MiniMax-H3', 'minimax-h3')
  }
  const videoUrl = final.video_url || final.data?.[0]?.url
  if (!videoUrl) throw new Error('参考视频生成失败：' + JSON.stringify(final).slice(0, 300))
  console.log('   视频就绪:', videoUrl.slice(0, 70))

  const buf = Buffer.from(await (await fetch(videoUrl)).arrayBuffer())
  const videoDataUri = `data:video/mp4;base64,${buf.toString('base64')}`
  console.log('   视频体积:', (buf.length / 1024 / 1024).toFixed(2), 'MB, dataURI:', (videoDataUri.length / 1024 / 1024).toFixed(2), 'MB')

  const videoOnly = await post(ENDPOINT, {
    model: 'Doubao-Seedance-2.5',
    content: [
      { type: 'text', text: '参考视频中的画面风格，生成相似场景' },
      { type: 'video_url', role: 'reference_video', video_url: { url: videoDataUri } },
    ],
    ratio: 'adaptive',
    duration: -1,
  })
  console.log('视频 dataURI =>', videoOnly.status, videoOnly.body.slice(0, 300))

  const imgBuf = Buffer.from(await (await fetch(imageUrl)).arrayBuffer())
  const imageDataUri = `data:image/png;base64,${imgBuf.toString('base64')}`
  const both = await post(ENDPOINT, {
    model: 'Doubao-Seedance-2.5',
    content: [
      { type: 'text', text: '把视频中的主体替换为参考图片中的主体' },
      { type: 'image_url', role: 'reference_image', image_url: { url: imageDataUri } },
      { type: 'video_url', role: 'reference_video', video_url: { url: videoDataUri } },
    ],
    ratio: 'adaptive',
    duration: -1,
  })
  console.log('图+视频 dataURI =>', both.status, both.body.slice(0, 300))
} catch (error) {
  console.error('探测失败:', JSON.stringify(describeError(error)).slice(0, 600))
  process.exitCode = 1
} finally {
  await env.close()
}
