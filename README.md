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
- 模型参数由 Adapter schema 动态生成
- 生成任务中心显示请求、任务创建、轮询、下载、成功/失败和调试信息
- 完成任务自动写入浏览器生成历史，可筛选、搜索、导出、删除和复用参数
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

Gitee 当前公开文档未把该接口作为本项目必须依赖的稳定能力，因此不会在页面加载时自动请求。若接口或 Token 不支持，页面会继续使用内置精选模型；也可以直接使用“自定义模型”。自动同步只补充可安全归类的图像模型；普通视频模型继续由本地 Registry 精选，避免把数字人或不匹配 I2V/T2V 的模型误加入下拉框。

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

不同模型的请求参数通过 Adapter 层处理：

- `qwen-image`：Qwen 文生图原生尺寸桶与 JSON 兼容变体
- `z-image`：保留已验证 OpenAI 风格 `size=1024x1024`
- `generic-image`：通用图片参数与降级变体
- `qwen-edit` / `generic-edit`：区分 Qwen 编辑专属参数与通用编辑参数
- `generic-video`：Vidu / HappyHorse / Wan2.7 / LTX 等通用视频参数与 JSON 字段兼容
- `wan-i2v`：Wan2.2 I2V 原项目兼容、专用 Endpoint 与 5 秒分段能力
- `hunyuan-t2v`：HunyuanVideo-1.5 原项目已验证参数优先

模型本身的任务类型、推荐分组、默认模型、状态、时长范围和 Adapter 绑定统一写在 `js/models/registry.js`，不再散落在主运行文件中。

## 模型驱动参数 UI

模型参数不再依赖固定展示的 Wan / Hunyuan 表单，而由 Adapter 的 `parameters` schema 决定。

例如：

- Qwen 文生图只显示其原生尺寸桶
- z-image 显示分辨率与生成张数
- 通用视频模型显示比例、分辨率、时长，并把 Seed 等放到高级参数
- Wan2.2 显示自己的分辨率、宽高、时长、Seed，并保留 steps、guidance、FPS、frames、ZIP 等高级能力
- HunyuanVideo-1.5 显示自己的 ratio、frames、Seed、steps、FPS

`js/ui/model-parameter-ui.js` 负责把 schema 渲染为“常用参数 / 高级模型参数”，并同步到底层兼容输入，因此不会破坏已有请求逻辑。

## 生成任务与错误中心

每次点击文生图、编辑、图生视频或文生视频的执行按钮，都会创建一个本地任务记录，并跟踪：

```text
准备参数
  ↓
提交生成请求
  ↓
兼容重试（如有）
  ↓
任务已创建 / task_id
  ↓
排队 / 生成中（轮询次数 + 已耗时）
  ↓
服务端完成
  ↓
下载结果
  ↓
生成完成
```

如果失败，任务卡会保留最后的 HTTP 状态、Endpoint、请求格式、原始响应和请求尝试记录，并根据常见错误给出可读提示，例如：

- Token / 权限问题
- 额度或频率限制
- duration 时长范围错误
- size / resolution 尺寸错误
- image / first_frame 图片字段问题
- Endpoint / Method 不匹配
- 400 / 422 参数错误

失败任务支持“一键重新生成”和“复制错误”；异步视频任务还可复制 `task_id`。

“停止本地等待”只会停止当前网页继续轮询，不会向 Gitee 发出远端取消任务请求，因此服务端任务可能仍继续生成。

## 持久化生成历史

第五阶段新增浏览器本地历史记录。任务进入成功、失败或停止等待状态后，会自动保存到 IndexedDB，默认最多保留 100 条。

历史记录包含：

- 任务类型与模型 ID
- Prompt
- Adapter 参数快照
- 自定义 Endpoint / 附加 JSON
- 输入文件的文件名、类型和大小（只保存元数据，不保存文件内容）
- 成功 / 失败 / 停止等待状态
- 生成耗时
- request / polling 次数
- `task_id`
- 最后错误与请求尝试摘要
- API 响应中可恢复的结果 URL

历史中心支持：

- 按任务类型筛选
- 按成功 / 失败状态筛选
- 按模型、Prompt、`task_id` 搜索
- 复制 Prompt / `task_id`
- 删除单条或清空全部历史
- 导出 JSON
- “再次生成”：恢复模型、Prompt、模型参数、Endpoint 与附加 JSON

