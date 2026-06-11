export class PromptValidationError extends Error {
  code: 'EMPTY_PROMPT' | 'BANNED_WORD'
  bannedWords?: string[]

  constructor(message: string, code: 'EMPTY_PROMPT' | 'BANNED_WORD', bannedWords?: string[]) {
    super(message)
    this.name = 'PromptValidationError'
    this.code = code
    this.bannedWords = bannedWords
  }
}

const BANNED_WORDS = [
  '习近平',
  '习主席',
  '共产党',
  '中共',
  '法轮功',
  '六四',
  '天安门',
  '台独',
  '港独',
  '藏独',
  '分裂国家',
  '暴恐',
  '恐怖袭击',
  '枪支改造',
  '炸弹制作',
  '冰毒',
  '海洛因',
  '色情',
  '约炮',
  '嫖娼',
]

function normalizePrompt(prompt: string) {
  return prompt.toLowerCase().replace(/\s+/g, '')
}

export function findBannedWords(prompt: string): string[] {
  const normalizedPrompt = normalizePrompt(prompt)
  return BANNED_WORDS.filter((word) => normalizedPrompt.includes(normalizePrompt(word)))
}

export function validatePromptOrThrow(prompt: string) {
  const trimmedPrompt = prompt.trim()
  if (!trimmedPrompt) {
    throw new PromptValidationError('请输入提示词后再开始生成。', 'EMPTY_PROMPT')
  }

  const matchedWords = findBannedWords(trimmedPrompt)
  if (matchedWords.length > 0) {
    throw new PromptValidationError(
      `提示词中包含违禁词：${matchedWords.join('、')}。请修改后再试。`,
      'BANNED_WORD',
      matchedWords,
    )
  }
}

export function getReadableErrorMessage(error: unknown, fallback = '操作失败，请稍后重试。'): string {
  if (error instanceof PromptValidationError) {
    return error.message
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}