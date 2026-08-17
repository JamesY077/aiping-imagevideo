// ArtSkills-V1 Skill 文件生成入口。
// 通过 aiping 平台的 /chat/completions 接口，携带 ARTSKILLS_SYSTEM_PROMPT 作为 system 消息，
// 让底层文本模型输出一份标准化 Skill Markdown 文件。对外只展示 ArtSkills-V1。

import { chatCompletion } from '@/api/aiping'
import { buildTextExtraBody } from '@/models/text'
import { ARTSKILLS_SYSTEM_PROMPT } from './systemPrompt'
import {
  resolveArtSkillsBackendModel,
  type ArtSkillsBackendModel,
  type ArtSkillsModelPreference,
} from './models'
import type { ChatMessage } from '@/types/api'

export interface SkillTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface GenerateSkillOptions {
  /** 本轮用户输入（一句话需求或修改要求）。 */
  prompt: string
  /** 设置里选择的模型偏好；auto 或空则随机。 */
  modelPreference?: ArtSkillsModelPreference | null
  /** 多轮对话历史（不含本轮），用于连续修改已生成的 skill。 */
  history?: SkillTurn[]
}

export interface GenerateSkillResult {
  /** 生成的 Skill Markdown 全文。 */
  content: string
  /** 本次实际调用的底层模型（仅用于调试，不对外展示）。 */
  backendModel: string
}

/**
 * 构建 Skill 生成请求的 extra_body。
 * DeepSeek 系列需要显式关闭思考，避免长时间 reasoning 导致前端 100s 超时。
 */
function buildSkillExtraBody(backendModel: ArtSkillsBackendModel): Record<string, unknown> {
  const extraBody = buildTextExtraBody(backendModel)
  if (backendModel.toLowerCase().startsWith('deepseek')) {
    extraBody.enable_thinking = false
  }
  return extraBody
}

/**
 * 去掉包裹整个输出的 Markdown 代码围栏。
 * 只有输出确实以 ```markdown / ```md / ``` 开头时，才同时移除首尾围栏。
 */
function stripOuterMarkdownFence(content: string): string {
  const trimmed = content.trim().replace(/^\uFEFF/, '')
  const leadingFence = trimmed.match(/^```(?:markdown|md)?[ \t]*\r?\n/)
  if (!leadingFence) return trimmed

  return trimmed
    .slice(leadingFence[0].length)
    .replace(/\r?\n?```[ \t]*$/, '')
    .trim()
}

/** 去掉模型可能夹带的 thinking / reasoning 标签块。 */
function stripThinkingBlocks(content: string): string {
  return content
    .replace(/<(?:think|thinking|reasoning)\b[^>]*>[\s\S]*?<\/(?:think|thinking|reasoning)>/gi, '')
    .trim()
}

/**
 * 只保留 Skill 本体：
 * 优先从第一个 YAML Front Matter 的 `---` 开始，其次从第一个一级标题开始。
 * 这样可以去掉模型在正文前输出的任何解释性文字。
 */
function extractSkillMarkdownBody(content: string): string {
  const lines = content.split(/\r?\n/)
  const frontMatterIndex = lines.findIndex((line) => /^\uFEFF?\s*---\s*$/.test(line))
  if (frontMatterIndex >= 0) {
    return lines.slice(frontMatterIndex).join('\n').trim()
  }

  const headingIndex = lines.findIndex((line) => /^#\s+/.test(line))
  if (headingIndex >= 0) {
    return lines.slice(headingIndex).join('\n').trim()
  }

  return content.trim()
}

/** 对生成结果做最终清洗，确保 UI 只拿到 Skill Markdown 本体。 */
function normalizeSkillOutput(rawContent: string): string {
  return extractSkillMarkdownBody(stripThinkingBlocks(stripOuterMarkdownFence(rawContent))).replace(/^\uFEFF/, '')
}

/**
 * 调用 ArtSkills-V1 生成 / 修改一份 Skill 文件。
 */
export async function generateSkill(options: GenerateSkillOptions): Promise<GenerateSkillResult> {
  const backendModel = resolveArtSkillsBackendModel(options.modelPreference)

  const messages: ChatMessage[] = [
    { role: 'system', content: ARTSKILLS_SYSTEM_PROMPT },
  ]

  for (const turn of options.history || []) {
    messages.push({ role: turn.role, content: turn.content })
  }

  messages.push({ role: 'user', content: options.prompt })

  const rawContent = await chatCompletion({
    model: backendModel,
    messages,
    temperature: 0.7,
    max_tokens: 2200,
    extra_body: buildSkillExtraBody(backendModel),
  })
  const content = normalizeSkillOutput(rawContent)

  if (!content) {
    throw new Error('Skill 生成结果无效，未返回可用的 Markdown 内容。')
  }

  return { content, backendModel }
}
