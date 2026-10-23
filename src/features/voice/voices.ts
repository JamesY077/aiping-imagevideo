/**
 * 音色目录的展示逻辑：语言分组、筛选、搜索与兜底数据。
 *
 * 上游 /voices/list 返回 300+ 个系统音色（voice_id 形如 `Chinese (Mandarin)_News_Anchor`），
 * 页面按语言分组 + 关键词搜索，避免一次性铺满列表。
 */

import type { SystemVoice } from './types'

export const VOICE_LANGUAGES = [
  { key: 'zh', label: '普通话' },
  { key: 'yue', label: '粤语' },
  { key: 'en', label: '英语' },
  { key: 'ja', label: '日语' },
  { key: 'ko', label: '韩语' },
  { key: 'other', label: '其他语言' },
] as const

export type VoiceLanguageKey = (typeof VOICE_LANGUAGES)[number]['key'] | 'all'

const PREFIX_LANGUAGE: Record<string, VoiceLanguageKey> = {
  'Chinese (Mandarin)': 'zh',
  Cantonese: 'yue',
  English: 'en',
  Japanese: 'ja',
  Korean: 'ko',
}

/** 由 voice_id 推断语言分组（无前缀的老音色 id 归入普通话）。 */
export function parseVoiceLanguage(voiceId: string): { key: VoiceLanguageKey; label: string } {
  const prefix = voiceId.split('_')[0]
  const key = PREFIX_LANGUAGE[prefix] || (/^[a-z]+-/.test(voiceId) || /^[a-z]+_/.test(voiceId) ? 'zh' : 'other')
  const label = VOICE_LANGUAGES.find((item) => item.key === key)?.label || '其他语言'
  return { key, label }
}

export function getVoiceLanguageLabel(key: string): string {
  return VOICE_LANGUAGES.find((item) => item.key === key)?.label || '其他语言'
}

/** 音色卡片右上角的短标签；复刻音色没有可推断的语言，直接标「复刻」。 */
const VOICE_LANGUAGE_TAGS: Record<string, string> = {
  zh: '普通话',
  yue: '粤语',
  en: '英语',
  ja: '日语',
  ko: '韩语',
  other: '其他',
  clone: '复刻',
}

/** 上游把大量非中英日韩音色统一归到 other，卡片标签再按 voice_id 前缀细分。 */
const VOICE_PREFIX_LANGUAGE_TAGS: Record<string, string> = {
  portuguese: '葡萄牙语',
  spanish: '西班牙语',
  indonesian: '印尼语',
  russian: '俄语',
  french: '法语',
  italian: '意大利语',
  german: '德语',
  dutch: '荷兰语',
  arabic: '阿拉伯语',
  turkish: '土耳其语',
  ukrainian: '乌克兰语',
  vietnamese: '越南语',
  thai: '泰语',
  malay: '马来语',
  hindi: '印地语',
  polish: '波兰语',
  swedish: '瑞典语',
  romanian: '罗马尼亚语',
  czech: '捷克语',
  greek: '希腊语',
  filipino: '菲律宾语',
}

const VOICE_DESCRIPTION_LANGUAGE_TAGS: Array<[RegExp, string]> = [
  [/标准普通话|普通话/, '普通话'],
  [/粤语/, '粤语'],
  [/英语/, '英语'],
  [/日语/, '日语'],
  [/韩语/, '韩语'],
  ...Object.values(VOICE_PREFIX_LANGUAGE_TAGS).map(
    (label) => [new RegExp(label), label] as [RegExp, string],
  ),
]

export function getVoiceLanguageTag(
  voice: Pick<SystemVoice, 'language' | 'voiceId' | 'description'>,
): string {
  if (voice.language === 'clone') return '复刻'

  const baseTag = VOICE_LANGUAGE_TAGS[voice.language]
  if (baseTag && voice.language !== 'other') return baseTag

  const prefix = voice.voiceId.split('_')[0]?.toLowerCase()
  const prefixTag = prefix ? VOICE_PREFIX_LANGUAGE_TAGS[prefix] : ''
  if (prefixTag) return prefixTag

  const description = voice.description || ''
  const matched = VOICE_DESCRIPTION_LANGUAGE_TAGS.find(([pattern]) => pattern.test(description))
  return matched?.[1] || '其他'
}

