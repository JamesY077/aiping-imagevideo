import axios from 'axios'
import { getApiBaseUrl, getApiKey, normalizeApiBaseUrl } from './config'
import type {
  ModelsResponse,
  ChatCompletionRequest,
  ChatCompletionResponse,
  ImageGenerateRequest,
  ImageGenerateResponse,
  VideoGenerateRequest,
  VideoGenerateResponse,
  VideoStatusResponse,
} from '@/types/api'
import { getImageProvider } from '@/api/providers/image'
import { getVideoProvider } from '@/api/providers/video'
import { AppError } from '@/utils/errors'

const client = axios.create({
  timeout: 100000,
})

export interface ConnectionTestResult {
  ok: boolean
  message?: string
}

function getConnectionErrorMessage(error: any): string {
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return 'API Key 无效或权限不足，请检查后重试。'
  }

  if (error?.response?.status === 404) {
    return 'Base URL 无法访问 /models 接口，请确认服务地址是否正确。'
  }

  if (error?.response?.status >= 500) {
    return '服务端暂时不可用，请稍后重试。'
  }

  if (error?.code === 'ECONNABORTED') {
    return '连接超时，请检查网络或服务地址。'
  }

  if (error?.message?.includes('Network Error')) {
    return '网络请求失败，可能是服务地址不可达、跨域限制或代理未配置。'
  }

  return '连接验证失败，请检查 Base URL 和 API Key。'
}

function getApiErrorMessage(error: any, fallback = '请求失败，请稍后重试。'): string {
  const data = error?.response?.data
  const detail = data?.detail
  const detailMessage = typeof detail === 'string' ? detail : detail?.message || detail?.error
  const message = detailMessage || data?.message || data?.error || error?.message

  if (!message) return fallback

  if (message.includes('No provider is currently available')) {
    return '当前模型的上游供应商暂不可用，前端已尝试多种参数格式仍失败。请稍后重试，或先切换到 Qwen-Image-2.0-Pro、Doubao-Seedream-5.0-lite 等其他图片模型。'
  }

  if (error?.response?.status === 400) {
    return `请求参数不被当前模型接受：${message}`
  }

  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return '鉴权失败，请检查 API Key 是否有效，或确认当前模型权限是否已开通。'
  }

  if (error?.response?.status === 429) {
    return '请求过于频繁或额度不足，请稍后重试，或检查账户配额。'
  }

  if (error?.response?.status >= 500) {
    return message && message !== error?.message
      ? `生成服务暂时不可用：${message}`
      : '生成服务暂时不可用，请稍后再试。'
  }

  if (error?.code === 'ECONNABORTED') {
    return '请求超时，生成时间较长或网络不稳定，请稍后重试。'
  }

  if (message.includes('Network Error')) {
    return '网络异常，无法连接生成服务，请检查网络或 Base URL 配置。'
  }

  return message
}

function parseImageSize(size: unknown): { width: number; height: number } | null {
  if (typeof size !== 'string') return null
  const [width, height] = size.split(/[x*]/).map((value) => Number(value))
  return width && height ? { width, height } : null
}

function pushUniqueBody(bodies: Record<string, unknown>[], body: Record<string, unknown>) {
  const signature = JSON.stringify(body)
  if (!bodies.some((candidate) => JSON.stringify(candidate) === signature)) {
    bodies.push(body)
  }
}

function maskSensitiveValue(value: unknown): unknown {
  if (typeof value !== 'string') return value
  if (value.startsWith('data:') || value.length > 120) return `[string:${value.length}]`
  if (/^https?:\/\//.test(value)) return '[url]'
  return value
}

function sanitizeDebugValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeDebugValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, sanitizeDebugValue(child)]))
  }
  return maskSensitiveValue(value)
}

function sanitizeDebugBody(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, sanitizeDebugValue(value)]))
}

function debugLog(message: string, payload?: unknown) {
  if (!import.meta.env.DEV) return
  if (payload === undefined) {
    console.debug(message)
    return
  }
  console.debug(message, payload)
}

client.interceptors.request.use((config) => {
  config.baseURL = config.baseURL || getApiBaseUrl()
  if (!config.headers.Authorization) {
    const apiKey = getApiKey()
    if (apiKey) {
      config.headers.Authorization = `Bearer ${apiKey}`
    }
  }
  return config
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !(error.config as any)?.skipAuthRedirect) {
      window.location.href = '/setup'
    }
    return Promise.reject(error)
  }
)

export async function getModels(): Promise<ModelsResponse> {
  const response = await client.get('/models')
  return response.data
}

export async function polishPrompt(params: ChatCompletionRequest): Promise<string> {
  const response = await client.post<ChatCompletionResponse>('/chat/completions', {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
  })
  const content = response.data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('AI 润色没有返回有效内容，请更换模型或稍后重试。')
  }
  return content
}

