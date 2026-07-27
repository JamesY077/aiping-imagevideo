export const AIPING_PUBLIC_API_BASE_URL = 'https://aiping.cn/api/v1'
export const DEFAULT_API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

const API_AUTH_STORAGE_KEY = 'aiping_api_auth'
const API_SESSION_READY_STORAGE_KEY = 'aiping_api_session_ready'

type StoredApiAuth = {
  apiKey: string
  apiBaseUrl: string
  sessionId: string
  verifiedAtEpochMs: number
  verifiedDateCN: string
}

function getCurrentChinaDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const valueOf = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''

  return {
    year: valueOf('year'),
    month: valueOf('month'),
    day: valueOf('day'),
    hour: valueOf('hour'),
    minute: valueOf('minute'),
    second: valueOf('second'),
  }
}

export function getCurrentChinaDateKey(date = new Date()): string {
  const { year, month, day } = getCurrentChinaDateParts(date)
  return `${year}-${month}-${day}`
}

export function getMillisecondsUntilNextChinaMidnight(date = new Date()): number {
  const { year, month, day } = getCurrentChinaDateParts(date)
  const currentChinaDate = new Date(`${year}-${month}-${day}T00:00:00+08:00`)
  const nextChinaMidnight = new Date(currentChinaDate.getTime() + 24 * 60 * 60 * 1000)
  return Math.max(nextChinaMidnight.getTime() - date.getTime(), 0)
}

function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function parseStoredApiAuth(): StoredApiAuth | null {
  const raw = localStorage.getItem(API_AUTH_STORAGE_KEY)

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredApiAuth>
    if (!parsed.apiKey || !parsed.apiBaseUrl || !parsed.sessionId || !parsed.verifiedDateCN) {
      return null
    }

    return {
      apiKey: parsed.apiKey,
      apiBaseUrl: parsed.apiBaseUrl,
      sessionId: parsed.sessionId,
      verifiedAtEpochMs: Number(parsed.verifiedAtEpochMs) || Date.now(),
      verifiedDateCN: parsed.verifiedDateCN,
    }
  } catch {
    return null
  }
}

function getSessionReadyToken(): string | null {
  return sessionStorage.getItem(API_SESSION_READY_STORAGE_KEY)
}

function clearStoredAuthData(): void {
  localStorage.removeItem(API_AUTH_STORAGE_KEY)
}

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

export function isOpenAiBaseUrlFormat(baseUrl: string): boolean {
  const trimmed = baseUrl.trim()
  if (!trimmed) return false

  try {
    const url = new URL(trimmed)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    return url.pathname.replace(/\/+$/, '').endsWith('/v1')
  } catch {
    return false
  }
}

export function isAipingBaseUrl(baseUrl: string): boolean {
  return normalizeApiBaseUrl(baseUrl) === '/api/v1'
}

export function getApiKey(): string | null {
  return parseStoredApiAuth()?.apiKey || null
}

export function saveApiKey(apiKey: string): void {
  const current = parseStoredApiAuth()
  const normalizedBaseUrl = current?.apiBaseUrl || DEFAULT_API_BASE_URL

  saveApiAuth(apiKey, normalizedBaseUrl)
}

export function clearApiKey(): void {
  clearStoredAuthData()
}

export function getApiBaseUrl(): string {
  return normalizeApiBaseUrl(parseStoredApiAuth()?.apiBaseUrl || DEFAULT_API_BASE_URL)
}

export function getApiBaseUrlInputValue(): string {
  const value = parseStoredApiAuth()?.apiBaseUrl || AIPING_PUBLIC_API_BASE_URL
  return isAipingBaseUrl(value) ? AIPING_PUBLIC_API_BASE_URL : value.trim().replace(/\/+$/, '')
}

export function saveApiBaseUrl(baseUrl: string): void {
  const current = parseStoredApiAuth()
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '')

  localStorage.setItem(
    API_AUTH_STORAGE_KEY,
    JSON.stringify({
      apiKey: current?.apiKey || '',
      apiBaseUrl: normalizedBaseUrl,
      sessionId: current?.sessionId || createSessionId(),
      verifiedAtEpochMs: current?.verifiedAtEpochMs || 0,
      verifiedDateCN: current?.verifiedDateCN || '',
    } satisfies StoredApiAuth),
  )
}

export function saveApiAuth(apiKey: string, baseUrl: string): void {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '')

  localStorage.setItem(
    API_AUTH_STORAGE_KEY,
    JSON.stringify({
      apiKey: apiKey.trim(),
      apiBaseUrl: normalizedBaseUrl,
      sessionId: createSessionId(),
      verifiedAtEpochMs: Date.now(),
      verifiedDateCN: getCurrentChinaDateKey(),
    } satisfies StoredApiAuth),
  )
}

export function clearApiBaseUrl(): void {
  clearStoredAuthData()
}

export function hasApiConfig(): boolean {
  return !!getApiKey() && !!getApiBaseUrl()
}

export function markApiSessionReady(): void {
  const auth = parseStoredApiAuth()
  if (!auth) return
  sessionStorage.setItem(API_SESSION_READY_STORAGE_KEY, auth.sessionId)
}

export function clearApiSessionReady(): void {
  sessionStorage.removeItem(API_SESSION_READY_STORAGE_KEY)
}

export function hasActiveApiSession(): boolean {
  const auth = parseStoredApiAuth()
  if (!auth?.apiKey || !auth.apiBaseUrl) return false

  if (auth.verifiedDateCN !== getCurrentChinaDateKey()) {
    clearApiSessionReady()
    return false
  }

  return getSessionReadyToken() === auth.sessionId
}

export function invalidateExpiredApiSession(): boolean {
  const auth = parseStoredApiAuth()
  if (!auth) return false

  if (auth.verifiedDateCN === getCurrentChinaDateKey()) {
    return false
  }

  clearApiSessionReady()
  return true
}
