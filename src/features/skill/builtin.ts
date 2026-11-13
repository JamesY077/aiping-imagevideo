// 内置 Skill 注册表。
// markdown 正文存放在 ./builtin/*.md，构建时以原始文本打包，
// 这样既能直接参与生成，也能在设置页/快捷按钮里展示同一份规范。

const rawModules = import.meta.glob('./builtin/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function readBuiltin(id: string): string {
  const key = Object.keys(rawModules).find((path) => path.endsWith(`/${id}.md`))
  return key ? rawModules[key] : ''
}

export type BuiltinSkillCategory = 'quality' | 'illustration' | 'style'

export interface BuiltinSkill {
  id: string
  name: string
  description: string
  category: BuiltinSkillCategory
  /** 生成时实际使用的规范正文。 */
  content: string
  /** 示例缩略图（public 下的路径，展示时再接 assetUrl）。 */
  thumbnail?: string
  /** 原始仓库地址，用于标注来源。 */
  source?: string
  license?: string
  /** 是否属于默认始终生效的质量规范。 */
  defaultEnabled?: boolean
}

const QUALITY_SKILLS: BuiltinSkill[] = [
  {
    id: 'impeccable',
    name: 'Impeccable 设计标准',
    description: '以设计总监的完成度约束层级、字体、色彩与细节。',
    category: 'quality',
    content: readBuiltin('impeccable'),
    source: 'https://github.com/pbakaus/impeccable',
    license: 'Apache-2.0',
    defaultEnabled: true,
  },
  {
    id: 'hallmark',
    name: 'Hallmark 反 AI 味',
    description: '拒绝模板化渐变、等宽卡片与万能居中构图。',
    category: 'quality',
    content: readBuiltin('hallmark'),
    source: 'https://github.com/Nutlope/hallmark',
    license: 'MIT',
    defaultEnabled: true,
  },
  {
    id: 'editable-design',
    name: 'Editable Design 画布规范',
    description: '把输出当成固定画布作品，先分层再落笔。',
    category: 'quality',
    content: readBuiltin('editable-design'),
    source: 'https://github.com/yejy53/Editable-Design',
    license: 'Apache-2.0',
    defaultEnabled: true,
  },
]

const ILLUSTRATION_SKILLS: BuiltinSkill[] = [
  {
    id: 'ian-xiaohei-illustrations',
    name: '小黑手绘解释图',
    description: '纯白底、黑色手绘、红橙蓝批注的中文正文配图。',
    category: 'illustration',
    content: readBuiltin('ian-xiaohei-illustrations'),
    thumbnail: '/skill-previews/ian-xiaohei.webp',
    source: 'https://github.com/helloianneo/ian-xiaohei-illustrations',
    license: 'MIT',
  },
]

interface StyleMeta {
  id: string
  name: string
  description: string
}

const STYLE_META: StyleMeta[] = [
  { id: 'swiss-style', name: '瑞士风格', description: '严格网格、无衬线大字、黑白加单一红。' },
  { id: 'bauhaus', name: '包豪斯', description: '红黄蓝三原色、基本几何形、对角构成。' },
  { id: 'memphis', name: '孟菲斯', description: '粉彩撞色、波浪线、圆点与几何拼贴。' },
  { id: 'neo-brutalism', name: '新野兽派', description: '生猛撞色、粗黑边框、硬阴影与压缩字。' },
  { id: 'maximalism', name: '极繁主义', description: '满密叠艳，层层堆叠的拼贴与金色细节。' },
  { id: 'minimalism', name: '极简主义', description: '近乎空白、一个精确主体、极细线条。' },
  { id: 'morandi', name: '莫兰迪', description: '低饱和灰调、柔和哑光、安静克制。' },
  { id: 'cassette-futurism', name: '卡带未来主义', description: '米色塑料、CRT 绿光、旋钮与磁带的旧未来。' },
  { id: 'y2k', name: 'Y2K', description: '液态金属、透明塑料、冰蓝银紫的千禧未来。' },
  { id: 'art-deco', name: 'Art Deco', description: '对称几何、扇形放射线、黑金祖母绿。' },
  { id: 'editorial', name: 'Editorial', description: '杂志级排版、强标题层级、衬线与大留白。' },
  { id: 'vaporwave', name: 'Vaporwave', description: '粉紫青渐变、网格地平线、棕榈与石膏像。' },
  { id: 'acid-graphics', name: 'Acid Graphics', description: '荧光酸绿与橙、扭曲字体、液态铬与 HUD。' },
  { id: 'japandi', name: 'Japandi', description: '原木燕麦、侘寂肌理、极简线条与自然光。' },
  { id: 'dopamine', name: '多巴胺配色', description: '高饱和快乐色块、圆润形状、明快对比。' },
]

const STYLE_SKILLS: BuiltinSkill[] = STYLE_META.map((meta) => ({
  id: meta.id,
  name: meta.name,
  description: meta.description,
  category: 'style',
  content: readBuiltin(meta.id),
  thumbnail: `/skill-previews/${meta.id}.webp`,
}))

export const BUILTIN_SKILLS: BuiltinSkill[] = [
  ...QUALITY_SKILLS,
  ...ILLUSTRATION_SKILLS,
  ...STYLE_SKILLS,
]

export const DEFAULT_QUALITY_SKILLS = QUALITY_SKILLS
export const DEFAULT_QUALITY_SKILL_IDS = QUALITY_SKILLS.map((skill) => skill.id)
export const STYLE_SKILL_OPTIONS: BuiltinSkill[] = [...ILLUSTRATION_SKILLS, ...STYLE_SKILLS]

const BUILTIN_MAP = new Map(BUILTIN_SKILLS.map((skill) => [skill.id, skill]))

export function getBuiltinSkill(id: string): BuiltinSkill | undefined {
  return BUILTIN_MAP.get(id)
}

export function getBuiltinSkillContent(id: string): string {
  return BUILTIN_MAP.get(id)?.content || ''
}
