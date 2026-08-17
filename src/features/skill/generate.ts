// ArtSkills-V1 Skill 文件生成入口。
// 通过 aiping 平台的 /chat/completions 接口，携带 ARTSKILLS_SYSTEM_PROMPT 作为 system 消息，
// 让底层文本模型输出一份标准化 Skill Markdown 文件。对外只展示 ArtSkills-V1。

import { chatCompletion } from '@/api/aiping'
import { buildTextExtraBody } from '@/models/text'
import { ARTSKILLS_SYSTEM_PROMPT } from './systemPrompt'
import {
  resolveArtSkillsBackendModel,
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

  const content = await chatCompletion({
    model: backendModel,
    messages,
    temperature: 0.7,
    extra_body: buildTextExtraBody(backendModel),
  })

  return { content, backendModel }
}
