import { startEnv, describeError } from './lib/env.mjs'

const KEY = process.env.AIPING_API_KEY
const env = await startEnv({ apiKey: KEY })

const ts = () => new Date().toISOString().slice(11, 19)

async function smokeImage() {
  const params = await env.bp.buildImageParams(
    '一只橘猫坐在窗台上，清晨柔光，写实摄影',
    'Doubao-Seedream-5.0-lite',
    null,
    '16:9',
    'seedream-5-lite',
  )
  console.log(ts(), 'image request', JSON.stringify(params))
  try {
    const res = await env.api.generateImage(params)
    console.log(ts(), 'image ok', JSON.stringify(res).slice(0, 500))
    return res?.data?.[0]?.url
  } catch (error) {
    console.log(ts(), 'image FAIL', JSON.stringify(describeError(error)))
  }
}

async function smokeVideo(modelId, videoRequestMode, extra = {}) {
  const params = await env.bp.buildVideoParams(
    '海边日落，镜头缓慢推进，海浪轻轻拍打礁石',
    modelId,
    extra.upload || null,
    '16:9',
    5,
    videoRequestMode,
    'off',
    extra.resolution || null,
  )
  console.log(ts(), modelId, 'video request', JSON.stringify(params).slice(0, 800))
  try {
    const task = await env.api.generateVideo(params)
    console.log(ts(), modelId, 'created', JSON.stringify(task).slice(0, 400))
    const final = await env.vid.pollVideoStatus(task.id, undefined, {
      provider: task.provider,
      providerCreateEndpoint: task.providerCreateEndpoint,
      duration: params.duration,
      resolution: extra.resolution || null,
      hasReferenceMedia: false,
      timeoutMs: 12 * 60_000,
      interval: 4000,
    })
    console.log(ts(), modelId, 'DONE', JSON.stringify({ status: final.status, url: final.video_url || final.data?.[0]?.url, error: final.error }))
    return true
  } catch (error) {
    console.log(ts(), modelId, 'FAIL', JSON.stringify(describeError(error)))
    return false
  }
}

try {
  const imageUrl = await smokeImage()
  await smokeVideo('Doubao-Seedance-2.5', 'seedance-2')
  await smokeVideo('MiniMax-H3', 'minimax-h3', { resolution: '768P' })
  console.log('smoke imageUrl:', imageUrl)
} finally {
  await env.close()
}
