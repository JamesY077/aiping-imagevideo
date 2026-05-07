export const AIPING_PUBLIC_API_BASE_URL = 'https://aiping.cn/api/v1'
export const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const API_KEY_STORAGE_KEY = 'aiping_api_key'
const API_BASE_URL_STORAGE_KEY = 'aiping_api_base_url'
const API_SESSION_READY_STORAGE_KEY = 'aiping_api_session_ready'

export function normalizeApiBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')

  try {
    const url = new URL(normalized)
    if (url.hostname === 'aiping.cn' && url.pathname.replace(/\/+$/, '') === '/api/v1') {
      return '/api/v1'
    }
    if (url.hostname === 'api.aiping.cn' && url.pathname.replace(/\/+$/, '') === '/v1') {
      return '/api/v1'
    }
  } catch {
    // Relative URLs such as /api/v1 are expected in local development.
  }

  return normalized
}

export function isAipingBaseUrl(baseUrl: string): boolean {
  return normalizeApiBaseUrl(baseUrl) === '/api/v1'
}

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY)
}

export function saveApiKey(apiKey: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey)
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY)
}

export function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(localStorage.getItem(API_BASE_URL_STORAGE_KEY) || DEFAULT_API_BASE_URL)
}

export function getApiBaseUrlInputValue(): string {
  const value = localStorage.getItem(API_BASE_URL_STORAGE_KEY) || AIPING_PUBLIC_API_BASE_URL
  return isAipingBaseUrl(value) ? AIPING_PUBLIC_API_BASE_URL : value.trim().replace(/\/+$/, '')
}

export function saveApiBaseUrl(baseUrl: string): void {
  localStorage.setItem(API_BASE_URL_STORAGE_KEY, baseUrl.trim().replace(/\/+$/, ''))
}

export function clearApiBaseUrl(): void {
  localStorage.removeItem(API_BASE_URL_STORAGE_KEY)
}

export function hasApiConfig(): boolean {
  return !!getApiKey() && !!getApiBaseUrl()
}

export function markApiSessionReady(): void {
  sessionStorage.setItem(API_SESSION_READY_STORAGE_KEY, '1')
}

export function clearApiSessionReady(): void {
  sessionStorage.removeItem(API_SESSION_READY_STORAGE_KEY)
}

export function hasActiveApiSession(): boolean {
  return hasApiConfig() && sessionStorage.getItem(API_SESSION_READY_STORAGE_KEY) === '1'
}
