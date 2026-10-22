// ArtSkills-V1「Skill 创作模型」的模型映射。
// 对外只展示 ArtSkills-V1，实际调用 aiping 平台的以下文本模型之一（不对外暴露真实模型名）。
// - 未在设置中指定时：从下列模型中随机调用；
// - 在设置中手动指定时：固定调用被指定的模型。

/** 对外展示名称（始终展示 ArtSkills-V1，不暴露底层真实模型）。 */
export const ARTSKILLS_DISPLAY_NAME = 'ArtSkills-V1'

/**
 * Skill 创作模型底层可调用的真实模型 ID 列表。
 * 与 PRD 保持一致：随机调用其中之一，或由设置手动指定。
 */
export const ARTSKILLS_BACKEND_MODELS = [
  'DeepSeek-V4.1-Flash-1017',
] as const

export type ArtSkillsBackendModel = (typeof ARTSKILLS_BACKEND_MODELS)[number]

/** 设置中「自动（随机）」的取值。 */
export const ARTSKILLS_AUTO_MODEL = 'auto'

export type ArtSkillsModelPreference = ArtSkillsBackendModel | typeof ARTSKILLS_AUTO_MODEL

/**
 * 根据用户在设置里的选择，解析出本次实际要调用的底层模型。
 * - 传入具体模型：直接返回该模型。
 * - 传入 auto 或非法值：从列表随机返回一个。
 */
export function resolveArtSkillsBackendModel(
  preference: ArtSkillsModelPreference | null | undefined,
): ArtSkillsBackendModel {
  if (preference && preference !== ARTSKILLS_AUTO_MODEL) {
    const matched = ARTSKILLS_BACKEND_MODELS.find(
      (model) => model.toLowerCase() === preference.toLowerCase(),
    )
    if (matched) return matched
  }
  const index = Math.floor(Math.random() * ARTSKILLS_BACKEND_MODELS.length)
  return ARTSKILLS_BACKEND_MODELS[index]
}

/** 设置页可选项：自动 + 三个具体模型。 */
export const ARTSKILLS_MODEL_OPTIONS: Array<{ value: ArtSkillsModelPreference; label: string }> = [
  { value: ARTSKILLS_AUTO_MODEL, label: '自动（随机调用）' },
  ...ARTSKILLS_BACKEND_MODELS.map((model) => ({ value: model, label: model })),
]
