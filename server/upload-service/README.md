# 参考文件上传代理服务（本地图片 / 音频 / 视频统一上传）

## 为什么需要它

火山 **Seedance 2.0** 与 **MiniMax-H3** 的参考素材接口要求公网 http/https URL，
不接受本地 base64：
- Seedance 2.0 的参考图目前可以内联 dataURI，但体积较大时建议上传换公网 URL；
- 参考音频的 `audio_url` 必须是公网可访问地址；
- 参考视频的 `reference_video` 只接受 web url（实测传 dataURI 会被拒绝）。

本服务负责：前端把本地图片、音频或视频（base64）POST 过来 → 用腾讯云 COS 密钥上传 → 返回公网 HTTPS URL。
COS 密钥只存在服务端 `.env`，不会暴露给前端用户。

> 说明：参考视频/参考音频必须使用公网 URL；其他模型在配置上传服务后也会统一走本服务，
> 从而避免多张本地原图直接 base64 上传导致请求体过大、上游返回 503。

## 目录

```
server/upload-service/
├── index.js         # 上传服务主程序（Express + COS SDK）
├── package.json
├── .env.example     # 配置模板
└── README.md
```

## 部署步骤（腾讯云服务器 49.232.99.62）

### 1. 上传代码并安装依赖

```bash
# 把 server/upload-service 目录传到服务器，例如 /opt/aiping-upload-service
cd /opt/aiping-upload-service
npm install
```

### 2. 配置 .env

```bash
cp .env.example .env
vim .env   # 填入 COS 密钥、Bucket、Region、PUBLIC_BASE_URL、UPLOAD_TOKEN
```

关键项：
- `COS_SECRET_ID` / `COS_SECRET_KEY`：腾讯云 CAM 密钥（建议子账号，仅授权该 bucket 的读写）
- `COS_BUCKET=artrealm-image-1314455608`
- `COS_REGION=ap-beijing`
- `PUBLIC_BASE_URL=https://abc.nextmak.cn`（你为 COS 配的自定义域名）
- `UPLOAD_TOKEN`：随机字符串，前端要用同一个值

### 3. 用 PM2 常驻运行

```bash
npm i -g pm2
pm2 start index.js --name aiping-upload
pm2 save
pm2 startup   # 按提示执行，开机自启
```

### 4. Nginx 反代（把 /upload 挂到 artrealm.nextmak.cn）

在 `artrealm.nextmak.cn` 的 server 块里加：

```nginx
location /upload {
    proxy_pass http://127.0.0.1:3100/upload;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    # 参考视频上限 50MB，base64 膨胀约 1/3，这里放宽到 80m
    client_max_body_size 80m;
    proxy_read_timeout 300s;
}
location = /upload/health {
    proxy_pass http://127.0.0.1:3100/health;
}
```

reload：`nginx -t && nginx -s reload`

### 5. 验证

```bash
curl https://artrealm.nextmak.cn/upload/health
# 期望: {"ok":true,...}
```

## 前端配置

在项目根目录 `.env`（或 `.env.production`）里加：

```
VITE_UPLOAD_SERVICE_URL=https://artrealm.nextmak.cn/upload
VITE_UPLOAD_SERVICE_TOKEN=与服务端 UPLOAD_TOKEN 相同的值
```

前端在调用 Seedance 2.0 / MiniMax-H3 且检测到本地 base64 参考图或参考音频时，会自动先 POST 到该地址换取公网 URL，再交给上游。

请求体约定：
- 图片：`{ "image": "data:image/png;base64,..." }`
- 音频：`{ "audio": "data:audio/wav;base64,..." }`
- 视频：`{ "video": "data:video/mp4;base64,..." }`

## 安全加固（已内置）

- **限流**：每个 IP 每分钟最多 `UPLOAD_RATE_LIMIT_PER_MIN`（默认 20）次上传。
- **配额**：每个 IP 每天最多上传 `UPLOAD_DAILY_QUOTA_MB`（默认 1024MB），超出返回 429。
- **CORS 收紧**：`ALLOW_ORIGINS` 留空时仅允许本机与局域网来源；`*` 为显式全开（不推荐）；生产环境请填写站点域名。
- **随机 key**：对象 key 含 128 位随机数，公开读时不可枚举。
- **token 建议**：`UPLOAD_TOKEN` 会打进前端产物，属公开值；请定期轮换，并依赖限流/配额兜底。更安全做法是改为 COS STS 临时密钥或服务端代签（后续可迭代）。

## 上传文件自动清理（4 种方案）

### 方案 A：COS 生命周期规则（推荐，已提供脚本）

本服务内置脚本，一键给 `seedance-uploads/` 前缀配置「上传 N 天后自动删除」：

```bash
cd server/upload-service
# 在 .env 里设置 LIFECYCLE_EXPIRE_DAYS（本项目默认 3 天，最小值 1）
npm run lifecycle
```

- 优点：托管在 COS 侧，自动执行，无需常驻任务。
- 注意：脚本会**整组覆盖**桶上的全部生命周期规则，已有规则需先到控制台合并。
- 火山/阿里抓取图片需要时间，建议 `LIFECYCLE_EXPIRE_DAYS >= 1`（本项目默认 3 天）。

### 兜底：内置自动清理（已启用，无需 CAM 生命周期权限）

当上传服务的 CAM 密钥没有 `PutBucketLifecycle` 权限（如当前环境）时，服务启动后每
小时自动扫描 `seedance-uploads/` 前缀，删除上传时间超过 `LIFECYCLE_EXPIRE_DAYS`
（默认 3 天）的对象。清理依据对象 key 中的上传时间戳，每页 1000 个。

### 方案 B：COS 控制台手动配置

存储桶 → 基础配置 → 生命周期 → 新增规则：
范围选「指定前缀」填 `seedance-uploads/`，规则选「修改后 N 天删除」填 1。

- 优点：图形化、所见即所得；改配置无需重新部署。
- 缺点：不可代码化，换环境需重新配置。

### 方案 C：服务器定时清理脚本 + cron

写一个 `cleanup.sh` 调用 COS SDK列 `/seedance-uploads` 并删除过期对象，再用 crontab 每天执行：

```cron
30 3 * * * cd /opt/aiping-upload-service && node scripts/cleanup-expired.js >> /var/log/aiping-cleanup.log 2>&1
```

- 优点：可自定义「按前缀 + 超过 N 天 + 文件大小」等复杂规则。
- 缺点：需要自维护脚本与服务器定时任务。

### 方案 D：腾讯云 SCF 云函数定时触发

在 SCF 写一个定时触发的函数，逻辑同方案 C，由平台托管调度。

- 优点：无服务器、按执行收费、不怕本地机器宕机。
- 缺点：多一套函数配置。

### 推荐组合

生产环境用 **方案 A（生命周期）+ 定期轮换 UPLOAD_TOKEN**；预算敏感或已有 SCF 体系可用方案 D。无论哪种方案，过期时间不要短于 1 天，避免上游还在抓图时对象已被删除。

## COS 侧建议

- 存储桶权限设为「公有读私有写」，或用 CDN 自定义域名 `abc.nextmak.cn` 做公开访问。
- 建议在 COS 控制台给 `seedance-uploads/` 前缀设置**生命周期规则**：例如 1 天后自动删除，实现"即用即清"、不长期占用空间。
- 火山抓取图片需要几秒到几十秒，请勿把过期时间设得过短（建议 ≥ 1 天）。
```
