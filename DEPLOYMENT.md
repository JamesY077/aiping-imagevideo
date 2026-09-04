# Ubuntu 服务器部署说明

本项目是 **Vite 前端静态站点 + Nginx 反向代理 API** 的架构。日常发版只涉及前端：构建 `dist/` 后推送到服务器即可。

## 一、服务器信息（以服务器 Nginx 配置为准）

| 项目 | 值 |
| --- | --- |
| 访问域名 | `https://artrealm.nextmak.cn`（80 端口 301 跳转到 443） |
| 服务器 | `49.232.99.62` |
| 登录账号 | `ubuntu@49.232.99.62`（密码登录，无密钥免密） |
| 站点根目录 | 不硬编码，由脚本从 Nginx 配置自动解析；线上现状通常为 `/data/www/aiping-aidraw` |
| 目录属主 | `www-data:www-data` |
| Nginx 站点配置 | `/etc/nginx/sites-available/aiping-aidraw`（软链到 `sites-enabled/`） |
| API 转发 | `/api/ -> https://aiping.cn`（浏览器请求 `/api/v1/*`，Nginx 转发到 `https://aiping.cn/api/v1/*`） |
| 静态资源 COS 桶 | `artrealm-image-1314455608`（`site-assets/` 前缀，公有读，生产静态图从该桶加载） |
| SSL 证书 | Let's Encrypt：`/etc/letsencrypt/live/artrealm.nextmak.cn/` |

> ⚠️ 关键点：站点根目录属主是 `www-data`，`ubuntu` 用户没有直接写权限，且 `scp` 无法使用 sudo。
> 因此正确发布方式是：**先 scp 到 ubuntu 家目录的临时目录，再用 sudo 覆盖到站点根目录**。
> 根目录路径以服务器 Nginx 实际配置为准，忘记路径时由发布脚本自动查询，切勿再往 `/var/www` 传（那是历史遗留错误路径）。

## 二、发布流程（推荐：一键脚本）

```bash
cd /Users/yjy/Desktop/aiping-创意项目/aiping-aidraw
./deploy.sh
```

`deploy.sh` 自动依次完成 5 步：

1. **本地构建**：运行 `npm run build`，产出新 `dist/`。
2. **上传临时目录**：清空并重建服务器家目录下 `aidraw-dist/`，`scp dist/*` 上传过去（提示输入登录密码）。
3. **自动查目录**：在服务器上从 Nginx 配置解析 `artrealm.nextmak.cn` 的真实站点根目录并显示出来（如 `/data/www/aiping-aidraw`）。
4. **确认后覆盖**：提示 `确认覆盖 ... 并重载 Nginx？(y/N)`，输入 `y` 后执行 `sudo` 删除旧文件、拷入新文件、`chown`、`nginx -t`、`reload nginx`（提示输入 sudo 密码）。
5. **指纹校验**：对比线上与本地 `index.html` 引用的 JS 文件名，一致则输出 ✅ 部署完成。

运行中需要输入的只有三样：服务器登录密码（ssh/scp，可能多次）、第 4 步的 `y`、sudo 密码。

完成后浏览器打开 `https://artrealm.nextmak.cn`，若仍是旧版按 `Cmd + Shift + R` 强制刷新。

> 注意：`deploy.sh` 只发布 `dist/`，不处理 `public/` 下的静态图；新增或替换静态图时还需按「五、生产环境说明 → 静态资源发布」同步到 COS。

## 三、手动分步命令（不用脚本时）

### 1）本地构建

```bash
npm install   # 首次或依赖变更时
npm run build
```

构建产物在 `dist/`。

### 2）上传到服务器临时目录（ubuntu 有写权限）

```bash
ssh ubuntu@49.232.99.62 "rm -rf ~/aidraw-dist && mkdir -p ~/aidraw-dist"
scp -r dist/* ubuntu@49.232.99.62:~/aidraw-dist/
```

### 3）从 Nginx 配置中查询真实站点根目录（不必死记路径）

```bash
ssh -t ubuntu@49.232.99.62 "dirs=\$(grep -rlE 'artrealm.nextmak.cn' /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null | sort -u); \
  if [ -n \"\$dirs\" ]; then grep -hE '^[[:space:]]*root[[:space:]]+[^;]+;' \$dirs; else sudo nginx -T 2>/dev/null; fi \
  | sed -E 's/^[[:space:]]*root[[:space:]]+//; s/;[[:space:]]*\$//; s/[[:space:]]+\$//' | sort -u"
```

> 输出即站点根目录（线上现状通常为 `/data/www/aiping-aidraw`）。若配置不可读，命令会自动回退到 `sudo nginx -T` 并提示输入 sudo 密码。

### 4）用 sudo 覆盖到查到的站点根目录并重载 Nginx

