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
import { getKlingStatusEndpoints } from '@/api/providers/video/common'
import { VIDU_TASKS_ENDPOINT } from '@/api/providers/video/viduShared'
import {
  SEEDANCE_TASKS_ENDPOINT,
  buildSeedanceContent,
  collectSeedanceReferenceImages,
  collectSeedanceReferenceVideos,
  collectSeedanceReferenceAudios,
  normalizeSeedanceResponse,
} from '@/api/providers/video/seedanceShared'
import {
  MINIMAX_H3_TASKS_ENDPOINT,
  MINIMAX_H3_QUERY_TASKS_ENDPOINT,
  buildMinimaxH3Content,
  collectMinimaxH3ReferenceAudios,
  collectMinimaxH3ReferenceImages,
  collectMinimaxH3ReferenceVideos,
  collectMinimaxH3FirstFrame,
  collectMinimaxH3LastFrame,
  normalizeMinimaxH3Response,
} from '@/api/providers/video/minimaxH3Shared'

import { AppError } from '@/utils/errors'
import {
  uploadDataUriToPublicUrl,
  ensurePublicImageUrlForModel,
  ensurePublicAudioUrlForModel,
  ensureMinimaxH3ImageForModel,
} from '@/features/generate/upload'




const client = axios.create({
  timeout: 100000,
})

/**
 * 视频任务创建是长耗时接口：
 * - Seedance 2 系列在受理阶段会先做降噪 / 推理准备，复杂多模态任务可能数分钟才返回 task_id；
 * - MiniMax-H3 大分辨率 + 多参考素材的创建请求也可能明显超过 100s。
 * 沿用全局 100s 会让仍在受理的任务被误判为超时，因此单独放宽到 240s。
 * 线上 Nginx /api 的 proxy_read_timeout 为 300s，需保持低于该值。
 */
const VIDEO_CREATE_TIMEOUT_MS = 240000

export interface ConnectionTestResult {
  ok: boolean
  message?: string
}

function getConnectionErrorMessage(error: any): string {
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return 'API Key 无效或权限不足，请检查后重试。'
  }

  if (error?.response?.status === 404) {
    return '无法连接到 AI 服务，请确认服务地址是否正确。'
  }

  if (error?.response?.status >= 500) {
    return 'AI 服务暂时开小差了，请稍后重试。'
  }

  if (error?.code === 'ECONNABORTED') {
    return '连接超时了，请检查网络后重试。'
  }

  if (error?.message?.includes('Network Error')) {
    return '网络连接失败，请检查服务地址、网络或代理设置。'
  }

  return '连接没有成功，请检查服务地址和 API Key 后重试。'
}

