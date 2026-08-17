# Ubuntu 服务器部署说明

本项目是 **Vite 前端静态站点 + Nginx 反向代理 API** 的架构，部署在 Ubuntu 服务器 `49.232.99.62` 上。

## 一、当前线上真实环境（以服务器 Nginx 配置为准）

| 项目 | 值 |
| --- | --- |
| 访问域名 | `https://artrealm.nextmak.cn`（80 端口 301 跳转到 443） |
| 站点根目录 | `/data/www/aiping-aidraw`（**不是** `/var/www`） |
| 目录属主 | `www-data:www-data` |
| Nginx 站点配置 | `/etc/nginx/sites-available/aiping-aidraw`（软链到 `sites-enabled/`） |
| 登录账号 | `ubuntu@49.232.99.62`（密码登录） |
| API 转发 | `/api/ -> https://aiping.cn`（浏览器请求 `/api/v1/*`，Nginx 转发到 `https://aiping.cn/api/v1/*`） |
| SSL 证书 | Let's Encrypt：`/etc/letsencrypt/live/artrealm.nextmak.cn/` |

> ⚠️ 关键点：站点根目录 `/data/www/aiping-aidraw` 属主是 `www-data`，`ubuntu` 用户没有直接写权限，且 `scp` 无法使用 sudo。
> 因此正确发布方式是：**先 scp 到 ubuntu 家目录的临时目录，再用 sudo 覆盖到站点根目录**。直接 `scp dist/* .../aiping-aidraw/` 会报 Permission denied，切勿再往 `/var/www` 传（那是历史遗留错误路径，不会被域名使用）。

---

## 二、本地构建

```bash
npm install   # 首次或依赖变更时
npm run build
```

构建产物在 `dist/`。

---

## 三、发布到服务器（当前正确流程）

### 1）本地构建

```bash
npm run build
```

### 2）上传到服务器临时目录（ubuntu 有写权限）

```bash
ssh ubuntu@49.232.99.62 "rm -rf ~/aidraw-dist && mkdir -p ~/aidraw-dist"
scp -r dist/* ubuntu@49.232.99.62:~/aidraw-dist/
```

### 3）用 sudo 覆盖到站点根目录并重载 Nginx

```bash
ssh -t ubuntu@49.232.99.62 "sudo rm -rf /data/www/aiping-aidraw/* \
  && sudo cp -r ~/aidraw-dist/* /data/www/aiping-aidraw/ \
  && sudo chown -R www-data:www-data /data/www/aiping-aidraw \
  && sudo nginx -t && sudo systemctl reload nginx"
```

> `ssh -t` 用于分配伪终端，方便交互输入 sudo 密码。

### 4）验证新版本是否真正上线

对比线上 `index.html` 引用的带哈希 JS 文件名与本地 `dist` 是否一致，一致即为新版本已上线：

```bash
curl -s https://artrealm.nextmak.cn | grep -oE 'assets/[A-Za-z0-9._-]+\.js'
grep -oE 'assets/[A-Za-z0-9._-]+\.js' dist/index.html
```

浏览器访问后如仍是旧版，请强制刷新（Cmd/Ctrl + Shift + R）清除本地缓存。

---

## 四、一键发布脚本（可选）

可将以上步骤保存为本地脚本 `deploy.sh`：

```bash
#!/usr/bin/env bash
set -e

SERVER="ubuntu@49.232.99.62"
WEB_ROOT="/data/www/aiping-aidraw"

echo "==> 构建"
npm run build

echo "==> 上传到临时目录"
ssh "$SERVER" "rm -rf ~/aidraw-dist && mkdir -p ~/aidraw-dist"
scp -r dist/* "$SERVER":~/aidraw-dist/

echo "==> sudo 覆盖并重载 Nginx"
ssh -t "$SERVER" "sudo rm -rf $WEB_ROOT/* \
  && sudo cp -r ~/aidraw-dist/* $WEB_ROOT/ \
  && sudo chown -R www-data:www-data $WEB_ROOT \
  && sudo nginx -t && sudo systemctl reload nginx"

echo "==> 验证线上资源指纹"
curl -s https://artrealm.nextmak.cn | grep -oE 'assets/[A-Za-z0-9._-]+\.js'
echo "==> 本地资源指纹"
grep -oE 'assets/[A-Za-z0-9._-]+\.js' dist/index.html

echo "✅ 部署完成：https://artrealm.nextmak.cn"
```

运行：

```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 五、Nginx 配置参考（线上现状）

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

---

## 六、访问方式

浏览器打开：

```text
https://artrealm.nextmak.cn
```

---

## 七、生产环境说明

项目生产环境（`.env.production`）默认读取：

```env
VITE_API_BASE_URL=/api/v1
```

也就是：
- 浏览器请求 `/api/v1/*`
- 由 Nginx 转发到 `https://aiping.cn/api/v1/*`

---

## 八、常见问题

- **改完代码域名没变化**：多半是传错目录（历史上传到过 `/var/www/aiping-aidraw`，域名用的是 `/data/www/aiping-aidraw`），或浏览器缓存。请确认按第三节流程传到 `/data/www/aiping-aidraw` 并用第 4 步指纹校验。
- **scp 报 Permission denied**：不要直接往 `/data/www/aiping-aidraw` scp，须走"临时目录 + sudo 覆盖"流程。
- **reload 后仍旧版**：确认 `sudo nginx -t` 通过、`sudo systemctl reload nginx` 执行成功，并强制刷新浏览器。
- **上传参考图/视频后报 `413 (Request Entity Too Large)`**：这是 Nginx 请求体大小限制导致的，**不是前端代码问题**。前端会把参考图/参考视频转成 base64 塞进请求体，一张高清图 base64 后常有几 MB，多图或视频更大，而 Nginx 默认 `client_max_body_size` 仅 1MB，超过就直接返回 413，请求根本到不了上游 `aiping.cn`。

  修复方法：编辑 `/etc/nginx/sites-available/aiping-aidraw`，在 `server` 块与 `location /api/` 块中加上 `client_max_body_size 100m;`（见第五节的配置示例），然后执行：

  ```bash
  ssh -t ubuntu@49.232.99.62 "sudo nginx -t && sudo systemctl reload nginx"
  ```

  一条命令直接改并重载（用 sed 在 http/server 层临时验证前，建议手动编辑更稳妥）：

  ```bash
  ssh -t ubuntu@49.232.99.62 "sudo sed -i '/index index.html;/a\\    client_max_body_size 100m;' /etc/nginx/sites-available/aiping-aidraw \
    && sudo nginx -t && sudo systemctl reload nginx"
  ```

---

## 九、后续建议

1. 增加自动化发布（如上面的 `deploy.sh` 或 CI）。
2. 配置 SSH 免密登录（密钥），避免每步输入密码。
3. 把 API 转发地址改为自有后端网关。
4. 配置 Nginx gzip / 静态资源缓存策略，优化加载。
