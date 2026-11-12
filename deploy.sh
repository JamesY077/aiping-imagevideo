#!/usr/bin/env bash
set -euo pipefail

# 项目根目录 = 本脚本所在目录（脚本可从任意目录执行）
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

if [ ! -f package.json ] || [ ! -d src ]; then
  echo "❌ 当前目录不像项目根目录：$PROJECT_DIR"
  exit 1
fi

echo "    项目目录：$PROJECT_DIR"

SERVER="ubuntu@49.232.99.62"
DOMAIN="artrealm.nextmak.cn"
REMOTE_TMP="aidraw-dist"
FIND_ROOT="aidraw-find-root.sh"

echo "==> 1/5 本地构建"
npm run build

echo "==> 2/5 上传到服务器临时目录（家目录下 ${REMOTE_TMP}，会提示输入登录密码）"
ssh "$SERVER" "rm -rf $REMOTE_TMP && mkdir -p $REMOTE_TMP"
scp -r dist/* "$SERVER:$REMOTE_TMP/"

echo "==> 3/5 从 Nginx 配置中查找 $DOMAIN 的真实站点根目录"
cat > /tmp/$FIND_ROOT <<'REMOTE'
#!/usr/bin/env bash
DOMAIN="artrealm.nextmak.cn"
dirs=$(grep -rlE "$DOMAIN" /etc/nginx/sites-available/ /etc/nginx/sites-enabled/ 2>/dev/null | sort -u)
if [ -n "$dirs" ]; then
  grep -hE '^[[:space:]]*root[[:space:]]+[^;]+;' $dirs 2>/dev/null
else
  sudo nginx -T 2>/dev/null
fi | sed -E 's/^[[:space:]]*root[[:space:]]+//; s/;[[:space:]]*$//; s/[[:space:]]+$//' | sort -u
REMOTE
scp /tmp/$FIND_ROOT "$SERVER:$FIND_ROOT"
rm -f /tmp/$FIND_ROOT

WEB_ROOTS=$(ssh -t "$SERVER" "bash $FIND_ROOT" | tr -d '\r' | sed '/^$/d' | sort -u)
echo "$WEB_ROOTS" | sed 's/^/    候选根目录: /'
WEB_ROOT=$(echo "$WEB_ROOTS" | head -n 1)

if [ -z "$WEB_ROOT" ]; then
  echo "❌ 未找到站点根目录，请手动确认：ssh -t $SERVER \"sudo nginx -T\""
  exit 1
fi
echo "    → 使用根目录：$WEB_ROOT"

read -r -p "    确认覆盖 $WEB_ROOT 并重载 Nginx？(y/N) " CONFIRM
if [ "${CONFIRM:-N}" != "y" ] && [ "${CONFIRM:-N}" != "Y" ]; then
  echo "已取消。临时目录 $REMOTE_TMP 仍保留在服务器上。"
  exit 0
fi

echo "==> 4/5 覆盖站点目录并重载 Nginx（会提示输入 sudo 密码）"
ssh -t "$SERVER" "sudo rm -rf \"$WEB_ROOT\"/* \
  && sudo cp -r $REMOTE_TMP/* \"$WEB_ROOT\"/ \
  && sudo chown -R www-data:www-data \"$WEB_ROOT\" \
  && sudo nginx -t && sudo systemctl reload nginx"

echo "==> 5/5 校验线上资源指纹"
REMOTE_HASH=$(curl -s "https://$DOMAIN" | grep -oE 'assets/[A-Za-z0-9._-]+\.js' | head -n 1)
LOCAL_HASH=$(grep -oE 'assets/[A-Za-z0-9._-]+\.js' dist/index.html | head -n 1)
echo "    线上: $REMOTE_HASH"
echo "    本地: $LOCAL_HASH"
if [ -n "$LOCAL_HASH" ] && [ "$REMOTE_HASH" = "$LOCAL_HASH" ]; then
  echo "✅ 指纹一致，部署完成：https://$DOMAIN"
else
  echo "⚠️  指纹不一致，请检查日志；浏览器访问时用 Cmd+Shift+R 强制刷新。"
fi

# 3D 建模依赖 OSS 同源反代；首次上线或用新服务器时检查一次即可。
if ! curl -sI "https://$DOMAIN/v2fun-assets/" | grep -qi 'aliyunoss'; then
  echo "⚠️  未检测到 /v2fun-assets/ 反代，3D 建模将退化为只看预览视频。"
  echo "    请按 DEPLOYMENT.md 第四节在 Nginx 增加 location /v2fun-assets/ 后 reload。"
fi
