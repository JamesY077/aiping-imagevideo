import axios from 'axios'
import { getApiBaseUrl, getApiKey, normalizeApiBaseUrl } from './config'
import type {
  ModelsResponse,
  ImageGenerateRequest,
  ImageGenerateResponse,
  VideoGenerateRequest,
  VideoGenerateResponse,
  VideoStatusResponse,
} from '@/types/api'

const client = axios.create({
  timeout: 100000,
})

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
    if (error.response?.status === 401) {
      window.location.href = '/setup'
    }
    return Promise.reject(error)
  }
)

export async function getModels(): Promise<ModelsResponse> {
  const response = await client.get('/models')
  return response.data
}

export async function generateImage(params: ImageGenerateRequest): Promise<ImageGenerateResponse> {
  const fullBody: Record<string, unknown> = {
    model: params.model || 'Kolors',
    prompt: params.prompt,
  }
  if (params.image) fullBody.image = params.image
  if (params.size) fullBody.size = params.size
  if (params.width) fullBody.width = params.width
  if (params.height) fullBody.height = params.height
  if (params.n) fullBody.n = params.n
  if (params.response_format) fullBody.response_format = params.response_format

  console.log('generateImage trying full body:', fullBody)
  try {
    const response = await client.post('/images/generations', fullBody)
    return response.data
  } catch (error: any) {
    const detail = JSON.stringify(error.response?.data)
    console.log('generateImage 400 error detail:', detail)
    if (error.response?.status === 400) {
      const alternateBody: Record<string, unknown> = { ...fullBody }

      if (typeof fullBody.size === 'string' && !fullBody.width && !fullBody.height) {
        const [width, height] = fullBody.size.split('x').map((value) => Number(value))
        if (width && height) {
          delete alternateBody.size
          alternateBody.width = width
          alternateBody.height = height
          console.log('generateImage retry with width/height:', alternateBody)
          const response = await client.post('/images/generations', alternateBody)
          return response.data
        }
      }

      if (typeof fullBody.width === 'number' && typeof fullBody.height === 'number' && !fullBody.size) {
        alternateBody.size = `${fullBody.width}x${fullBody.height}`
        delete alternateBody.width
        delete alternateBody.height
        console.log('generateImage retry with size:', alternateBody)
        const response = await client.post('/images/generations', alternateBody)
        return response.data
      }

      throw new Error(`图片尺寸参数未被当前模型接受：${detail || 'unknown error'}`)
    }
    throw error
  }
}

export async function generateVideo(params: VideoGenerateRequest): Promise<VideoGenerateResponse> {
  const fullBody: Record<string, unknown> = {
    model: params.model || 'Kling-V2.6',
    prompt: params.prompt,
  }
  if (params.image) fullBody.image = params.image
  if (params.img_url) fullBody.img_url = params.img_url
  if (params.first_frame_url) fullBody.first_frame_url = params.first_frame_url
  if (params.last_frame_url) fullBody.last_frame_url = params.last_frame_url
  if (params.reference_images?.length) fullBody.reference_images = params.reference_images
  if (params.video_list?.length) fullBody.video_list = params.video_list
  if (params.duration) fullBody.duration = params.duration
  if (params.aspect_ratio) fullBody.aspect_ratio = params.aspect_ratio
  if (params.size) fullBody.size = params.size

  console.log('generateVideo trying full body:', fullBody)
  try {
    const response = await client.post('/videos', fullBody)
    return response.data
  } catch (error: any) {
    console.log('generateVideo error:', error.response?.status, JSON.stringify(error.response?.data))
    if (error.response?.status === 400 || error.response?.status === 422) {
      const minimalBody: Record<string, unknown> = { model: fullBody.model, prompt: fullBody.prompt }
      if (fullBody.image) minimalBody.image = fullBody.image
      if (fullBody.img_url) minimalBody.img_url = fullBody.img_url
      if (fullBody.first_frame_url) minimalBody.first_frame_url = fullBody.first_frame_url
      if (fullBody.video_list) minimalBody.video_list = fullBody.video_list
      if (fullBody.aspect_ratio) minimalBody.aspect_ratio = fullBody.aspect_ratio
      if (fullBody.size) minimalBody.size = fullBody.size
      console.log('generateVideo fallback to minimal body:', minimalBody)
      const response = await client.post('/videos', minimalBody)
      return response.data
    }
    throw error
  }
}

export async function getVideoStatus(taskId: string): Promise<VideoStatusResponse> {
  const response = await client.get(`/videos/${taskId}`)
  return response.data
}

export async function testConnection(testKey?: string, testBaseUrl?: string): Promise<boolean> {
  try {
    const keyToUse = testKey || getApiKey()
    const baseURL = testBaseUrl ? normalizeApiBaseUrl(testBaseUrl) : getApiBaseUrl()
    // 用 /models 接口验证 API Key 是否有效（AIPing 支持此接口）
    const res = await client.get('/models', {
      baseURL,
      headers: {
        Authorization: `Bearer ${keyToUse}`
      }
    })
    return res.status === 200
  } catch (error: any) {
    console.error('testConnection failed:', error?.message, error?.response?.status, error?.response?.data)
    return false
  }
}

export default client
