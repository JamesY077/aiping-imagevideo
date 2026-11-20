/**
 * 音色目录的展示逻辑：语言分组、筛选、搜索与兜底数据。
 *
 * 上游 /voices/list 返回 300+ 个系统音色（voice_id 形如 `Chinese (Mandarin)_News_Anchor`），
 * 页面按语言分组 + 关键词搜索，避免一次性铺满列表。
 */

import type { SystemVoice } from './types'
import { getVoiceMeta, getVoiceSearchKeywords } from './catalogMeta'

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

/**
 * 老一代 MiniMax 音色没有语言前缀（`male-qn-qingse`、`female-yujie` …），
 * 只能靠 id 白名单判断。不能简单用「带下划线就是中文」：`greek_male_1a_v1`
 * 这类小语种会被误判成普通话。
 */
const LEGACY_ZH_PREFIXES = ['male-qn-', 'female-']
const LEGACY_ZH_IDS = new Set([
  'clever_boy',
  'cute_boy',
  'lovely_girl',
  'cartoon_pig',
  'bingjiao_didi',
  'junlang_nanyou',
  'chunzhen_xuedi',
  'lengdan_xiongzhang',
  'badao_shaoye',
  'tianxin_xiaoling',
  'qiaopi_mengmei',
  'wumei_yujie',
  'diadia_xuemei',
  'danya_xuejie',
  'Arrogant_Miss',
  'Robot_Armor',
])

function isLegacyMandarin(voiceId: string): boolean {
  return (
    LEGACY_ZH_IDS.has(voiceId) ||
    LEGACY_ZH_PREFIXES.some((prefix) => voiceId.startsWith(prefix))
  )
}

/** 由 voice_id 推断语言分组。 */
export function parseVoiceLanguage(voiceId: string): { key: VoiceLanguageKey; label: string } {
  const prefix = voiceId.split('_')[0]
  const key = PREFIX_LANGUAGE[prefix] || (isLegacyMandarin(voiceId) ? 'zh' : 'other')
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
  design: '设计',
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
  finnish: '芬兰语',
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
    description: '经典青涩青年男声，带一点学生气，适合校园与日常对白。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'female-shaonv',
    name: '少女音色',
    description: '经典清亮少女音色，适合角色对白与轻快内容。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'female-chengshu',
    name: '成熟女性音色',
    description: '知性成熟的女性声音，适合旁白与有声书。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'male-qn-jingying',
    name: '精英青年音色',
    description: '干净利落的精英青年男声，适合商务与讲解。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'female-tianmei',
    name: '甜美女性音色',
    description: '甜美亲和的女性声音，适合广告与陪伴类内容。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'female-yujie',
    name: '御姐音色',
    description: '气场十足的御姐声音，适合都市剧与角色对白。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Sweet_Lady',
    name: '甜美女声',
    description: '一位温柔甜美的青年女性声音，标准普通话。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Wise_Women',
    name: '阅历姐姐',
    description: '一位富有阅历、声音抒情的中年姐姐声音，标准普通话。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Warm_Girl',
    name: '温暖少女',
    description: '一位温柔温暖的少年女声，标准普通话。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Kind-hearted_Elder',
    name: '花甲奶奶',
    description: '一位慈祥和蔼的老年女性奶奶声音，标准普通话。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Chinese (Mandarin)_Humorous_Elder',
    name: '搞笑大爷',
    description: '一位爽朗幽默的老年男性大爷声音，带有北方口音的中文。',
    createdAt: '',
    language: 'zh',
  },
  {
    voiceId: 'Cantonese_ProfessionalHost（F)',
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
  {
    title: '新闻播报',
    desc: '标准播音腔，字正腔圆',
    text: '各位晚上好，欢迎收看今天的新闻。首先来关注一组最新的数据和现场报道。',
    voiceId: 'Chinese (Mandarin)_News_Anchor',
    voiceName: '新闻女声',
  },
  {
    title: '有声书',
    desc: '娓娓道来，适合长段落',
    text: '那年冬天特别冷。她站在车站的尽头，手里攥着一张已经揉皱的车票，迟迟没有上车。',
    voiceId: 'female-chengshu',
    voiceName: '成熟女性音色',
  },
  {
    title: '短视频带货',
    desc: '口语化，短句有钩子',
    text: '别再犹豫了！今天下单，明天就能用上。这个价格，真的是最后一次了。',
    voiceId: 'Chinese (Mandarin)_Warm_Bestie',
    voiceName: '温暖闺蜜',
  },
  {
    title: '睡前电台',
    desc: '气声低语，慢速治愈',
    text: '今天辛苦了。把灯关掉，把手机放远一点，剩下的故事，我慢慢讲给你听。',
    voiceId: 'Chinese (Mandarin)_Sweet_Lady',
    voiceName: '甜美女声',
  },
  {
    title: '儿童故事',
    desc: '活泼可爱，适合绘本动画',
    text: '小兔子蹦蹦跳跳地出门啦。它说：今天，我一定要找到最大的那根胡萝卜！',
    voiceId: 'Chinese (Mandarin)_Warm_Girl',
    voiceName: '温暖少女',
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
      // 常用音色权重更高，排在分组最前面；同权重按名称排序。
      voices: (buckets.get(key) || []).sort((left, right) => {
        const weightDiff = (getVoiceMeta(right)?.weight || 0) - (getVoiceMeta(left)?.weight || 0)
        if (weightDiff !== 0) return weightDiff
        return left.name.localeCompare(right.name, 'zh-Hans-CN')
      }),
    }))
}

/** 关键词搜索：匹配名称、voice_id、描述，以及性别 / 年龄 / 场景标签。 */
export function matchesVoiceQuery(voice: SystemVoice, query: string): boolean {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return true
  return (
    voice.name.toLowerCase().includes(keyword) ||
    voice.voiceId.toLowerCase().includes(keyword) ||
    voice.description.toLowerCase().includes(keyword) ||
    getVoiceSearchKeywords(voice).toLowerCase().includes(keyword)
  )
}
