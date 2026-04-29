export function isValidApiKey(key: string): boolean {
  return key.trim().length > 10
}
