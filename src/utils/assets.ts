/**
 * 静态资源地址解析。
 *
 * 生产环境通过 VITE_CDN_ASSET_BASE 把 public/ 下的图片指向 COS/CDN，
 * 本地开发留空时仍走项目内静态资源，不依赖外网。
 */
const ASSET_BASE = (import.meta.env.VITE_CDN_ASSET_BASE as string | undefined)?.replace(/\/+$/, '')

export function assetUrl(path: string): string {
  if (!ASSET_BASE) return path
  return `${ASSET_BASE}${path.startsWith('/') ? path : `/${path}`}`
}
