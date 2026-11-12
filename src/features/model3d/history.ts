/**
 * 3D 建模任务历史（本地缓存）。
 *
 * 只存任务 id 与展示信息，不缓存 OSS 预签名地址（1 小时即失效）。
 * 点击历史项时用 task_uuid 重新查询，能拿到新的下载链接。
 */

import type { TaskStatus } from '@/api/model3d'

export interface Model3DHistoryEntry {
  taskId: string
  kind: 'mesh' | 'motion'
  modelId: string
  prompt: string
  createdAt: number
  status: TaskStatus | 'RUNNING'
}

const STORAGE_KEY = 'artrealm.model3d.history.v1'
const MAX_ENTRIES = 24

export function loadHistory(): Model3DHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is Model3DHistoryEntry => Boolean(item?.taskId && item?.modelId))
  } catch {
    return []
  }
}

function persist(entries: Model3DHistoryEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    // 隐私模式下 localStorage 不可写，忽略即可
  }
}

export function addHistoryEntry(entry: Model3DHistoryEntry): Model3DHistoryEntry[] {
  const next = [entry, ...loadHistory().filter((item) => item.taskId !== entry.taskId)].slice(0, MAX_ENTRIES)
  persist(next)
  return next
}

export function updateHistoryStatus(taskId: string, status: Model3DHistoryEntry['status']): Model3DHistoryEntry[] {
  const next = loadHistory().map((item) => (item.taskId === taskId ? { ...item, status } : item))
  persist(next)
  return next
}

export function clearHistory(): Model3DHistoryEntry[] {
  persist([])
  return []
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function formatClock(timestamp: number): string {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`
}
