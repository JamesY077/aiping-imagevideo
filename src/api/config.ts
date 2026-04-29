export const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const API_KEY_STORAGE_KEY = 'aiping_api_key'
const API_BASE_URL_STORAGE_KEY = 'aiping_api_base_url'

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

export function saveApiBaseUrl(baseUrl: string): void {
  localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalizeApiBaseUrl(baseUrl))
}

export function clearApiBaseUrl(): void {
  localStorage.removeItem(API_BASE_URL_STORAGE_KEY)
}

export function hasApiConfig(): boolean {
  return !!getApiKey() && !!getApiBaseUrl()
}
