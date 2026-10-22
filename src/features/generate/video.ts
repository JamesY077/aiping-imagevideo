import { getVideoStatusWithProvider } from '@/api/aiping'
import type { VideoGenerateRequest, VideoStatusResponse } from '@/types/api'

/**
 * 多任务并发轮询时，任意两次状态查询之间的最小间隔（毫秒）。
 * 5 个任务按 3s 轮询 ≈ 100 次/分钟，若 5 个请求在同一瞬间发出会形成突发，
 * 触发上游「RPM 超限」限流（429），因此这里把请求摊平后再发。
 */
const POLL_MIN_GAP_MS = 600
/** 单次查询遇到 429 / 5xx / 网络抖动时的最大连续重试次数。 */
const MAX_POLL_RETRIES = 8

/** 全局轮询时间片，所有任务共享。 */
let nextPollSlotAt = 0

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

/** 全局轮询节流：请求按固定间隔依次发出，避免并发任务同时命中限流。 */
async function acquirePollSlot() {
  const now = Date.now()
  const wait = Math.max(0, nextPollSlotAt - now)
  nextPollSlotAt = Math.max(now, nextPollSlotAt) + POLL_MIN_GAP_MS
  if (wait > 0) await sleep(wait)
}

function getErrorStatus(error: any): number | undefined {
  const direct = error?.response?.status
  if (typeof direct === 'number') return direct
  const matched = /^http_(\d{3})$/.exec(String(error?.code || ''))
  return matched ? Number(matched[1]) : undefined
}

/**
 * 状态查询是幂等的，可以安全重试：
 * - 429：RPM 超限 / 并发已满（上游临时限流，退避后即可恢复）
 * - 5xx：上游临时故障
 * - 网络错误 / 超时
 * 注意：这些错误不能直接判定任务失败，否则 5 并发时偶发一次限流就会让整条任务被丢弃。
 */
function isRetryablePollError(error: any): boolean {
  const status = getErrorStatus(error)
  if (status === 429) return true
  if (typeof status === 'number' && status >= 500) return true
  if (String(error?.code || '') === 'network') return true
  if (typeof status !== 'number') {
    const message = String(error?.message || '').toLowerCase()
    return message.includes('network') || message.includes('timeout') || message.includes('超时')
  }
  return false
}

export async function pollVideoStatus(
  taskId: string,
  onProgress?: (progress: number) => void,
  interval = 3000,
  maxAttempts = 100,
  provider?: string,
  providerCreateEndpoint?: string,
): Promise<VideoStatusResponse> {
  // MiniMax-H3 多模态参考 / 首尾帧 / 2K 场景耗时更长，避免 5 分钟窗口过早判超时。
  const resolvedMaxAttempts = provider?.toLowerCase() === 'minimax-h3'
    ? Math.max(maxAttempts, 240)
    : maxAttempts

  let attempt = 0
  let retries = 0

  while (attempt < resolvedMaxAttempts) {
    await acquirePollSlot()

    let status: VideoStatusResponse
    try {
      status = await getVideoStatusWithProvider(taskId, provider, providerCreateEndpoint)
    } catch (error) {
      if (!isRetryablePollError(error) || retries >= MAX_POLL_RETRIES) throw error

      // 限流/抖动不消耗轮询次数，按指数退避后重试同一次查询。
      retries += 1
      const backoff = Math.min(15000, 1000 * 2 ** (retries - 1)) + Math.floor(Math.random() * 400)
      await sleep(backoff)
      continue
    }

    retries = 0
    attempt += 1

    const normalizedStatus = (status.status || status.state)?.toLowerCase()
    if (typeof status.progress === 'number' && onProgress) {
      onProgress(status.progress)
    }
    if (
      normalizedStatus === 'completed' ||
      normalizedStatus === 'succeed' ||
      normalizedStatus === 'success' ||
      normalizedStatus === 'succeeded'
    ) {
      return status
    }
    if (
      normalizedStatus === 'failed' ||
      normalizedStatus === 'error' ||
      normalizedStatus === 'expired' ||
      normalizedStatus === 'cancelled'
    ) {
      throw new Error(status.error || `视频生成失败 (task: ${taskId})`)
    }

    await sleep(interval)
  }
  throw new Error('视频生成超时')
}

export function setVideoRatio(params: VideoGenerateRequest, aspectRatio: string) {
  params.aspect_ratio = aspectRatio
  params.ratio = aspectRatio
}

export function deleteVideoRatio(params: VideoGenerateRequest) {
  delete params.aspect_ratio
  delete params.ratio
}