```bash
WEB_ROOT="/data/www/aiping-aidraw"   # 换成第 3 步查到的路径
ssh -t ubuntu@49.232.99.62 "sudo rm -rf \"\$WEB_ROOT\"/* \
  && sudo cp -r ~/aidraw-dist/* \"\$WEB_ROOT\"/ \
  && sudo chown -R www-data:www-data \"\$WEB_ROOT\" \
  && sudo nginx -t && sudo systemctl reload nginx"
```

> `ssh -t` 用于分配伪终端，方便交互输入 sudo 密码。

### 5）验证新版本是否真正上线

对比线上 `index.html` 引用的带哈希 JS 文件名与本地 `dist` 是否一致，一致即为新版本已上线：

```bash
curl -s https://artrealm.nextmak.cn | grep -oE 'assets/[A-Za-z0-9._-]+\.js'
grep -oE 'assets/[A-Za-z0-9._-]+\.js' dist/index.html
```

浏览器访问后如仍是旧版，请强制刷新（Cmd/Ctrl + Shift + R）清除本地缓存。

## 四、Nginx 配置参考（线上现状）

站点配置文件：`/etc/nginx/sites-available/aiping-aidraw`

```nginx
server {
    listen 443 ssl;
    server_name artrealm.nextmak.cn;

    root /data/www/aiping-aidraw;
    index index.html;

    # 前端会把参考图/参考视频转成 base64 放进请求体，单次请求可能达到几十 MB。
    # Nginx 默认 client_max_body_size 仅 1MB，超过会直接返回 413，因此必须调大。
    client_max_body_size 100m;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # —— 以下 /upload 反代为可选：仅当启用 server/upload-service（Seedance 2.0 本地上传图）时才需要。
    # 没有这段反代时，POST /upload 会落到上面的 location /，被 try_files 转成静态文件并返回 405。
    location /upload {
        proxy_pass http://127.0.0.1:3100/upload;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 25m;
        proxy_read_timeout 60s;
    }

    location = /upload/health {
        proxy_pass http://127.0.0.1:3100/health;
        proxy_set_header Host $host;
    }

    location /api/ {
        proxy_pass https://aiping.cn;
        proxy_ssl_server_name on;
        proxy_set_header Host aiping.cn;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 大请求体 + 视频生成属于长耗时接口，放宽请求体上限与超时时间。
        client_max_body_size 100m;
        proxy_request_buffering off;
        proxy_connect_timeout 120s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    ssl_certificate /etc/letsencrypt/live/artrealm.nextmak.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/artrealm.nextmak.cn/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    server_name artrealm.nextmak.cn;
    return 301 https://$host$request_uri;
}
```

修改配置后：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

#### 可选优化：给带哈希的静态资源加长缓存

`dist/assets/*` 文件名带内容哈希，可安全长缓存，减轻回源压力：

```nginx
location /assets/ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}
```

非必需，不影响功能；加上后 reload Nginx 即可生效。

## 五、生产环境说明

项目生产环境（`.env.production`）默认读取：

```env
VITE_API_BASE_URL=/api/v1
# 默认留空：不启用图片上传服务
VITE_UPLOAD_SERVICE_URL=
VITE_UPLOAD_SERVICE_TOKEN=
# 静态图片走 COS 公有读直连
VITE_CDN_ASSET_BASE=https://artrealm-image-1314455608.cos.ap-beijing.myqcloud.com/site-assets
```

也就是：

- 浏览器请求 `/api/v1/*`
- 由 Nginx 转发到 `https://aiping.cn/api/v1/*`
- 静态图片（logo、背景图、模板封面、Skill 封面等）通过 `VITE_CDN_ASSET_BASE` 指向 COS
  公有读地址，不占用 Nginx 站点带宽
- 本地上传的图片**不经过 `/upload`**：MiniMax-H3 等支持 base64 的模型由前端压缩后以
  dataURI 直传，线上无需改 Nginx，也不会触发 405
- Seedance 2.0 的本地上传图必须公网 URL，未配置上传服务时会给出明确提示；
  如需启用，见第七节（并给 Nginx 加 `/upload` 反代）

> 关键点：线上 405 的根因是旧版前端把本地图 POST 到 `/upload`，而 Nginx 没有该反代。
> 本版生产配置直接不请求 `/upload`，因此**重新发布前端即可修复，不需要改服务器配置**。

### 静态资源发布（`public/` → COS）

- 前端 `public/` 下的图片生产环境一律走 `VITE_CDN_ASSET_BASE`；本地开发留空时走本地 `public/`，不依赖外网。
- 新增或替换静态图时，需把同名文件上传到 COS `artrealm-image-1314455608` 桶的 `site-assets/` 前缀，再发布前端；否则生产环境图片 404（本地开发正常）。
- 上传方式：COS 控制台、COSBrowser，或用 coscmd CLI：

  ```bash
  # 安装与配置（一次性）
  pip install coscmd
  coscmd config -a <SecretId> -s <SecretKey> -b artrealm-image-1314455608 -r ap-beijing

  # 单个文件 / 整个目录同步（保持 public/ 的相对路径）
  coscmd upload public/logo1.webp site-assets/logo1.webp
  coscmd upload -r --skipmd5 public/ site-assets/
  ```