function getApiErrorMessage(error: any, fallback = '请求失败，请稍后重试。'): string {
  const data = error?.response?.data
  const detail = data?.detail
  const detailMessage = typeof detail === 'string' ? detail : detail?.message || detail?.error
  // AIPing 的错误体是 { code, msg, data }，msg 里才是上游真实原因（如“RPM 超限”“并发已满”）。
  const rawMessage = detailMessage || data?.message || data?.error || data?.msg || error?.message
  const message = typeof rawMessage === 'string' ? rawMessage : ''

  if (!message) return fallback

  if (message.includes('No provider is currently available')) {
    return '当前模型的上游供应商暂不可用，前端已尝试多种参数格式仍失败。请稍后重试，或先切换到 Qwen-Image-2.0-Pro、Doubao-Seedream-5.0-lite 等其他图片模型。'
  }

  const normalizedMessage = message.toLowerCase()
  if (
    message.includes('版权') ||
    message.includes('copyright') ||
    normalizedMessage.includes('copyright restriction') ||
    message.includes('content policy') ||
    message.includes('safety policy') ||
    message.includes('审核')
  ) {
    return '内容可能涉及版权或平台审核限制，请移除品牌名、真实人物、受保护角色或未授权素材后重试。'
  }

  if (error?.response?.status === 400 || error?.response?.status === 422) {
    return fallback !== '请求失败，请稍后重试。'
      ? fallback
      : '当前模型暂时无法处理这个请求，请调整提示词、参考图、比例、时长或模型后重试。'
  }

  if (error?.response?.status === 401 || error?.response?.status === 403) {
    return '鉴权失败，请检查 API Key 是否有效，或确认当前模型权限是否已开通。'
  }

  if (error?.response?.status === 429) {
    if (message.includes('并发已满') || message.toLowerCase().includes('concurrency')) {
      return '当前模型并发已满：同一账号同时生成的任务已达上限，请等待正在生成的任务完成后再试。'
    }
    if (message.toLowerCase().includes('rpm')) {
      return '接口调用频率超出限制（RPM），本轮已自动重试仍失败，请稍后重试。'
    }
    return '请求过于频繁或额度不足，请稍后重试，或检查账户配额。'
  }

  if (error?.response?.status >= 500) {
    return '生成服务暂时开小差了，请稍后重试；如果仍失败，可以切换其他模型。'
  }

  if (error?.code === 'ECONNABORTED') {
    return '请求超时，生成时间较长或网络不稳定，请稍后重试。'
  }

  if (message.includes('Network Error')) {
    return '网络异常，无法连接生成服务，请检查网络或 Base URL 配置。'
  }

  return '生成没有成功，请稍后重试；如果多次失败，可尝试更换模型或调整提示词。'
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

/**
 * 通用文本对话补全。用于文本节点，支持透传 extra_body
 * （如 provider 路由配置、enable_thinking 等，见 PRD 示例代码）。
 */
export async function chatCompletion(params: ChatCompletionRequest): Promise<string> {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
  }
  if (typeof params.temperature === 'number') {
    body.temperature = params.temperature
  }
  if (typeof params.max_tokens === 'number') {
    body.max_tokens = params.max_tokens
  }
  if (params.extra_body) {
    body.extra_body = params.extra_body
  }

  try {
    const response = await client.post<ChatCompletionResponse>('/chat/completions', body)
    const content = response.data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new Error('文本模型没有返回有效内容，请更换模型或稍后重试。')
    }
    return content
  } catch (error: any) {
    if (error instanceof AppError || !error?.response) throw error
    throw new AppError(getApiErrorMessage(error, '文本生成失败，请稍后重试。'))
  }
}

async function prepareImageGenerationParams(params: ImageGenerateRequest): Promise<ImageGenerateRequest> {
  if (!params.image) return params
  return {
    ...params,
    image: await ensurePublicImageUrlForModel(params.image),
  }
}

async function prepareVideoGenerationParams(
  params: VideoGenerateRequest,
  prepareImage: (value: string) => Promise<string> = ensurePublicImageUrlForModel,
): Promise<VideoGenerateRequest> {
  const next: VideoGenerateRequest = { ...params }

  if (next.image) next.image = await prepareImage(next.image)
  if (next.image_url) next.image_url = await prepareImage(next.image_url)
  if (next.image_tail) next.image_tail = await prepareImage(next.image_tail)
  if (next.img_url) next.img_url = await prepareImage(next.img_url)
  if (next.first_frame_image) next.first_frame_image = await prepareImage(next.first_frame_image)
  if (next.last_frame_image) next.last_frame_image = await prepareImage(next.last_frame_image)
  if (next.first_frame_url) next.first_frame_url = await prepareImage(next.first_frame_url)
  if (next.last_frame_url) next.last_frame_url = await prepareImage(next.last_frame_url)
  if (next.start_image) next.start_image = await prepareImage(next.start_image)
  if (next.end_image) next.end_image = await prepareImage(next.end_image)

  if (next.images) {
    next.images = await Promise.all(next.images.map(prepareImage))
  }
  if (next.reference_images) {
    next.reference_images = await Promise.all(next.reference_images.map(prepareImage))
  }
  if (next.image_list) {
    next.image_list = await Promise.all(
      next.image_list.map(async (item) => ({
        ...item,
        image_url: await prepareImage(item.image_url),
      })),
    )
  }
  if (next.subject_reference) {
    next.subject_reference = await Promise.all(
      next.subject_reference.map(async (item) => ({
        ...item,
        image: await Promise.all((item.image || []).map(prepareImage)),
      })),
    )
  }

  return next
}

