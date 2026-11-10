/**
 * 验证 Seedream 5.0 Lite 的多图参考链路：
 * 1. 先用文生图生成一张参考图（红圆）；
 * 2. 再把它和本地图片（dataURI）一起作为 image 数组下发，验证：
 *    - 多图以数组形式进入请求体；
 *    - 本地 dataURI 会走 ensureSeedreamImageForModel（压缩/校验 → 公网 URL 或降级 dataURI）；
 *    - 上游能正常出图。
 *
 * 用法：AIPING_API_KEY=xxx node scripts/probe-seedream-multimodal.mjs
 */
import fs from 'node:fs'
import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
if (!KEY) {
  console.error('缺少 AIPING_API_KEY')
  process.exit(1)
}

const PORT = Number(process.env.PROXY_PORT || 5286)
const env = await startEnv({ apiKey: KEY, proxyPort: PORT })

async function download(url, file) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载图片失败：HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync('test-results', { recursive: true })
  fs.writeFileSync(file, buf)
  console.log(`已保存 ${file}（${(buf.length / 1024).toFixed(0)} KB）`)
}

try {
  console.log('① 生成参考图（红圆）...')
  const refParams = await env.bp.buildImageParams(
    '纯白背景正中一个纯红色圆形，扁平矢量插画，极高对比，无文字',
    'Doubao-Seedream-5.0-lite',
    null,
    '1:1',
    'seedream-5-lite'
  )
  const refRes = await env.api.generateImage(refParams)
  const redUrl = refRes?.data?.[0]?.url
  if (!redUrl) throw new Error('参考图生成未返回 URL')
  console.log('参考图 URL:', redUrl.slice(0, 90))

  console.log('② 多图参考：公网 URL + 本地 dataURI ...')
  const localPath = 'test-results/landscape-small.png'
  const localDataUri = `data:image/png;base64,${fs.readFileSync(localPath).toString('base64')}`

  const multiParams = await env.bp.buildImageParams(
    '把图1 的红色圆形缩小后放在图2 的湖面上方，保持图2 的写实风景摄影风格',
    'Doubao-Seedream-5.0-lite',
    [
      { name: 'red-circle.png', type: 'image', url: redUrl, size: 0 },
      { name: 'landscape.png', type: 'image', url: localDataUri, size: 0 },
    ],
    '16:9',
    'seedream-5-lite',
    undefined,
    'multi'
  )
  console.log('请求体 image 是否为数组:', Array.isArray(multiParams.image), '张数:', multiParams.image?.length)
  console.log('sequential_image_generation:', multiParams.sequential_image_generation)

  const multiRes = await env.api.generateImage(multiParams)
  const outUrl = multiRes?.data?.[0]?.url
  if (!outUrl) throw new Error('多图参考未返回 URL')
  console.log('多图结果 URL:', outUrl.slice(0, 90))
  await download(outUrl, 'test-results/seedream-multi-reference.png')
  console.log('✅ Seedream 多图参考链路通过')
} catch (error) {
  console.error('❌ 失败:', JSON.stringify(describeError(error), null, 2))
  process.exitCode = 1
} finally {
  await env.close()
}
