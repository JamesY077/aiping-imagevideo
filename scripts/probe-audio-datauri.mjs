/**
 * 探测参考音频能否用 dataURI 内联（H3 / Seedance）。
 * 用 2 秒静音 WAV 作为最小素材，只看创建是否被接受。
 */
import fs from 'node:fs'
import http from 'node:http'
import { startProxy } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
const PORT = 5285
const proxy = await startProxy(PORT)

function makeWav(seconds = 2, sampleRate = 16000) {
  const samples = seconds * sampleRate
  const dataSize = samples * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(sampleRate, 24)
  buf.writeUInt32LE(sampleRate * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  return buf
}

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

const wav = makeWav()
const audioDataUri = `data:audio/wav;base64,${wav.toString('base64')}`

try {
  const h3 = await post('/api/v1/multimodal/minimax/videos/video_generation', {
    model: 'MiniMax-H3',
    content: [
      { type: 'text', text: '参考音频的氛围，生成一段画面' },
      { type: 'audio_url', role: 'reference_audio', audio_url: { url: audioDataUri } },
    ],
    resolution: '768P',
    duration: 4,
  })
  console.log('H3 音频 dataURI =>', h3.status, h3.body)

  const png = `data:image/png;base64,${fs.readFileSync('test-results/landscape-small.png').toString('base64')}`
  const sd = await post('/api/v1/multimodal/sd/videos/contents/generations/tasks', {
    model: 'Doubao-Seedance-2.0-fast',
    content: [
      { type: 'text', text: '参考图片画面，配合音频节奏' },
      { type: 'image_url', role: 'reference_image', image_url: { url: png } },
      { type: 'audio_url', role: 'reference_audio', audio_url: { url: audioDataUri } },
    ],
    ratio: '16:9',
    duration: 5,
  })
  console.log('SD 图+音频 dataURI =>', sd.status, sd.body)
} finally {
  proxy.close()
}
