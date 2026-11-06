#!/usr/bin/env bash
set -euo pipefail

# 一键部署「参考文件上传服务」到腾讯云服务器，并给 Nginx 加上 /upload 反代。
# 用法：bash scripts/deploy-upload-service.sh
#   SKIP_NGINX=1 只部署服务、不动 Nginx
# 前置：server/upload-service/.env 已填好 COS 密钥与 UPLOAD_TOKEN。

SERVER="${SERVER:-ubuntu@49.232.99.62}"
DOMAIN="${DOMAIN:-artrealm.nextmak.cn}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$APP_DIR/server/upload-service"
REMOTE_DIR="aiping-upload"

if [ ! -f "$SRC/.env" ]; then
  echo "❌ 缺少 $SRC/.env，请先复制 .env.example 并填写 COS 密钥 / UPLOAD_TOKEN"
  exit 1
fi

echo "==> 1/5 上传服务代码到 ~/$REMOTE_DIR"
ssh "$SERVER" "rm -rf ~/$REMOTE_DIR && mkdir -p ~/$REMOTE_DIR"
rsync -av --exclude node_modules --exclude .env "$SRC/" "$SERVER:~/$REMOTE_DIR/"
scp "$SRC/.env" "$SERVER:~/$REMOTE_DIR/.env"

echo "==> 2/5 安装依赖并用 PM2 启动"
ssh -t "$SERVER" "
  cd ~/$REMOTE_DIR &&
  npm install --omit=dev --no-audit --no-fund &&
  (command -v pm2 >/dev/null || sudo npm i -g pm2) &&
  (pm2 restart aiping-upload --update-env || pm2 start index.js --name aiping-upload) &&
  pm2 save
"

echo "==> 3/5 服务器本机健康检查"
ssh "$SERVER" "curl -s --max-time 5 http://127.0.0.1:3100/health; echo"

if [ "${SKIP_NGINX:-0}" = "1" ]; then
  echo "==> 4/5 跳过 Nginx（SKIP_NGINX=1）"
else
  echo "==> 4/5 配置 Nginx /upload 反代"
  SERVER="$SERVER" DOMAIN="$DOMAIN" bash "$APP_DIR/scripts/setup-nginx-upload.sh"
fi

echo "==> 5/5 公网健康检查"
curl -s --max-time 10 "https://$DOMAIN/upload/health" || true
echo
echo "完成。若上面输出 {\"ok\":true,...} 说明本地参考视频链路已就绪。"
