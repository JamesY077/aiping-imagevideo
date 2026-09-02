import 'dotenv/config'
import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import COS from 'cos-nodejs-sdk-v5'

/**
 * 图片上传代理服务
 * ------------------------------------------------------------------
 * 作用：前端把本地图片（base64）POST 到本服务，本服务用腾讯云 COS 密钥
 *       上传，返回一个公网 HTTPS URL（abc.nextmak.cn/...）。
 *       这个 URL 交给火山 Seedance 2.0 的 CreateAsset 接口即可正常抓取。
 *
 * 为什么需要它：COS 的 SecretId/SecretKey 绝不能放到纯前端里（会被所有用户
 *       看到并盗用）。所以密钥只保存在本服务的 .env 中，由服务端代理上传。
 * ------------------------------------------------------------------
 */

const {
  PORT = '3100',
  // 腾讯云 COS 配置
  COS_SECRET_ID,
  COS_SECRET_KEY,
  COS_BUCKET,          // 形如 artrealm-image-1314455608
  COS_REGION,          // 形如 ap-beijing
  // 对外访问用的公网域名（COS 自定义域名 CDN），末尾不带 /
  PUBLIC_BASE_URL = 'https://abc.nextmak.cn',
  // COS 内的存储目录前缀
  COS_PREFIX = 'seedance-uploads',
  // 简单鉴权 token（前端 .env 里的 VITE_UPLOAD_SERVICE_TOKEN 要与之一致；留空则不校验）
  UPLOAD_TOKEN = '',
  // 允许跨域来源，逗号分隔。
  // - 留空：仅允许本机（localhost/127.0.0.1）与局域网私有网段的来源（开发安全默认值）；
  // - '*'：显式允许所有来源（不推荐）；
  // - 具体列表：仅允许列出的来源，例如 https://artrealm.nextmak.cn
  ALLOW_ORIGINS = '',
  // 单张图片体积上限（MB）
  MAX_FILE_MB = '15',
  // 每个 IP 每分钟最多上传次数（防刷）
  UPLOAD_RATE_LIMIT_PER_MIN = '20',
  // 每个 IP 每天最多上传字节数（MB，防 COS 额度盗刷）
  UPLOAD_DAILY_QUOTA_MB = '1024',
  // 是否信任反向代理传入的 X-Forwarded-For（部署在 Nginx 后置为 1）
  TRUST_PROXY = '0',
  // 对象保留天数：启动后与每小时自动执行一次过期清理。
  // （与原生 COS 生命周期规则等价的内置兜底，适用于当前密钥无 PutBucketLifecycle 权限的场景）
  LIFECYCLE_EXPIRE_DAYS = '3',
} = process.env

if (!COS_SECRET_ID || !COS_SECRET_KEY || !COS_BUCKET || !COS_REGION) {
  console.error('[upload-service] 缺少 COS 配置，请在 .env 中填写 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION')
  process.exit(1)
}

const cos = new COS({ SecretId: COS_SECRET_ID, SecretKey: COS_SECRET_KEY })

const app = express()
app.disable('x-powered-by')
// base64 图片体积较大，放宽 JSON body 上限。
app.use(express.json({ limit: `${Number(MAX_FILE_MB) + 5}mb` }))

const allowList = ALLOW_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
/** 判断来源是否是本机或局域网私有网段（开发环境默认放行）。 */
function isPrivateOrigin(origin) {
  try {
    const hostname = new URL(origin).hostname
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
    return (
      /^192\.168\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    )
  } catch {
    return false
  }
}

function resolveCorsOrigin(origin, callback) {
  // 同源请求 / 非浏览器请求不需要 CORS 头。
  if (!origin) return callback(null, false)
  if (allowList.includes('*')) return callback(null, true)
  if (allowList.includes(origin)) return callback(null, true)
  // 未显式配置时采用安全默认值：仅放行本机与局域网来源。
  if (allowList.length === 0 && isPrivateOrigin(origin)) return callback(null, true)
  return callback(null, false)
}