/** 兜底系统音色：接口不可用时页面仍可操作。 */
export const FALLBACK_SYSTEM_VOICES: SystemVoice[] = [
  {
    voiceId: 'Chinese (Mandarin)_Warm_Bestie',
    name: '温暖闺蜜',
    description: '温暖清脆的青年女性闺蜜声音，标准普通话，友好而清晰。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Gentleman',
    name: '温润男声',
    description: '温润磁性的青年男性声音，标准普通话。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_News_Anchor',
    name: '新闻女声',
    description: '专业播音腔的中年女性新闻主播，标准普通话。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Reliable_Executive',
    name: '沉稳高管',
    description: '沉稳可靠的中年男性高管声音，标准普通话。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Crisp_Girl',
    name: '清脆少女',
    description: '温暖清脆的少女声音，标准普通话。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Male_Announcer',
    name: '播报男声',
    description: '一位富有磁性的中年男性播报员声音，标准普通话，清晰而权威。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Mature_Woman',
    name: '傲娇御姐',
    description: '一位妩媚成熟的青年御姐声音，标准普通话。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Radio_Host',
    name: '电台男主播',
    description: '富有诗意的青年男性电台主播声音，标准普通话。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'male-qn-qingse',
    name: '青涩青年音色',
    description: '经典青涩青年男声。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'female-shaonv',
    name: '少女音色',
    description: '经典少女音色。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Cantonese_ProfessionalHostFemale',
    name: '粤语女主持',
    description: '专业粤语女性主持声音。',
    createdAt: '',
    language: 'yue',
  },
  {
    voiceId: 'English_Graceful_Lady',
    name: 'Graceful Lady',
    description: 'A graceful English female voice.',
    createdAt: '',
    language: 'en',
  },
]

export const DEFAULT_VOICE_ID = FALLBACK_SYSTEM_VOICES[0].voiceId

/** 试听文本（约 30 字，单次试听成本很低）。 */
export function buildPreviewText(voiceName: string): string {
  return `你好，我是${voiceName}。这是一段音色试听，希望这个声音适合你的片子。`
}

/** 复刻完成后的自动试听文本。 */
export const CLONE_DEMO_TEXT = '你好，这是用我的声音复刻出来的音色，希望它听起来自然又好听。'

/** 脚本快捷示例：一次把文案和配套音色都设好。 */
export interface VoiceTextPreset {
  title: string
  desc: string
  text: string
  voiceId: string
  voiceName: string
}

export const TEXT_PRESETS: VoiceTextPreset[] = [
  {
    title: '纪录片旁白',
    desc: '沉稳叙述，适合画面解说',
    text: '清晨的雾还没有散尽，山脊像一条沉睡的线。风穿过松林，把远处的声音一层层送过来。',
    voiceId: 'Chinese (Mandarin)_Male_Announcer',
    voiceName: '播报男声',
  },
  {
    title: '广告口播',
    desc: '干净利落，节奏明快',
    text: '一杯好咖啡，不需要复杂的理由。三十秒萃取，刚好留住今天的第一口香气。',
    voiceId: 'Chinese (Mandarin)_Crisp_Girl',
    voiceName: '清脆少女',
  },
  {
    title: '角色台词',
    desc: '带情绪，可配合语气词',
    text: '你终于来了(laughs)。我等这一天，等了整整三年。<#0.6#>现在，把你知道的都告诉我。',
    voiceId: 'Chinese (Mandarin)_Mature_Woman',
    voiceName: '傲娇御姐',
  },
]

/** 按语言分组，并保持普通话优先、组内按名称排序。 */
export function groupVoicesByLanguage(
  voices: SystemVoice[],
  languageFilter: VoiceLanguageKey,
): { key: string; label: string; voices: SystemVoice[] }[] {
  const buckets = new Map<string, SystemVoice[]>()

  for (const voice of voices) {
    const key = voice.language || parseVoiceLanguage(voice.voiceId).key
    if (languageFilter !== 'all' && key !== languageFilter) continue
    const bucket = buckets.get(key)
    if (bucket) bucket.push(voice)
    else buckets.set(key, [voice])
  }

  const order = languageFilter === 'all' ? VOICE_LANGUAGES.map((item) => item.key) : [languageFilter]
  return order
    .filter((key) => (buckets.get(key)?.length || 0) > 0)
    .map((key) => ({
      key,
      label: getVoiceLanguageLabel(key),
      voices: (buckets.get(key) || []).sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN')),
    }))
}

/** 关键词搜索：匹配名称、voice_id 与描述。 */
export function matchesVoiceQuery(voice: SystemVoice, query: string): boolean {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return true
  return (
    voice.name.toLowerCase().includes(keyword) ||
    voice.voiceId.toLowerCase().includes(keyword) ||
    voice.description.toLowerCase().includes(keyword)
  )
}