对于文生图和文生视频，历史参数恢复后可确认并直接重新提交；对于图像编辑和图生视频，由于浏览器安全限制不能自动恢复本地文件，页面会恢复其它参数并提示重新上传图片。

历史模块不会保存 API Key，也不会把生成出的图片或视频文件本体写入 IndexedDB。若 API 返回的结果 URL 后续失效，历史中的“打开结果”也可能无法继续访问。

## 运行时验证说明

模型“在 Gitee Serverless 模型广场存在”不等于“所有模型共享完全相同的请求字段”。原项目的 `Wan2_2-I2V-A14B` 与 `HunyuanVideo-1.5` 有已有调用逻辑；Vidu、LTX、Wan 2.7、HappyHorse 等新增模型仍应以 Gitee 当前模型页提供的 API 示例为最终依据。页面会显示具体 HTTP 错误，便于继续做模型级适配。

## 前端运行时结构

第五阶段完成后，前端加载顺序固定为：

```text
app.js
  ↓
js/models/registry.js
  ↓
js/adapters/adapter-registry.js
  ↓
js/adapters/image-adapters.js
  ↓
js/adapters/video-adapters.js
  ↓
multi-model.js
  ↓
js/runtime/model-runtime.js
  ↓
js/ui/model-parameter-ui.js
  ↓
js/runtime/task-tracker.js
  ↓
js/storage/history-store.js
  ↓
js/ui/task-center.js
  ↓
js/ui/history-center.js
```

职责划分：

- `app.js`：原项目基础 UI、主题、预览和已验证旧链路，作为兼容基线
- `js/models/registry.js`：唯一模型目录，记录任务、分组、默认模型、状态、限制和 Adapter ID
- `js/adapters/adapter-registry.js`：Adapter 注册与模型到 Adapter 的解析入口
- `js/adapters/image-adapters.js`：Qwen、z-image、通用图像和图像编辑适配
- `js/adapters/video-adapters.js`：通用视频、Wan I2V、Hunyuan T2V 适配
- `multi-model.js`：模型选择、自定义模型、生成流程与模型同步；不再维护一份重复模型清单
- `js/runtime/model-runtime.js`：健康状态、请求重试、时长校正、Loading 和 Wan 分段等运行时能力
- `js/ui/model-parameter-ui.js`：由 Adapter schema 动态生成参数面板
- `js/runtime/task-tracker.js`：跟踪生成按钮、API 请求、task_id、轮询、结果下载和任务状态
- `js/storage/history-store.js`：IndexedDB 历史存储、100 条上限与 localStorage 降级
- `js/ui/task-center.js`：实时进度卡、错误解释、请求尝试、复制 task_id / 错误、重新生成和停止本地等待
- `js/ui/history-center.js`：历史筛选、搜索、导出、删除和参数复用

第一阶段删除的 `multi-model-hotfix.js`、`model-workbench.js`、`video-duration-fix.js`、`video-catalog-fix.js` 保持删除状态。

## 新增模型的推荐方式

以后新增普通模型时，优先只做两件事：

1. 在 `js/models/registry.js` 增加模型条目，并绑定已有 Adapter。
2. 只有当请求结构真的不同，才在 `js/adapters/` 新增或扩展 Adapter。

例如一个新的通用文生图模型通常只需：

```js
{
  id: "New-Image-Model",
  label: "New-Image-Model",
  adapter: "generic-image",
  group: "more"
}
```

不需要再修改请求主流程。

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

- `index.html`：页面与四类功能面板，并显式按依赖顺序加载前端脚本
- `app.js`：原项目基础功能与兼容基线
- `js/models/registry.js`：集中模型 Registry
- `js/adapters/adapter-registry.js`：Adapter 注册中心
- `js/adapters/image-adapters.js`：图像/编辑 Adapter
- `js/adapters/video-adapters.js`：视频 Adapter
- `multi-model.js`：多模型 UI、统一生成入口和实验性同步
- `js/runtime/model-runtime.js`：统一模型运行时
- `js/ui/model-parameter-ui.js`：模型驱动参数 UI
- `js/runtime/task-tracker.js`：生成任务生命周期跟踪
- `js/storage/history-store.js`：持久化生成历史
- `js/ui/task-center.js`：任务进度与错误中心
- `js/ui/history-center.js`：历史记录中心
- `styles.css`：页面基础样式
- `functions/api/[[path]].js`：Gitee API 代理
- `functions/dl.js`：下载代理
- `functions/_middleware.js`：首页缓存控制
