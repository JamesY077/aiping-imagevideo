export function formatCost(cost: number): string {
  return `¥${cost.toFixed(4)}`
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
