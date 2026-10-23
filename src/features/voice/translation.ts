/**
 * 配音文案翻译：目标语言、提示词与输出清洗。
 *
 * 翻译使用设置里的文本模型，不依赖语音模型；停顿标记和语气词标记需要原样保留，
 * 否则翻译后的文案会丢失节奏信息。
 */

import type { ChatMessage } from '@/types/api'

export interface TranslationLanguage {
  code: string
  /** 中文展示名 */
  label: string
  /** 语言自身的名称，帮助用户确认目标语言 */
  nativeLabel: string
  /** 发给模型的目标语言描述 */
  promptLabel: string
}

export const TRANSLATION_LANGUAGES: TranslationLanguage[] = [
  { code: 'zh-CN', label: '简体中文', nativeLabel: '简体中文', promptLabel: '简体中文（普通话）' },
  { code: 'zh-TW', label: '繁体中文', nativeLabel: '繁體中文', promptLabel: '繁体中文' },
  { code: 'en', label: '英语', nativeLabel: 'English', promptLabel: '英语（English）' },
  { code: 'ja', label: '日语', nativeLabel: '日本語', promptLabel: '日语（日本語）' },
  { code: 'ko', label: '韩语', nativeLabel: '한국어', promptLabel: '韩语（한국어）' },
  { code: 'yue', label: '粤语', nativeLabel: '粵語', promptLabel: '粤语' },
  { code: 'fr', label: '法语', nativeLabel: 'Français', promptLabel: '法语（Français）' },
  { code: 'de', label: '德语', nativeLabel: 'Deutsch', promptLabel: '德语（Deutsch）' },
  { code: 'es', label: '西班牙语', nativeLabel: 'Español', promptLabel: '西班牙语（Español）' },
  { code: 'pt', label: '葡萄牙语', nativeLabel: 'Português', promptLabel: '葡萄牙语（Português）' },
  { code: 'ru', label: '俄语', nativeLabel: 'Русский', promptLabel: '俄语（Русский）' },
  { code: 'it', label: '意大利语', nativeLabel: 'Italiano', promptLabel: '意大利语（Italiano）' },
  { code: 'ar', label: '阿拉伯语', nativeLabel: 'العربية', promptLabel: '阿拉伯语（العربية）' },
  { code: 'th', label: '泰语', nativeLabel: 'ไทย', promptLabel: '泰语（ไทย）' },
  { code: 'vi', label: '越南语', nativeLabel: 'Tiếng Việt', promptLabel: '越南语（Tiếng Việt）' },
  { code: 'id', label: '印尼语', nativeLabel: 'Bahasa Indonesia', promptLabel: '印尼语（Bahasa Indonesia）' },
  { code: 'ms', label: '马来语', nativeLabel: 'Bahasa Melayu', promptLabel: '马来语（Bahasa Melayu）' },
  { code: 'hi', label: '印地语', nativeLabel: 'हिन्दी', promptLabel: '印地语（हिन्दी）' },
]

export const TRANSLATION_SYSTEM_PROMPT = `你是一名专业的配音文案翻译。
请把用户提供的配音文案翻译成指定的目标语言，保持原意、语气、情绪和口语节奏。
严格保留原文中的换行、<#1.2#> 形式的停顿标记，以及 (laughs)、(sighs) 等括号语气词标记；这些标记不要翻译、增删或改写。
只输出翻译后的正文，不要解释，不要添加标题，不要使用 Markdown 代码块。`

export function buildTranslationMessages(source: string, language: TranslationLanguage): ChatMessage[] {
  return [
    { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `请将下面的配音文案翻译为${language.promptLabel}。\n\n${source}`,
    },
  ]
}

/** 去掉模型偶尔附带的代码块围栏或「译文：」前缀。 */
export function cleanTranslationOutput(raw: string): string {
  let result = raw.trim()
  if (!result) return ''

  const fenced = result.match(/^```[a-zA-Z-]*\s*\n([\s\S]*?)\n```$/)
  if (fenced?.[1]) result = fenced[1].trim()

  return result.replace(/^(译文|翻译|translation)\s*[:：]\s*/i, '').trim()
}
