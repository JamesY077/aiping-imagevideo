/**
 * 配音创作（语音合成）模型注册表。
 *
 * 目前仅登记 AIPing 已开放的 text2audio 模型；
 * 后续接入音色克隆、多角色对白时在这里扩展 capability 字段即可。
 */

export type VoiceModelProvider = 'minimax'

export interface VoiceModelCapability {
  /** 支持的音色来源：内置音色 / 克隆音色 */
  voiceSources: ('preset' | 'clone')[]
  /** 是否支持情绪、语速、音量等演绎参数 */
  expressive: boolean
  /** 是否支持多角色对白 */
  multiSpeaker: boolean
}

export interface VoiceModelOption {
  id: string
  displayName: string
  provider: VoiceModelProvider
  description: string
  capability: VoiceModelCapability
}

export const VOICE_MODELS: VoiceModelOption[] = [
  {
    id: 'MiniMax-Speech-2.8-hd',
    displayName: 'MiniMax Speech 2.8 HD',
    provider: 'minimax',
    description: '高保真语音合成，适合成片配音与情绪化演绎。',
    capability: {
      voiceSources: ['preset'],
      expressive: true,
      multiSpeaker: false,
    },
  },
  {
    id: 'MiniMax-Speech-02-hd',
    displayName: 'MiniMax Speech 02 HD',
    provider: 'minimax',
    description: '稳定版高音质语音合成模型，适合批量旁白与长文本朗读。',
    capability: {
      voiceSources: ['preset'],
      expressive: true,
      multiSpeaker: false,
    },
  },
]

export const DEFAULT_VOICE_MODEL_ID = VOICE_MODELS[0].id

export function getVoiceModel(modelId: string | null | undefined): VoiceModelOption | undefined {
  if (!modelId) return undefined
  return VOICE_MODELS.find((item) => item.id === modelId)
}
