export function getItem<T>(key: string, defaultValue?: T): T | null {
  try {
    const item = localStorage.getItem(key)
    if (item === null) return defaultValue ?? null
    return JSON.parse(item) as T
  } catch {
    return defaultValue ?? null
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function removeItem(key: string): void {
  localStorage.removeItem(key)
}
