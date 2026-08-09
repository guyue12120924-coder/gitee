# Image View · Gitee AI 多模型创作工作台

一个可直接部署到 Cloudflare Pages / Workers 的纯 HTML + JavaScript 多模态生成前端，统一通过 Gitee AI Serverless API 调用模型。

**当前版本：`v1.0.0-rc.1`**

当前代码已进入 v1 上线前冻结阶段：核心架构、桌面 Creator Studio、任务、历史、模型 Adapter 与移动端专项均已完成。`rc.1` 仍需要最后一轮真实浏览器移动端回归和用户 API 冒烟测试，通过后再提升为 `v1.0.0`。

## Creator Studio

主界面采用统一创作工作台：

```text
工作流导航
    ↓
Canvas 作品区  +  Inspector 参数区
    ↓
Prompt Composer
```

支持四个工作流：

- 文生图（Text-to-Image）
- 图像编辑（Image Edit）
- 图生视频（Image-to-Video）
- 文生视频（Text-to-Video）

主要交互：

- 每个工作流独立记忆自己的 Canvas 结果，不互相串页
- 图片单结果自动进入 Focus View，2 张双列，3+ 张 Gallery
- 图片可直接进入“编辑”或“生成视频”，无需先下载再上传
- 模型、比例、清晰度、时长等基础参数默认可见
- Seed、Steps、Guidance、FPS 等收进高级设置
- Endpoint、Extra JSON、Adapter 与诊断信息收进开发者设置
- Prompt 模板、本地增强、撤销
- 文生图支持最多 3 个模型的顺序对比生成
- Task / History / Settings 使用抽屉，不长期占据创作区

## 移动端

移动端有独立优化层，不是简单缩放桌面布局：

- 四工作流横向导航
- 参数 Inspector 使用 Bottom Sheet
- 支持安全区域 `safe-area-inset-*`
- 使用 `VisualViewport` 处理软键盘导致的可视高度变化
- Prompt 聚焦时尽量保证输入区与 Generate 可触达
- 手机模型菜单限制在当前可视区域内
- Gallery 自动单列
- Task / History / Settings Drawer 使用全屏宽度
- Lightbox 操作适配窄屏和底部安全区

建议发布前至少回归：`390×844`、`430×932`、`768×1024`。

## 模型架构

模型定义集中在：

```text
js/models/registry.js
```

Registry 负责：

- 模型 ID
- 工作流类型
- 推荐 / 备选分组
- 默认模型
- 状态
- 时长 / 参数限制
- Adapter 绑定

请求差异由 Adapter 层处理：

```text
js/adapters/adapter-registry.js
js/adapters/image-adapters.js
js/adapters/video-adapters.js
```

当前主要 Adapter：

- `qwen-image`
- `z-image`
- `generic-image`
- `qwen-edit`
- `generic-edit`
- `generic-video`
- `wan-i2v`
- `hunyuan-t2v`

以后新增普通模型，优先只在 Registry 增加条目并复用已有 Adapter；只有请求结构真正不同才新增 Adapter。

## 内置模型

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

### 图生视频

**推荐体验**

- ViduQ3-Pro
- ViduQ3-Turbo
- ViduQ2-Pro
- HappyHorse-1.1
- Wan2.7
- Wan2_2-I2V-A14B（原项目兼容链路）
- LTX-2

**备选**

- ViduQ2-Turbo
- HappyHorse-1.0

### 文生视频

**推荐体验**

- HunyuanVideo-1.5（原项目兼容链路）
- ViduQ3-Pro
- ViduQ3-Turbo
- Wan2.7
- Wan2.1-T2V-14B
- LTX-2

**备选**

- HappyHorse-1.1

`Duix-Avatar`、`InfiniteTalk`、`Duix.Heygem` 等偏数字人或音频驱动视频的模型没有混入普通 I2V/T2V 工作流。

> 上述视频模型可在 Gitee 当前视频生成页面进行体验。通过本项目直接调用 API 时，是否消耗体验额度或产生费用，以 Gitee 当前账户和 API 规则为准。

> Gitee AI 的模型上下线、精确 model ID、请求字段和 Endpoint 可能变化。项目保留自定义模型、Endpoint 覆盖和 Extra JSON，方便快速兼容新模型。

## 模型参数 UI