export async function generateImage(params: ImageGenerateRequest): Promise<ImageGenerateResponse> {
  const preparedParams = await prepareImageGenerationParams(params)
  const provider = getImageProvider(preparedParams)
  const fullBody = provider.buildRequestBody(preparedParams)

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

type SeedanceAssetType = 'Image' | 'Video' | 'Audio'

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function getUpstreamErrorMessage(error: any): string {
  const data = error?.response?.data
  return String(data?.msg || data?.message || data?.detail || data?.error || error?.message || '')
}

/**
 * 创建任务时的限流重试。
 * 只重试 429：此时上游尚未建单，重试不会产生重复任务（5xx 可能已建单，不能盲目重试）。
 * - 429「RPM 超限」：请求突发导致，短退避即可恢复。
 * - 429「当前多模态并发已满」：账号同时运行的任务数已达上限（实测上限 5），
 *   需要等已有任务结束释放名额，因此退避时间更长。
 */
async function postVideoCreateWithRetry(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const maxRetries = 10
  let lastError: any

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.post(endpoint, body, { timeout: VIDEO_CREATE_TIMEOUT_MS })
    } catch (error: any) {
      lastError = error
      const status = error?.response?.status
      if (status !== 429 || attempt === maxRetries) throw error

      const message = getUpstreamErrorMessage(error)
      const concurrencyFull = message.includes('并发已满') || message.toLowerCase().includes('concurrency')
      const wait = concurrencyFull
        ? Math.min(30000, 3000 * 2 ** Math.min(attempt, 3)) + Math.floor(Math.random() * 500)
        : Math.min(8000, 1000 * 2 ** Math.min(attempt, 3)) + Math.floor(Math.random() * 300)

      debugLog(
        `create retry after 429 endpoint=${endpoint} attempt=${attempt + 1} wait=${wait}ms msg=${message}`
      )
      await sleep(wait)
    }
  }

  throw lastError
}

/** 判断当前配置的服务地址是否为 AI Ping 官方地址。 */
function isAipingApiConfigured(): boolean {
  const baseUrl = getApiBaseUrl()
  if (!baseUrl) return false
  if (baseUrl === '/api/v1') return true
  try {
    const url = new URL(baseUrl, window.location.origin)
    return url.hostname === 'aiping.cn'
  } catch {
    return false
  }
}

/** 把 Seedance 2.0 的上游错误转换成普通用户能理解的提示。 */
function resolveSeedanceCreateError(error: any): AppError | null {
  const status = error?.response?.status
  const data = error?.response?.data
  const msg = typeof data?.msg === 'string' ? data.msg : ''

  if (status === 401 || status === 403) {
    return new AppError('Seedance 2.0 系列仅支持已开通白名单的账号调用。当前 API Key 未开通白名单权限，请联系服务商开通后重试。')
  }

  if (status === 404 && /model参数.*不在支持列表/.test(msg)) {
    return new AppError('当前 API Key 未开放 Seedance 2.0 视频模型，请先到服务商处开通该模型后重试。')
  }

  if (status === 500 && msg === '创建任务失败' && !isAipingApiConfigured()) {
    return new AppError('当前服务地址暂不支持 Seedance 2.0。请到「设置 → 编辑配置」把服务地址改为 https://aiping.cn/api/v1 后重试。')
  }

  return null
}

/** 判断一个字符串是否为 base64 dataURI（data:xxx;base64,...）。 */
function isDataUri(value: string): boolean {
  return /^data:[^;]+;base64,/.test(value)
}

/** 图片/音频类素材允许上传本地 base64（会先转成公网 URL）；参考视频暂不支持本地上传。 */
function assertRemoteAssetUrl(url: string, assetType: SeedanceAssetType): void {
  if (isDataUri(url)) {
    throw new AppError(
      `Seedance 2.0 的参考${assetType === 'Video' ? '视频' : '素材'}目前需要公网 URL，暂不支持本地上传。请改用公网可访问的地址。`,
    )
  }
}

