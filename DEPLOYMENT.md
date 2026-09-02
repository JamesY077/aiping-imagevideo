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

## 五、生产环境说明

项目生产环境（`.env.production`）默认读取：

```env
VITE_API_BASE_URL=/api/v1
```

也就是：

- 浏览器请求 `/api/v1/*`
- 由 Nginx 转发到 `https://aiping.cn/api/v1/*`

## 六、常见问题

- **改完代码域名没变化**：多半是传错目录（历史上传到过 `/var/www/aiping-aidraw`，域名用的是 `/data/www/aiping-aidraw`），或浏览器缓存。用第 5 步指纹校验确认，并强制刷新。
- **scp 报 Permission denied**：不要直接往站点根目录 scp，须走「临时目录 + sudo 覆盖」流程。
- **reload 后仍旧版**：确认 `sudo nginx -t` 通过、`sudo systemctl reload nginx` 执行成功，并强制刷新浏览器。
- **上传参考图/视频后报 `413 (Request Entity Too Large)`**：这是 Nginx 请求体大小限制导致的，**不是前端代码问题**。前端会把参考图/参考视频转成 base64 塞进请求体，超过 Nginx 默认 1MB 上限就会 413，请求到不了上游 `aiping.cn`。修复：在 `server` 块与 `location /api/` 块加上 `client_max_body_size 100m;`（见第四节的配置示例），然后执行：

  ```bash
  ssh -t ubuntu@49.232.99.62 "sudo nginx -t && sudo systemctl reload nginx"
  ```