参数 UI 由 Adapter schema 动态生成，不再为每个模型复制一套固定表单。

示例：

- Qwen 文生图显示原生比例 / 尺寸映射
- 支持批量的图片模型显示数量 Stepper
- 通用视频默认显示比例、清晰度、时长
- Wan2.2 主界面显示“画面比例 + 清晰度 + 时长”，原始宽高 / frames 等放高级设置
- HunyuanVideo-1.5 主界面显示用户友好的“视频时长”，底层继续同步 `num_frames`
- 图像编辑的原图 / 参考图使用拖拽上传卡
- 图生视频的首帧图片优先于其他参数展示

`js/ui/model-parameter-ui.js` 负责从 Adapter schema 渲染参数，最终仍同步到兼容输入和已有请求逻辑。

## Task Center

每次真实生成都会创建本地任务记录，跟踪：

```text
准备参数
  ↓
提交请求
  ↓
兼容尝试（仅在明确可重试的格式/字段错误时）
  ↓
任务已创建
  ↓
排队 / 轮询
  ↓
服务端完成
  ↓
下载结果
  ↓
完成 / 失败
```

任务中心保存：

- 模型
- Endpoint
- 请求格式
- 请求次数
- `task_id`
- 轮询次数
- 耗时
- 最后错误
- 请求尝试摘要
- 调试响应

为了降低重复创建视频任务的风险，收到成功 / accepted 响应后不会继续盲目尝试其他请求格式；401 / 403 / 429 / 5xx 等也不会因为“换一个 payload”而自动重复提交。

“停止本地等待”仅停止浏览器继续轮询，不代表取消 Gitee 服务器上的任务。

## History

完成、失败或停止等待的任务会保存在浏览器 IndexedDB，默认最多 100 条；IndexedDB 不可用时会降级到 localStorage，并在恢复后合并去重。

历史记录包含：

- 工作流与模型
- Prompt
- Adapter 参数快照
- 自定义 Endpoint / Extra JSON
- 输入文件元数据
- 状态与耗时
- 请求 / 轮询次数
- `task_id`
- 结果 URL
- 最后错误

支持：

- 按任务类型 / 状态筛选
- 搜索模型、Prompt、`task_id`
- 导出 JSON
- 删除 / 清空
- 复制 Prompt / task_id
- 恢复历史参数再次生成

浏览器安全机制不允许自动恢复本地文件，因此图像编辑和图生视频的历史记录会恢复模型、Prompt 和参数，但仍需重新选择本地图片。

历史不会保存 API Key，也不会把完整图片 / 视频文件写入 IndexedDB。

## Prompt 与模型对比

Prompt Tools 提供：

- 文生图模板：人物摄影、电影画面、产品广告、动漫插画、建筑空间、文字海报等
- 图像编辑模板
- 图生视频镜头 / 动作模板
- 文生视频场景 / 镜头模板
- 本地 Prompt 增强
- 撤销

文生图可选择 2–3 个模型顺序对比。对比会产生多次真实 API 请求，执行前会确认；不会用并发洪泛方式一次提交全部模型。

## 自定义模型与实验同步

每个工作流都保留“自定义模型”，可以指定：

- Model ID
- Endpoint
- Extra JSON

模型同步是实验能力：

```text
GET /api/models
    ↓
Cloudflare Pages Function
    ↓
GET https://ai.gitee.com/v1/models
```

同步失败不会影响 Registry 内置模型。视频模型不会因为同步结果而自动全部加入普通视频菜单，避免数字人或不匹配任务类型的模型被误分类。

## API Proxy 与安全

默认代理：

```text
/api/* -> https://ai.gitee.com/v1/*
```

下载代理：

```text
/dl?url=...
```

安全处理包括：

- API Proxy 只转发 `Authorization`、`Content-Type`、`Accept`、`Range`
- API path 分段校验并重新编码
- 下载代理只允许公共 HTTPS 目标
- 阻止 localhost、私有 IPv4、环回、链路本地、CGNAT、literal IPv6 等目标
- 重定向逐跳重新验证
- 首页设置 `nosniff`、frame 限制、referrer policy 和 permissions policy
- API Key 在原始 HTML 阶段就是 password 输入，不等待 JS 后置隐藏

## 性能策略

v1 发布前已收敛开发期间的高开销行为：

