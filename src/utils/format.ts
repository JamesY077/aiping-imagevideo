export function formatCost(cost: number): string {
  return `¥${cost.toFixed(4)}`
}

export function normalizeCost(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

export function resolveRealCost(payload: { total_cost?: unknown; cost?: unknown; usage?: { total_cost?: unknown } } | null | undefined): number {
  if (!payload) return 0
  return normalizeCost(payload.usage?.total_cost ?? payload.total_cost ?? payload.cost)
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return key.slice(0, 6) + '...' + key.slice(-4)
}