app.use(
  cors({
    origin: resolveCorsOrigin,
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
)

// —— 上传限流（每个 IP 每分钟次数）——
const rateLimitMap = new Map() // ip -> { windowStartMs, count }
const quotaMap = new Map() // ip -> { dayKey, bytes }
const rateLimitPerMin = Math.max(1, Number(UPLOAD_RATE_LIMIT_PER_MIN) || 20)
const dailyQuotaBytes = Math.max(1, Number(UPLOAD_DAILY_QUOTA_MB) || 1024) * 1024 * 1024

function clientIp(req) {
  if (TRUST_PROXY === '1') {
    const forwarded = req.headers['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim()
  }
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

function uploadRateLimit(req, res, next) {
  const ip = clientIp(req)
  const now = Date.now()
  const windowMs = 60 * 1000
  const entry = rateLimitMap.get(ip)
  if (!entry || now - entry.windowStartMs >= windowMs) {
    rateLimitMap.set(ip, { windowStartMs: now, count: 1 })
    return next()
  }
  entry.count += 1
  if (entry.count > rateLimitPerMin) {
    console.warn(`[upload-service] rate limited ip=${ip}`)
    return res.status(429).json({ error: `上传过于频繁，请稍后再试（每分钟最多 ${rateLimitPerMin} 次）。` })
  }
  next()
}

// 定期清理过期的限流/配额记录，避免 Map 无限增长。
setInterval(() => {
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStartMs >= 5 * 60 * 1000) rateLimitMap.delete(ip)
  }
  for (const [ip, entry] of quotaMap) {
    if (entry.dayKey !== today) quotaMap.delete(ip)
  }
}, 60 * 1000).unref()

// —— 过期对象自动清理（内置生命周期兜底）——
// 依赖对象 key 中携带的上传时间戳判断年龄；每页 1000 个，不足部分下一轮继续。
const uploadRetentionDays = Math.max(1, Math.floor(Number(LIFECYCLE_EXPIRE_DAYS) || 3))
let cleanupRunning = false

function isExpiredObjectKey(key) {
  const base = String(key).split('/').pop() || ''
  const uploadedAtMs = Number(base.split('-')[0])
  return Number.isFinite(uploadedAtMs) && uploadedAtMs < Date.now() - uploadRetentionDays * 24 * 60 * 60 * 1000
}

function cleanupExpiredObjects() {
  if (cleanupRunning) return
  cleanupRunning = true
  const finish = () => {
    cleanupRunning = false
  }

  cos.getBucket(
    { Bucket: COS_BUCKET, Region: COS_REGION, Prefix: `${COS_PREFIX.trim()}/`, MaxKeys: 1000 },
    (listErr, data) => {
      if (listErr) {
        console.warn(`[upload-service] 清理任务列表失败：${listErr?.message || listErr}`)
        return finish()
      }
      const expired = (data.Contents || []).filter((obj) => isExpiredObjectKey(obj.Key))
      if (!expired.length) {
        console.log(`[upload-service] 清理检查完成：没有超过 ${uploadRetentionDays} 天的对象。`)
        return finish()
      }
      cos.deleteMultipleObject(
        { Bucket: COS_BUCKET, Region: COS_REGION, Objects: expired.map((obj) => ({ Key: obj.Key })) },
        (deleteErr) => {
          if (deleteErr) {
            console.warn(`[upload-service] 清理删除失败：${deleteErr?.message || deleteErr}`)
            return finish()
          }
          console.log(`[upload-service] 已清理 ${expired.length} 个超过 ${uploadRetentionDays} 天的对象。`)
          finish()
        },
      )
    },
  )
}

const cleanupStartDelayMs = 15 * 1000
const cleanupIntervalMs = 60 * 60 * 1000
setTimeout(() => cleanupExpiredObjects(), cleanupStartDelayMs).unref()
setInterval(() => cleanupExpiredObjects(), cleanupIntervalMs).unref()

/** 解析 dataURI，返回 { buffer, mime, ext }；非法则抛错。 */
function parseDataUri(dataUri) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUri || '')
  if (!match) throw new Error('image 字段必须是 data:<mime>;base64,<data> 形式的 dataURI')
  const mime = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  const extMap = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
  }
  const ext = extMap[mime] || 'png'
  return { buffer, mime, ext }
}

