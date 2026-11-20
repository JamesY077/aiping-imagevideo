/**
 * 音色目录的增强元数据：性别、年龄段与适用场景。
 *
 * 上游 `/voices/list` 只返回 voice_id 和名称，老一代音色连描述都没有；
 * 50 多个普通话音色平铺在一个列表里很难挑。这里给已知音色补一份策展
 * 元数据，其余音色按名称 / 描述关键词兜底推断，从而支持：
 * - 按「场景 / 性别」筛选
 * - 用「旁白」「御姐」「童声」这类词搜索
 * - 卡片上直接看到「女 · 青年 · 旁白」标签
 */

import type { SystemVoice } from './types'

export type VoiceGender = 'female' | 'male' | 'neutral'

export type VoiceSceneKey =
  | 'narration'
  | 'commercial'
  | 'news'
  | 'character'
  | 'companion'
  | 'kids'
  | 'podcast'
  | 'audiobook'
  | 'education'

export const VOICE_SCENES: { key: VoiceSceneKey; label: string }[] = [
  { key: 'narration', label: '旁白解说' },
  { key: 'commercial', label: '广告口播' },
  { key: 'news', label: '新闻播报' },
  { key: 'character', label: '角色对白' },
  { key: 'companion', label: '温柔陪伴' },
  { key: 'kids', label: '童声动画' },
  { key: 'podcast', label: '电台播客' },
  { key: 'audiobook', label: '有声书' },
  { key: 'education', label: '知识讲解' },
]

export const VOICE_SCENE_LABELS: Record<VoiceSceneKey, string> = VOICE_SCENES.reduce(
  (map, scene) => {
    map[scene.key] = scene.label
    return map
  },
  {} as Record<VoiceSceneKey, string>,
)

/** 卡片标签用的短名，避免「温柔陪伴」这类长词把一行占满。 */
const VOICE_SCENE_SHORT_LABELS: Record<VoiceSceneKey, string> = {
  narration: '旁白',
  commercial: '口播',
  news: '播报',
  character: '角色',
  companion: '陪伴',
  kids: '童声',
  podcast: '播客',
  audiobook: '有声书',
  education: '讲解',
}

export const VOICE_GENDER_LABELS: Record<VoiceGender, string> = {
  female: '女声',
  male: '男声',
  neutral: '中性',
}

export interface VoiceMeta {
  gender: VoiceGender
  /** 年龄段：童声 / 少年 / 青年 / 中年 / 老年 */
  age: string
  scenes: VoiceSceneKey[]
  /** 排序权重，越大越靠前 */
  weight: number
  /** 额外标签，参与搜索与展示 */
  tags: string[]
}

type MetaRow = [voiceId: string, gender: VoiceGender, age: string, scenes: VoiceSceneKey[], weight?: number, tags?: string[]]

/**
 * 策展表：覆盖全部普通话 / 粤语内置音色。
 * weight 让常用音色排在分组最前面，不用每次都往下翻。
 */