/**
 * 把某一类参考素材整理成任务接口可直接使用的公网 URL：
 * - 图片 base64：先上传到图片服务换成公网 URL。
 * - 音频 base64：先上传到同一文件服务换成公网 URL（配音音频库/本地上传都走这里）。
 * - 视频 base64：暂不支持，直接给出中文提示。
 * - 其他 http/https 地址：原样返回。
 */
async function prepareSeedanceReferenceUrls(urls: string[], assetType: SeedanceAssetType): Promise<string[]> {
  const preparedUrls: string[] = []
  for (const rawUrl of urls) {
    if (isDataUri(rawUrl)) {
      if (assetType === 'Image') {
        preparedUrls.push(await uploadDataUriToPublicUrl(rawUrl))
      } else if (assetType === 'Audio') {
        preparedUrls.push(await ensurePublicAudioUrlForModel(rawUrl))
      } else {
        assertRemoteAssetUrl(rawUrl, assetType)
        preparedUrls.push(rawUrl)
      }
    } else {
      preparedUrls.push(rawUrl)
    }
  }
  return preparedUrls
}


/**
 * Seedance 2.0 系列专用生成流程：
 * 1. 把本地 base64 参考图上传成公网 URL（视频/音频必须已是公网 URL）。
 * 2. 直接用公网 URL 调用 contents/generations/tasks 创建视频任务。
 * 仅 AI Ping 白名单账号生成的 API Key 才能成功，否则上游返回鉴权类报错。
 */
async function generateSeedanceVideo(params: VideoGenerateRequest, canonicalModel: string): Promise<VideoGenerateResponse> {
  const referenceImages = collectSeedanceReferenceImages(params)
  const referenceVideos = collectSeedanceReferenceVideos(params)
  const referenceAudios = collectSeedanceReferenceAudios(params)

  const imageUrls = await prepareSeedanceReferenceUrls(referenceImages, 'Image')
  const videoUrls = await prepareSeedanceReferenceUrls(referenceVideos, 'Video')
  const audioUrls = await prepareSeedanceReferenceUrls(referenceAudios, 'Audio')

  const body: Record<string, unknown> = {
    model: params.model || canonicalModel,
    content: buildSeedanceContent(params.prompt, {
      images: imageUrls,
      videos: videoUrls,
      audios: audioUrls,
    }),
    generate_audio: typeof params.audio === 'boolean' ? params.audio : true,
    ratio: params.aspect_ratio || params.ratio || '16:9',
    duration: params.duration || params.seconds || 5,
    watermark: typeof params.watermark === 'boolean' ? params.watermark : false,
  }


  debugLog('generateVideo provider=seedance body:', sanitizeDebugBody(body))
  try {
    const response = await client.post(SEEDANCE_TASKS_ENDPOINT, body, {
      timeout: VIDEO_CREATE_TIMEOUT_MS,
    })
    return normalizeSeedanceResponse(response.data)
  } catch (error: any) {
    debugLog('generateSeedanceVideo error:', {
      status: error.response?.status,
      data: error.response?.data,
    })
    const resolvedError = resolveSeedanceCreateError(error)
    if (resolvedError) throw resolvedError
    throw new AppError(getApiErrorMessage(error, 'Seedance 2.0 视频生成失败，请确认账号已完成白名单接入后重试。'))
  }
}

/**
 * MiniMax-H3 专用生成流程：
 * 1. 首/尾帧与参考图已由通用上传流程处理为公网 URL（或压缩后的 dataURI）；
 *    参考音频的 base64 会在这里上传为公网 URL；参考视频仍必须已是公网 URL。
 * 2. 组装 content 数组后调用 /multimodal/minimax/videos/video_generation 创建任务。
 */
