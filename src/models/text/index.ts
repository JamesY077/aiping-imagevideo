// AIPing 平台文本模型定义
// 参考 PRD《无限画布节点设置》- 文本节点 - 文本模型列表与示例代码
// 所有模型统一通过 /chat/completions 接口（OpenAI 兼容）调用，
// 并按示例代码携带 extra_body（enable_thinking + provider 路由配置）。

export interface TextModelModule {
  /** 模型 ID，与 API 请求中的 model 字段一致 */
  id: string
  /** 展示名称 */
  displayName: string
  /**
   * extra_body.enable_thinking 的取值。
   * - false：显式关闭思考（DeepSeek / GLM / Doubao 系列示例携带该字段）
   * - true：显式开启思考
   * - null：不传该字段（Kimi / MiniMax 示例未携带该字段）
   */
  enableThinking: boolean | null
  /** 是否支持图片输入（多模态视觉能力） */
  supportsVision: boolean
}

/**
 * 文本模型列表（顺序与 PRD 一致）。
 */
export const textModelModules: TextModelModule[] = [
  { id: 'DeepSeek-V4-Flash', displayName: 'DeepSeek-V4-Flash', enableThinking: false, supportsVision: false },
  { id: 'DeepSeek-V4-Pro', displayName: 'DeepSeek-V4-Pro', enableThinking: false, supportsVision: false },
  { id: 'GLM-5.2', displayName: 'GLM-5.2', enableThinking: false, supportsVision: false },
  { id: 'Kimi-K3', displayName: 'Kimi-K3', enableThinking: null, supportsVision: true },
  { id: 'Kimi-K2.7-Code', displayName: 'Kimi-K2.7-Code', enableThinking: null, supportsVision: true },
  { id: 'MiniMax-M3', displayName: 'MiniMax-M3', enableThinking: null, supportsVision: true },
  { id: 'Doubao-Seed-2.1-turbo', displayName: 'Doubao-Seed-2.1-turbo', enableThinking: false, supportsVision: true },
  { id: 'Doubao-Seed-2.1-pro', displayName: 'Doubao-Seed-2.1-pro', enableThinking: false, supportsVision: true },
]

/** 默认文本模型（列表首个）。 */
export const DEFAULT_TEXT_MODEL_ID = textModelModules[0].id

/**
 * 示例代码中统一的 provider 路由配置，保持所有字段为空以走平台默认路由。
 */
const DEFAULT_PROVIDER_CONFIG = {
  only: [] as string[],
  order: [] as string[],
  sort: null as string | null,
  input_price_range: [] as number[],
  output_price_range: [] as number[],
  input_length_range: [] as number[],
  output_length_range: [] as number[],
  throughput_range: [] as number[],
  latency_range: [] as number[],
}

const textModelById = new Map(textModelModules.map((model) => [model.id.toLowerCase(), model]))

export function getTextModelModule(modelId: string | null | undefined): TextModelModule | null {
  if (!modelId) return null
  return textModelById.get(modelId.toLowerCase()) || null
}

export function isTextModel(modelId: string | null | undefined): boolean {
  return !!getTextModelModule(modelId)
}

/**
 * 根据模型构建 chat/completions 请求的 extra_body，
 * 与 PRD 示例代码保持一致：携带 provider 路由配置，
 * 并按模型决定是否附带 enable_thinking。
 */
export function buildTextExtraBody(modelId: string | null | undefined): Record<string, unknown> {
  const model = getTextModelModule(modelId)
  const extraBody: Record<string, unknown> = {
    provider: { ...DEFAULT_PROVIDER_CONFIG },
  }
  if (model && typeof model.enableThinking === 'boolean') {
    extraBody.enable_thinking = model.enableThinking
  }
  return extraBody
}
