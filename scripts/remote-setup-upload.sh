#!/usr/bin/env bash
# 在服务器上执行：加载 node/npm 环境 → 安装依赖 → 用 PM2 常驻启动上传服务。
# 由 scripts/deploy-upload-service.sh 通过 `bash -lc` 调用，确保加载登录环境（nvm 等）。
set -euo pipefail

cd "$HOME/aiping-upload"

# 非交互环境默认不加载 nvm，这里主动尝试常见位置。
if ! command -v npm >/dev/null 2>&1; then
  for f in "$HOME/.nvm/nvm.sh" "/usr/local/nvm/nvm.sh" "/usr/share/nvm/init-nvm.sh"; do
    if [ -s "$f" ]; then
      # shellcheck disable=SC1090
      . "$f"
      break
    fi
  done
fi

# 再兜底常见安装目录。
if ! command -v npm >/dev/null 2>&1; then
  for d in /usr/local/bin /opt/node/bin "$HOME/.volta/bin" "$HOME/.local/bin"; do
    if [ -x "$d/npm" ]; then PATH="$d:$PATH"; export PATH; break; fi
  done
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[remote] 服务器没有 Node.js，自动安装 Node 20（NodeSource）..."
  if curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - ; then
    sudo apt-get install -y nodejs
  else
    echo "[remote] NodeSource 不可达，改用 npmmirror 二进制包..."
    NODE_VER="v20.18.0"
    cd /tmp
    curl -fsSLO "https://npmmirror.com/mirrors/node/${NODE_VER}/node-${NODE_VER}-linux-x64.tar.xz"
    sudo rm -rf /usr/local/nodejs
    sudo tar -xJf "node-${NODE_VER}-linux-x64.tar.xz" -C /usr/local
    sudo mv "/usr/local/node-${NODE_VER}-linux-x64" /usr/local/nodejs
    for b in node npm npx; do sudo ln -sf "/usr/local/nodejs/bin/$b" "/usr/local/bin/$b"; done
    cd "$HOME/aiping-upload"
  fi
  hash -r 2>/dev/null || true
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ 服务器上找不到 node/npm，自动安装也失败了，请手动安装 Node 18+ 后重试。"
  exit 1
fi

echo "[remote] node: $(command -v node) $(node -v 2>/dev/null || true)"
echo "[remote] npm : $(command -v npm) $(npm -v 2>/dev/null || true)"

echo "[remote] 安装生产依赖..."
npm install --omit=dev --no-audit --no-fund

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[remote] 安装 pm2..."
  npm i -g pm2 || sudo env "PATH=$PATH" npm i -g pm2
  hash -r 2>/dev/null || true
fi

# npmmirror 二进制布局下全局 bin 在 /usr/local/nodejs/bin，补一个软链到 PATH。
if ! command -v pm2 >/dev/null 2>&1 && [ -x /usr/local/nodejs/bin/pm2 ]; then
  sudo ln -sf /usr/local/nodejs/bin/pm2 /usr/local/bin/pm2
  hash -r 2>/dev/null || true
fi

if ! command -v pm2 >/dev/null 2>&1; then
  echo "❌ pm2 安装失败，请手动执行：sudo npm i -g pm2"
  exit 1
fi

echo "[remote] 启动/重启 aiping-upload ..."
pm2 restart aiping-upload --update-env 2>/dev/null || pm2 start index.js --name aiping-upload
pm2 save

echo "[remote] pm2 状态:"
pm2 status aiping-upload || true
