# Image View · Gitee AI 多模型工作台

这是一个可直接部署到 Cloudflare Pages / Workers 的纯 HTML + JavaScript 多模态生成前端，统一通过 Gitee AI Serverless API 调用模型。

## 主要功能

- 文生图（Text-to-Image）
- 图像编辑（Image Edit）
- 图生视频（Image-to-Video）
- 文生视频（Text-to-Video）
- 每个功能均支持多模型切换
- 支持自定义模型 ID、Endpoint 与附加 JSON 参数
- 尝试通过 `GET /v1/models` 自动同步当前 Token 可见模型；接口不可用时自动退回内置精选模型
- 生成结果直接在网页展示并提供下载

## 内置模型

内置列表优先选择 Gitee AI 当前 Serverless API 模型广场中质量较高、较热门或官方推荐的模型。

### 文生图

- Qwen-Image-2512
- FLUX.2-dev
- Qwen-Image
- FLUX.1-schnell
- z-image-turbo
- Z-Image
- GLM-Image
- HiDream-I1-Full
- CogView4-6B
- LongCat-Image
- FLUX.1-dev
- FLUX.1-Krea-dev
- FLUX.2-klein-9B
- FLUX.2-klein-4B

### 图像编辑

- Qwen-Image-Edit-2511（默认推荐）
- LongCat-Image-Edit
- Qwen-Image-Edit
- FLUX.1-Kontext-dev
- DreamO
- Qwen-Image-Layered

### 图生视频

- ViduQ3-Pro
- Wan2.7
- ViduQ2-Pro
- ViduQ3-Turbo
- Wan2_2-I2V-A14B
- ViduQ2-Turbo
- HappyHorse-1.1
- HappyHorse-1.0
- LTX-2

### 文生视频

- ViduQ3-Pro
- Wan2.7
- ViduQ3-Turbo
- LTX-2
- HunyuanVideo-1.5
- Wan2.1-T2V-14B

> Gitee AI 的模型上下线、模型 ID、参数和 API Endpoint 可能随平台更新变化。项目提供“自定义模型”和 Endpoint 覆盖，便于直接适配新模型。

## 模型切换逻辑

API Token 负责身份和调用权限，真正指定模型的是请求中的 `model` 字段。

例如图像编辑请求会根据页面选择动态发送：

```text
model = Qwen-Image-Edit-2511
```

或：

```text
model = LongCat-Image-Edit
```

不再把四个功能固定到单一模型。

## 自动同步模型

输入 Gitee AI Token 后，可点击“同步 Gitee 模型”。网页会尝试：

```text
GET /api/models
    ↓
Cloudflare Pages Function
    ↓
GET https://ai.gitee.com/v1/models
```

如果 Gitee 当前 Token / 接口返回 OpenAI 风格模型列表，网页会按模型名称自动归类到：

- 文生图
- 图像编辑
- 图生视频
- 文生视频

自动同步失败不会影响使用，内置模型和自定义模型始终可用。

## 自定义模型

每个功能下拉框最后都有“自定义模型…”。可填写：

- 模型 ID
- API Endpoint
- 附加 JSON 参数

这样 Gitee 上线新模型后，即使项目尚未更新，也可以直接测试。

## API 与兼容策略

项目默认通过同域代理访问：

```text
/api/* -> https://ai.gitee.com/v1/*
```

下载结果通过：

```text
/dl?url=...
```

解决浏览器 CORS / 跨域下载问题。

不同视频和编辑模型的参数格式可能不同，因此多模型扩展加入了兼容请求策略：

- 图像编辑优先尝试异步 edits 接口，必要时尝试同步 edits
- 图生视频会在通用视频参数与 Wan 兼容参数之间自动重试
- 文生视频对 HunyuanVideo-1.5 保留原项目已验证参数，对其他模型优先使用 Gitee 通用视频参数并提供兼容重试

如果某个新模型参数特殊，可在“高级”区域用 Endpoint / 附加 JSON 参数覆盖。

## Cloudflare Pages 部署

项目包含 Pages Functions：

- `functions/api/[[path]].js`：代理 Gitee AI `/v1/*`
- `functions/dl.js`：代理图片 / 视频下载

部署步骤：

1. 将仓库连接到 Cloudflare Pages
2. Build command 留空
3. Output directory 使用仓库根目录 `/`
4. 部署后访问 Pages 域名

本地调试可使用：

```bash
wrangler pages dev .
```

## 主要文件

- `index.html`：页面与四类功能面板
- `app.js`：原项目基础功能与兼容逻辑
- `multi-model.js`：多模型目录、模型切换、自定义模型、自动同步与请求兼容层
- `styles.css`：页面样式
- `functions/api/[[path]].js`：Gitee API 代理
- `functions/dl.js`：下载代理
