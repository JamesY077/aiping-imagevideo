/**
 * 配音创作（TTS / 声音复刻）的数据结构。
 *
 * 字段命名与 AIPing MiniMax 音频接口对齐：
 * - 语音合成：POST /audio/speech
 * - 音色查询：POST /audio/minimax/voices/list
 * - 样本上传：POST /audio/minimax/voices/upload
 * - 快速复刻：POST /audio/minimax/voices/clone
 * - 移除音色：POST /audio/minimax/voices/delete
 */

/** 音色来源：系统内置 / 快速复刻。 */
export type VoiceSource = 'system' | 'clone'

/** 输出音频格式（wav / flac / pcm 仅非流式可用）。 */
export type SpeechAudioFormat = 'mp3' | 'wav' | 'flac' | 'pcm'

/** 支持的情绪标签（Speech 2.8 系列不支持 whisper）。 */
export type VoiceEmotion = 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised' | 'calm'

/** voice_setting：音色与发音设置。 */
export interface VoiceSetting {
  voiceId: string
  /** 语速，取值 [0.5, 2]，1 为原速 */
  speed: number
  /** 音量，取值 (0, 10]，1 为原始音量 */
  vol: number
  /** 语调，取值 [-12, 12]，0 为原音色 */
  pitch: number
  /** 情绪，留空表示不指定 */
  emotion: VoiceEmotion | ''
}

/** audio_setting：音频格式与采样参数。 */
export interface SpeechAudioSetting {
  format: SpeechAudioFormat
  sampleRate: number
  /** 比特率仅 mp3 生效 */
  bitrate: number
  channel: 1 | 2
}

/** 一次语音合成请求。 */
export interface SpeechRequest {
  model: string
  text: string
  voice: VoiceSetting
  audio: SpeechAudioSetting
  /** 中英文文本规范化（数字、单位等读法） */
  textNormalization: boolean
}

/** 一次语音合成结果（音频已在前端转成 Blob，避免依赖上游临时链接）。 */
export interface SpeechResult {
  blob: Blob
  /** blob: 临时地址，页面卸载时需 revoke */
  url: string
  format: SpeechAudioFormat
  /** 音频时长（毫秒） */
  durationMs: number
  /** 计费字符数，来自上游 usage_characters */
  usageCharacters: number
  /** 音频字节数 */
  size: number
  traceId: string
  createdAt: number
}

/** 系统内置音色。 */
export interface SystemVoice {
  voiceId: string
  name: string
  description: string
  createdAt: string
  /** 由 voice_id 前缀推断的语言分组 key */
  language: string
}

/** 账号下的复刻音色（服务端已存在的）。 */
export interface RemoteClonedVoice {
  voiceId: string
  name: string
  createdAt: string
}

/** 音色目录：系统音色 + 账号复刻音色。 */
export interface VoiceCatalog {
  system: SystemVoice[]
  cloned: RemoteClonedVoice[]
}

/** 本地留存的复刻音色（没有后端，因此只存在浏览器里）。 */
export interface StoredClonedVoice {
  voiceId: string
  name: string
  createdAt: number
  /** 试听音频本地副本（小文件 dataURL），远程链接过期后仍可回放 */
  demoDataUrl?: string
  /** 上游返回的试听链接（约 2 天有效） */
  demoUrl?: string
  durationMs?: number
}

/** 一次性试听（试听音色 / 复刻试听）的播放数据。 */
export interface VoicePreview {
  url: string
  durationMs: number
  format: SpeechAudioFormat
  createdAt: number
  /** 波形峰值（试听时顺带解析，供播放器显示） */
  waveform?: number[]
  /** 试听对应的音色，切换音色后自动隐藏 */
  voiceId?: string
}

/** 配音生成记录。 */
export interface VoiceHistoryItem {
  id: string
  text: string
  voiceId: string
  voiceName: string
  model: string
  createdAt: number
  durationMs: number
  usageCharacters: number
  audioUrl: string
  format: SpeechAudioFormat
  size: number
}

/**
 * 配音音频库条目：只保存用户真正生成完成的音频。
 * 音频 Blob 存在 IndexedDB 中，因此离开配音页、刷新浏览器后仍可被视频生成选择。
 */
export interface VoiceLibraryItem {
  id: string
  text: string
  voiceId: string
  voiceName: string
  model: string
  createdAt: number
  durationMs: number
  usageCharacters: number
  format: SpeechAudioFormat
  size: number
  blob: Blob
}

/** 复刻流程阶段。 */
export type CloneStage = 'idle' | 'uploading' | 'cloning' | 'done'

/** 复刻结果。 */
export interface CloneResult {
  voiceId: string
  demoUrl?: string
  demoDataUrl?: string
  durationMs?: number
}

/** 待复刻的样本音频。 */
export interface CloneSample {
  blob: Blob
  name: string
  /** 时长（秒），无法解析时为 0 */
  durationSec: number
  size: number
  source: 'upload' | 'record'
  /** 浏览器侧预览地址 */
  previewUrl: string
}

/** 页面里持久化的演绎参数（下次进入沿用）。 */
export interface VoiceSettingsSnapshot {
  voiceId: string
  speed: number
  vol: number
  pitch: number
  emotion: VoiceEmotion | ''
  format: SpeechAudioFormat
  sampleRate: number
  bitrate: number
  channel: 1 | 2
  textNormalization: boolean
  languageFilter: string
}