const META_ROWS: MetaRow[] = [
  // ---------- 新一代 Mandarin 音色 ----------
  ['Chinese (Mandarin)_Male_Announcer', 'male', '中年', ['narration', 'news', 'audiobook'], 100, ['磁性', '权威']],
  ['Chinese (Mandarin)_News_Anchor', 'female', '中年', ['news', 'narration'], 98, ['播音腔', '专业']],
  ['Chinese (Mandarin)_Warm_Bestie', 'female', '青年', ['companion', 'podcast'], 96, ['闺蜜', '亲切']],
  ['Chinese (Mandarin)_Crisp_Girl', 'female', '少年', ['commercial', 'character'], 95, ['清脆', '元气']],
  ['Chinese (Mandarin)_Gentleman', 'male', '青年', ['narration', 'audiobook', 'companion'], 94, ['温润', '磁性']],
  ['Chinese (Mandarin)_Sweet_Lady', 'female', '青年', ['commercial', 'companion'], 92, ['甜美', '温柔']],
  ['Chinese (Mandarin)_Reliable_Executive', 'male', '中年', ['commercial', 'education', 'news'], 90, ['沉稳', '商务']],
  ['Chinese (Mandarin)_Mature_Woman', 'female', '青年', ['character', 'commercial'], 88, ['御姐', '妩媚']],
  ['Chinese (Mandarin)_Radio_Host', 'male', '青年', ['podcast', 'narration'], 86, ['诗意', '夜间电台']],
  ['Chinese (Mandarin)_Warm_Girl', 'female', '少年', ['companion', 'audiobook'], 84, ['温暖', '治愈']],
  ['Chinese (Mandarin)_Lyrical_Voice', 'male', '青年', ['audiobook', 'narration'], 82, ['抒情', '磁性']],
  ['Chinese (Mandarin)_Gentle_Youth', 'male', '少年', ['companion', 'character'], 80, ['温柔', '少年感']],
  ['Chinese (Mandarin)_Kind-hearted_Antie', 'female', '中年', ['character', 'companion'], 78, ['热心', '市井']],
  ['Chinese (Mandarin)_Kind-hearted_Elder', 'female', '老年', ['audiobook', 'character'], 76, ['慈祥', '奶奶']],
  ['Chinese (Mandarin)_Humorous_Elder', 'male', '老年', ['character', 'podcast'], 74, ['幽默', '北方口音']],
  ['Chinese (Mandarin)_Wise_Women', 'female', '中年', ['narration', 'audiobook', 'education'], 72, ['阅历', '抒情']],
  ['Chinese (Mandarin)_Gentle_Senior', 'female', '青年', ['companion', 'education'], 70, ['学姐', '温柔']],
  ['Chinese (Mandarin)_Unrestrained_Young_Man', 'male', '青年', ['character', 'commercial'], 68, ['潇洒', '不羁']],
  ['Chinese (Mandarin)_Sincere_Adult', 'male', '青年', ['education', 'commercial'], 66, ['真诚', '鼓励']],
  ['Chinese (Mandarin)_Straightforward_Boy', 'male', '少年', ['character', 'companion'], 64, ['率真', '弟弟']],
  ['Chinese (Mandarin)_Pure-hearted_Boy', 'male', '少年', ['companion', 'character'], 62, ['清澈', '邻家']],
  ['Chinese (Mandarin)_Stubborn_Friend', 'male', '青年', ['character'], 60, ['嘴硬', '竹马']],
  ['Chinese (Mandarin)_Southern_Young_Man', 'male', '青年', ['character', 'podcast'], 58, ['南方口音', '质朴']],
  ['Chinese (Mandarin)_Soft_Girl', 'female', '青年', ['companion', 'character'], 56, ['软糯', '南方口音']],
  ['Chinese (Mandarin)_HK_Flight_Attendant', 'female', '中年', ['commercial', 'news'], 54, ['港普', '礼貌']],
  ['Chinese (Mandarin)_Cute_Spirit', 'male', '童声', ['kids', 'character'], 52, ['呆萌', '萌兽']],

  // 经典英文命名、但描述里写明「标准普通话」的两个音色
  ['Arrogant_Miss', 'female', '青年', ['character'], 50, ['嚣张', '傲气']],
  ['Robot_Armor', 'male', '青年', ['character', 'narration'], 50, ['机械', '科幻']],

  // ---------- 经典 MiniMax 音色 ----------
  ['female-chengshu', 'female', '中年', ['narration', 'audiobook'], 70, ['成熟', '知性']],
  ['male-qn-jingying', 'male', '青年', ['commercial', 'education'], 69, ['精英', '干净']],
  ['female-yujie', 'female', '青年', ['character', 'commercial'], 67, ['御姐', '气场']],
  ['female-tianmei', 'female', '青年', ['commercial', 'companion'], 65, ['甜美', '亲和']],
  ['male-qn-qingse', 'male', '青年', ['character', 'companion'], 63, ['青涩', '学生气']],
  ['female-shaonv', 'female', '少年', ['character', 'companion'], 61, ['少女', '清亮']],
  ['male-qn-daxuesheng', 'male', '青年', ['podcast', 'education'], 59, ['大学生', '阳光']],
  ['male-qn-badao', 'male', '青年', ['character'], 57, ['霸道', '低沉']],
  ['junlang_nanyou', 'male', '青年', ['companion', 'character'], 51, ['男友', '俊朗']],
  ['tianxin_xiaoling', 'female', '青年', ['companion', 'character'], 50, ['甜心', '软萌']],
  ['danya_xuejie', 'female', '青年', ['audiobook', 'companion'], 49, ['淡雅', '学姐']],
  ['wumei_yujie', 'female', '青年', ['character'], 48, ['妩媚', '御姐']],
  ['qiaopi_mengmei', 'female', '少年', ['character', 'commercial'], 47, ['俏皮', '萌妹']],
  ['diadia_xuemei', 'female', '少年', ['companion', 'character'], 46, ['嗲', '学妹']],
  ['bingjiao_didi', 'male', '少年', ['character'], 45, ['病娇', '弟弟']],
  ['lengdan_xiongzhang', 'male', '青年', ['character'], 44, ['冷淡', '学长']],
  ['chunzhen_xuedi', 'male', '少年', ['companion', 'character'], 43, ['纯真', '学弟']],
  ['badao_shaoye', 'male', '青年', ['character'], 42, ['霸道', '少爷']],
  ['clever_boy', 'male', '童声', ['kids'], 41, ['聪明', '男童']],
  ['cute_boy', 'male', '童声', ['kids'], 40, ['可爱', '男童']],
  ['lovely_girl', 'female', '童声', ['kids'], 39, ['萌萌', '女童']],
  ['cartoon_pig', 'neutral', '童声', ['kids', 'character'], 38, ['卡通', '搞笑']],

  // 经典音色的 beta（新版）版本：同类型，权重略低
  ['male-qn-jingying-jingpin', 'male', '青年', ['commercial', 'education'], 37, ['精英', '新版']],
  ['female-chengshu-jingpin', 'female', '中年', ['narration', 'audiobook'], 36, ['成熟', '新版']],
  ['female-yujie-jingpin', 'female', '青年', ['character', 'commercial'], 35, ['御姐', '新版']],
  ['female-tianmei-jingpin', 'female', '青年', ['commercial', 'companion'], 34, ['甜美', '新版']],
  ['male-qn-qingse-jingpin', 'male', '青年', ['character', 'companion'], 33, ['青涩', '新版']],
  ['female-shaonv-jingpin', 'female', '少年', ['character', 'companion'], 32, ['少女', '新版']],
  ['male-qn-daxuesheng-jingpin', 'male', '青年', ['podcast', 'education'], 31, ['大学生', '新版']],
  ['male-qn-badao-jingpin', 'male', '青年', ['character'], 30, ['霸道', '新版']],

  // ---------- 粤语 ----------
  ['Cantonese_ProfessionalHost（F)', 'female', '青年', ['news', 'podcast'], 60, ['粤语主持']],
  ['Cantonese_ProfessionalHost（M)', 'male', '青年', ['news', 'podcast'], 59, ['粤语主持']],
  ['Cantonese_GentleLady', 'female', '青年', ['companion', 'audiobook'], 58, ['粤语', '温柔']],
  ['Cantonese_PlayfulMan', 'male', '青年', ['character'], 57, ['粤语', '活泼']],
  ['Cantonese_KindWoman', 'female', '青年', ['companion', 'narration'], 56, ['粤语', '亲切']],
  ['Cantonese_CuteGirl', 'female', '青年', ['character', 'companion'], 55, ['粤语', '可爱']],
]

