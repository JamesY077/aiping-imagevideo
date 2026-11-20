/**
 * 音色设计（Voice Design / 文生音色）预设。
 *
 * 灵感来自 VoiceStudio 的「voice gallery」：把「性别 + 年龄 + 音色质感 +
 * 语速 + 场景」拆成结构化配方，用一段固定文案试听，挑中后再拿去配音。
 * 上游接口：POST /audio/minimax/voices/design（返回 trial_audio + voice_id）。
 *
 * 注意：设计出来的音色是「临时音色」，7 天内没有真正用于合成会被上游删除；
 * 只要用它合成过一次，就会长期保留在账号里。
 */

import type { VoiceSceneKey } from './catalogMeta'

export interface VoiceDesignPreset {
  id: string
  /** 默认音色名（保存到「我设计的音色」时使用） */
  name: string
  /** 一句话说明 */
  blurb: string
  scenes: VoiceSceneKey[]
  tags: string[]
  /** 交给模型的音色描述 */
  prompt: string
  /** 试听文案：和音色人设匹配，试听时更容易判断 */
  previewText: string
}

export const DEFAULT_DESIGN_PREVIEW_TEXT =
  '夜色慢慢落下来，城市的灯一盏一盏亮起。我们把这个故事，从头讲一遍。'

export const VOICE_DESIGN_PRESETS: VoiceDesignPreset[] = [
  {
    id: 'documentary-narrator',
    name: '纪录片旁白',
    blurb: '低沉克制，适合画面解说与品牌片',
    scenes: ['narration'],
    tags: ['男声', '中年', '纪录片'],
    prompt:
      '低沉厚实的中年男性旁白声音，普通话标准，语速偏慢、停顿克制，气息稳，像纪录片解说，情绪内敛但很有分量。',
    previewText: '清晨的雾还没有散尽，山脊像一条沉睡的线。风穿过松林，把远处的声音一层层送过来。',
  },
  {
    id: 'late-night-radio',
    name: '深夜电台',
    blurb: '气声低语，适合睡前与情感内容',
    scenes: ['podcast', 'companion'],
    tags: ['女声', '青年', '治愈'],
    prompt:
      '温柔松弛的青年女性声音，带一点气声，音量偏小、语速很慢，像深夜电台主播在耳边说话，安静、亲密、有陪伴感。',
    previewText: '今天辛苦了。把灯关掉，把手机放远一点，剩下的故事，我慢慢讲给你听。',
  },
  {
    id: 'news-anchor',
    name: '新闻播报',
    blurb: '标准播音腔，字正腔圆',
    scenes: ['news'],
    tags: ['女声', '中年', '播音腔'],
    prompt:
      '专业新闻主播声音，中年女性，普通话非常标准，字正腔圆、吐字清晰，语速均匀，语气客观而有权威感。',
    previewText: '各位晚上好，欢迎收看今天的新闻。首先来关注一组最新的数据和现场报道。',
  },
  {
    id: 'ad-energetic',
    name: '广告口播',
    blurb: '清亮元气，节奏明快有钩子',
    scenes: ['commercial'],
    tags: ['女声', '青年', '元气'],
    prompt:
      '清亮有弹性的青年女性广告口播声音，普通话标准，语速偏快、节奏明快，句尾上扬，情绪饱满有感染力。',
    previewText: '别再犹豫了！今天下单，明天就能用上。一杯好咖啡，只要三十秒。',
  },
  {
    id: 'knowledge-explainer',
    name: '知识讲解',
    blurb: '理性清楚，适合科普与课程',
    scenes: ['education'],
    tags: ['男声', '青年', '理性'],
    prompt:
      '沉稳理性的青年男性讲解声音，普通话标准，咬字清楚，语速中等偏慢，逻辑重音明显，像在认真讲一门课。',
    previewText: '我们先看第一个问题：为什么海水是咸的？答案藏在几十亿年的地质运动里。',
  },
  {
    id: 'audiobook-warm',
    name: '有声书',
    blurb: '娓娓道来，长段落不累',
    scenes: ['audiobook', 'narration'],
    tags: ['女声', '中年', '叙事'],
    prompt:
      '娓娓道来的中年女性叙事声音，普通话标准，声音温润，语速平缓，情绪随文字自然起伏，适合长篇有声书。',
    previewText: '那年冬天特别冷。她站在车站的尽头，手里攥着一张已经揉皱的车票。',
  },
  {
    id: 'drama-heroine',
    name: '都市剧女主',
    blurb: '干练御姐，带一点锋利',
    scenes: ['character'],
    tags: ['女声', '青年', '御姐'],
    prompt:
      '干练成熟的青年女性角色声音，普通话标准，中低音区，语气带一点锋利和距离感，像都市剧里有主见的女主角。',
    previewText: '这件事我不会再解释第二遍。你要么现在相信我，要么就当我从来没说过。',
  },
  {
    id: 'anime-hero',
    name: '少年主角',
    blurb: '清亮少年感，热血不油腻',
    scenes: ['character', 'kids'],
    tags: ['男声', '少年', '热血'],
    prompt:
      '清亮有朝气的少年男性声音，普通话标准，音色偏亮，语气真诚，带一点不服输的冲劲，适合动画男主角。',
    previewText: '就算所有人都说不可能，我也要试一次。因为这一次，我想赢。',
  },
  {
    id: 'anime-sweet',
    name: '动漫萌妹',
    blurb: '甜脆软糯，情绪起伏大',
    scenes: ['character', 'kids'],
    tags: ['女声', '少年', '可爱'],
    prompt:
      '甜脆软糯的少年女性声音，普通话标准，音调偏高，尾音轻轻上扬，情绪起伏明显，像动画里的可爱少女角色。',
    previewText: '诶？你终于来啦！我等了好久好久，快来快来，我给你留了最好吃的那一个。',
  },
  {
    id: 'villain-whisper',
    name: '反派低语',
    blurb: '阴冷压迫，适合悬疑与科幻',
    scenes: ['character'],
    tags: ['男声', '中年', '悬疑'],
    prompt:
      '阴冷克制的男性反派声音，普通话标准，低音区，语速很慢，气声里带一点笑，像在耳边低声威胁。',
    previewText: '你以为你逃掉了吗？从你踏进这扇门的那一刻起，结局就已经写好了。',
  },
  {
    id: 'uncle-warm',
    name: '憨厚大叔',
    blurb: '市井烟火气，亲切接地气',
    scenes: ['character', 'commercial'],
    tags: ['男声', '中年', '生活化'],
    prompt:
      '憨厚爽朗的中年男性声音，带一点北方口音，普通话整体清晰，语速不快，笑的时候很实在，有市井烟火气。',
    previewText: '哎，来啦？刚出锅的，热乎着呢。先尝一口，不好吃不要钱。',
  },
  {
    id: 'storyteller-guofeng',
    name: '国风说书',
    blurb: '评书腔，起承转合有味道',
    scenes: ['audiobook', 'podcast'],
    tags: ['男声', '中年', '国风'],
    prompt:
      '传统评书先生的声音，中年男性，普通话清晰，带一点说书腔，节奏顿挫分明，关键处会拖长音、加重语气。',
    previewText: '话说那一日，风雨交加，城门将闭。偏偏就在此时，一匹快马自远处疾驰而来。',
  },
  {
    id: 'corporate-film',
    name: '企业宣传片',
    blurb: '庄重大气，适合品牌与发布会',
    scenes: ['narration', 'commercial'],
    tags: ['男声', '中年', '大气'],
    prompt:
      '庄重大气的企业宣传片男声，普通话标准，中低音，共鸣饱满，语速稳健，句与句之间留出空间，有仪式感。',
    previewText: '十年时间，我们把一个问题，做成了一份事业。下一个十年，从这里开始。',
  },
  {
    id: 'healing-companion',
    name: '治愈陪伴',
    blurb: '软糯邻家，适合情感与客服',
    scenes: ['companion'],
    tags: ['女声', '青年', '亲和'],
    prompt:
      '软糯亲切的邻家青年女性声音，普通话标准，声音偏轻偏暖，语速慢，句尾柔和，像在耐心安慰朋友。',
    previewText: '没关系呀，慢慢来就好。你已经做得很好了，剩下的我们一点一点解决。',
  },
  {
    id: 'epic-game-narrator',
    name: '游戏旁白',
    blurb: '史诗感，适合预告与世界观',
    scenes: ['narration', 'character'],
    tags: ['男声', '中年', '史诗'],
    prompt:
      '有史诗感的游戏旁白声音，男声，偏低沉沙哑，普通话标准，语速慢、气息长，情绪庄严，像在讲述一个古老世界。',
    previewText: '在光熄灭之前，最后一位守夜人走进了荒原。他的名字，后来成了传说。',
  },
  {
    id: 'kid-story-teller',
    name: '儿童故事',
    blurb: '活泼姐姐，角色切换自然',
    scenes: ['kids'],
    tags: ['女声', '青年', '活泼'],
    prompt:
      '活泼亲切的儿童故事姐姐声音，普通话标准，音色明亮，语速稍慢，情绪夸张可爱，能自然切换不同小动物的语气。',
    previewText: '小兔子蹦蹦跳跳地出门啦。它说：今天，我一定要找到最大的那根胡萝卜！',
  },
  {
    id: 'cute-pet',
    name: '萌宠角色',
    blurb: '奶声奶气，适合短视频与动画',
    scenes: ['kids', 'character'],
    tags: ['中性', '童声', '萌'],
    prompt:
      '奶声奶气的小动物角色声音，音调偏高、有点含混，普通话基本清晰，情绪直白，适合短视频里的萌宠配音。',
    previewText: '主人主人！你回来啦！我今天有乖乖吃饭哦，真的，一口都没剩！',
  },
]

/** 场景筛选：只保留预设里真实出现的场景，避免空分组。 */
export function getDesignSceneOptions(): { key: VoiceSceneKey | 'all'; label: string }[] {
  const used = new Set<VoiceSceneKey>()
  for (const preset of VOICE_DESIGN_PRESETS) preset.scenes.forEach((scene) => used.add(scene))
  return [
    { key: 'all', label: '全部配方' },
    ...(
      [
        ['narration', '旁白解说'],
        ['commercial', '广告口播'],
        ['news', '新闻播报'],
        ['character', '角色对白'],
        ['companion', '温柔陪伴'],
        ['kids', '童声动画'],
        ['podcast', '电台播客'],
        ['audiobook', '有声书'],
        ['education', '知识讲解'],
      ] as Array<[VoiceSceneKey, string]>
    )
      .filter(([key]) => used.has(key))
      .map(([key, label]) => ({ key, label })),
  ]
}
