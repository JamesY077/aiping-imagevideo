#!/usr/bin/env bash
set -euo pipefail

# 一键部署「参考文件上传服务」到腾讯云服务器（不改 Nginx 配置）
# 用法：bash scripts/deploy-upload-service.sh
# 前置：server/upload-service/.env 已填好 COS 密钥与 UPLOAD_TOKEN。

SERVER="${SERVER:-ubuntu@49.232.99.62}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$APP_DIR/server/upload-service"
REMOTE_DIR="aiping-upload"

if [ ! -f "$SRC/.env" ]; then
  echo "❌ 缺少 $SRC/.env，请先复制 .env.example 并填写 COS 密钥 / UPLOAD_TOKEN"
  exit 1
fi

echo "==> 1/4 上传服务代码到 ~/$REMOTE_DIR"
ssh "$SERVER" "rm -rf ~/$REMOTE_DIR && mkdir -p ~/$REMOTE_DIR"
rsync -av --exclude node_modules --exclude .env "$SRC/" "$SERVER:~/$REMOTE_DIR/"
scp "$SRC/.env" "$SERVER:~/$REMOTE_DIR/.env"

echo "==> 2/4 安装依赖并用 PM2 启动"
ssh -t "$SERVER" "
  cd ~/$REMOTE_DIR &&
  npm install --omit=dev --no-audit --no-fund &&
  (command -v pm2 >/dev/null || sudo npm i -g pm2) &&
  (pm2 restart aiping-upload --update-env || pm2 start index.js --name aiping-upload) &&
  pm2 save
"

echo "==> 3/4 本机健康检查"
ssh "$SERVER" "curl -s --max-time 5 http://127.0.0.1:3100/health; echo"

echo "==> 4/4 完成。若下面的公网检查不是 200，需要给 Nginx 加 /upload 反代："
echo "    curl -s -i https://artrealm.nextmak.cn/upload/health"
echo "    Nginx 片段见 DEPLOYMENT.md 第四节「location /upload」。"
