// Skill 文件（.md）解析与读取工具。
// 用于从上传的 skill 文件或生成的 skill 文本中，提取展示用的名称/描述，
// 以及在生成图片/视频时把 skill 规范拼接进提示词。

export interface ParsedSkill {
  /** 文件名（含扩展名），仅用于 UI 展示。 */
  fileName: string
  /** Skill 名称（取 YAML front matter 的 name，否则取正文一级标题，否则取文件名）。 */
  name: string
  /** Skill 简介（取 YAML front matter 的 description 首行）。 */
  description: string
  /** Skill 文件全文（原始 markdown）。 */
  content: string
}

/** 读取一个本地 File 为纯文本。 */
export function readSkillFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Skill 文件读取失败，请重试。'))
    reader.readAsText(file)
  })
}

/** 从 markdown 内容中截取 YAML front matter 区块（--- 与 --- 之间）。 */
function extractFrontMatter(content: string): string | null {
  const match = content.match(/^\uFEFF?---\s*\n([\s\S]*?)\n---\s*(\n|$)/)
  return match ? match[1] : null
}

/** 从 front matter 文本里取某个字段的首行值（支持 `key: value` 与 `key: |` 折叠块首行）。 */
function readFrontMatterField(frontMatter: string, key: string): string {
  const lines = frontMatter.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const inline = line.match(new RegExp(`^${key}\\s*:\\s*(.*)$`))
    if (!inline) continue
    const value = inline[1].trim()
    if (value && value !== '|' && value !== '>' && value !== '|-' && value !== '>-') {
      return value.replace(/^["']|["']$/g, '')
    }
    // 折叠块：取下一行有内容的缩进文本。
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim()
      if (next) return next.replace(/^["']|["']$/g, '')
    }
    return ''
  }
  return ''
}

/** 取正文第一个一级标题（# ...）。 */
function extractFirstHeading(content: string, frontMatter: string | null): string {
  const body = frontMatter ? content.replace(/^\uFEFF?---\s*\n[\s\S]*?\n---\s*(\n|$)/, '') : content
  const match = body.match(/^#\s+(.+)$/m)
  return match ? match[1].trim() : ''
}

/** 解析 skill markdown 文本，抽取展示信息。 */
export function parseSkillContent(content: string, fileName = 'skill.md'): ParsedSkill {
  const frontMatter = extractFrontMatter(content)
  const nameFromFm = frontMatter ? readFrontMatterField(frontMatter, 'name') : ''
  const descFromFm = frontMatter ? readFrontMatterField(frontMatter, 'description') : ''
  const heading = extractFirstHeading(content, frontMatter)

  const name = nameFromFm || heading || fileName.replace(/\.md$/i, '') || '未命名 Skill'
  const description = descFromFm || heading || '已加载 Skill 规范，将约束生成风格与要求。'

  return { fileName, name, description, content }
}

/**
 * 把 skill 规范拼接为提示词前缀，供图片/视频生成时携带。
 * 生成的内容需严格遵循该 skill 的文字与规范，以保证风格与要求一致。
 */
export function buildSkillPromptPrefix(skillContent: string): string {
  const trimmed = skillContent.trim()
  if (!trimmed) return ''
  return [
    '你必须严格遵循以下 Skill 规范来生成内容，保证输出的风格、要求与规范完全一致：',
    '===== Skill 规范开始 =====',
    trimmed,
    '===== Skill 规范结束 =====',
    '',
    '在遵循上述 Skill 规范的前提下，完成下面的创作需求：',
  ].join('\n')
}

/** 把 skill 规范应用到用户提示词，返回最终下发给模型的提示词。 */
export function applySkillToPrompt(prompt: string, skillContent: string | null | undefined): string {
  if (!skillContent || !skillContent.trim()) return prompt
  return `${buildSkillPromptPrefix(skillContent)}\n${prompt}`
}
