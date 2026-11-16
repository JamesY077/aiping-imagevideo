# ArtRealm AI — AI 创作工作台

一个面向 AI 图片、视频与文本创作的轻量级工作台，基于 ArtRealm / AIPing 兼容 API 构建。前端把不同图像、视频生成模型统一到一个简洁界面中，支持文生图、图生图、文生视频、图生视频、首尾帧、动作控制等创作方式，并提供 Skill 创作、图片 / 视频生成、3D 建模与配音创作四个分区。

## 功能

- **对话式创作（简易模式）**：以聊天流形式展示提示词、生成状态与最终结果，支持下载与再次迭代。
- **图片生成**：文生图、图生图、参考图生成；Seedream 5.0 Lite 支持最多 10 张多图参考，可用 `@图片N` 在提示词中指定素材；内置常用画面比例（16:9 至 9:16）。
- **图像编辑（图生图）**：上传单张参考图后可点「图像编辑」，把整张图作为固定底图，新增图层、填写元素描述并拖拽 / 缩放，完成后直接按布局生成新图；也支持从生成结果卡片再次进入编辑。图层支持上传自己的素材图（「上传参考图」），按框内位置参与生成：多图参考模型作为独立参考图下发，单图模型先把素材合成到底图再生成。
- **视频生成**：文生视频、图生视频、首尾帧、尾帧、主体参考、动作控制、多模态参考与视频编辑，按模型能力自动展示可用方式。
- **Skill 创作**：通过 ArtSkills-V1 把一句话需求生成标准化 Skill Markdown，支持多轮修改、本地应用与下载。
- **Skill 模板库**：首页提供精选 Skill（可下载 `.md`）与内置风格 Skill，含「真实感摄影」预设；图片页与视频页共用同一套风格 Skill，上传的 Skill 可与内置风格叠加（最多 3 个），视频侧不叠加图片默认规范，示例图统一使用 Moss 版本。
- **3D 建模**：文生 3D、图生 3D 与多视角重建，支持在线预览与模型下载。
- **提示词润色**：默认开启，使用内置默认模型；已选 Skill 时会按 Skill 规范改写提示词并补齐必要画面元素。
- **用量与费用**：记录调用次数与累计消耗，便于了解使用情况。
- **本地偏好保存**：自动保存媒体类型、模型、比例等常用选择，并在设置页统一管理。

## 支持模型

### 图片模型

- Doubao Seedream 5.0 Lite
- Qwen Image 2.0 Pro

### 视频模型

- Doubao Seedance 2.0 / 2.0 Fast / 2.0 Mini
- Vidu Q3 Pro / Q3 Pro Fast
- MiniMax Hailuo 2.3 / MiniMax H3
- Kling Video O1 / V3 Omni / V3 / V2.6

### 文本模型（画布文本节点与 Skill 创作）

- DeepSeek-V4-Flash / DeepSeek-V4-Pro
- GLM-5.2
- Kimi-K3 / Kimi-K2.7-Code
- MiniMax-M3
- Doubao Seed-2.1-turbo / Seed-2.1-pro

## 技术栈

- 前端框架：Vue 3 + TypeScript + Vite
- 状态管理与路由：Pinia、Vue Router
- 样式：Tailwind CSS 4
- HTTP：axios

## 快速开始

### 环境要求

- Node.js ≥ 20.19 或 ≥ 22.12（带 npm）

### 方式一：macOS 一键启动（推荐）

双击运行 `start-macos.command`。脚本会自动完成：

1. 检测并准备 Node.js 运行时（缺少时自动下载到 `.runtime/`）。
2. 首次运行自动创建 `.env`（从 `.env.example` 复制）。
3. 安装依赖并启动开发服务器，自动打开浏览器。

### 方式二：手动启动

```bash
npm install
cp .env.example .env   # 首次运行，按需修改
npm run dev            # 默认 http://127.0.0.1:5500
```

### 构建与预览

```bash
npm run build    # 产物输出到 dist/
npm run preview  # 本地预览 dist/
```

### 全模型生成自测（可选，会真实消耗额度）

`scripts/` 下的自测工具通过 Vite SSR 加载项目真实模块（请求构造、轮询、模型注册），因此测的是线上同一套逻辑，而不是另写一份请求。

```bash
AIPING_API_KEY='QC-...' node scripts/smoke.mjs                       # 单条冒烟：出图 / 文生视频 / 多模态
AIPING_API_KEY='QC-...' node scripts/run-matrix.mjs --concurrency=3  # 分层矩阵：每模型×每模式 + 比例/时长/分辨率扫描
node scripts/analyze-matrix.mjs test-results/matrix-*.jsonl          # 汇总为 Markdown 报告
```

