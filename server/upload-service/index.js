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
  // 允许跨域来源，逗号分隔；留空表示允许所有
  ALLOW_ORIGINS = '',
  // 单张图片体积上限（MB）
  MAX_FILE_MB = '15',
} = process.env

if (!COS_SECRET_ID || !COS_SECRET_KEY || !COS_BUCKET || !COS_REGION) {
  console.error('[upload-service] 缺少 COS 配置，请在 .env 中填写 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION')
  process.exit(1)
}

const cos = new COS({ SecretId: COS_SECRET_ID, SecretKey: COS_SECRET_KEY })

const app = express()
// base64 图片体积较大，放宽 JSON body 上限。
app.use(express.json({ limit: `${Number(MAX_FILE_MB) + 5}mb` }))

const allowList = ALLOW_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
app.use(
  cors({
    origin: allowList.length ? allowList : true,
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
)

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
app.post('/upload', async (req, res) => {
  try {
    // 鉴权（可选）
    if (UPLOAD_TOKEN) {
      const auth = req.headers.authorization || ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      if (token !== UPLOAD_TOKEN) {
        return res.status(401).json({ error: '上传服务鉴权失败：token 无效' })
      }
    }

    const { image } = req.body || {}
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: '缺少 image 字段（base64 dataURI）' })
    }

    const { buffer, mime, ext } = parseDataUri(image)

    const maxBytes = Number(MAX_FILE_MB) * 1024 * 1024
    if (buffer.length > maxBytes) {
      return res.status(413).json({ error: `图片过大，超过 ${MAX_FILE_MB}MB 限制` })
    }

    const key = `${COS_PREFIX}/${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${ext}`

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
})
