# Image View · Gitee AI 多模型工作台

这是一个可直接部署到 Cloudflare Pages / Workers 的纯 HTML + JavaScript 多模态生成前端，统一通过 Gitee AI Serverless API 调用模型。

## 主要功能

- 文生图（Text-to-Image）
- 图像编辑（Image Edit）
- 图生视频（Image-to-Video）
- 文生视频（Text-to-Video）
- 每个功能均支持多模型切换
- 支持自定义模型 ID、Endpoint 与附加 JSON 参数
- 可手动尝试 `GET /v1/models` 同步当前 Token 可见模型；该接口未作为必需能力，失败不影响内置模型和自定义模型
- 生成结果直接在网页展示并提供下载

## 内置模型

内置清单只收录当前在 Gitee AI Serverless 模型广场可核对到的模型。不同厂商的视频模型参数可能不完全统一，因此除原项目已验证模型外，部分新视频模型在界面中会标记“兼容尝试”。

### 文生图

- Qwen-Image-2512
- FLUX.2-dev
- Qwen-Image
- FLUX.2-klein-9B
- FLUX.1-schnell
- z-image-turbo
- Z-Image
- GLM-Image
- HiDream-I1-Full
- CogView4-6B
- LongCat-Image
- FLUX.1-dev
- FLUX.1-Krea-dev
- FLUX.2-klein-4B
- Kolors
- stable-diffusion-xl-base-1.0
- stable-diffusion-3.5-large-turbo
- stable-diffusion-3-medium

### 图像编辑

- Qwen-Image-Edit-2511（默认推荐）
- LongCat-Image-Edit
- Qwen-Image-Edit
- FLUX.1-Kontext-dev
- FLUX.2-klein-9B
- FLUX.2-klein-4B
- FLUX.1-Krea-dev
- Qwen-Image

`DreamO` 与 `Qwen-Image-Layered` 没有作为通用编辑模型内置：前者更偏定制生成，后者主要用于图层分解，并不等同于普通 `/images/edits` 工作流。

### 图生视频

当前普通图生视频下拉框按 Gitee 视频生成页进行精选，优先保留页面可体验且更适合作为通用 I2V 的模型。

**推荐体验**

- ViduQ3-Pro
- ViduQ3-Turbo
- ViduQ2-Pro
- HappyHorse-1.1
- Wan2.7
- Wan2_2-I2V-A14B（原项目已验证）
- LTX-2

**备选**

- ViduQ2-Turbo
- HappyHorse-1.0

### 文生视频

**推荐体验**

- HunyuanVideo-1.5（原项目已验证）
- ViduQ3-Pro
- ViduQ3-Turbo
- Wan2.7
- Wan2.1-T2V-14B
- LTX-2

**备选**

- HappyHorse-1.1

`Duix-Avatar`、`InfiniteTalk`、`Duix.Heygem` 等更偏数字人或音频驱动视频，不放入普通图生视频 / 文生视频下拉框。后续若需要，可单独增加“数字人视频”工作流。

> 上述视频模型来自当前 Gitee 视频生成页，页面通常提供免费体验。通过本工具直接调用 API 时，是否消耗体验额度或产生费用仍以 Gitee 当前账户与 API 规则为准。

> Gitee AI 的模型上下线、精确 model ID、参数和 API Endpoint 可能随平台更新变化。项目提供“自定义模型”、Endpoint 覆盖和附加 JSON 参数，便于直接适配新模型。

## 模型切换逻辑

API Token 负责身份和调用权限，真正指定模型的是请求中的 `model` 字段。例如图像编辑可动态发送：

```text
model = Qwen-Image-Edit-2511
```

或：

```text
model = LongCat-Image-Edit
```

不再把四个功能固定到单一模型。

## 自动同步模型（实验功能）

输入 Gitee AI Token 后，可点击“尝试同步 Gitee 模型”。网页会尝试：

```text
GET /api/models
    ↓
Cloudflare Pages Function
    ↓
GET https://ai.gitee.com/v1/models
```

Gitee 当前公开文档未把该接口作为本项目必须依赖的稳定能力，因此不会在页面加载时自动请求。若接口或 Token 不支持，页面会继续使用内置精选模型；也可以直接使用“自定义模型”。视频下拉框会继续以项目的精选清单为准，避免自动同步把数字人或不适配普通 I2V/T2V 的模型混入列表。

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

不同模型的请求参数可能不同，因此多模型扩展采用兼容策略：

- 文生图支持同步 URL、Base64 和异步 task 结果
- Qwen 文生图自动转换为模型支持的原生尺寸桶
- 图像编辑仅对 Qwen 编辑模型发送 `task_types`、`guidance_scale`、`num_inference_steps` 等 Qwen 风格参数；其他编辑模型使用更精简的通用表单
- 图像编辑会尝试异步和同步 edits Endpoint
- 图生视频会尝试通用 multipart、Wan 风格 multipart，以及部分 JSON 图片输入形式
- 文生视频会尝试通用视频参数、Hunyuan 旧参数，以及多个常见异步视频 Endpoint
- Vidu、HappyHorse、Wan2.7 等模型的安全时长范围会在提交前统一校正
- Wan2.2 继续保留长视频分段与 ZIP 打包能力
- 自动轮询遇到明确 4xx 会提前结束，避免无意义地长时间等待

如果某个新模型参数特殊，可在“高级”区域用 Endpoint / 附加 JSON 参数覆盖。

## 运行时验证说明

模型“在 Gitee Serverless 模型广场存在”不等于“所有模型共享完全相同的请求字段”。原项目的 `Wan2_2-I2V-A14B` 与 `HunyuanVideo-1.5` 有已有调用逻辑；Vidu、LTX、Wan 2.7、HappyHorse 等新增模型应以 Gitee 当前模型页提供的 API 示例为最终依据。页面会显示具体 HTTP 错误，便于继续做模型级适配。

## 前端运行时结构

第一阶段重构后，不再通过多个 `*-fix.js` 叠加修补，也不再由 Cloudflare Middleware 动态注入前端脚本。当前加载顺序固定为：

```text
app.js
  ↓
multi-model.js
  ↓
js/runtime/model-runtime.js
```

其中：

- `app.js` 保留原项目基础 UI、主题、预览和已验证旧链路，作为兼容基线
- `multi-model.js` 负责多模型选择、自定义模型、统一运行入口和实验性模型同步
- `js/runtime/model-runtime.js` 集中负责模型请求适配、尺寸与时长校正、精选视频目录、模型健康状态、一键检测、动态参数显示、API Key/Loading 包装以及 Wan2.2 分段逻辑

原来的 `multi-model-hotfix.js`、`model-workbench.js`、`video-duration-fix.js`、`video-catalog-fix.js` 已合并并删除，避免加载顺序和重复事件绑定问题。

## Cloudflare Pages 部署

项目包含 Pages Functions：

- `functions/api/[[path]].js`：代理 Gitee AI `/v1/*`
- `functions/dl.js`：代理图片 / 视频下载
- `functions/_middleware.js`：仅处理首页缓存策略，不再注入业务脚本

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

- `index.html`：页面与四类功能面板，并显式加载前端脚本
- `app.js`：原项目基础功能与兼容基线
- `multi-model.js`：多模型目录、模型切换、自定义模型、实验性模型同步与统一生成入口
- `js/runtime/model-runtime.js`：统一模型运行时，替代原来的多个 hotfix / workbench / video patch 文件
- `styles.css`：页面样式
- `functions/api/[[path]].js`：Gitee API 代理
- `functions/dl.js`：下载代理
- `functions/_middleware.js`：首页缓存控制