- 模型菜单第一次打开时才构建完整选项 DOM
- Gallery Observer 只监听 `#output` 顶层节点
- 不再使用长期 `document.body` MutationObserver
- History 抽屉关闭时不持续重绘列表
- History 使用 `DocumentFragment + replaceChildren()` 批量更新
- 图片 `loading="lazy"` + `decoding="async"`
- 视频 `preload="metadata"`
- 等待 Task / History 挂载的临时 Observer 完成后立即断开
- 移动端增强层保持事件驱动，不引入新的 MutationObserver

## 前端加载顺序

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
  ↓
js/ui/workspace-layout.js
  ↓
js/ui/creation-tools.js
  ↓
js/ui/studio-extras.js
  ↓
js/ui/product-polish.js
  ↓
js/ui/workflow-polish.js
  ↓
js/ui/mobile-polish.js
```

第一阶段删除的 `multi-model-hotfix.js`、`model-workbench.js`、`video-duration-fix.js`、`video-catalog-fix.js` 保持删除，不应重新引入。

## 主要文件

- `VERSION`：当前发布版本
- `CHANGELOG.md`：版本变更记录
- `index.html`：基础 DOM、资源加载顺序与四工作流兼容输入
- `app.js`：原始兼容基线
- `multi-model.js`：多模型统一生成入口与兼容请求流程
- `js/models/registry.js`：Model Registry
- `js/adapters/adapter-registry.js`：Adapter 注册中心
- `js/adapters/image-adapters.js`：图片 / 编辑 Adapter
- `js/adapters/video-adapters.js`：视频 Adapter
- `js/runtime/model-runtime.js`：模型运行时与健康状态
- `js/runtime/task-tracker.js`：任务生命周期
- `js/storage/history-store.js`：持久化历史
- `js/ui/model-parameter-ui.js`：参数 schema 渲染
- `js/ui/task-center.js`：任务与错误中心
- `js/ui/history-center.js`：历史中心
- `js/ui/workspace-layout.js`：Creator Studio 骨架
- `js/ui/creation-tools.js`：Prompt Tools / 模型对比
- `js/ui/studio-extras.js`：创作交互增强
- `js/ui/product-polish.js`：Gallery / Model Picker / Settings
- `js/ui/workflow-polish.js`：编辑 / 视频工作流产品化
- `js/ui/mobile-polish.js`：移动端 Viewport / Bottom Sheet / Keyboard 逻辑
- `workspace.css`、`creation-tools.css`、`studio-extras.css`、`product-polish.css`、`workflow-polish.css`、`mobile-polish.css`：对应 UI 层样式
- `functions/api/[[path]].js`：Gitee API 代理
- `functions/dl.js`：安全下载代理
- `functions/_middleware.js`：缓存与基础安全响应头
- `scripts/static-check.mjs`：静态发布审计
- `docs/V1-RELEASE-CHECKLIST.md`：v1 发布回归清单

## Cloudflare Pages 部署

项目包含 Pages Functions，不需要前端构建步骤。

1. 将仓库连接到 Cloudflare Pages
2. Build command 留空
3. Output directory 使用仓库根目录 `/`
4. 部署 `main`
5. 部署完成后强制刷新浏览器

本地可使用：

```bash
wrangler pages dev .
```

静态审计：

```bash
node scripts/static-check.mjs
```

GitHub Actions 会在 `main` push 和 Pull Request 时自动运行同一套静态审计。

## v1 发布流程

当前：`1.0.0-rc.1`

发布 `v1.0.0` 前需要满足：

1. 桌面四工作流至少完整跑通一次
2. 390×844、430×932、768×1024 至少完成移动端 UI 回归
3. Prompt + 软键盘 + Generate 在手机上可触达
4. Bottom Sheet、模型菜单、Task / History / Settings Drawer 正常
5. History 刷新 / 再次生成正常
6. 静态审计通过
7. 无页面卡死、无限 DOM 轮询或 broad subtree Observer
8. 用户自己的 Gitee API Key 至少完成一次真实图片和视频短任务冒烟测试

详细检查项见 `docs/V1-RELEASE-CHECKLIST.md`。

版本约定：

- `1.0.x`：Bug / 兼容修复
- `1.1.x`：新模型、新 Adapter、新功能
- `2.x`：大型架构或工作流变更
