# Ubuntu 服务器部署说明

本项目已按 **Vite 前端静态站点 + Nginx 反向代理 API** 的方式整理，适合部署到 Ubuntu 服务器（如 `49.232.99.62`）。

## 一、推荐部署结构

- 前端静态文件：`dist/`
- Web 服务：Nginx
- API 转发：`/api/ -> https://aiping.cn/`

这样前端浏览器访问你自己的服务器域名/IP，API 请求仍然通过服务器转发到 AIPing，避免浏览器跨域问题，并且便于后续替换后端地址。

---

## 二、本地构建

```bash
npm install
npm run build
```

构建产物在：

```bash
dist/
```

---

## 三、上传到 Ubuntu 服务器

示例：

```bash
scp -r dist/* root@49.232.99.62:/var/www/aiping-aidraw/
```

如果服务器还没目录，可以先创建：

```bash
ssh root@49.232.99.62 "mkdir -p /var/www/aiping-aidraw"
```

---

## 四、Nginx 配置示例

Ubuntu 服务器安装 Nginx：

```bash
sudo apt update
sudo apt install -y nginx
```

新建配置：

```bash
sudo nano /etc/nginx/sites-available/aiping-aidraw
```

写入以下内容：

```nginx
server {
    listen 80;
    server_name 49.232.99.62;

    root /var/www/aiping-aidraw;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass https://aiping.cn/;
        proxy_ssl_server_name on;
        proxy_set_header Host aiping.cn;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/aiping-aidraw /etc/nginx/sites-enabled/aiping-aidraw
sudo nginx -t
sudo systemctl reload nginx
```

如果默认站点冲突，可移除：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 五、访问方式

浏览器打开：

```text
http://49.232.99.62
```

---

## 六、生产环境说明

项目生产环境默认读取：

```env
VITE_API_BASE_URL=/api/v1
```

也就是：
- 浏览器请求 `/api/v1/*`
- 由 Nginx 转发到 `https://aiping.cn/api/v1/*`

---

## 七、后续建议

1. 给服务器绑定域名
2. 增加 HTTPS（推荐用 Let's Encrypt）
3. 把 API 转发地址改为你自己的后端网关
4. 配置 Nginx gzip / 缓存策略优化静态资源加载