- `--dry-run` 只打印用例；`--only=<模型名>` 过滤模型；`--keys=<file.json>` 复测指定用例；`--limit=` 截断。
- 上游多模态并发上限约 5，`--concurrency` 建议 ≤ 3。
- `test-results/` 为本地测试产物（含上游临时签名 URL），已在 `.gitignore` 中忽略。

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `VITE_APP_NAME` | 应用名称 | `ArtRealm AI` |
| `VITE_APP_VERSION` | 应用版本 | `1.0.0` |
| `VITE_API_BASE_URL` | API 基础路径，开发环境由 Vite 代理到 `https://aiping.cn` | `/api/v1` |
| `VITE_API_DOCS_URL` | API 文档地址 | `https://aiping.cn/docs` |
| `VITE_UPLOAD_SERVICE_URL` | 参考文件上传服务地址（**只有 Seedance 2 本地参考视频必需**，其余素材可内联） | 空 |
| `VITE_UPLOAD_SERVICE_TOKEN` | 与上传服务端 `UPLOAD_TOKEN` 一致的令牌 | 空 |
| `VITE_CDN_ASSET_BASE` | 静态资源 CDN/COS 前缀，本地开发留空走 `public/` | 空 |

## 页面说明

| 路由 | 说明 |
| --- | --- |
| `/` | 落地页：产品介绍、Skill 模板库与内置风格 Skill |
| `/setup` | 首次配置 API Base URL 与 API Key |
| `/image` | 图片生成工作台：提示词条 + 结果画廊 + 参数 / Skill 侧栏 |
| `/video` | 视频生成工作台：结果画廊 + 提示词条 + 视频参数侧栏 |
| `/studio` | 旧入口兼容：按 `type` 自动跳转到 `/image` 或 `/video` |
| `/model3d` | 3D 建模工作台：文生 3D、图生 3D 与多视角重建 |
| `/skill` | Skill 创作页 |
| `/voice` | 配音创作页 |
| `/settings` | 工作台设置：API 配置、提示词增强、数据清除 |

API Base URL 与 API Key 保存在浏览器本地，配置完成后即可进入工作台，未配置时受限页面会自动跳转回首页。

## 参考文件上传服务（Seedance 2 本地参考视频 / Seedream 多图参考）

实测结论（2026-11）：

- **Seedance 2 系列**：参考图、参考音频支持 base64 dataURI 直传；**参考视频只接受公网 URL**（传 dataURI 返回 `reference_video must be provided as a web url`）。
- **MiniMax-H3**：参考图、参考视频、参考音频都支持 dataURI 直传，不需要上传服务。
- **Seedream 5.0 Lite**：参考图支持 dataURI，但多图参考（最多 10 张）会让请求体明显变大，优先换成公网 URL；服务不可用时自动降级为 dataURI。

所以 `server/upload-service`（Express + 腾讯云 COS）主要服务两个场景：**Seedance 2 的本地参考视频**，以及 **Seedream 5.0 Lite 的多图参考**。

- 不部署上传服务时：图片、音频、文生视频、图生视频、H3 全链路都正常；只有「Seedance + 本地视频」会给出明确提示，建议改用公网视频地址；Seedream 多图参考会自动降级为 dataURI。
- 需要支持「Seedance + 本地视频」时：部署 `server/upload-service`，并在 Nginx 加 `/upload` 反代（约 10 行）。

部署与配置方法见 `server/upload-service/README.md` 与 `DEPLOYMENT.md` 第四 / 七节；前端通过 `VITE_UPLOAD_SERVICE_URL` 与 `VITE_UPLOAD_SERVICE_TOKEN` 配置。

> 一键部署服务：`bash scripts/deploy-upload-service.sh`，随后按 `DEPLOYMENT.md` 给 Nginx 加 `/upload` 反代并 reload。

## 部署

线上站点为 `https://artrealm.nextmak.cn`，架构为 Vite 静态站点 + Nginx 反向代理 `/api` 到 `https://aiping.cn`。

- 一键发布：`./deploy.sh`（本地构建 → 上传服务器 → 覆盖站点根目录 → 重载 Nginx → 指纹校验）。
- 完整服务器与 Nginx 配置说明见 `DEPLOYMENT.md`。
- 生产环境变量在 `.env.production` 中维护。

## 项目结构

```
├── src/
│   ├── api/          # API 客户端与各平台适配器（providers/）
│   ├── components/   # 通用组件与画布节点（canvas/）
│   ├── features/     # 生成参数、上传、视频轮询、Skill 解析/应用
│   ├── models/       # 图片 / 视频 / 文本模型定义与示例
│   ├── router/       # 路由配置
│   ├── stores/       # Pinia 状态（API、设置、聊天、画布、Skill）
│   ├── types/        # 类型定义
│   ├── utils/        # 工具函数
│   └── views/        # 页面组件
├── server/upload-service/  # 参考图上传服务（可选）
├── public/           # 静态资源与模板
├── deploy.sh         # 一键部署脚本
├── start-macos.command  # macOS 一键启动脚本
└── DEPLOYMENT.md     # 服务器部署说明
```
