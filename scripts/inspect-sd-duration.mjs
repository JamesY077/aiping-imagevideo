/** 打印 Seedance 任务结果 URL + 用 ffprobe 校验真实时长。 */
import { execFileSync } from 'node:child_process'
import { startEnv } from './lib/env.mjs'

const ids = process.argv.slice(2)
const env = await startEnv({ apiKey: process.env.AIPING_API_KEY, proxyPort: 5291 })

for (const id of ids) {
  try {
    const s = await env.api.getVideoStatusWithProvider(id, 'seedance')
    const url = s.video_url
    let real = ''
    if (url) {
      try {
        real = execFileSync('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration',
          '-of', 'default=nw=1:nk=1',
          url,
        ], { encoding: 'utf8' }).trim()
      } catch (e) {
        real = `ffprobe 失败: ${e.message.slice(0, 80)}`
      }
    }
    console.log(`${id} status=${s.status} reported=${s.duration} real=${real || '-'} url=${String(url || '').slice(0, 90)}`)
  } catch (error) {
    console.log(`${id} 查询失败 ${error?.message}`)
  }
}

await env.close()
