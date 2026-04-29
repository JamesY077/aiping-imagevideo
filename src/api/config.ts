export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export function getApiKey(): string | null {
  return localStorage.getItem('aiping_api_key')
}

export function saveApiKey(apiKey: string): void {
  localStorage.setItem('aiping_api_key', apiKey)
}

export function clearApiKey(): void {
  localStorage.removeItem('aiping_api_key')
}