export async function generateImage(params: ImageGenerateRequest): Promise<ImageGenerateResponse> {
  const provider = getImageProvider(params)
  const fullBody = provider.buildRequestBody(params)

  debugLog(`generateImage provider=${provider.provider} trying full body:`, sanitizeDebugBody(fullBody))
  try {
    const response = await client.post(provider.endpoint, fullBody)
    return response.data
  } catch (error: any) {
    const detail = JSON.stringify(error.response?.data)
    debugLog('generateImage 400 error detail:', detail)
    if (error.response?.status === 400) {
      const alternateBody: Record<string, unknown> = { ...fullBody }

      if (typeof fullBody.size === 'string' && !fullBody.width && !fullBody.height) {
        const size = parseImageSize(fullBody.size)
        if (size) {
          delete alternateBody.size
          alternateBody.width = size.width
          alternateBody.height = size.height
          debugLog('generateImage retry with width/height:', sanitizeDebugBody(alternateBody))
          try {
            const response = await client.post(provider.endpoint, alternateBody)
            return response.data
          } catch (retryError: any) {
            throw new AppError(getApiErrorMessage(retryError, '图片尺寸参数未被当前模型接受，请切换模型或比例后重试。'))
          }
        }
      }

      if (typeof fullBody.width === 'number' && typeof fullBody.height === 'number' && !fullBody.size) {
        alternateBody.size = `${fullBody.width}x${fullBody.height}`
        delete alternateBody.width
        delete alternateBody.height
        debugLog('generateImage retry with size:', sanitizeDebugBody(alternateBody))
        try {
          const response = await client.post(provider.endpoint, alternateBody)
          return response.data
        } catch (retryError: any) {
          throw new AppError(getApiErrorMessage(retryError, '图片尺寸参数未被当前模型接受，请切换模型或比例后重试。'))
        }
      }

      throw new AppError(getApiErrorMessage(error, '图片尺寸参数未被当前模型接受，请切换模型或比例后重试。'))
    }
    throw error
  }
}

export async function generateVideo(params: VideoGenerateRequest): Promise<VideoGenerateResponse> {
  const provider = getVideoProvider(params)
  const fullBody = provider.buildRequestBody(params)
  const videoEndpoint = provider.getEndpoint(fullBody)
  const normalizeResponse = provider.normalizeResponse || ((data: VideoGenerateResponse) => data)

  debugLog(`generateVideo provider=${provider.provider} trying full body:`, sanitizeDebugBody(fullBody))
  try {
    const response = await client.post(videoEndpoint, fullBody)
    return normalizeResponse(response.data)
  } catch (error: any) {
    debugLog('generateVideo error:', {
      status: error.response?.status,
      data: error.response?.data,
    })
    if (error.response?.status === 400 || error.response?.status === 422) {
      const minimalBody: Record<string, unknown> = { model: fullBody.model, prompt: fullBody.prompt }
      if (fullBody.image) minimalBody.image = fullBody.image
      if (fullBody.images) minimalBody.images = fullBody.images
      if (fullBody.img_url) minimalBody.img_url = fullBody.img_url
      if (fullBody.first_frame_image) minimalBody.first_frame_image = fullBody.first_frame_image
      if (fullBody.last_frame_image) minimalBody.last_frame_image = fullBody.last_frame_image
      if (fullBody.first_frame_url) minimalBody.first_frame_url = fullBody.first_frame_url
      if (fullBody.start_image) minimalBody.start_image = fullBody.start_image
      if (fullBody.end_image) minimalBody.end_image = fullBody.end_image
      if (fullBody.subject_reference) minimalBody.subject_reference = fullBody.subject_reference
      if (fullBody.video_list) minimalBody.video_list = fullBody.video_list
      if (fullBody.seconds) minimalBody.seconds = fullBody.seconds
      if (fullBody.aspect_ratio) minimalBody.aspect_ratio = fullBody.aspect_ratio
      if (fullBody.ratio) minimalBody.ratio = fullBody.ratio
      if (fullBody.size) minimalBody.size = fullBody.size
      if (fullBody.resolution) minimalBody.resolution = fullBody.resolution
      if (typeof fullBody.audio === 'boolean') minimalBody.audio = fullBody.audio
      if (fullBody.movement_amplitude) minimalBody.movement_amplitude = fullBody.movement_amplitude
      if (typeof fullBody.off_peak === 'boolean') minimalBody.off_peak = fullBody.off_peak
      if (typeof fullBody.watermark === 'boolean') minimalBody.watermark = fullBody.watermark
      if (typeof fullBody.seed === 'number') minimalBody.seed = fullBody.seed
      if (fullBody.style) minimalBody.style = fullBody.style
      if (typeof fullBody.payload === 'string') minimalBody.payload = fullBody.payload
      if (fullBody.extra_body) minimalBody.extra_body = fullBody.extra_body

      const fallbackBodies: Record<string, unknown>[] = []
      pushUniqueBody(fallbackBodies, minimalBody)

      for (const providerFallbackBody of provider.buildFallbackBodies?.(fullBody) || []) {
        pushUniqueBody(fallbackBodies, providerFallbackBody)
      }

      if (provider.provider === 'vidu' && minimalBody.images && !minimalBody.image) {
        const viduImages = minimalBody.images
        const viduImageBody: Record<string, unknown> = {
          ...minimalBody,
          image: Array.isArray(viduImages) ? viduImages[0] : viduImages,
        }
        delete viduImageBody.images
        pushUniqueBody(fallbackBodies, viduImageBody)
      }

      if (minimalBody.aspect_ratio && minimalBody.ratio) {
        const aspectRatioOnly = { ...minimalBody }
        delete aspectRatioOnly.ratio
        pushUniqueBody(fallbackBodies, aspectRatioOnly)

        const ratioOnly = { ...minimalBody }
        delete ratioOnly.aspect_ratio
        pushUniqueBody(fallbackBodies, ratioOnly)
      }

      let lastError = error
      for (const body of fallbackBodies) {
        debugLog('generateVideo fallback body:', sanitizeDebugBody(body))
        try {
          const fallbackEndpoint = provider.getEndpoint(body)
          const response = await client.post(fallbackEndpoint, body)
          return normalizeResponse(response.data)
        } catch (fallbackError: any) {
          lastError = fallbackError
          if (![400, 422].includes(fallbackError.response?.status)) {
            throw fallbackError
          }
        }
      }

      throw new AppError(getApiErrorMessage(lastError, '视频比例参数未被当前模型接受，请切换模型或比例后重试。'))
    }
    throw error
  }
}

