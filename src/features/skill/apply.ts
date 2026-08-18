// Skill 规范到实际生成提示词的处理。
// 简易模式与无限画布共用同一套逻辑：先压缩 Skill，再拼接用户提示词。

import { getModels, polishPrompt } from '@/api/aiping'
import { useSettingsStore } from '@/stores/settingsStore'

const SKILL_COMPRESSION_SYSTEM_PROMPT = `你是一名专业的视频/图像 Skill 压缩助手。
请把用户提供的 Skill 规范压缩成 500 字左右的中文视觉创作规范，只保留会直接影响画面生成的关键约束，例如：主体、场景、画风、色调、构图、镜头、运镜、节奏、动作、服装、光影、声音氛围等。
删除 YAML 元信息、标题、说明文字、示例代码、流程步骤、角色背景故事等对画面生成没有直接帮助的内容。
只输出压缩后的规范正文，不要解释，不要使用 Markdown 标记，不要输出代码块。`

const SKILL_COMPRESSION_MAX_CHARS = 500

function cleanCompressedSkill(content: string): string {
  let result = content.trim()
  result = result.replace(/^```[a-zA-Z]*\s*|\s*```$/g, '').trim()
  if (result.length > SKILL_COMPRESSION_MAX_CHARS) {
    result = result.slice(0, SKILL_COMPRESSION_MAX_CHARS)
  }
  return result
}

/** 压缩失败时的兜底：去掉 YAML 头部并截断，避免一次失败就让生成完全中断。 */
function fallbackCompressSkill(skillContent: string): string {
  const body = skillContent
    .replace(/^\uFEFF?---\s*\n[\s\S]*?\n---\s*(\n|$)/, '')
    .trim()
  return cleanCompressedSkill(body)
}

async function resolveSkillCompressionModel(): Promise<string> {
  const settingsStore = useSettingsStore()
  const configured = settingsStore.promptPolishModel.trim()
  if (configured) return configured

  const models = await getModels()
  const candidates = Array.isArray(models?.data) ? models.data : []
  const preferredIds = ['DeepSeek-V3-0324', 'Qwen3-32B', 'Qwen3-14B', 'DeepSeek-V3']
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

async function compressSkillContent(skillContent: string): Promise<string> {
  const model = await resolveSkillCompressionModel()
  const compressed = await polishPrompt({
    model,
    messages: [
      { role: 'system', content: SKILL_COMPRESSION_SYSTEM_PROMPT },
      { role: 'user', content: `请压缩以下 Skill：\n\n${skillContent}` },
    ],
    temperature: 0.2,
  })
  return cleanCompressedSkill(compressed)
}

/** 有 Skill 时先压缩，再把压缩结果和用户提示词合并；无 Skill 时原样返回。 */
export async function buildEffectivePrompt(prompt: string, skillContent: string | null | undefined): Promise<string> {
  if (!skillContent || !skillContent.trim()) return prompt

  let skillSummary: string
  try {
    skillSummary = await compressSkillContent(skillContent)
  } catch (error) {
    console.warn('Skill 压缩失败，使用截断后的原始 Skill 作为兜底。', error)
    skillSummary = fallbackCompressSkill(skillContent)
  }

  return `请严格遵循以下 Skill 创作规范：\n${skillSummary}\n\n用户创作需求：\n${prompt}`
}
