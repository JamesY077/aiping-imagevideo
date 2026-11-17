// Skill 示例图的模型维度路径解析。
// 目录约定：public/skill-previews/<model-slug>/<skill-id>.webp，
// 缺失时回落到 public/skill-previews/<skill-id>.webp。

import type { BuiltinSkill } from './builtin'

/** 只给需要在生图页展示示例图的模型建立目录；未配置的模型回落到公共示例图。 */
const MODEL_PREVIEW_DIRS: Record<string, string> = {
  'Moss-Image-SFT': 'moss-image-sft',
  'Doubao-Seedream-5.0-lite': 'doubao-seedream-5.0-lite',
}

export function getSkillPreviewPath(
  skill: Pick<BuiltinSkill, 'id' | 'thumbnail'>,
  modelId?: string | null,
): string | null {
  if (!skill.thumbnail) return null
  const dir = modelId ? MODEL_PREVIEW_DIRS[modelId] : ''
  if (!dir) return skill.thumbnail
  return skill.thumbnail.replace('/skill-previews/', `/skill-previews/${dir}/`)
}
