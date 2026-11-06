#!/usr/bin/env bash
set -euo pipefail

# 一键部署「参考文件上传服务」到腾讯云服务器，并给 Nginx 加上 /upload 反代。
# 用法：bash scripts/deploy-upload-service.sh
#   SKIP_NGINX=1 只部署服务、不动 Nginx
# 前置：server/upload-service/.env 已填好 COS 密钥与 UPLOAD_TOKEN。
# 说明：只建立 3 次 SSH 连接，尽量减少重复输入密码。

SERVER="${SERVER:-ubuntu@49.232.99.62}"
DOMAIN="${DOMAIN:-artrealm.nextmak.cn}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$APP_DIR/server/upload-service"
REMOTE_DIR="aiping-upload"

if [ ! -f "$SRC/.env" ]; then
  echo "❌ 缺少 $SRC/.env，请先复制 .env.example 并填写 COS 密钥 / UPLOAD_TOKEN"
  exit 1
fi

echo "==> 1/4 打包并上传服务代码 + .env + 远程安装脚本"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/app"
# 连同 .env 一起打包（.env 只存在于服务器，不进 git）
(cd "$SRC" && tar -cf - --exclude node_modules .) | (cd "$TMP/app" && tar -xf -)
cp "$APP_DIR/scripts/remote-setup-upload.sh" "$TMP/remote-setup-upload.sh"
tar -C "$TMP" -czf - app remote-setup-upload.sh \
  | ssh "$SERVER" "rm -rf ~/$REMOTE_DIR ~/aiping-remote-setup.sh && tar -xzf - -C ~ && mv ~/app ~/$REMOTE_DIR"

echo "==> 2/4 安装依赖并用 PM2 启动（登录 shell，自动加载 nvm）+ 本机健康检查"
ssh -t "$SERVER" "bash -lc 'bash ~/aiping-remote-setup.sh && echo --- && curl -s --max-time 5 http://127.0.0.1:3100/health; echo'"

if [ "${SKIP_NGINX:-0}" = "1" ]; then
  echo "==> 3/4 跳过 Nginx（SKIP_NGINX=1）"
else
  echo "==> 3/4 配置 Nginx /upload 反代"
  SERVER="$SERVER" DOMAIN="$DOMAIN" bash "$APP_DIR/scripts/setup-nginx-upload.sh"
fi

echo "==> 4/4 公网健康检查"
curl -s --max-time 10 "https://$DOMAIN/upload/health" || true
echo
echo "完成。若上面输出 {\"ok\":true,...} 说明本地参考视频链路已就绪。"
