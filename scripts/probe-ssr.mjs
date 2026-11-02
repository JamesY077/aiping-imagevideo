import { createServer } from 'vite'

const KEY = process.env.AIPING_API_KEY
const store = {
  apiKey: KEY,
  apiBaseUrl: 'https://aiping.cn/api/v1',
  sessionId: 'matrix-test',
  verifiedAtEpochMs: Date.now(),
  verifiedDateCN: '2026-10-30',
}
const makeStorage = () => {
  const m = new Map([['aiping_api_auth_session', JSON.stringify(store)]])
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    clear: () => m.clear(),
  }
}
globalThis.sessionStorage = makeStorage()
globalThis.localStorage = makeStorage()
globalThis.window = { location: { href: '' } }

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const api = await vite.ssrLoadModule('/src/api/aiping.ts')
  console.log('exports:', Object.keys(api).sort().join(', '))
  const cfg = await vite.ssrLoadModule('/src/api/config.ts')
  console.log('baseUrl:', cfg.getApiBaseUrl())
  console.log('keyPrefix:', (cfg.getApiKey() || '').slice(0, 6))
} finally {
  await vite.close()
}
