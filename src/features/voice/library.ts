/**
 * 配音音频库（IndexedDB）。
 *
 * 生成完成的配音音频体积可能较大，不适合塞进 localStorage；
 * 这里用 IndexedDB 保存 Blob 与展示元数据，供「图片视频生成 → 多模态参考」
 * 在另外一个路由里读取、试听和复用。
 */

import type { VoiceLibraryItem } from './types'

const DB_NAME = 'artrealm.voice.library'
const DB_VERSION = 1
const STORE_NAME = 'audios'

/** 本地最多保留多少条配音；超出后自动淘汰最旧的记录。 */
export const VOICE_LIBRARY_LIMIT = 30

let dbPromise: Promise<IDBDatabase | null> | null = null

function openLibraryDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }

    let settled = false
    const finish = (db: IDBDatabase | null) => {
      if (settled) return
      settled = true
      resolve(db)
    }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      dbPromise = null
      finish(null)
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt')
      }
    }

    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      finish(db)
    }

    request.onerror = () => {
      dbPromise = null
      finish(null)
    }

    request.onblocked = () => {
      dbPromise = null
      finish(null)
    }
  })

  return dbPromise
}

function isValidItem(value: unknown): value is VoiceLibraryItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<VoiceLibraryItem>
  return (
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    typeof item.voiceName === 'string' &&
    typeof item.createdAt === 'number' &&
    typeof item.durationMs === 'number' &&
    typeof item.format === 'string' &&
    typeof item.size === 'number' &&
    item.blob instanceof Blob
  )
}

function readAll(db: IDBDatabase): Promise<VoiceLibraryItem[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()

    request.onsuccess = () => {
      const items = (request.result as unknown[]).filter(isValidItem)
      items.sort((a, b) => b.createdAt - a.createdAt)
      resolve(items)
    }
    request.onerror = () => reject(request.error)
  })
}

/** 读取全部配音，按创建时间倒序。存储不可用时返回空数组。 */
export async function loadVoiceLibrary(): Promise<VoiceLibraryItem[]> {
  const db = await openLibraryDb()
  if (!db) return []

  try {
    return await readAll(db)
  } catch {
    return []
  }
}

/** 写入一条配音；成功返回 true。 */
export async function saveVoiceLibraryItem(item: VoiceLibraryItem): Promise<boolean> {
  const db = await openLibraryDb()
  if (!db) return false

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })

    // 超出上限时淘汰最旧的条目，避免浏览器存储无限增长。
    const items = await readAll(db)
    const overflow = items.slice(VOICE_LIBRARY_LIMIT)
    if (overflow.length) {
      await deleteVoiceLibraryItems(overflow.map((entry) => entry.id))
    }
    return true
  } catch {
    return false
  }
}

/** 删除指定配音。 */
export async function deleteVoiceLibraryItems(ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await openLibraryDb()
  if (!db) return

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    ids.forEach((id) => store.delete(id))
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
}

/** 清空配音音频库。 */
export async function clearVoiceLibrary(): Promise<void> {
  const db = await openLibraryDb()
  if (!db) return

  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
}
