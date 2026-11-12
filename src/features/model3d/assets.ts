/**
 * V2Fun 产物读取工具。
 *
 * 背景：V2Fun 的产物放在 `oss-cn-1.v2fun.art`，该 OSS 桶**不返回 CORS 头**，
 * 浏览器无法直接 fetch（`<video>` 标签不受此限制，但 Three.js 读取几何体必须拿到字节）。
 *
 * 因此前端统一走同源代理：
 * - 开发环境：Vite `server.proxy` 把 `/v2fun-assets/*` 转发到 OSS；
 * - 生产环境：Nginx 增加 `location /v2fun-assets/` 反向代理（见 DEPLOYMENT.md）。
 *
 * 代理不可用时自动回退为直连（若上游将来开放 CORS 则直接可用），
 * 两者都失败时页面退化为「预览视频转台」。
 */

const PROXY_PREFIX = '/v2fun-assets'
const V2FUN_HOST_RE = /(^|\.)v2fun\.art$/i

export class AssetError extends Error {
  /** proxy-unavailable：同源代理未配置；cors：上游无 CORS；http：状态码异常；format：内容不是模型文件 */
  reason: 'proxy-unavailable' | 'cors' | 'http' | 'format' | 'network'
  constructor(message: string, reason: AssetError['reason']) {
    super(message)
    this.name = 'AssetError'
    this.reason = reason
  }
}

/** 该地址是否需要经过同源代理。 */
function needsProxy(raw: string): boolean {
  try {
    const url = new URL(raw, window.location.origin)
    return url.origin !== window.location.origin && V2FUN_HOST_RE.test(url.hostname)
  } catch {
    return false
  }
}

/** 把 OSS 预签名地址转成同源代理地址（保留完整 path + query，签名才有效）。 */
function proxyAssetUrl(raw: string): string {
  try {
    const url = new URL(raw, window.location.origin)
    return `${PROXY_PREFIX}${url.pathname}${url.search}`
  } catch {
    return raw
  }
}

function looksLikeHtml(buffer: ArrayBuffer): boolean {
  const head = new TextDecoder().decode(buffer.slice(0, 128)).trimStart().toLowerCase()
  return head.startsWith('<!doctype') || head.startsWith('<html') || head.startsWith('<?xml')
}

export function detectModelFormat(buffer: ArrayBuffer, path = ''): 'ply' | 'glb' | 'gltf' | 'unknown' {
  const bytes = new Uint8Array(buffer.slice(0, 16))
  const magic = String.fromCharCode(...bytes.slice(0, 4))
  if (magic.startsWith('ply')) return 'ply'
  if (magic === 'glTF') return 'glb'

  const head = new TextDecoder().decode(buffer.slice(0, 256)).trimStart()
  if (head.startsWith('{')) return 'gltf'

  const ext = path.split('?')[0]?.toLowerCase() || ''
  if (ext.endsWith('.ply')) return 'ply'
  if (ext.endsWith('.glb')) return 'glb'
  if (ext.endsWith('.gltf')) return 'gltf'
  return 'unknown'
}

async function readWithProgress(response: Response, onProgress?: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  const total = Number(response.headers.get('content-length') || 0)
  if (!response.body || !total || !onProgress) {
    const buffer = await response.arrayBuffer()
    onProgress?.(buffer.byteLength, buffer.byteLength)
    return buffer
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      loaded += value.byteLength
      onProgress(loaded, total)
    }
  }
  const merged = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged.buffer
}

async function fetchOnce(url: string, onProgress?: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  const response = await fetch(url, { credentials: 'omit' })
  if (!response.ok) {
    throw new AssetError(`资源下载失败（HTTP ${response.status}）`, response.status === 404 ? 'http' : 'proxy-unavailable')
  }
  const buffer = await readWithProgress(response, onProgress)
  if (looksLikeHtml(buffer)) {
    // 同源代理没配置时，Nginx/Vite 会回 index.html（200），这里必须识别出来。
    throw new AssetError('同源代理返回了网页而不是模型文件', 'proxy-unavailable')
  }
  return buffer
}

/**
 * 读取模型字节：先走同源代理，失败再尝试直连。
 */
export async function fetchAssetBytes(raw: string, onProgress?: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  const attempts: string[] = needsProxy(raw) ? [proxyAssetUrl(raw), raw] : [raw]

  let lastError: unknown = null
  for (const url of attempts) {
    try {
      const buffer = await fetchOnce(url, onProgress)
      if (detectModelFormat(buffer, raw) === 'unknown') {
        lastError = new AssetError('下载到的内容不是可识别的 3D 文件', 'format')
        continue
      }
      return buffer
    } catch (error) {
      lastError = error
    }
  }

  if (lastError instanceof AssetError) throw lastError
  throw new AssetError('模型文件读取被浏览器拦截（上游 OSS 未开放 CORS）', 'cors')
}

/** 预览视频 / 音频等媒体地址：能走同源代理就走，视频标签本身不依赖 CORS。 */
export function mediaUrl(raw: string): string {
  return needsProxy(raw) ? proxyAssetUrl(raw) : raw
}

/** 通过同源代理保存文件；失败时退化为新窗口打开。 */
export async function downloadAsset(raw: string, filename: string): Promise<'streamed' | 'blob' | 'opened' | 'failed'> {
  const url = mediaUrl(raw)

  // 1) 走同源代理：用 Range 探测一次，确认代理可用且返回的不是网页。
  if (url !== raw && (await canStream(url))) {
    saveWithAnchor(url, filename)
    return 'streamed'
  }

  // 2) 代理不可用（如生产环境未配置反代）：尝试 fetch 成 Blob 再保存。
  try {
    const response = await fetch(url, { credentials: 'omit' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    if (!blob.size) throw new Error('empty')
    saveWithAnchor(URL.createObjectURL(blob), filename)
    return 'blob'
  } catch {
    // 3) 最后兜底：交给浏览器处理（可能直接打开而不是下载）。
    const opened = window.open(raw, '_blank', 'noopener')
    return opened ? 'opened' : 'failed'
  }
}

/** 只拿 1 个字节验证链路：能拿到 206/200 且不是 HTML/JSON 才算可用。 */
async function canStream(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { headers: { Range: 'bytes=0-0' }, credentials: 'omit' })
    if (!response.ok) return false
    const type = (response.headers.get('content-type') || '').toLowerCase()
    if (type.includes('text/html') || type.includes('application/json')) return false
    // 服务端忽略 Range 时这里可能是整个文件：没有 content-range、体积又不明确或过大，
    // 就不要在这里把整包读进内存，交给后面的 Blob / 新窗口兜底。
    const length = Number(response.headers.get('content-length') || 0)
    if (!response.headers.get('content-range') && (!length || length > 8 * 1024 * 1024)) return false
    await response.arrayBuffer()
    return true
  } catch {
    return false
  }
}

function saveWithAnchor(href: string, filename: string) {
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  if (href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(href), 4000)
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
