import http from 'node:http'
import https from 'node:https'
import { createServer as createViteServer } from 'vite'

/**
 * 本地透明代理：把 http://127.0.0.1:<port>/api/v1/* 转发到 https://aiping.cn/api/v1/*。
 * 目的：项目里的 normalizeApiBaseUrl 会把 aiping.cn 归一化成相对路径 /api/v1，
 * Node 环境无法直接发相对请求，因此用本地代理承接，同时保持对真实上游的直连。
 */
export function startProxy(port = 5271) {
  const server = http.createServer((req, res) => {
    const upstream = https.request(
      {
        hostname: 'aiping.cn',
        port: 443,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: 'aiping.cn' },
      },
      (up) => {
        res.writeHead(up.statusCode || 502, up.headers)
        up.pipe(res)
      },
    )
    upstream.on('error', (error) => {
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: error.message }))
    })
    req.pipe(upstream)
  })

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

function makeStorage(seed = {}) {
  const map = new Map(Object.entries(seed))
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    clear: () => map.clear(),
  }
}

export async function startEnv({ apiKey, proxyPort = 5271 }) {
  if (!apiKey) throw new Error('缺少 AIPING_API_KEY')

  const proxy = await startProxy(proxyPort)
  const auth = {
    apiKey,
    apiBaseUrl: `http://127.0.0.1:${proxyPort}/api/v1`,
    sessionId: 'matrix-test',
    verifiedAtEpochMs: Date.now(),
    verifiedDateCN: '2026-10-30',
  }
  const storage = makeStorage({ aiping_api_auth_session: JSON.stringify(auth) })
  globalThis.sessionStorage = storage
  globalThis.localStorage = makeStorage()
  globalThis.window = { location: { href: '' } }

  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })

  const api = await vite.ssrLoadModule('/src/api/aiping.ts')
  const bp = await vite.ssrLoadModule('/src/features/generate/buildParams.ts')
  const vid = await vite.ssrLoadModule('/src/features/generate/video.ts')
  const model = await vite.ssrLoadModule('/src/types/model.ts')
  const models = await vite.ssrLoadModule('/src/models/index.ts')
  const layout = await vite.ssrLoadModule('/src/features/layout/mossLayout.ts')
  const planner = await vite.ssrLoadModule('/src/features/layout/planner.ts')

  return {
    api,
    bp,
    vid,
    model,
    models,
    layout,
    planner,
    async close() {
      await vite.close()
      await new Promise((resolve) => proxy.close(resolve))
    },
  }
}

/** 从 axios / AppError 里尽量提取可读的失败原因。 */
export function describeError(error) {
  if (!error) return { message: 'unknown error' }
  const data = error.response?.data
  return {
    name: error.name,
    message: error.message || String(error),
    status: error.response?.status,
    code: error.code,
    upstream: data ?? undefined,
    upstreamText: typeof data === 'string' ? data : JSON.stringify(data ?? null).slice(0, 2000),
  }
}
