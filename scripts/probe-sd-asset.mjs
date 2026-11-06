/**
 * 探测 Seedance 是否支持「不走公网 URL」的参考视频方案：
 * 1. CreateAsset 传 dataURI 是否能创建素材（返回 asset id）；
 * 2. 任务里用 asset:// 引用该素材；
 * 3. 任务里传裸 base64（不带 data: 前缀）。
 */
import fs from 'node:fs'
import http from 'node:http'
import { startProxy, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
const PORT = 5284
const proxy = await startProxy(PORT)

function post(path, body, contentType = 'application/json') {
  return new Promise((resolve) => {
    const data = JSON.stringify(body)
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method: 'POST',
        headers: {
          'content-type': contentType,
          authorization: `Bearer ${KEY}`,
          'content-length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let b = ''
        res.on('data', (d) => (b += d))
        res.on('end', () => resolve({ status: res.statusCode, body: b.slice(0, 700) }))
      },
    )
    req.on('error', (e) => resolve({ status: 0, body: e.message }))
    req.end(data)
  })
}

const videoBuf = fs.readFileSync('/private/var/folders/0_/qg5tdh2j49x3v_6wfnp8kf3r0000gn/T/opencode/v.mp4')
const videoDataUri = `data:video/mp4;base64,${videoBuf.toString('base64')}`
const rawBase64 = videoBuf.toString('base64')
const ASSETS = '/api/v1/multimodal/sd/assets?Action=CreateAsset&Version=2024-01-01'
const TASKS = '/api/v1/multimodal/sd/videos/contents/generations/tasks'

try {
  console.log('1) CreateAsset with dataURI')
  const a1 = await post(ASSETS, { AssetType: 'Video', URL: videoDataUri })
  console.log('   =>', a1.status, a1.body)

  console.log('2) CreateAsset with raw base64')
  const a2 = await post(ASSETS, { AssetType: 'Video', URL: rawBase64 })
  console.log('   =>', a2.status, a2.body)

  console.log('3) CreateAsset with base64 field')
  const a3 = await post(ASSETS, { AssetType: 'Video', Base64: rawBase64 })
  console.log('   =>', a3.status, a3.body)

  console.log('4) task with raw base64 video')
  const t1 = await post(TASKS, {
    model: 'Doubao-Seedance-2.0-fast',
    content: [
      { type: 'text', text: '参考视频中的运动' },
      { type: 'video_url', role: 'reference_video', video_url: { url: rawBase64.slice(0, 2000) } },
    ],
    ratio: 'adaptive',
    duration: -1,
  })
  console.log('   =>', t1.status, t1.body)

  console.log('5) task with video_url as string')
  const t2 = await post(TASKS, {
    model: 'Doubao-Seedance-2.0-fast',
    content: [
      { type: 'text', text: '参考视频中的运动' },
      { type: 'video_url', role: 'reference_video', video_url: 'data:video/mp4;base64,AAAA' },
    ],
    ratio: 'adaptive',
    duration: -1,
  })
  console.log('   =>', t2.status, t2.body)
} catch (error) {
  console.error('探测失败:', JSON.stringify(describeError(error)).slice(0, 400))
} finally {
  proxy.close()
}