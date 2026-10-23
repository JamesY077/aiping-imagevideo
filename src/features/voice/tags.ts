/**
 * 配音脚本的语法快捷插入。
 *
 * MiniMax Speech 2.8 支持两类行内标记：
 * - 停顿：`<#x#>`，x ∈ [0.01, 99.99] 秒
 * - 语气词 / 非语言发声：`(laughs)`、`(sighs)` 等
 *
 * 页面把这些标记做成可点击的标签，点击后直接写进光标位置。
 */

export interface InterjectionTag {
  /** 官方标签名，插入形式为 `(code)` */
  code: string
  /** 中文短标签，用于按钮展示 */
  label: string
  /** 补充说明，用于 title 提示 */
  hint: string
}

/** 官方语音模型支持的语气词（按常用程度排序）。 */
export const INTERJECTION_TAGS: InterjectionTag[] = [
  { code: 'laughs', label: '笑声', hint: '大笑' },
  { code: 'chuckle', label: '轻笑', hint: '低声轻笑' },
  { code: 'sighs', label: '叹气', hint: '叹气' },
  { code: 'breath', label: '呼吸', hint: '呼吸声' },
  { code: 'gasps', label: '倒吸气', hint: '惊讶地倒吸气' },
  { code: 'emm', label: '嗯', hint: '思考时的“嗯”' },
  { code: 'coughs', label: '咳嗽', hint: '咳嗽' },
  { code: 'clear-throat', label: '清嗓', hint: '清嗓子' },
  { code: 'sniffs', label: '抽鼻子', hint: '抽鼻子' },
  { code: 'pant', label: '喘气', hint: '喘息' },
  { code: 'inhale', label: '吸气', hint: '吸气声' },
  { code: 'exhale', label: '呼气', hint: '呼气声' },
  { code: 'groans', label: '呻吟', hint: '呻吟' },
  { code: 'snorts', label: '哼气', hint: '不屑地哼气' },
  { code: 'burps', label: '打嗝', hint: '打嗝' },
  { code: 'lip-smacking', label: '咂嘴', hint: '咂嘴' },
  { code: 'humming', label: '哼唱', hint: '哼唱' },
  { code: 'hissing', label: '嘶声', hint: '嘶嘶声' },
  { code: 'sneezes', label: '喷嚏', hint: '打喷嚏' },
]

/** 常用停顿预设（秒）。 */
export const PAUSE_PRESETS = [0.3, 0.5, 1, 1.5, 2, 3] as const

export const PAUSE_MIN_SECONDS = 0.01
export const PAUSE_MAX_SECONDS = 99.99

export function clampPauseSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 1
  return Math.min(PAUSE_MAX_SECONDS, Math.max(PAUSE_MIN_SECONDS, seconds))
}

/** 生成 `<#1.2#>` 形式的停顿时长标记。 */
export function formatPauseTag(seconds: number): string {
  const value = Number(clampPauseSeconds(seconds).toFixed(2))
  return `<#${value}#>`
}