- 两张背景图地址硬编码在代码里：`src/views/LandingPage.vue`（`home-collage-bg.webp`）与
  `src/views/ApiKeySetup.vue`（`login-collage-bg.webp`）。更换 COS 桶或启用 CDN 加速域名时，
  除改 `VITE_CDN_ASSET_BASE` 外还需同步修改这两处代码。
- CDN 加速域名生效后，把 `VITE_CDN_ASSET_BASE` 换成 `https://cdn.artrealm.nextmak.cn/site-assets`，重新构建发布即可。

## 六、常见问题

- **改完代码域名没变化**：多半是传错目录（历史上传到过 `/var/www/aiping-aidraw`，域名用的是 `/data/www/aiping-aidraw`），或浏览器缓存。用第 5 步指纹校验确认，并强制刷新。
- **scp 报 Permission denied**：不要直接往站点根目录 scp，须走「临时目录 + sudo 覆盖」流程。
- **reload 后仍旧版**：确认 `sudo nginx -t` 通过、`sudo systemctl reload nginx` 执行成功，并强制刷新浏览器。
- **上传参考图/视频后报 `413 (Request Entity Too Large)`**：这是 Nginx 请求体大小限制导致的，**不是前端代码问题**。前端会把参考图/参考视频转成 base64 塞进请求体，超过 Nginx 默认 1MB 上限就会 413，请求到不了上游 `aiping.cn`。修复：在 `server` 块与 `location /api/` 块加上 `client_max_body_size 100m;`（见第四节的配置示例），然后执行：

  ```bash
  ssh -t ubuntu@49.232.99.62 "sudo nginx -t && sudo systemctl reload nginx"
  ```
- **本地上传图片时控制台报 `405 (Not Allowed)`**：只有旧版前端（或重新启用了上传服务）才会请求 `https://artrealm.nextmak.cn/upload`。当前生产配置（`.env.production` 的 `VITE_UPLOAD_SERVICE_URL` 留空）不请求该地址，重新执行 `./deploy.sh` 发布即可修复，无需改 Nginx。若以后启用上传服务，才需要第四节的 `location /upload` 反代 + 第七节的服务，快速验证：

  ```bash
  # 405 表示还没配好反代；返回 200 JSON 表示反代通了；返回 502 表示反代通了但 3100 服务没起
  curl -s -i https://artrealm.nextmak.cn/upload/health
  ```

- **本地正常、线上图片 404 / 裂图**：静态图走 COS。确认对应文件已上传到 `site-assets/` 前缀、文件名一致，且 `.env.production` 的 `VITE_CDN_ASSET_BASE` 指向正确桶；本地正常而线上裂图，大概率是 COS 上没有同步新图。
- **更换 COS 桶或启用 CDN 域名后，首页/登录页背景图仍是旧地址**：这两张背景图在代码中硬编码（`src/views/LandingPage.vue`、`src/views/ApiKeySetup.vue`），需要改代码后重新发布，只改环境变量不会生效。

## 七、图片上传服务（可选，仅 Seedance 2.0 本地上传图需要）

`server/upload-service` 是一个 Express 服务：接收前端 POST 的 base64 图片，用腾讯云 COS
密钥上传并返回公网 HTTPS URL（Seedance 2.0 只接受公网 URL）。密钥只保存在服务端 `.env`。

### 1）部署到服务器

```bash
# 本地把服务目录传到服务器家目录（排除 node_modules）
rsync -av --exclude node_modules server/upload-service/ ubuntu@49.232.99.62:~/upload-service/

# 服务器上安装依赖并启动（PM2 常驻）
ssh -t ubuntu@49.232.99.62 "
  cd ~/upload-service &&
  npm install &&
  sudo npm i -g pm2 2>/dev/null || npm i -g pm2 &&
  pm2 start index.js --name aiping-upload &&
  pm2 save &&
  pm2 startup | tail -n 1
"
```

### 2）服务端 `.env` 必改项

`~/upload-service/.env`（或复制 `.env.example` 后填写）：

```env
PORT=3100
COS_SECRET_ID=...
COS_SECRET_KEY=...
COS_BUCKET=artrealm-image-1314455608
COS_REGION=ap-beijing
PUBLIC_BASE_URL=https://artrealm-image-1314455608.cos.ap-beijing.myqcloud.com
COS_PREFIX=seedance-uploads
UPLOAD_TOKEN=换成一串随机字符串（与前端 VITE_UPLOAD_SERVICE_TOKEN 保持一致）
# 部署在 Nginx 后必须置 1，否则所有用户的限流都会算成 127.0.0.1 一个 IP
TRUST_PROXY=1
```

### 3）验证

```bash
curl -s https://artrealm.nextmak.cn/upload/health
# 期望：{"ok":true,"service":"aiping-upload-service",...}
```
