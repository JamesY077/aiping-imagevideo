// Skill 规范到实际生成提示词的处理。
// 简易模式与无限画布共用同一套逻辑：先把多个 Skill 合并压缩，再拼接用户提示词。

import { getModels, polishPrompt } from '@/api/aiping'
import { DEFAULT_PROMPT_POLISH_MODEL, useSettingsStore } from '@/stores/settingsStore'

const SKILL_COMPRESSION_SYSTEM_PROMPT = `你是一名专业的视频/图像 Skill 压缩助手。
用户可能同时提供多份 Skill：质量规范、风格规范、手绘规范，以及用户自行上传的 Skill。
请把它们合并成一份紧凑的中文视觉创作规范，只保留会直接影响画面生成的关键约束，例如：主体、场景、画风、色调、构图、镜头、运镜、节奏、动作、服装、光影、文字排版、材质等。
合并规则：
1. 后出现的 Skill 在风格冲突时优先，质量类规范作为全局底线始终保留。
2. 去掉重复表述，只留下可执行的约束，不要罗列来源或标题。
3. 删除 YAML 元信息、说明文字、示例代码、流程步骤、角色背景故事等对画面生成没有直接帮助的内容。
只输出压缩后的规范正文，不要解释，不要使用 Markdown 标记，不要输出代码块。`

const SKILL_COMPRESSION_BASE_CHARS = 500
const SKILL_COMPRESSION_CHARS_PER_SKILL = 140
const SKILL_COMPRESSION_MAX_CHARS = 1100

function normalizeSkillContents(skillContent: string | string[] | null | undefined): string[] {
  const list = Array.isArray(skillContent) ? skillContent : [skillContent]
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of list) {
    const content = typeof item === 'string' ? item.trim() : ''
    if (!content || seen.has(content)) continue
    seen.add(content)
    result.push(content)
  }
  return result
}

function compressionLimit(skillCount: number): number {
  return Math.min(
    SKILL_COMPRESSION_MAX_CHARS,
    SKILL_COMPRESSION_BASE_CHARS + Math.max(0, skillCount - 1) * SKILL_COMPRESSION_CHARS_PER_SKILL,
  )
}

function cleanCompressedSkill(content: string, limit: number): string {
  let result = content.trim()
  result = result.replace(/^```[a-zA-Z]*\s*|\s*```$/g, '').trim()
  if (result.length > limit) {
    result = result.slice(0, limit)
  }
  return result
}

/** 压缩失败时的兜底：去掉 YAML 头部并按总长度均分截断，避免一次失败就让生成完全中断。 */
function fallbackCompressSkills(skillContents: string[]): string {
  const limit = compressionLimit(skillContents.length)
  const perSkill = Math.max(120, Math.floor(limit / skillContents.length))
  return skillContents
    .map((content) => {
      const body = content.replace(/^\uFEFF?---\s*\n[\s\S]*?\n---\s*(\n|$)/, '').trim()
      return body.slice(0, perSkill)
    })
    .join('\n')
    .slice(0, limit)
}

async function resolveSkillCompressionModel(): Promise<string> {
  const settingsStore = useSettingsStore()
  const configured = settingsStore.promptPolishModel.trim() || DEFAULT_PROMPT_POLISH_MODEL
  if (configured) return configured

  const models = await getModels()
  const candidates = Array.isArray(models?.data) ? models.data : []
  const preferredIds = ['DeepSeek-V4.1-Flash-1017', 'DeepSeek-V3-0324', 'Qwen3-32B', 'Qwen3-14B', 'DeepSeek-V3']
  const preferred = candidates.find((model) => preferredIds.includes(model.id))
  const firstLlm = candidates.find((model) => {
    const modelType = (model as any).model_type
    return modelType === 'llm' || (Array.isArray(modelType) && modelType.includes('llm'))
  })
  const fallback = preferred || firstLlm
  if (!fallback?.id) {
    throw new Error('当前 API Key 没有可用的文本模型，无法压缩 Skill。请先在设置中配置 AI 润色模型。')
  }
  return fallback.id
}

async function compressSkillContents(skillContents: string[]): Promise<string> {
  const model = await resolveSkillCompressionModel()
  const limit = compressionLimit(skillContents.length)
  const merged = skillContents
    .map((content, index) => `### Skill ${index + 1}\n${content}`)
    .join('\n\n')
  const compressed = await polishPrompt({
    model,
    messages: [
      { role: 'system', content: SKILL_COMPRESSION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `请把以下 ${skillContents.length} 份 Skill 合并压缩成不超过 ${limit} 字的中文视觉创作规范：\n\n${merged}`,
      },
    ],
    temperature: 0.2,
  })
  return cleanCompressedSkill(compressed, limit)
}

/** 同一组 Skill 在连续生成/重试时会重复压缩，这里做一层内存缓存。 */
const compressionCache = new Map<string, string>()
const COMPRESSION_CACHE_LIMIT = 12

/** 有 Skill 时先合并压缩，再把压缩结果和用户提示词合并；无 Skill 时原样返回。 */
export async function buildEffectivePrompt(
  prompt: string,
  skillContent: string | string[] | null | undefined,
): Promise<string> {
  const skillContents = normalizeSkillContents(skillContent)
  if (!skillContents.length) return prompt

  const cacheKey = skillContents.join('\n\n---SKILL---\n\n')
  const cached = compressionCache.get(cacheKey)
  if (cached) {
    return `请严格遵循以下 Skill 创作规范：\n${cached}\n\n用户创作需求：\n${prompt}`
  }

  let skillSummary: string
  try {
    skillSummary = await compressSkillContents(skillContents)
    compressionCache.set(cacheKey, skillSummary)
    if (compressionCache.size > COMPRESSION_CACHE_LIMIT) {
      const oldest = compressionCache.keys().next().value
      if (oldest) compressionCache.delete(oldest)
    }
  } catch (error) {
    console.warn('Skill 压缩失败，使用截断后的原始 Skill 作为兜底。', error)
    skillSummary = fallbackCompressSkills(skillContents)
  }

  return `请严格遵循以下 Skill 创作规范：\n${skillSummary}\n\n用户创作需求：\n${prompt}`
}
