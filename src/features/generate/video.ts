import { getVideoStatusWithProvider } from '@/api/aiping'
import type { VideoGenerateRequest, VideoStatusResponse } from '@/types/api'

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

  for (let i = 0; i < resolvedMaxAttempts; i++) {
    const status = await getVideoStatusWithProvider(taskId, provider, providerCreateEndpoint)
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

    await new Promise((resolve) => setTimeout(resolve, interval))
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
