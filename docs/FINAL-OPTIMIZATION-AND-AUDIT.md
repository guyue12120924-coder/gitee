# Final Optimization & Audit

日期：2026-08-08

本轮是在 Stage 1–6 完成后的最终功能增强和代码审计。目标不是继续扩大模型数量，而是提高实际创作效率、减少误提交、增强调试能力，并修复前几阶段组合后暴露出的边界问题。

## 最终功能增强

### Prompt Tools

四类工作流都增加了本地 Prompt 工具：

- 文生图：人物摄影、电影画面、产品广告、动漫插画、建筑空间、文字海报
- 图像编辑：移除物体、更换背景、风格迁移、局部改色
- 图生视频：自然微动、缓慢推进、环绕镜头、广告动效
- 文生视频：电影运镜、人物叙事、自然风景、商业广告

“本地增强”根据任务类型补充质量、构图、运动连续性或编辑约束，不调用额外 AI API。每个工作流保留一个小型撤销栈，方便恢复增强前的 Prompt。

### 文生图模型对比

文生图工作流增加 2–3 模型顺序对比：

- 默认优先选择 Qwen-Image-2512 与 z-image-turbo
- 只从 Registry 的推荐/快速模型中展示候选
- 一次最多选择 3 个模型
- 对比前明确提示会真实提交多次 API 请求
- 每个模型强制单张生成，避免对比任务意外放大请求量
- 顺序执行，上一模型完成后才提交下一模型
- 单个模型等待超时后停止后续对比，不盲目继续提交
- 结果仍进入原 Output、Task Tracker 与 History，不建立第二套生成链路

## 审计中修复的问题

### 1. 防止兼容重试产生重复任务

旧视频/编辑兼容逻辑只有在识别到 `task_id` 或结果 URL 时才停止。如果服务端已经接受请求并返回非标准 2xx 结构，前端可能继续换 Endpoint/请求格式重试，存在重复创建计费任务的风险。

现在规则改为：

- 任意 2xx/202 响应立即停止兼容重试
- 401/403/429/5xx 等非参数类错误不自动换格式重试
- 只对明确的 400/404/405/415/422 参数、字段、Endpoint、媒体类型问题尝试兼容变体
- 已接受但返回结构无法识别时，直接展示原始响应，提示人工适配，不再提交第二个任务

### 2. 修复共享视频模型的任务归属

ViduQ3-Pro、ViduQ3-Turbo、Wan2.7、LTX-2 等模型可同时出现在 I2V/T2V。旧逻辑仅根据 model ID 推断任务，可能把 T2V 请求归到 I2V。

现在根据 URL + payload 判断：

- `image` / `first_frame` / `image_url` 存在 => I2V
- 普通视频 JSON 且无图片字段 => T2V

Task Tracker 与 Adapter Runtime 都统一使用这种判断方式。

### 3. 修复任务取消后的状态污染

任务到达终态后，Task Tracker 不再接受后续 stage 更新。停止本地等待也不会继续把任务改成 polling/downloading。

模型健康状态同时忽略以下非模型故障：

- 用户主动停止本地等待
- 尚未真正发送 API 请求的输入校验错误
- API Key / 401 / 403
- 429 / quota / 余额或额度问题
- 网络错误和本地等待超时

避免把“没上传图片”“Token 失效”“用户取消”等问题误标成模型本身不可用。

### 4. 修复任务下载归属

并发任务下载时，不再无条件把 `/dl?url=` 归给“最近启动的任务”。Task Tracker 会优先根据目标结果 URL 匹配对应 run，减少并行任务状态串线。

### 5. 修复历史存储降级丢记录

旧逻辑在 IndexedDB 单次写入失败、但后续 IndexedDB 又恢复时，会只读取 IndexedDB，从而忽略 localStorage 降级记录。

现在：

- 每次读取都会合并 IndexedDB 与 localStorage fallback
- 按 run ID 去重
- 成功写入 IndexedDB 后清理同 ID 的 fallback 副本
- 删除历史时同时清理两个存储
- trim 同时控制两种存储，最多保留 100 条

### 6. 修复任务中心“重新生成”上下文错误

旧任务卡的“重新生成”只是点击当前页面按钮；如果用户已经切换模型或修改 Prompt，它并不是真正重试原任务。

现在失败/停止任务会优先从 History 恢复：

- 工作流
- 模型
- Prompt
- Adapter 参数
- Endpoint
- 附加 JSON

