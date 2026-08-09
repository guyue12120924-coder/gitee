# Image View v1.0 Release Checklist

## 当前候选版本

`1.0.0-rc.1` — 2026-08-09

Creator Studio 的核心功能、桌面 UI、性能清理与移动端专项已完成。当前进入最终外部验证，不再继续增加大型功能。

RC 回滚分支：`release/v1.0.0-rc.1`

## 仓库侧发布准备

- [x] `VERSION` 已固定为 `1.0.0-rc.1`。
- [x] README 已按当前 Creator Studio 架构重写并标注 RC 状态。
- [x] `CHANGELOG.md` 已记录 RC 功能、修复、验证边界与版本策略。
- [x] `docs/V1-RC1-REGRESSION-REPORT.md` 已记录代码级回归和外部验证边界。
- [x] `docs/RELEASE-NODE.md` 已记录 Runtime/UI freeze commit、RC metadata commit 与回滚分支。
- [x] `release/v1.0.0-rc.1` 已创建，作为完整 RC 树回滚点。
- [x] 正式版升级条件保持显式，不会在未完成外部验证时提前改写为 `1.0.0`。

## 自动 / 代码级检查

- [x] 模型 Registry / Adapter / Runtime 依赖顺序固定。
- [x] 旧 hotfix 文件保持删除，并由静态审计阻止重新引入。
- [x] 模型菜单按需构建，不在首屏创建全部模型 DOM。
- [x] Gallery / workflow Observer 只监听 Output 顶层节点。
- [x] 不使用长期 `document.body` MutationObserver。
- [x] History 抽屉关闭时不持续重建历史卡。
- [x] History 使用 `DocumentFragment + replaceChildren()` 批量提交 DOM。
- [x] 图片 lazy decode，视频仅 preload metadata。
- [x] API Key 在原始 HTML 中即为 password 输入。
- [x] 视频 accepted / 非可重试响应停止兼容重试，降低重复任务风险。
- [x] I2V / T2V 任务归属使用 payload / endpoint 辅助判断。
- [x] API Proxy 使用 Header allowlist 与 path segment 校验。
- [x] 下载代理验证 HTTPS、重定向与私有网络目标。
- [x] 移动端 `viewport-fit=cover`、`interactive-widget=resizes-content`、VisualViewport 和 safe-area 逻辑已接入。
- [x] 移动端增强层保持事件驱动，不新增 MutationObserver。
- [x] `VERSION` / `CHANGELOG.md` / README 版本信息由静态审计保持一致。

## 外部验证：桌面人工回归

这些项目需要真实浏览器交互，仓库静态检查不能代替。

建议至少检查 1366×768、1536×864、1920×1080：

- [ ] 四个工作流切换正常，Canvas 结果互不串页。
- [ ] 文生图模型菜单第一次打开正常，搜索和模型切换正常。
- [ ] 图像编辑：原图 / 参考图点击、拖拽、预览、移除正常。
- [ ] 图生视频：首帧上传、比例、清晰度、时长正常。
- [ ] 文生视频：比例和用户友好的视频时长正常，底层 frames 仍同步。
- [ ] Prompt 模板、本地增强、撤销正常。
- [ ] 单图 Focus、双图、3+ Gallery 布局正常。
- [ ] Lightbox 的编辑 / 生视频 / 下载操作正常。
- [ ] Task Drawer 能显示当前任务和轮询进度。
- [ ] History 第一次打开时正常加载；关闭抽屉生成新任务后，再打开能看到新记录。
- [ ] Settings 的 API Key、主题和开发者设置正常。
- [ ] 错误 API Key / 空 Prompt / 缺图片不会把模型永久标红。

## 外部验证：移动端 / 平板人工回归

建议使用浏览器 Device Toolbar 或真实设备检查：390×844、430×932、768×1024。

- [ ] 四工作流导航一行可操作，不横向溢出。
- [ ] Canvas 不被 Composer 大面积遮挡。
- [ ] “参数”按钮可以打开 Inspector Bottom Sheet。
- [ ] Bottom Sheet 可滚动，遮罩与关闭按钮正常。
- [ ] 手机软键盘弹出后 Prompt 与 Generate 仍可触达。
- [ ] 上传卡在窄屏不截断关键操作。
- [ ] 模型菜单不超出当前可视区域；首次打开不会强制弹出软键盘。
- [ ] Gallery 在手机切成单列。
- [ ] Drawer 在手机使用全屏宽度且内容可滚动。
- [ ] safe-area 设备底部不会挡住 Composer / Lightbox 操作。

## 外部验证：真实 Gitee API 冒烟测试

使用用户自己的 API Key，尽量采用最小请求；不要把 Key 写入仓库或 CI。

- [ ] 文生图：至少一个已知可工作的模型成功生成。
- [ ] 图像编辑：上传图片并完成一次编辑。
- [ ] 图生视频：Wan2.2 短任务完成一次。
- [ ] 文生视频：HunyuanVideo-1.5 短任务完成一次。
- [ ] 任务结束后 History 正常保存，刷新后仍存在。
- [ ] History “再次生成”能恢复模型 / Prompt / 参数；需要本地文件的工作流会正确提示重新上传。

## v1.0.0 发布条件

1. 上述桌面人工回归无 release blocker。
2. 390×844、430×932、768×1024 移动端回归通过。
3. 刷新页面、切主题、开关 Drawer 无卡死或无响应。
4. 至少完成一条图片与一条视频真实 API 冒烟链路。
5. 静态审计通过。
6. 不存在新的 broad subtree MutationObserver 或无限 DOM polling。
7. README 明确区分“Gitee 页面体验”与“直接 API 额度 / 计费规则”。

通过后将 `VERSION` 从 `1.0.0-rc.1` 提升为 `1.0.0`，并在 `CHANGELOG.md` 记录正式发布日期。

详细代码级检查记录见 `docs/V1-RC1-REGRESSION-REPORT.md`，运行时代码回滚点见 `docs/RELEASE-NODE.md`。
