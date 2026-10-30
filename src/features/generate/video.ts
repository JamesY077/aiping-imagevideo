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

/** 默认视频轮询预算（非多模态长耗时模型）。 */
const DEFAULT_POLL_TIMEOUT_MS = 8 * 60_000
/** Seedance 2 系列：1080p 8s 常见 3~5 分钟，带多模态参考素材时更久。 */
const SEEDANCE_POLL_TIMEOUT_MS = 15 * 60_000
const SEEDANCE_REFERENCE_POLL_TIMEOUT_MS = 20 * 60_000
/** MiniMax-H3 768P：4~15s 常规任务。 */
const MINIMAX_H3_POLL_TIMEOUT_MS = 20 * 60_000
const MINIMAX_H3_LONG_POLL_TIMEOUT_MS = 30 * 60_000
/** MiniMax-H3 2K：15s 原生 2K + 音频是当前最重档位，实际耗时可能超过 15 分钟。 */
const MINIMAX_H3_2K_POLL_TIMEOUT_MS = 30 * 60_000
const MINIMAX_H3_2K_LONG_POLL_TIMEOUT_MS = 40 * 60_000

export interface VideoPollOptions {
  /** 轮询间隔，默认 3000ms。 */
  interval?: number
  /** 显式指定超时预算；不传则按 provider / 分辨率 / 时长推导。 */
  timeoutMs?: number
  provider?: string
  providerCreateEndpoint?: string
  /** 视频时长（秒），用于放宽长视频任务预算。 */
  duration?: number
  /** 视频分辨率（MiniMax-H3：768P / 2K）。 */
  resolution?: string | null
  /** 是否携带参考素材（图片 / 视频 / 音频）。 */
  hasReferenceMedia?: boolean
}

/**
 * 计算单个视频任务的轮询预算。
 *
 * 视频生成是异步任务，创建后需要持续查询，不同模型/档位的耗时差异很大：
 * - Seedance 2 系列创建任务本身可能等待数分钟，生成再叠加数分钟；
 * - MiniMax-H3 的 2K + 15s 是当前最重档位，15 分钟窗口经常不够。
 * 因此按 provider / 分辨率 / 时长给足预算，避免任务实际还在跑却被前端提前判超时。
 */
export function resolveVideoPollTimeoutMs(options: VideoPollOptions = {}): number {
  if (options.timeoutMs && options.timeoutMs > 0) return options.timeoutMs

  const provider = options.provider?.toLowerCase()
  const duration = Number(options.duration || 0)
  const is2K = String(options.resolution || '').toUpperCase() === '2K'

  if (provider === 'minimax-h3') {
    if (is2K) {
      return duration >= 10
        ? MINIMAX_H3_2K_LONG_POLL_TIMEOUT_MS
        : MINIMAX_H3_2K_POLL_TIMEOUT_MS
    }
    return duration >= 10
      ? MINIMAX_H3_LONG_POLL_TIMEOUT_MS
      : MINIMAX_H3_POLL_TIMEOUT_MS
  }

  if (provider === 'seedance') {
    return options.hasReferenceMedia
      ? SEEDANCE_REFERENCE_POLL_TIMEOUT_MS
      : SEEDANCE_POLL_TIMEOUT_MS
  }

  return DEFAULT_POLL_TIMEOUT_MS
}

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
  options: VideoPollOptions = {},
): Promise<VideoStatusResponse> {
  const interval = options.interval ?? 3000
  const timeoutMs = resolveVideoPollTimeoutMs(options)
  const startedAt = Date.now()
  const deadline = startedAt + timeoutMs

  let retries = 0
  let lastStatus: VideoStatusResponse | undefined

  while (Date.now() < deadline) {
    await acquirePollSlot()

    let status: VideoStatusResponse
    try {
      status = await getVideoStatusWithProvider(taskId, options.provider, options.providerCreateEndpoint)
    } catch (error) {
      if (!isRetryablePollError(error) || retries >= MAX_POLL_RETRIES) throw error

      // 限流/抖动不消耗轮询预算，按指数退避后重试同一次查询。
      retries += 1
      const backoff = Math.min(15000, 1000 * 2 ** (retries - 1)) + Math.floor(Math.random() * 400)
      await sleep(backoff)
      continue
    }

    retries = 0
    lastStatus = status

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

    const remaining = deadline - Date.now()
    if (remaining <= 0) break
    await sleep(Math.min(interval, remaining))
  }

  const waitedMs = Date.now() - startedAt
  const waitedLabel = waitedMs >= 60_000
    ? `${Math.round(waitedMs / 60_000)} 分钟`
    : `${Math.max(1, Math.round(waitedMs / 1000))} 秒`
  const upstreamState = lastStatus?.status || lastStatus?.state
  const stateHint = upstreamState ? `，上游最后状态：${upstreamState}` : ''
  throw new Error(
    `视频生成超时（已等待约 ${waitedLabel}${stateHint}）。任务可能仍在生成，请稍后重试或切换模型。`,
  )
}

export function setVideoRatio(params: VideoGenerateRequest, aspectRatio: string) {
  params.aspect_ratio = aspectRatio
  params.ratio = aspectRatio
}

export function deleteVideoRatio(params: VideoGenerateRequest) {
  delete params.aspect_ratio
  delete params.ratio
}
