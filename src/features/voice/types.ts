/**
 * 配音创作的数据结构占位定义。
 * 后端接口接入前，页面与状态管理先按这套类型组织，避免后期大改。
 */

export type VoiceTaskStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface VoiceGenerateRequest {
  model: string
  /** 待合成的文本 */
  text: string
  /** 内置音色 ID 或克隆音色 ID */
  voiceId?: string
  /** 语速，1.0 为原速 */
  speed?: number
  /** 音量，1.0 为原始音量 */
  volume?: number
  /** 音高偏移 */
  pitch?: number
  /** 情绪标签，如 happy / sad / calm */
  emotion?: string
  /** 输出音频格式 */
  format?: 'mp3' | 'wav'
  /** 回调地址，可选 */
  callbackUrl?: string
}

export interface VoiceGenerateResult {
  /** 音频地址 */
  url: string
  /** 时长（秒） */
  duration?: number
  model: string
  createdAt: number
  /** 实际消费 */
  cost?: number
}

export interface VoiceTask {
  id: string
  status: VoiceTaskStatus
  progress: number
  request: VoiceGenerateRequest
  result?: VoiceGenerateResult
  error?: string
  createdAt: number
}