export async function getVideoStatus(taskId: string): Promise<VideoStatusResponse> {
  const response = await client.get(`/videos/${taskId}`)
  return response.data
}

function normalizeVideoStatus(data: any, taskId: string, provider?: string): VideoStatusResponse {
  const normalized = data?.task_id && !data.id
    ? {
      ...data,
      id: data.task_id,
      status: data.status || data.state || 'pending',
    }
    : data

  const creations = Array.isArray(normalized?.creations) ? normalized.creations : undefined
  const normalizedData = normalized?.data || creations?.map((creation: any) => ({
    url: creation.url || creation.video_url,
    thumbnail: creation.thumbnail || creation.cover_url || creation.cover,
    duration: creation.duration || normalized?.duration || normalized?.seconds || 0,
  })).filter((item: any) => item.url)

  return {
    ...normalized,
    id: normalized?.id || normalized?.task_id || taskId,
    task_id: normalized?.task_id || taskId,
    status: normalized?.status || normalized?.state || 'pending',
    video_url: normalized?.video_url || normalized?.url || normalizedData?.[0]?.url,
    data: normalizedData,
    error: normalized?.error || normalized?.err_msg || normalized?.message,
    provider: normalized?.provider || provider,
  }
}

export async function getVideoStatusWithProvider(taskId: string, provider?: string): Promise<VideoStatusResponse> {
  const normalizedProvider = provider?.toLowerCase()
  const endpoints = normalizedProvider === 'vidu'
    ? [`/videos/vidu/tasks/${taskId}/creations`, `/videos/${taskId}`]
    : [`/videos/${taskId}`]

  let lastError: any
  for (const endpoint of endpoints) {
    try {
      debugLog(`getVideoStatus provider=${provider || 'default'} endpoint=${endpoint}`)
      const response = await client.get(endpoint)
      return normalizeVideoStatus(response.data, taskId, provider)
    } catch (error: any) {
      lastError = error
      debugLog('getVideoStatus error:', {
        endpoint,
        status: error.response?.status,
        data: error.response?.data,
      })

      if (![404, 405, 500, 502, 503, 504].includes(error.response?.status)) {
        break
      }
    }
  }

  throw new AppError(getApiErrorMessage(lastError, `视频状态查询失败 (task: ${taskId})`))
}

export async function testConnection(testKey?: string, testBaseUrl?: string): Promise<boolean> {
  const result = await testConnectionWithDetail(testKey, testBaseUrl)
  return result.ok
}

export async function testConnectionWithDetail(testKey?: string, testBaseUrl?: string): Promise<ConnectionTestResult> {
  try {
    const keyToUse = testKey || getApiKey()
    if (!keyToUse) {
      return { ok: false, message: '请先填写 API Key。' }
    }

    const baseURL = testBaseUrl ? normalizeApiBaseUrl(testBaseUrl) : getApiBaseUrl()
    if (!baseURL) {
      return { ok: false, message: '请先填写 Base URL。' }
    }

    // 用 /models 接口验证 API Key 是否有效（AIPing 支持此接口）
    const res = await client.get('/models', {
      baseURL,
      skipAuthRedirect: true,
      headers: {
        Authorization: `Bearer ${keyToUse}`
      }
    } as any)
    return res.status === 200
      ? { ok: true }
      : { ok: false, message: `连接验证失败，服务返回状态码 ${res.status}。` }
  } catch (error: any) {
    debugLog('testConnection failed:', {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    })
    return { ok: false, message: getConnectionErrorMessage(error) }
  }
}

export default client
