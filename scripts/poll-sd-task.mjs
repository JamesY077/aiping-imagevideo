/**
 * 轮询 Seedance 任务状态，确认「创建成功」的时长是否真的能生成成功。
 * 用法：node scripts/poll-sd-task.mjs <taskId> [<taskId> ...]
 */
import { startEnv } from './lib/env.mjs'

const ids = process.argv.slice(2)
const env = await startEnv({ apiKey: process.env.AIPING_API_KEY, proxyPort: 5289 })

async function status(id) {
  const s = await env.api.getVideoStatusWithProvider(id, 'seedance')
  return { status: s.status, duration: s.duration, url: s.video_url, error: s.error }
}

for (let round = 0; round < 40; round += 1) {
  let allDone = true
  const lines = []
  for (const id of ids) {
    try {
      const s = await status(id)
      lines.push(`${id} -> ${s.status} duration=${s.duration ?? '-'}${s.error ? ` error=${String(s.error).slice(0, 120)}` : ''}`)
      if (!['succeeded', 'failed', 'cancelled', 'expired'].includes(String(s.status))) allDone = false
    } catch (error) {
      lines.push(`${id} -> 查询失败 ${error?.message}`)
      allDone = false
    }
  }
  console.log(`[round ${round}] ${lines.join(' | ')}`)
  if (allDone) break
  await new Promise((r) => setTimeout(r, 15000))
}

await env.close()
