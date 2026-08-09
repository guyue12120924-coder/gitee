# Image View v1.0 Release Checklist

## 当前候选版本

`1.0.0-rc.1` — 2026-08-09

Creator Studio 的核心功能、桌面 UI、性能清理与移动端专项已完成。当前只剩真实设备与真实 Gitee API 的外部验证，不再继续增加大型功能。

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
- [x] GitHub Actions run `#100`：`Run static audit` = `success`。

## 自动浏览器回归

GitHub Actions run `#100` 通过 Chrome/Playwright 对当前 RC 做了无 API 的响应式交互回归。

### 桌面

- [x] `1366×768`
- [x] `1536×864`
- [x] `1920×1080`
- [x] 四工作流导航与状态切换。
- [x] Composer 不与 Inspector 重叠。
- [x] Edit / I2V 上传卡存在且位置正确。
- [x] Wan2.2 友好比例/清晰度控制可生成。
- [x] Hunyuan 用户友好视频时长控制可生成。
- [x] 单图 Focus、3+ Gallery 和 Lightbox。
- [x] Task / History / Settings Drawer 开关。

### 手机 / 平板视口

- [x] `390×844`
- [x] `430×932`
- [x] `768×1024`
- [x] 四工作流按钮不超出横向视口。
- [x] Prompt 聚焦后 Generate 仍在可视区域。
- [x] “参数”按钮可打开 / 关闭 Inspector Bottom Sheet。
- [x] Bottom Sheet 不超出视口宽度。
- [x] 模型菜单不超出视口，且首次打开不会强制聚焦搜索框。
- [x] Gallery / Lightbox / Drawers 基础交互通过。
- [x] 页面无 JavaScript page error、无本地资源缺失、无整体水平溢出。

## 外部验证：真实设备

Headless viewport 回归不能完整模拟手机操作系统软键盘、刘海 / Home Indicator safe-area 和原生文件选择器，因此以下项目仍建议在真实手机上确认：

- [ ] 真实软键盘弹出 / 收起后 Prompt 与 Generate 始终可触达。
- [ ] iPhone / Android 安全区不会挡住 Composer、Bottom Sheet 或 Lightbox 操作。
- [ ] 触控滚动和原生图片文件选择器体验正常。

## 外部验证：真实 Gitee API 冒烟测试

使用用户自己的 API Key，尽量采用最小请求；不要把 Key 写入仓库或 CI。

- [ ] 文生图：至少一个已知可工作的模型成功生成。
- [ ] 图像编辑：上传图片并完成一次编辑。
- [ ] 图生视频：Wan2.2 短任务完成一次。
- [ ] 文生视频：HunyuanVideo-1.5 短任务完成一次。
- [ ] 任务结束后 History 正常保存，刷新后仍存在。
- [ ] History “再次生成”能恢复模型 / Prompt / 参数；需要本地文件的工作流会正确提示重新上传。

## v1.0.0 发布条件

1. 自动静态审计和六档响应式浏览器回归通过。
2. 不存在新的 broad subtree MutationObserver 或无限 DOM polling。
3. README 明确区分“Gitee 页面体验”与“直接 API 额度 / 计费规则”。
4. 至少完成一条图片与一条视频真实 Gitee API 冒烟链路。
5. 正式稳定版前建议再做一次真实手机软键盘 / safe-area 检查。

前 3 项已经完成；第 4 项依赖用户自己的 Gitee API 凭据，第 5 项需要真实移动设备。通过后将 `VERSION` 从 `1.0.0-rc.1` 提升为 `1.0.0`，并在 `CHANGELOG.md` 记录正式发布日期。

详细记录见 `docs/V1-RC1-REGRESSION-REPORT.md` 与 `docs/RELEASE-NODE.md`。
