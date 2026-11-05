/**
 * 探测 Seedance 2.0 是否接受 base64 dataURI 作为参考图/参考视频。
 * 结论用于决定「本地上传」能否内联直传，还是必须走公网 URL 上传服务。
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
  console.log('生成一张测试图...')
  const params = await env.bp.buildImageParams('雪山湖泊，清晨薄雾，写实风景摄影', 'Doubao-Seedream-5.0-lite', null, '16:9', 'seedream-5-lite')
  const res = await env.api.generateImage(params)
  const url = res?.data?.[0]?.url
  console.log('图片 URL:', String(url).slice(0, 80))

  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  const dataUri = `data:image/png;base64,${buf.toString('base64')}`
  console.log('图片体积:', (buf.length / 1024 / 1024).toFixed(2), 'MB, dataURI 长度:', dataUri.length)

  const withUrl = await post(ENDPOINT, {
    model: 'Doubao-Seedance-2.0-fast',
    content: [
      { type: 'text', text: '参考图片中的画面，镜头缓慢推进' },
      { type: 'image_url', role: 'reference_image', image_url: { url } },
    ],
    ratio: '16:9',
    duration: 5,
  })
  console.log('公网 URL  =>', withUrl.status, withUrl.body)

  const withDataUri = await post(ENDPOINT, {
    model: 'Doubao-Seedance-2.0-fast',
    content: [
      { type: 'text', text: '参考图片中的画面，镜头缓慢推进' },
      { type: 'image_url', role: 'reference_image', image_url: { url: dataUri } },
    ],
    ratio: '16:9',
    duration: 5,
  })
  console.log('dataURI   =>', withDataUri.status, withDataUri.body.slice(0, 400))
} catch (error) {
  console.error('探测失败:', JSON.stringify(describeError(error)).slice(0, 600))
  process.exitCode = 1
} finally {
  await env.close()
}
