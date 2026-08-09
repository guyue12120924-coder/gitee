# Image View v1.0 Release Checklist

## 当前阶段

Creator Studio 的核心功能与桌面 UI 已稳定，当前进入 v1.0 上线前收尾：性能、移动端和回归测试优先，不再继续堆叠大型功能。

## 本轮性能清理

- 模型选择器改为按需构建：首屏只渲染当前模型摘要，用户第一次打开模型菜单时才创建完整模型列表和搜索控件。
- Gallery 观察器只监听 `#output` 的顶层新增/删除，不再监听整个结果卡子树。
- Lightbox 操作不再依赖长期 `document.body` MutationObserver。
- Workspace 用于等待 Task / History 面板的临时 Observer 在完成挂载后立即断开。
- History 在抽屉关闭时不持续重建 50 条历史卡；首次打开或数据变更且抽屉可见时再刷新。
- History DOM 使用 `DocumentFragment + replaceChildren()` 批量提交，搜索 debounce 状态保持模块内，不再写到 `window`。
- 生成图片使用 `loading=lazy` 和 `decoding=async`；生成视频只预加载 metadata。
- 隐藏的赞助二维码使用 lazy loading，避免进入首页时抢占首屏资源。
- API Key 在原始 HTML 阶段即为 password 输入，避免等待增强脚本后才隐藏。

## 桌面回归

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

## 移动端回归

建议使用浏览器 Device Toolbar 检查：390×844、430×932、768×1024。

- [ ] 四工作流导航一行可操作，不横向溢出。
- [ ] Canvas 不被 Composer 大面积遮挡。
- [ ] “参数”按钮可以打开 Inspector Bottom Sheet。
- [ ] Bottom Sheet 可滚动且关闭按钮可见。
- [ ] 手机软键盘弹出后 Prompt 与 Generate 仍可触达。
- [ ] 上传卡在窄屏不截断文件名或按钮。
- [ ] 模型菜单不超出屏幕。
- [ ] Gallery 在手机切成单列。
- [ ] Drawer 在手机使用全屏宽度且内容可滚动。
- [ ] safe-area 设备底部不会挡住 Composer。

## v1.0 发布条件

满足以下条件后再打 v1.0 稳定版：

1. 桌面四工作流完整跑通一次。
2. 至少一个 390px 手机视口完成 UI 回归。
3. 刷新页面、切主题、开关 Drawer 无卡死或无响应。
4. History 刷新与再次生成正常。
5. 静态审计保持通过。
6. 不存在新的 broad subtree MutationObserver 或无限 DOM polling。
7. README 明确标注已验证模型与“页面免费体验 / API 额度规则”区别。

通过后，后续改动按语义化版本管理：Bug 修复进入 v1.0.x，新功能进入 v1.1.x，大型架构变化再进入 v2.x。