async function generateMinimaxH3Video(params: VideoGenerateRequest, canonicalModel: string): Promise<VideoGenerateResponse> {
  const firstFrame = collectMinimaxH3FirstFrame(params)
  const lastFrame = collectMinimaxH3LastFrame(params)
  const referenceImages = collectMinimaxH3ReferenceImages(params)
  const referenceVideos = collectMinimaxH3ReferenceVideos(params)
  const referenceAudios = collectMinimaxH3ReferenceAudios(params)

  const hasFrames = !!(firstFrame || lastFrame)

  let preparedReferenceAudios = referenceAudios
  if (!hasFrames) {
    for (const url of referenceVideos) {
      if (isDataUri(url)) {
        throw new AppError('MiniMax-H3 的参考视频目前需要公网 URL，暂不支持本地上传。请改用公网可访问的地址。')
      }
    }
    preparedReferenceAudios = await Promise.all(
      referenceAudios.map((url) => ensurePublicAudioUrlForModel(url)),
    )
  }

  const body: Record<string, unknown> = {
    model: params.model || canonicalModel,
    content: hasFrames
      ? buildMinimaxH3Content(params.prompt, {
          firstFrame,
          lastFrame,
        })
      : buildMinimaxH3Content(params.prompt, {
          referenceImages,
          referenceVideos,
          referenceAudios: preparedReferenceAudios,
        }),
    resolution: params.resolution === '2K' ? '2K' : '768P',
    duration: Math.min(15, Math.max(4, Math.round(Number(params.duration || params.seconds || 5)))),
  }

  const ratio = params.aspect_ratio || params.ratio
  if (ratio && ratio !== 'adaptive') body.ratio = ratio
  else if (!hasFrames && !referenceImages.length && !referenceVideos.length && !referenceAudios.length) {
    // 纯文生视频必须给具体比例。
    body.ratio = '16:9'
  }

  if (typeof params.watermark === 'boolean') body.aigc_watermark = params.watermark
  if (params.callback_url) body.callback_url = params.callback_url

  debugLog('generateVideo provider=minimax-h3 body:', sanitizeDebugBody(body))
  try {
    const response = await postVideoCreateWithRetry(MINIMAX_H3_TASKS_ENDPOINT, body)
    return normalizeMinimaxH3Response(response.data)
  } catch (error: any) {
    debugLog('generateMinimaxH3Video error:', {
      status: error.response?.status,
      data: error.response?.data,
    })
    if (error?.response?.status === 503) {
      throw new AppError(
        'MiniMax-H3 服务暂时不可用（503）。如果当前上传了多张本地图片，请稍后重试，或先压缩图片、减少参考图数量、改用公网图片链接后再试。',
      )
    }
    throw new AppError(getApiErrorMessage(error, 'MiniMax-H3 视频生成失败，请切换模型或调整参数后重试。'))
  }
}