/** 健康检查 */
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'aiping-upload-service', time: Date.now() })
})

/**
 * POST /upload
 * body: { image: "data:image/png;base64,...." }
 * headers: Authorization: Bearer <UPLOAD_TOKEN>  （若配置了 UPLOAD_TOKEN）
 * resp: { url: "https://abc.nextmak.cn/seedance-uploads/xxxx.png" }
 */
app.post('/upload', uploadRateLimit, async (req, res) => {
  try {
    // 鉴权（可选）
    if (UPLOAD_TOKEN) {
      const auth = req.headers.authorization || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      const expected = Buffer.from(UPLOAD_TOKEN)
      const provided = Buffer.from(token)
      const tokenInvalid = expected.length !== provided.length || !crypto.timingSafeEqual(provided, expected)
      if (tokenInvalid) {
        console.warn(`[upload-service] unauthorized upload from ip=${clientIp(req)}`)
        return res.status(401).json({ error: '上传服务鉴权失败：token 无效' })
      }
    }

    const { image } = req.body || {}
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: '缺少 image 字段（base64 dataURI）' })
    }

    const { buffer, mime, ext } = parseDataUri(image)

    const ip = clientIp(req)
    const dayKey = new Date().toISOString().slice(0, 10)
    const quota = quotaMap.get(ip)
    const usedToday = quota && quota.dayKey === dayKey ? quota.bytes : 0
    if (usedToday + buffer.length > dailyQuotaBytes) {
      console.warn(`[upload-service] daily quota exceeded ip=${ip}`)
      return res.status(429).json({ error: `今日上传配额已用完，请明天再试（每天最多 ${UPLOAD_DAILY_QUOTA_MB}MB）。` })
    }

    const maxBytes = Number(MAX_FILE_MB) * 1024 * 1024
    if (buffer.length > maxBytes) {
      return res.status(413).json({ error: `图片过大，超过 ${MAX_FILE_MB}MB 限制` })
    }

    // 128 位随机 key，公开读场景下不可枚举。
    const key = `${COS_PREFIX}/${Date.now()}-${crypto.randomBytes(16).toString('hex')}.${ext}`

    await new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket: COS_BUCKET,
          Region: COS_REGION,
          Key: key,
          Body: buffer,
          ContentType: mime,
          ACL: 'public-read',
        },
        (err, data) => (err ? reject(err) : resolve(data)),
      )
    })

    quotaMap.set(ip, { dayKey, bytes: usedToday + buffer.length })

    const url = `${PUBLIC_BASE_URL.replace(/\/+$/, '')}/${key}`
    console.log(`[upload-service] uploaded ${buffer.length} bytes -> ${url}`)
    return res.json({ url, key })
  } catch (err) {
    console.error('[upload-service] upload failed:', err?.message || err)
    return res.status(500).json({ error: `上传失败：${err?.message || err}` })
  }
})

app.listen(Number(PORT), () => {
  console.log(`[upload-service] listening on :${PORT}`)
  console.log(`[upload-service] public base url: ${PUBLIC_BASE_URL}`)
  console.log(`[upload-service] COS bucket: ${COS_BUCKET} region: ${COS_REGION} prefix: ${COS_PREFIX}`)
  console.log(`[upload-service] auto cleanup enabled: 超过 ${uploadRetentionDays} 天的对象自动删除`)
})