图像编辑和图生视频仍要求重新上传本地文件，这是浏览器安全限制；文生视频重新提交前额外确认可能产生的额度/费用。

### 7. 修复 Stage 6 预览工具栏 sticky 失效

Stage 6 在 Output 卡片顶部插入了 preview summary，而旧 CSS 仍使用 `.row:first-child`，导致输出工具栏实际上不再是第一个子元素，sticky 样式失效。

最终样式改为按 summary / compare panel 后的工具栏结构匹配，并在移动端恢复 static。

### 8. 修复模型健康详情的 DOM 注入风险

模型健康详情可能来自服务端错误文本。旧实现曾使用 HTML 字符串拼接显示状态。

现在状态标题与详情都通过 `textContent` / `replaceChildren` 渲染，服务端文本不会作为 HTML 执行。

### 9. 加固 API Proxy 请求头

`functions/api/[[path]].js` 不再复制整个浏览器请求头。只向 Gitee API 转发：

- Authorization
- Content-Type
- Accept
- Range

避免 Cookie、Referrer、Cloudflare 元数据和其它站点请求头被不必要地发送到上游。

### 10. 加固下载代理

旧 `/dl?url=` 可以访问任意 HTTP(S) 地址，是一个过宽的服务器端下载代理。

现在：

- 只允许 HTTPS
- 拒绝 localhost / `.local`
- 拒绝私有、环回、链路本地、CGNAT、保留 IPv4
- 拒绝 literal IPv6 目标
- 最多手动跟随 5 次重定向
- 每次重定向都重新校验目标

这不能替代网络层 DNS 安全策略，但显著缩小了公开代理攻击面。

### 11. 首页基础安全响应头

首页 Middleware 增加：

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy` 禁用 camera / microphone / geolocation / payment

暂未强制 CSP，因为当前页面仍有内联脚本，以及 Wan 分段 ZIP 会按需加载固定版本 JSZip；贸然加 CSP 会破坏现有功能。

## 自动静态审计

新增：

- `scripts/static-check.mjs`
- `.github/workflows/static-check.yml`

静态审计覆盖：

- 所有 JS/MJS 的 `node --check`
- index.html 本地资源存在性
- 静态 HTML ID 重复
- 前端脚本依赖顺序
- 已删除 legacy hotfix 不得重新出现
- Task Tracker 终态保护和任务归属辅助函数
- History 双存储合并
- Adapter Runtime I2V/T2V payload 判定
- 模型健康安全 DOM 渲染
- 模糊 2xx 响应不得继续创建任务
- Prompt compare 最大模型数与真实请求确认
- 下载代理 HTTPS/redirect/private-IP 保护
- API Proxy header allowlist
- Stage 6 sticky toolbar 修复

Workflow 在 `main` push 与 Pull Request 时运行。运行状态仍应以 GitHub Actions 页面实际结果为准。

## 仍需真实 API 冒烟测试的部分

本次审计可以验证代码结构和静态行为，但没有使用用户 API Key 真实调用 Gitee。因此以下项目仍需要部署后用实际账户确认：

1. z-image-turbo / Qwen-Image-2512 各生成 1 张图
2. Qwen-Image-Edit-2511 完成一次编辑
3. Wan2.2-I2V-A14B 完成一次短视频
4. HunyuanVideo-1.5 完成一次短视频
5. 任选一个 Vidu/HappyHorse/Wan2.7 模型验证当前 Gitee API schema
6. 文生图 2 模型对比完整跑通
7. 刷新页面确认 History 仍存在，并用“再次生成”恢复参数
8. 停止一次异步视频本地等待，确认模型健康状态不会被误标为失败

## 最终模块层次

```text
Base UI / Compatibility
  app.js
      ↓
Model Registry
  js/models/registry.js
      ↓
Adapters
  js/adapters/*
      ↓
Generation Core
  multi-model.js
      ↓
Runtime
  js/runtime/model-runtime.js
  js/runtime/task-tracker.js
      ↓
Storage
  js/storage/history-store.js
      ↓
UI
  js/ui/model-parameter-ui.js
  js/ui/task-center.js
  js/ui/history-center.js
  js/ui/workspace-layout.js
  js/ui/creation-tools.js
```

最终阶段继续沿用 Registry / Adapter / Runtime / UI 分层，没有重新引入 `xxx-hotfix.js` 形式的补丁文件。
