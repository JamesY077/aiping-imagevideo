// AI 润色与 Skill 联动。
// 有已选 Skill 时，润色不能脱离规范自由扩写，而要按规范补齐画面元素，
// 让润色结果与真正下发给模型的提示词保持同一套约束。

import { polishPrompt } from '@/api/aiping'
import { DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT } from '@/stores/settingsStore'
import { normalizeSkillContents, summarizeSkillContents } from './apply'

const SKILL_POLISH_RULES = `本次请求会附带用户选中的「Skill 创作规范」，请把规范当作必须遵守的创作约束：
1. 保留用户原意与主体，不要替换成规范里的示例主体。
2. 主动补齐规范要求、但用户没有写出的画面元素，例如画风、色调、光线、构图、镜头、材质、纹理、版式、文字排版与整体氛围。
3. 规范明确要求出现的元素（如海报文字、纸张质感、指定配色、版式结构、动作轨迹）必须写进最终提示词，而不是只写"符合某风格"。
4. 规范与用户明确写出的内容冲突时，以用户写出的内容为准。
5. 只输出改写后的最终提示词正文，不要解释，不要复述 Skill 原文，不要出现"Skill""规范""用户需求"等字样，不要使用 Markdown。`

const POLISH_SKILL_BASE_LIMIT = 1200
const POLISH_SKILL_LIMIT_STEP = 400
const POLISH_SKILL_MAX_LIMIT = 2600

function polishSkillLimit(skillCount: number): number {
  return Math.min(
    POLISH_SKILL_MAX_LIMIT,
    POLISH_SKILL_BASE_LIMIT + Math.max(0, skillCount - 1) * POLISH_SKILL_LIMIT_STEP,
  )
}

export interface SkillAwarePolishOptions {
  model: string
  prompt: string
  skillContent?: string | string[] | null
  /** 用户在设置里自定义的润色系统提示词；为空时用默认文案。 */
  systemPrompt?: string
  temperature?: number
}

/**
 * 带 Skill 约束的提示词润色。
 * 没有任何 Skill 时回落到普通润色，行为与旧版一致。
 */
export async function polishPromptWithSkills(options: SkillAwarePolishOptions): Promise<string> {
  const prompt = options.prompt.trim()
  const baseSystem = options.systemPrompt?.trim() || DEFAULT_PROMPT_POLISH_SYSTEM_PROMPT
  const skillContents = normalizeSkillContents(options.skillContent)
  if (!skillContents.length) {
    return polishPrompt({
      model: options.model,
      messages: [
        { role: 'system', content: baseSystem },
        { role: 'user', content: prompt },
      ],
      temperature: options.temperature ?? 0.7,
    })
  }

  const skillSummary = await summarizeSkillContents(skillContents, polishSkillLimit(skillContents.length))
  if (!skillSummary) {
    return polishPrompt({
      model: options.model,
      messages: [
        { role: 'system', content: baseSystem },
        { role: 'user', content: prompt },
      ],
      temperature: options.temperature ?? 0.7,
    })
  }

  return polishPrompt({
    model: options.model,
    messages: [
      { role: 'system', content: `${baseSystem}\n\n${SKILL_POLISH_RULES}` },
      {
        role: 'user',
        content: `Skill 创作规范：\n${skillSummary}\n\n用户原始需求：\n${prompt}`,
      },
    ],
    temperature: options.temperature ?? 0.45,
  })
}
