/**
 * 给 COS 桶配置生命周期规则：自动删除 COS_PREFIX 下超过 N 天的对象。
 * ------------------------------------------------------------------
 * 用法：
 *   cd server/upload-service && npm run lifecycle
 * 参数（来自 .env）：
 *   COS_PREFIX           对象前缀，默认 seedance-uploads
 *   LIFECYCLE_EXPIRE_DAYS 过期天数，默认 1（最小 1）
 *
 * 注意：putBucketLifecycle 会整组覆盖桶上的全部生命周期规则。
 * 如果桶里已有其他规则，请先到 COS 控制台合并后再执行本脚本。
 * ------------------------------------------------------------------
 */
import 'dotenv/config'
import COS from 'cos-nodejs-sdk-v5'

const {
  COS_SECRET_ID,
  COS_SECRET_KEY,
  COS_BUCKET,
  COS_REGION,
  COS_PREFIX = 'seedance-uploads',
  LIFECYCLE_EXPIRE_DAYS = '1',
} = process.env

if (!COS_SECRET_ID || !COS_SECRET_KEY || !COS_BUCKET || !COS_REGION) {
  console.error('[lifecycle] 缺少 COS 配置，请在 .env 中填写 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION')
  process.exit(1)
}

const prefix = `${COS_PREFIX.replace(/^\/+|\/+$/g, '')}/`
const expireDays = Math.max(1, Math.floor(Number(LIFECYCLE_EXPIRE_DAYS) || 1))
const rule = {
  ID: `auto-expire-${prefix.slice(0, -1).replace(/[/._-]/g, '-')}`,
  Filter: { Prefix: prefix },
  Status: 'Enabled',
  Expiration: { Days: expireDays },
}

const cos = new COS({ SecretId: COS_SECRET_ID, SecretKey: COS_SECRET_KEY })

cos.putBucketLifecycle(
  {
    Bucket: COS_BUCKET,
    Region: COS_REGION,
    Rules: [rule],
  },
  (err, data) => {
    if (err) {
      console.error(`[lifecycle] 配置失败：${err.message || err}`)
      console.error('[lifecycle] 若提示无权限，请在 CAM 给该密钥附加 PutBucketLifecycle 权限。')
      process.exit(1)
    }
    console.log(`[lifecycle] 成功：${prefix} 下的对象将在上传 ${expireDays} 天后自动删除。`)
    console.log('[lifecycle] 响应：', JSON.stringify(data))
  },
)