const META: Record<string, VoiceMeta> = {}
for (const [voiceId, gender, age, scenes, weight = 0, tags = []] of META_ROWS) {
  META[voiceId] = { gender, age, scenes, weight, tags }
}

const WOMAN_PATTERN = /女声|女性|少女|闺蜜|姐姐|学姐|御姐|学妹|萌妹|女孩|女童|奶奶|大婶|空姐|女主|夫人|妈妈/
const MAN_PATTERN = /男声|男性|青年男性|少年|哥哥|学长|学弟|弟弟|男友|大爷|大叔|少爷|竹马|男童|男主|先生/
const GIRL_PATTERN = /少女|女童|萌妹|学妹|女孩|童声|萝莉/
const BOY_PATTERN = /男童|少年|学弟|弟弟|竹马/
const ELDER_PATTERN = /老年|大爷|奶奶|花甲|长辈|慈祥/
const MIDDLE_PATTERN = /中年|高管|主播|大婶|知性|成熟/

const SCENE_PATTERNS: Array<[RegExp, VoiceSceneKey]> = [
  [/新闻|主播|播报|主持/, 'news'],
  [/旁白|解说|纪录|纪录片|叙述|朗读/, 'narration'],
  [/广告|口播|带货|宣传|促销/, 'commercial'],
  [/角色|台词|剧情|剧集|动漫|动画|游戏/, 'character'],
  [/电台|播客|夜间|深夜|访谈/, 'podcast'],
  [/有声书|书|故事|小说|评书/, 'audiobook'],
  [/讲解|课程|知识|科普|教学|老师/, 'education'],
  [/童|萌|宝宝|儿童/, 'kids'],
  [/陪伴|治愈|温柔|闺蜜|哄睡|晚安/, 'companion'],
]

