# AIDRAW — AI 创作工作台

> 基于 [AI PING（aiping.cn）](https://aiping.cn) API 构建的 AI 图片 & 视频生成工作台，支持多模型切换、本地素材上传、生成记录查看与费用统计。

---

## ✨ 功能特性

- **图片生成**：支持文生图、图生图，覆盖 Qwen-Image、Doubao-Seedream、GLM-Image、Kolors、HunyuanImage、即梦、Wan2.5 等主流模型
- **视频生成**：支持文生视频、图生视频，覆盖 Kling 系列、MiniMax-Hailuo、Wan2.6、Doubao-Seedance、即梦视频等模型
- **多模型切换**：下拉选择器动态拉取 API 可用模型列表，按媒体类型自动过滤
- **比例选择**：支持 16:9 / 3:2 / 4:3 / 1:1 / 3:4 / 2:3 / 9:16 七种画面比例
- **本地素材上传**：支持上传本地图片/视频作为参考素材（模型能力允许时）
- **生成记录**：对话式界面展示所有生成历史，支持重新生成
- **用量统计**：侧边栏面板实时统计调用次数与累计花费
- **API Key 管理**：首次使用引导配置，支持在设置页随时修改
- **本地持久化**：模型选择、媒体类型、比例等偏好自动保存到 localStorage

---

## 🖥️ 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Vue 3 + `<script setup>` + TypeScript |
| 构建 | Vite 8 |
| 状态管理 | Pinia |
| 路由 | Vue Router 4 |
| HTTP | Axios |
| UI 组件 | Vant 4（部分） |
| API | APING-OpenAI 兼容接口 |

---

## 🚀 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/your-username/aiping-aidraw.git
cd aiping-aidraw/ai-workshop
```

### 2. 安装依赖

```bash
npm install
# 或
pnpm install
```

### 3. 配置环境变量

复制示例文件并填写配置：

```bash
cp .env.example .env
```

`.env` 内容说明：

```env
VITE_APP_NAME=AIDRAW
VITE_APP_VERSION=1.0.0
VITE_API_BASE_URL=/api/v1                    # API 代理地址，开发环境一般无需修改
VITE_API_DOCS_URL=https://aiping.cn/docs     # 文档链接
```

> **API Key 不写在 `.env` 里**，首次打开页面会引导你在界面中输入，保存在浏览器 localStorage。
> 开发服务器会把 `/api` 请求代理到 `https://aiping.cn`，避免浏览器直接请求 `api.aiping.cn` 时遇到 DNS 或跨域问题。

### 4. 启动开发服务器

```bash
npm run dev
```

浏览器访问 `http://localhost:5173`，按提示输入爱萍 AI 的 API Key 即可开始使用。

也可以直接使用一键启动脚本：

- macOS：双击 `start-macos.command`
- Windows：双击 `start-windows.bat`

脚本会自动检测 Node.js 版本（要求 v20.19.0+ 或 v22.12.0+）。如果本机缺失或版本过低，会下载项目内置运行时到 `.runtime/`，随后安装依赖并启动开发服务器。

### 5. 构建生产版本

```bash
npm run build
```

产物输出到 `dist/` 目录，可直接部署到任意静态托管服务（Vercel、Netlify、GitHub Pages 等）。

---

## 📁 项目结构

```
ai-workshop/
├── public/                  # 静态资源
├── src/
│   ├── api/
│   │   ├── aiping.ts        # 爱萍 AI API 封装（图片/视频生成、模型列表）
│   │   ├── config.ts        # Axios 实例与拦截器
│   │   └── index.ts         # API 统一导出
│   ├── assets/styles/
│   │   ├── global.css       # 全局样式
│   │   └── variables.css    # CSS 变量（颜色、阴影、过渡）
│   ├── components/
│   │   ├── ApiKeyInput.vue  # API Key 输入组件
│   │   ├── ChatBubble.vue   # 对话气泡
│   │   ├── CostDisplay.vue  # 费用展示
│   │   ├── ImageResult.vue  # 图片生成结果
│   │   ├── LoadingOverlay.vue
│   │   ├── ModelSelector.vue # 模型选择下拉
│   │   └── VideoResult.vue  # 视频生成结果
│   ├── composables/
│   │   ├── useApiKey.ts     # API Key 管理
│   │   ├── useChat.ts       # 对话逻辑
│   │   ├── useGenerate.ts   # 生成任务调度（轮询进度）
│   │   └── useModels.ts     # 模型列表获取
│   ├── router/index.ts      # 路由配置
│   ├── stores/
│   │   ├── apiStore.ts      # API Key 状态
│   │   ├── chatStore.ts     # 消息列表状态
│   │   └── settingsStore.ts # 用户偏好（模型/比例/媒体类型）
│   ├── types/
│   │   ├── api.ts           # API 响应类型
│   │   ├── chat.ts          # 消息/生成结果类型
│   │   └── model.ts         # 模型能力定义与工具函数
│   ├── utils/
│   │   ├── format.ts        # 时间/费用格式化
│   │   ├── storage.ts       # localStorage 工具
│   │   └── validators.ts    # 输入校验
│   └── views/
│       ├── ApiKeySetup.vue  # API Key 配置页
│       ├── ChatCreate.vue   # 创作工作台主页
│       └── Settings.vue     # 设置页
├── .env.example
├── index.html
├── package.json
└── vite.config.ts
```

---

## 🔑 获取 API Key

1. 访问 [aiping.cn](https://aiping.cn) 注册账号
2. 进入控制台 → API Keys → 创建新 Key
3. 将 Key 粘贴到工作台首次启动时的配置页，或在「设置」页修改

---

## 📝 支持的模型（部分）

### 图片模型

| 模型 | 特性 |
|------|------|
| Qwen-Image-2.0 / Pro / Plus | 通义千问图像生成 |
| Doubao-Seedream-4.0 / 4.5 / 5.0-lite | 豆包 Seedream，支持图生图 |
| GLM-Image | 智谱 GLM 图像 |
| Kolors | 可图 |
| HunyuanImage-3.0 | 混元图像 |
| 即梦图片生成 4.0 / 文生图 3.0 / 3.1 | 即梦系列 |
| Wan2.5-T2I-Preview / I2I-Preview | Wan 图像，支持图生图 |
| Qwen-Image-Edit / Edit-Plus | 图像编辑，需上传参考图 |

### 视频模型

| 模型 | 特性 |
|------|------|
| Kling-V3 / V3-Omni / V2.6 / Video-O1 | 可灵视频系列 |
| MiniMax-Hailuo-2.3 / 02 | 海螺视频 |
| Wan2.6-T2V / I2V | Wan 视频，I2V 需上传参考图 |
| Doubao-Seedance-1.0-Pro-Fast | 豆包视频 |
| 即梦视频生成 3.0 Pro | 即梦视频 |

更多模型正在支持中！

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 License

MIT
