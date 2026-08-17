# 图片上传代理服务（Seedance 2.0 参考图专用）

## 为什么需要它

火山 **Seedance 2.0** 系列生成视频时，参考图必须先经过火山 `CreateAsset` 接口换成 `asset://{id}`。
而 `CreateAsset` **只接受公网 http/https 图片 URL，不接受本地 base64**（会报
`InvalidParameter.URL: URL must be a valid HTTP or HTTPS URL`）。

本服务负责：前端把本地图片（base64）POST 过来 → 用腾讯云 COS 密钥上传 → 返回公网 HTTPS URL。
COS 密钥只存在服务端 `.env`，不会暴露给前端用户。

> 注意：其他模型（Kling / Vidu / Minimax / Seedream 等）直接吃 base64，不需要本服务。只有 Seedance 2.0 需要。

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
    client_max_body_size 20m;   # 允许较大图片
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

前端在调用 Seedance 2.0 且检测到本地 base64 参考图时，会自动先 POST 到该地址换取公网 URL，再交给火山。

## COS 侧建议

- 存储桶权限设为「公有读私有写」，或用 CDN 自定义域名 `abc.nextmak.cn` 做公开访问。
- 建议在 COS 控制台给 `seedance-uploads/` 前缀设置**生命周期规则**：例如 1 天后自动删除，实现"即用即清"、不长期占用空间。
- 火山抓取图片需要几秒到几十秒，请勿把过期时间设得过短（建议 ≥ 1 天）。
```