/** 从名称 / 描述里兜底推断元数据（未收录的音色、上游新增音色都能有标签）。 */
function inferMeta(voice: SystemVoice): VoiceMeta {
  const haystack = `${voice.name} ${voice.description}`
  const gender: VoiceGender = WOMAN_PATTERN.test(haystack)
    ? 'female'
    : MAN_PATTERN.test(haystack)
      ? 'male'
      : 'neutral'

  const age = ELDER_PATTERN.test(haystack)
    ? '老年'
    : GIRL_PATTERN.test(haystack) || BOY_PATTERN.test(haystack)
      ? '少年'
      : MIDDLE_PATTERN.test(haystack)
        ? '中年'
        : '青年'

  const scenes: VoiceSceneKey[] = []
  for (const [pattern, key] of SCENE_PATTERNS) {
    if (pattern.test(haystack) && !scenes.includes(key)) scenes.push(key)
  }

  return {
    gender,
    age,
    scenes: scenes.length ? scenes.slice(0, 3) : ['narration'],
    weight: 0,
    tags: [],
  }
}

/** 取音色元数据；复刻音色 / 非中文音色返回 null。 */
export function getVoiceMeta(
  voice: Pick<SystemVoice, 'voiceId' | 'name' | 'description' | 'language'>,
): VoiceMeta | null {
  if (voice.language === 'clone') return null
  if (voice.language !== 'zh' && voice.language !== 'yue') return null
  return META[voice.voiceId] || inferMeta(voice as SystemVoice)
}

/** 卡片上的短标签，例如「女 · 青年 · 旁白」。 */
export function getVoiceMetaChips(
  voice: Pick<SystemVoice, 'voiceId' | 'name' | 'description' | 'language'>,
): string[] {
  const meta = getVoiceMeta(voice)
  if (!meta) return []

  const chips = [VOICE_GENDER_LABELS[meta.gender], meta.age]
  const scene = meta.scenes[0]
  if (scene) chips.push(VOICE_SCENE_SHORT_LABELS[scene])
  return chips
}

/** 场景 / 性别筛选；音色没有元数据时只在筛选为「全部」时显示。 */
export function matchesVoiceMeta(
  voice: Pick<SystemVoice, 'voiceId' | 'name' | 'description' | 'language'>,
  scene: VoiceSceneKey | 'all',
  gender: VoiceGender | 'all',
): boolean {
  if (scene === 'all' && gender === 'all') return true
  const meta = getVoiceMeta(voice)
  if (!meta) return false
  if (scene !== 'all' && !meta.scenes.includes(scene)) return false
  if (gender !== 'all' && meta.gender !== gender) return false
  return true
}

/** 场景同义词：让「纪录片」「哄睡」「带货」这类口语搜索也能命中。 */
const VOICE_SCENE_SEARCH_ALIASES: Record<VoiceSceneKey, string> = {
  narration: '纪录片 解说 朗读 叙述 旁白 配音员',
  commercial: '广告 口播 带货 促销 宣传片 电商',
  news: '新闻 播报 播音 主持 记者',
  character: '角色 台词 动漫 动画 游戏 影视 剧集',
  companion: '陪伴 哄睡 治愈 深夜 晚安 闺蜜 温柔',
  kids: '童声 儿童 宝宝 绘本 童话 小朋友',
  podcast: '播客 电台 访谈 夜间 深夜',
  audiobook: '有声书 小说 评书 故事 长文 朗读',
  education: '讲解 课程 科普 教学 老师 知识 培训',
}

/** 搜索用的附加关键词（场景、性别、年龄、自定义标签）。 */
export function getVoiceSearchKeywords(
  voice: Pick<SystemVoice, 'voiceId' | 'name' | 'description' | 'language'>,
): string {
  const meta = getVoiceMeta(voice)
  if (!meta) return ''
  return [
    VOICE_GENDER_LABELS[meta.gender],
    meta.age,
    ...meta.scenes.map((scene) => VOICE_SCENE_LABELS[scene]),
    // 「纪录片」「哄睡」这类口语说法不会出现在官方描述里，按场景补一组同义词。
    ...meta.scenes.map((scene) => VOICE_SCENE_SEARCH_ALIASES[scene]),
    ...meta.tags,
  ].join(' ')
}
