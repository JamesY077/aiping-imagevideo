/**
 * 用真实 App 代码路径验证 Moss-Image-SFT 接入：
 * - provider 选择、请求体裁剪（size 的 * → x、去除 image/n/width/height）
 * - 文生图 + 多比例真机出图
 * 用法：AIPING_API_KEY=... node scripts/probe-moss-image.mjs
 */
import { startEnv, describeError } from './lib/env.mjs'

const env = await startEnv({ apiKey: process.env.AIPING_API_KEY, proxyPort: 5294 })

// 通过模型注册表拿到 Moss 的 adapter（等价于运行时 getImageProvider 的选择结果）。
const mossAdapter = env.models.modelModules.find((model) => model.id === 'Moss-Image-SFT')?.adapter
console.log('provider =', mossAdapter?.provider, '| endpoint =', mossAdapter?.endpoint)
console.log(
  'body(1024*1024 + image + n + b64) =',
  JSON.stringify(
    mossAdapter?.buildRequestBody({
      model: 'Moss-Image-SFT',
      prompt: 'x',
      size: '1024*1024',
      image: 'data:image/png;base64,AAA',
      n: 2,
      response_format: 'b64_json',
      width: 1024,
      height: 1024,
      output_format: 'png',
      watermark: false,
    })
  )
)

for (const [label, size] of [
  ['1:1', '1024x1024'],
  ['16:9', '1280x720'],
  ['21:9', '1680x720'],
  ['9:16', '720x1280'],
]) {
  try {
    const result = await env.api.generateImage({
      model: 'Moss-Image-SFT',
      prompt: `${label} 山间书院，清晨薄雾，水墨风格`,
      size,
    })
    const usage = result.usage || {}
    console.log(
      `${label} ${size}: OK ${usage.output_width}x${usage.output_height} url=${String(result.data?.[0]?.url || '').slice(0, 70)}`
    )
  } catch (error) {
    const info = describeError(error)
    console.log(`${label} ${size}: FAIL ${String(info.message).slice(0, 160)} | ${String(info.upstreamText).slice(0, 160)}`)
  }
}

await env.close()
