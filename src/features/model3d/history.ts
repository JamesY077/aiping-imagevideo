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
  /** 用户自定义的项目名称；为空时回落到描述 / 模型名。 */
  name?: string
  createdAt: number
  status: TaskStatus | 'RUNNING'
}

const STORAGE_KEY = 'artrealm.model3d.history.v2'
const LEGACY_STORAGE_KEY = 'artrealm.model3d.history.v1'
const MAX_ENTRIES = 12

// 清掉内测阶段遗留的调试任务（历史只存 task ID 与展示信息，不影响其他数据）。
try {
  localStorage.removeItem(LEGACY_STORAGE_KEY)
} catch {
  // 隐私模式下 localStorage 不可写，忽略
}

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

/** 重命名项目：只改本地展示名，不影响上游任务。传空字符串则回落为自动命名。 */
export function renameHistoryEntry(taskId: string, name: string): Model3DHistoryEntry[] {
  const trimmed = name.trim().slice(0, 40)
  const next = loadHistory().map((item) => (item.taskId === taskId ? { ...item, name: trimmed } : item))
  persist(next)
  return next
}

/** 历史项的统一展示名：自定义名称优先，其次描述，最后是任务短 ID。 */
export function historyDisplayName(entry: Model3DHistoryEntry | null | undefined): string {
  if (!entry) return ''
  const custom = entry.name?.trim()
  if (custom) return custom
  const prompt = entry.prompt.trim()
  if (prompt) return prompt.length > 28 ? `${prompt.slice(0, 28)}…` : prompt
  return `任务 ${entry.taskId.slice(0, 8)}`
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
