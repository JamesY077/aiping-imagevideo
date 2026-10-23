/**
 * 配音创作的音频工具集。
 *
 * 上游（AIPing → MiniMax）非流式接口返回的是 hex 编码音频；
 * 这里统一转成 Blob 播放 / 下载，并提供波形、时长、WAV 转码等能力。
 * 录音样本必须转 WAV 才能上传（MiniMax 只接受 mp3 / m4a / wav，浏览器录音多为 webm）。
 */

import type { SpeechAudioFormat } from './types'

const MIME_BY_FORMAT: Record<SpeechAudioFormat, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  flac: 'audio/flac',
  pcm: 'audio/L16',
}

export function audioMime(format: SpeechAudioFormat): string {
  return MIME_BY_FORMAT[format] || 'audio/mpeg'
}

export function audioExtension(format: SpeechAudioFormat): string {
  return format === 'pcm' ? 'pcm' : format
}

/** hex 字符串 → 字节数组。 */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim()
  const length = Math.floor(clean.length / 2)
  const bytes = new Uint8Array(length)
  for (let index = 0; index < length; index += 1) {
    const byte = Number.parseInt(clean.slice(index * 2, index * 2 + 2), 16)
    bytes[index] = Number.isFinite(byte) ? byte : 0
  }
  return bytes
}

export function bytesToBlob(bytes: Uint8Array, format: SpeechAudioFormat): Blob {
  // BlobPart 对 Uint8Array 的类型要求与 TS DOM 版本相关，这里复制一份标准 ArrayBuffer。
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buffer], { type: audioMime(format) })
}

/** 兼容 Safari 的 AudioContext 构造器。 */
export function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null
  if (typeof AudioContext !== 'undefined') return AudioContext
  const scope = window as Window & { webkitAudioContext?: typeof AudioContext }
  return scope.webkitAudioContext || null
}

/** 解码音频，失败返回 null（浏览器不支持该编码时）。 */
export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer | null> {
  const Ctor = getAudioContextCtor()
  if (!Ctor) return null

  const context = new Ctor()
  try {
    const arrayBuffer = await blob.arrayBuffer()
    const buffer = await context.decodeAudioData(arrayBuffer.slice(0))
    return buffer
  } catch {
    return null
  } finally {
    void context.close().catch(() => {})
  }
}

/** 音频时长（毫秒）；无法解析时返回 0。 */
export async function getAudioDurationMs(blob: Blob): Promise<number> {
  const buffer = await decodeAudioBlob(blob)
  return buffer ? Math.round(buffer.duration * 1000) : 0
}

/**
 * 计算波形峰值数组（0~1），用于播放器可视化。
 * 解码失败时返回空数组，播放器会退化成等宽条。
 */
export async function computeWaveform(blob: Blob, bars = 64): Promise<number[]> {
  const buffer = await decodeAudioBlob(blob)
  if (!buffer || buffer.length === 0) return []

  const channel = buffer.getChannelData(0)
  const step = Math.max(1, Math.floor(channel.length / bars))
  const peaks: number[] = []
  let maxPeak = 0

  for (let bar = 0; bar < bars; bar += 1) {
    const start = bar * step
    let peak = 0
    for (let index = 0; index < step; index += 1) {
      const value = Math.abs(channel[start + index] || 0)
      if (value > peak) peak = value
    }
    peaks.push(peak)
    if (peak > maxPeak) maxPeak = peak
  }

  if (maxPeak <= 0) return []
  return peaks.map((peak) => Math.min(1, Math.max(0.06, peak / maxPeak)))
}

/**
 * AudioBuffer → 单声道 16bit PCM WAV。
 * 录音样本统一用 32kHz 单声道，体积和 MiniMax 的识别效果比较平衡。
 */
export function encodeWavMono(buffer: AudioBuffer, targetSampleRate = 32000): Blob {
  const channels = buffer.numberOfChannels
  const ratio = buffer.sampleRate / targetSampleRate
  const outLength = Math.max(1, Math.floor(buffer.length / ratio))
  const channelData: Float32Array[] = []
  for (let channel = 0; channel < channels; channel += 1) {
    channelData.push(buffer.getChannelData(channel))
  }

  const samples = new Float32Array(outLength)
  for (let index = 0; index < outLength; index += 1) {
    const position = index * ratio
    const left = Math.floor(position)
    const right = Math.min(left + 1, buffer.length - 1)
    const fraction = position - left
    let mixed = 0
    for (const data of channelData) {
      mixed += data[left] * (1 - fraction) + data[right] * fraction
    }
    samples[index] = mixed / channels
  }

  const bytesPerSample = 2
  const dataSize = outLength * bytesPerSample
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeAscii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, targetSampleRate, true)
  view.setUint32(28, targetSampleRate * bytesPerSample, true)
  view.setUint16(32, bytesPerSample, true)
  view.setUint16(34, 16, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let index = 0; index < outLength; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += bytesPerSample
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' })
}

/** Blob → dataURL（超过 maxBytes 返回 undefined，避免把 localStorage 塞满）。 */
export function blobToDataUrl(blob: Blob, maxBytes = 320 * 1024): Promise<string | undefined> {
  if (blob.size > maxBytes) return Promise.resolve(undefined)

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined)
    reader.onerror = () => resolve(undefined)
    reader.readAsDataURL(blob)
  })
}

/** 远程音频 → dataURL（受 CORS 限制，失败返回 undefined）。 */
export async function remoteAudioToDataUrl(url: string, maxBytes = 320 * 1024): Promise<string | undefined> {
  try {
    const response = await fetch(url)
    if (!response.ok) return undefined
    const blob = await response.blob()
    if (blob.size > maxBytes) return undefined
    return await blobToDataUrl(blob, maxBytes)
  } catch {
    return undefined
  }
}

export function formatDurationMs(ms: number): string {
  if (!ms || ms < 0) return '0:00'
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** 复刻样本允许的扩展名 / MIME。 */
export const CLONE_SAMPLE_MAX_BYTES = 20 * 1024 * 1024
export const CLONE_SAMPLE_MIN_SECONDS = 10
export const CLONE_SAMPLE_MAX_SECONDS = 300

export function isCloneSampleFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const byExtension = /\.(mp3|m4a|wav)$/.test(name)
  const byMime = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/x-m4a', 'audio/m4a'].includes(
    file.type,
  )
  return byExtension || byMime
}

/**
 * 上传用的文件名：录音统一转成 wav；上传样本保留原扩展名（mp3 / m4a / wav）。
 * 上游只认这三种格式，其他扩展名一律按 mp3 兜底。
 */
export function normalizeCloneFileName(fileName: string, source: 'upload' | 'record'): string {
  const base = (fileName || '').replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40)
  const name = base.replace(/\.(mp3|m4a|wav)$/i, '')
  if (source === 'record') return `${name || 'recording'}.wav`

  const extension = /\.(mp3|m4a|wav)$/i.exec(fileName)?.[0].toLowerCase() || '.mp3'
  return `${name || 'sample'}${extension}`
}
