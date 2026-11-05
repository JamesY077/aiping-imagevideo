/** 直接在 Node 里 POST Seedance 任务，隔离变量：PNG dataURI / 参数组合。 */
import fs from 'node:fs'
import http from 'node:http'
import { startProxy } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
const PORT = 5282
const proxy = await startProxy(PORT)
const ENDPOINT = '/api/v1/multimodal/sd/videos/contents/generations/tasks'

function post(body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body)
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: ENDPOINT,
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

const png = `data:image/png;base64,${fs.readFileSync('test-results/landscape-small.png').toString('base64')}`

const variants = [
  ['png dataURI + 完整参数', {
    model: 'Doubao-Seedance-2.0-fast',
    content: [
      { type: 'text', text: '参考图片中的画面，镜头缓慢推进' },
      { type: 'image_url', role: 'reference_image', image_url: { url: png } },
    ],
    generate_audio: true,
    ratio: '16:9',
    duration: 5,
    watermark: false,
  }],
  ['png dataURI + 最小参数', {
    model: 'Doubao-Seedance-2.0-fast',
    content: [
      { type: 'text', text: '参考图片中的画面，镜头缓慢推进' },
      { type: 'image_url', role: 'reference_image', image_url: { url: png } },
    ],
    ratio: '16:9',
    duration: 5,
  }],
]

for (const [name, body] of variants) {
  const r = await post(body)
  console.log(name, '=>', r.status, r.body)
}
proxy.close()