export async function generateVideo(params: VideoGenerateRequest): Promise<VideoGenerateResponse> {
  const provider = getVideoProvider(params)
  const preparedParams = provider.provider === 'seedance'
    ? params
    : provider.provider === 'minimax-h3'
      ? await prepareVideoGenerationParams(params, ensureMinimaxH3ImageForModel)
      : await prepareVideoGenerationParams(params)

  // Seedance 2.0 系列走独立的「素材 + 任务」流程。
  if (provider.provider === 'seedance') {
    return generateSeedanceVideo(preparedParams, provider.models[0])
  }

  // MiniMax-H3 走独立的 content 数组协议端点。
  if (provider.provider === 'minimax-h3') {
    return generateMinimaxH3Video(preparedParams, provider.models[0])
  }

  const fullBody = provider.buildRequestBody(preparedParams)
  const videoEndpoint = provider.getEndpoint(fullBody)
  const normalizeResponse = provider.normalizeResponse
    || ((data: VideoGenerateResponse, _providerCreateEndpoint?: string) => data)


  debugLog(`generateVideo provider=${provider.provider} trying full body:`, sanitizeDebugBody(fullBody))
  try {
    const response = await postVideoCreateWithRetry(videoEndpoint, fullBody)
    return normalizeResponse(response.data, videoEndpoint)
  } catch (error: any) {
    debugLog('generateVideo error:', {
      status: error.response?.status,
      data: error.response?.data,
    })
    if (error.response?.status === 400 || error.response?.status === 422) {
      const minimalBody: Record<string, unknown> = { model: fullBody.model, model_name: fullBody.model_name, prompt: fullBody.prompt }
      if (fullBody.image) minimalBody.image = fullBody.image
      if (fullBody.image_tail) minimalBody.image_tail = fullBody.image_tail
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
      if (fullBody.duration) minimalBody.duration = fullBody.duration
      if (fullBody.negative_prompt !== undefined) minimalBody.negative_prompt = fullBody.negative_prompt
      if (fullBody.mode) minimalBody.mode = fullBody.mode
      if (fullBody.sound) minimalBody.sound = fullBody.sound
      if (fullBody.aspect_ratio) minimalBody.aspect_ratio = fullBody.aspect_ratio
      if (fullBody.ratio) minimalBody.ratio = fullBody.ratio
      if (fullBody.size) minimalBody.size = fullBody.size
      if (fullBody.resolution) minimalBody.resolution = fullBody.resolution
      if (fullBody.sound) minimalBody.sound = fullBody.sound
      if (fullBody.movement_amplitude) minimalBody.movement_amplitude = fullBody.movement_amplitude
      if (typeof fullBody.off_peak === 'boolean') minimalBody.off_peak = fullBody.off_peak
      if (typeof fullBody.watermark === 'boolean') minimalBody.watermark = fullBody.watermark
      if (typeof fullBody.seed === 'number') minimalBody.seed = fullBody.seed
      if (fullBody.style) minimalBody.style = fullBody.style
      if (typeof fullBody.payload === 'string') minimalBody.payload = fullBody.payload
      if (fullBody.callback_url !== undefined) minimalBody.callback_url = fullBody.callback_url
      if (fullBody.external_task_id !== undefined) minimalBody.external_task_id = fullBody.external_task_id
      if (fullBody.extra_body) minimalBody.extra_body = fullBody.extra_body

      const fallbackBodies: Record<string, unknown>[] = []
      pushUniqueBody(fallbackBodies, minimalBody)

      for (const providerFallbackBody of provider.buildFallbackBodies?.(fullBody) || []) {
        pushUniqueBody(fallbackBodies, providerFallbackBody)
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
          const response = await postVideoCreateWithRetry(fallbackEndpoint, body)
          return normalizeResponse(response.data, fallbackEndpoint)
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

/**
 * 归一化 Seedance 2.0 任务查询结果。
 * 文档返回：{ id, model, status, content?.video_url, ... }，status 取值见文档
 * （queued / running / cancelled / succeeded / failed / expired）。
 */
function normalizeSeedanceStatus(data: any, taskId: string): VideoStatusResponse {
  const videoUrl = data?.content?.video_url || data?.video_url
  return {
    ...data,
    id: data?.id || taskId,
    task_id: data?.id || taskId,
    status: data?.status || 'running',
    state: data?.status,
    video_url: videoUrl,
    data: videoUrl ? [{ url: videoUrl, duration: data?.duration || 0 }] : undefined,
    error: data?.error?.message || data?.error,
    provider: 'seedance',
    model: data?.model,
  }
}

function normalizeVideoStatus(data: any, taskId: string, provider?: string): VideoStatusResponse {

  const task = data?.data?.task_id || data?.data?.task_status ? data.data : data
  const normalized = task?.task_id && !task.id
    ? {
      ...task,
      id: task.task_id,
      status: task.status || task.task_status || task.state || 'pending',
      state: task.state || task.task_status,
    }
    : task

  const creations = Array.isArray(normalized?.creations) ? normalized.creations : undefined
  const taskVideos = normalized?.task_result?.videos
  const normalizedData = normalized?.data
    || (Array.isArray(taskVideos) ? taskVideos : creations)?.map((creation: any) => ({
      url: creation.url || creation.video_url,
      thumbnail: creation.thumbnail || creation.cover_url || creation.cover,
      watermarked_url: creation.watermark_url || creation.watermarked_url,
      duration: Number(creation.duration) || normalized?.duration || normalized?.seconds || 0,
    })).filter((item: any) => item.url)

  const result: VideoStatusResponse = {
    ...normalized,
    id: normalized?.id || normalized?.task_id || taskId,
    task_id: normalized?.task_id || taskId,
    status: normalized?.status || normalized?.state || 'pending',
    video_url: normalized?.video_url || normalized?.url || normalizedData?.[0]?.url,
    data: normalizedData,
    error: normalized?.error || normalized?.task_status_msg || normalized?.err_msg || normalized?.message || normalized?.err_code,
    provider: normalized?.provider || provider,
    model: normalized?.model || data?.model || '',
  }

  if (normalized?.final_unit_deduction !== undefined) {
    result.usage = { total_cost: normalized.final_unit_deduction }
  }

  return result
}

/**
 * 归一化 MiniMax-H3 任务查询结果。
 * 查询接口返回：{ task: { id, status, content: { url }, ... }, aiping_id }。
 */
function normalizeMinimaxH3Status(data: any, taskId: string): VideoStatusResponse {
  const task = data?.task || data?.data?.task || data?.data || data
  const videoUrl = task?.content?.url || task?.content?.video_url || task?.video_url || task?.url

  return {
    ...task,
    id: task?.id || task?.task_id || taskId,
    task_id: task?.task_id || task?.id || taskId,
    status: task?.status || task?.state || 'pending',
    state: task?.state || task?.status,
    video_url: videoUrl,
    data: videoUrl ? [{ url: videoUrl, duration: task?.duration || 0 }] : undefined,
    error: task?.error?.message || task?.error || task?.err_msg,
    provider: 'minimax',
    model: task?.model || data?.model,
  }
}

export async function getVideoStatusWithProvider(
  taskId: string,
  provider?: string,
  providerCreateEndpoint?: string,
): Promise<VideoStatusResponse> {
  const normalizedProvider = provider?.toLowerCase()

  // Seedance 2.0 走独立的任务查询接口：/multimodal/sd/videos/contents/generations/tasks/{task_id}
  if (normalizedProvider === 'seedance') {
    try {
      debugLog(`getVideoStatus provider=seedance endpoint=${SEEDANCE_TASKS_ENDPOINT}/${taskId}`)
      const response = await client.get(`${SEEDANCE_TASKS_ENDPOINT}/${taskId}`)
      return normalizeSeedanceStatus(response.data, taskId)
    } catch (error: any) {
      debugLog('getVideoStatus seedance error:', {
        status: error.response?.status,
        data: error.response?.data,
      })
      throw new AppError(getApiErrorMessage(error, `Seedance 视频状态查询失败 (task: ${taskId})`), {
        code: error?.response?.status ? `http_${error.response.status}` : 'network',
      })
    }
  }

  // 可灵任务按创建能力拆分查询路径，优先使用创建接口返回的路径。
  const endpoints = normalizedProvider === 'vidu'
    ? [`${VIDU_TASKS_ENDPOINT}/${taskId}/creations`]
    : normalizedProvider === 'kling' || normalizedProvider === 'kling-omni'
      ? getKlingStatusEndpoints(providerCreateEndpoint || '', taskId)
    : normalizedProvider === 'minimax-h3'
      ? [`${MINIMAX_H3_QUERY_TASKS_ENDPOINT}/${taskId}`]
    : [`/videos/${taskId}`]


  // Kling Omni / MiniMax-H3 对外展示仍归一为 kling / minimax，避免 UI 上出现内部路由标识。
  const displayProvider = normalizedProvider === 'kling-omni'
    ? 'kling'
    : normalizedProvider === 'minimax-h3'
      ? 'minimax'
      : provider

  let lastError: any
  for (const endpoint of endpoints) {
    try {
      debugLog(`getVideoStatus provider=${provider || 'default'} endpoint=${endpoint}`)
      const response = await client.get(endpoint)
      return normalizedProvider === 'minimax-h3'
        ? normalizeMinimaxH3Status(response.data, taskId)
        : normalizeVideoStatus(response.data, taskId, displayProvider)
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

  throw new AppError(getApiErrorMessage(lastError, `视频状态查询失败 (task: ${taskId})`), {
    // 保留上游状态码，供轮询层判断是否可重试（429 限流 / 5xx）。
    code: lastError?.response?.status ? `http_${lastError.response.status}` : 'network',
  })
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
