/**
 * 配音创作的本地持久化。
 *
 * 项目没有后端，复刻音色本身保存在 MiniMax 侧（voice_id 有效），
 * 本地只记住：音色展示名、试听音频（小文件 dataURL）、以及上次使用的演绎参数。
 */

import { getItem, removeItem, setItem } from '@/utils/storage'
import { clampVoiceParam, DEFAULT_AUDIO_SETTING, DEFAULT_VOICE_MODEL_ID } from './models'
import type { SpeechAudioFormat, StoredClonedVoice, VoiceEmotion, VoiceSettingsSnapshot, RemoteClonedVoice } from './types'

const CLONED_VOICES_KEY = 'artrealm.voice.cloned.v1'
const SETTINGS_KEY = 'artrealm.voice.settings.v1'
/** 本地最多保留多少个复刻音色（演示环境足够，避免撑爆 localStorage）。 */
const MAX_LOCAL_CLONED_VOICES = 10

export function loadClonedVoices(): StoredClonedVoice[] {
  const raw = getItem<unknown>(CLONED_VOICES_KEY, [])
  if (!Array.isArray(raw)) return []

  return raw
    .filter((item): item is StoredClonedVoice => {
      const candidate = item as StoredClonedVoice
      return !!candidate && typeof candidate.voiceId === 'string' && typeof candidate.name === 'string'
    })
    .map((item) => ({
      voiceId: item.voiceId,
      name: item.name,
      createdAt: Number(item.createdAt) || Date.now(),
      demoDataUrl: item.demoDataUrl,
      demoUrl: item.demoUrl,
      durationMs: item.durationMs,
    }))
    .slice(0, MAX_LOCAL_CLONED_VOICES)
}

export function saveClonedVoices(voices: StoredClonedVoice[]): void {
  const payload = voices.slice(0, MAX_LOCAL_CLONED_VOICES)

  try {
    setItem(CLONED_VOICES_KEY, payload)
  } catch {
    // localStorage 配额不够时，优先丢弃较旧音色的试听音频，保证列表本身能存下。
    const slim = payload.map((voice, index) => (index < 3 ? voice : { ...voice, demoDataUrl: undefined }))
    try {
      setItem(CLONED_VOICES_KEY, slim)
    } catch {
      // 仍然失败就只保留最近 3 个，避免影响复刻主流程。
      try {
        setItem(CLONED_VOICES_KEY, slim.slice(0, 3))
      } catch {
        // 放弃持久化，前端内存里仍可用
      }
    }
  }
}

export function upsertClonedVoice(voice: StoredClonedVoice): StoredClonedVoice[] {
  const current = loadClonedVoices()
  const next = [voice, ...current.filter((item) => item.voiceId !== voice.voiceId)].slice(0, MAX_LOCAL_CLONED_VOICES)
  saveClonedVoices(next)
  return next
}

export function removeStoredClonedVoice(voiceId: string): StoredClonedVoice[] {
  const next = loadClonedVoices().filter((item) => item.voiceId !== voiceId)
  saveClonedVoices(next)
  return next
}

/**
 * 把账号里已有的复刻音色同步到本地列表（例如换了浏览器 / 清了缓存）。
 * 不覆盖本地已有的展示名与试听音频。
 */
export function syncClonedVoicesFromRemote(remote: RemoteClonedVoice[]): StoredClonedVoice[] {
  const local = loadClonedVoices()
  const localIds = new Set(local.map((item) => item.voiceId))
  const additions = remote
    .filter((item) => !localIds.has(item.voiceId))
    .map((item) => ({
      voiceId: item.voiceId,
      name: item.name || item.voiceId,
      createdAt: Date.parse(`${item.createdAt}T00:00:00+08:00`) || Date.now(),
    }))

  if (!additions.length) return local

  const next = [...local, ...additions].slice(0, MAX_LOCAL_CLONED_VOICES)
  saveClonedVoices(next)
  return next
}

const EMOTIONS: VoiceEmotion[] = ['happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised', 'calm']
const FORMATS: SpeechAudioFormat[] = ['mp3', 'wav', 'flac']

export function loadVoiceSettings(): VoiceSettingsSnapshot {
  const raw = getItem<Partial<VoiceSettingsSnapshot>>(SETTINGS_KEY, {}) || {}
  const emotion = EMOTIONS.includes(raw.emotion as VoiceEmotion) ? (raw.emotion as VoiceEmotion) : ''
  const format = FORMATS.includes(raw.format as SpeechAudioFormat)
    ? (raw.format as SpeechAudioFormat)
    : DEFAULT_AUDIO_SETTING.format

  return {
    voiceId: typeof raw.voiceId === 'string' && raw.voiceId ? raw.voiceId : '',
    speed: clampVoiceParam('speed', Number(raw.speed)),
    vol: clampVoiceParam('vol', Number(raw.vol)),
    pitch: clampVoiceParam('pitch', Number(raw.pitch)),
    emotion,
    format,
    sampleRate: Number(raw.sampleRate) || DEFAULT_AUDIO_SETTING.sampleRate,
    bitrate: Number(raw.bitrate) || DEFAULT_AUDIO_SETTING.bitrate,
    channel: raw.channel === 2 ? 2 : 1,
    textNormalization: raw.textNormalization !== false,
    languageFilter: typeof raw.languageFilter === 'string' ? raw.languageFilter : 'zh',
  }
}

export function saveVoiceSettings(snapshot: VoiceSettingsSnapshot): void {
  setItem(SETTINGS_KEY, snapshot)
}

export function clearVoiceSettings(): void {
  removeItem(SETTINGS_KEY)
}

export const VOICE_STORAGE_DEFAULT_MODEL = DEFAULT_VOICE_MODEL_ID
