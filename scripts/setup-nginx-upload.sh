#!/usr/bin/env bash
set -euo pipefail

# 给线上 Nginx 增加 /upload 反向代理（幂等，可重复执行）
# 用法：bash scripts/setup-nginx-upload.sh
# 前置：server/upload-service 已在服务器 3100 端口运行（bash scripts/deploy-upload-service.sh）

SERVER="${SERVER:-ubuntu@49.232.99.62}"
DOMAIN="${DOMAIN:-artrealm.nextmak.cn}"

echo "==> 在 $SERVER 上为 $DOMAIN 配置 /upload 反代（需要 sudo 密码）"

ssh -t "$SERVER" "sudo DOMAIN='$DOMAIN' bash -s" <<'REMOTE'
set -euo pipefail

CONF=""
for f in $(grep -rl --include='*.conf' "$DOMAIN" /etc/nginx 2>/dev/null); do
  if grep -q 'server_name' "$f"; then CONF="$f"; break; fi
done
if [ -z "$CONF" ]; then
  for f in $(grep -rl "$DOMAIN" /etc/nginx 2>/dev/null); do
    case "$f" in */snippets/*) continue;; esac
    CONF="$f"; break
  done
fi
[ -n "$CONF" ] || { echo "❌ 找不到包含 $DOMAIN 的 Nginx 配置"; exit 1; }
echo "目标配置: $CONF"

BACKUP="$CONF.bak.$(date +%Y%m%d%H%M%S)"
cp "$CONF" "$BACKUP"
echo "已备份: $BACKUP"

python3 - "$CONF" <<'PY'
import re, sys

path = sys.argv[1]
src = open(path, encoding='utf-8').read()

if re.search(r'location\s*=?\s*/upload\b', src):
    print('已存在 /upload 配置，跳过插入')
else:
    block = """
    # —— /upload 反代：仅 Seedance 2 本地参考视频需要（其余素材走 dataURI）
    location /upload {
        proxy_pass http://127.0.0.1:3100/upload;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # 参考视频上限 50MB，base64 膨胀约 1/3
        client_max_body_size 80m;
        proxy_read_timeout 300s;
    }

    location = /upload/health {
        proxy_pass http://127.0.0.1:3100/health;
        proxy_set_header Host $host;
    }
"""
    anchor = src.find('location /api/')
    if anchor == -1:
        m = re.search(r'location\s+/(\s|\{)', src)
        anchor = m.start() if m else -1
    if anchor == -1:
        anchor = src.rfind('}')
    line_start = src.rfind('\n', 0, anchor) + 1
    src = src[:line_start] + block.lstrip('\n') + '\n' + src[line_start:]
    open(path, 'w', encoding='utf-8').write(src)
    print('已插入 /upload 配置')

if 'client_max_body_size' not in src:
    print('⚠️  配置里没有 client_max_body_size，参考图/视频请求体可能触发 413，'
          '请在 server 块内加 client_max_body_size 100m;')
PY

echo "==> nginx -t"
nginx -t
echo "==> reload"
systemctl reload nginx
echo "==> 本机检查上传服务"
curl -s --max-time 5 http://127.0.0.1:3100/health || true
echo
echo "==> 公网检查 /upload/health"
curl -s --max-time 8 "https://$DOMAIN/upload/health" || true
echo
REMOTE

echo "==> 完成。期望上面最后一行输出 {\"ok\":true,...}"
