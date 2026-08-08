# Creator-first UI Redesign

日期：2026-08-08

这轮只重构界面和交互层，不修改现有模型 Registry、Adapter、API Proxy、生成请求、Task Tracker 或 History 数据结构。目标是把“功能很多的 API 工作台”变成“普通用户打开即可创作、高级功能按需展开”的 AI 创作界面。

## 设计原则

1. 一次只展示一个工作流。
2. 作品预览是页面视觉中心。
3. Prompt 和 Generate 始终在最容易触达的位置。
4. 模型与常用参数默认可见，Endpoint / JSON / 调试信息降级到第二层。
5. Task / History / API Key 不再长期占据主画布。
6. 不删除高级能力，只改变它们的默认可见性。
7. UI 重构不得复制第二套生成逻辑，所有生成仍调用现有按钮和 Runtime。

## 实施步骤

### Step 1 — Creator Studio 骨架 ✅

主界面改为：

- 左侧工作流 Rail
- 中部作品 Canvas
- 右侧参数 Inspector
- 底部 Prompt Composer

旧 `modelSel` 继续作为兼容状态源，但从主界面隐藏，左侧导航仍通过 change 事件驱动原逻辑。

### Step 2 — 工作流导航 ✅

四个主任务只保留短标签：

- 文生图
- 图像编辑
- 图生视频
- 文生视频

桌面使用纵向 Rail；移动端自动转为顶部四段式导航。

### Step 3 — 参数 Inspector ✅

现有模型选择器和 Adapter-driven 参数面板被移动到右侧 Inspector。

- 常用参数仍由 Adapter schema 生成
- 高级参数继续折叠
- Endpoint / Extra JSON 仍保留在“高级与诊断”中
- 模型健康检测与 Adapter 技术说明不再长期占据主界面
- 移动端参数区变成底部 Sheet

### Step 4 — Prompt Composer ✅

四个工作流的真实 Prompt textarea 和真实 Generate button 被移动到底部 Composer，而不是复制一份假输入。

这样可以保证：

- 原事件监听器继续工作
- History 恢复仍修改同一个 textarea
- Prompt Tools 仍作用于同一个输入框
- Ctrl/Cmd + Enter 可以直接生成

首轮实现曾在 Composer 再放一次快速模型下拉框。根据实际页面截图复盘后，这个重复入口已经删除：模型只在右侧 Inspector 选择，Composer 只负责 Prompt 与 Generate。

### Step 5 — Output Gallery ✅

Output 改为画廊式网格：

- 图片 / 视频成为视觉主体
- 原始 JSON 默认折叠到“调试信息”
- 图片点击打开 Lightbox
- 下载等原有操作继续保留

### Step 6 — Result Workflow Actions ✅

生成图片新增：

- 编辑
- 生成视频

前端会将当前生成图片转换为 File，通过 DataTransfer 填充原来的 file input，再切换到对应工作流。因此普通用户不需要“下载 → 找文件 → 再上传”。桌面端操作按钮只在作品 Hover 时出现，移动端保持常显。

### Step 7 — Task / History Drawers ✅

任务中心与历史记录从页面主体移到右侧抽屉。

截图复盘后进一步收敛为：

- Task：只保留顶栏入口，并显示活动任务数量
- History：桌面只保留左侧 Rail 入口；移动端在顶栏提供入口
- Settings：只保留顶栏入口

避免同一功能在顶栏和侧栏重复出现。

### Step 8 — Settings Drawer ✅

API Key 卡片移动到 Settings：

- Key 默认密码形式显示
- 显示 / 隐藏 Key
- 保存、清除、模型同步继续可用
- GitHub / 赞助入口移入设置，减少顶栏噪声

### Step 9 — Prompt Tools / Model Compare 降噪 ✅

Prompt 模板、本地增强、撤销仍在 Composer 内，但使用更轻的工具栏。

文生图模型对比保留 `<details>` 实现，但折叠时完全不占 Canvas 空间。Canvas 顶部使用一个轻量“对比”按钮按需展开；“清空输出”也合并到同一工具栏。

### Step 10 — Mobile / Tablet ✅

900px 以下：

- Rail 转成横向工作流切换
- Inspector 变成底部 Sheet
- Composer 固定在屏幕底部
- Task / History / Settings 使用抽屉
- Gallery 自动切为单列
- History 顶栏入口只在移动端显示

### Step 11 — UI 回归与静态审计 ✅ / 浏览器复核继续

静态检查已更新为 Creator Studio 结构，覆盖：

- 新 CSS / JS 是否被 index.html 正确加载
- 依赖顺序
- Rail / Inspector / Composer / Drawer 标记
- Output JSON 折叠
- Model Compare 默认折叠且折叠时不占空间
- Composer 不重复显示模型选择
- API Key 隐藏
- 图片结果直接送往 Edit / I2V
- Prompt 自动高度
- 移动端断点
- 原有 API、任务、历史、安全审计规则继续保留

真实浏览器仍需要部署后复核，特别是不同显示分辨率下的视觉比例与交互手感。

## 截图复盘后的视觉收敛 ✅

根据 1536px 桌面截图又完成了一轮以“减少视觉噪声”为目标的修改：

1. 顶栏压缩到约 56px，主题 / 任务 / 设置改为图标式入口。
2. 左 Rail 删除无实际导航意义的 AI 标记，并删除任务 / 设置重复入口，只保留四个工作流和历史。
3. Canvas 删除重复 Ready 状态，只保留工作流、当前模型、对比和清空两个轻工具。
4. 空状态移除大面积虚线框与过多说明文字。
5. Inspector 将 Adapter、model ID、Endpoint、模型诊断等技术信息统一放进“高级与诊断”。
6. Inspector 默认只强调模型、模型状态和 Adapter-driven 常用参数。
7. Composer 删除重复模型选择，默认高度压缩到约 54px 输入区 + 48px Generate，并根据内容自动增长。
8. Gallery 减少卡片边框，图片结果“编辑 / 生成视频”操作改成桌面 Hover 显示。
9. 浅色模式统一为 #F6F6F7 页面背景、白色 Inspector、#FAFAFA Canvas 和 Indigo 主强调色。
10. 整体通过背景层级和留白替代大量边框，降低“API 调试工具”感。

## 当前文件职责

```text
workspace.css
  Creator Studio 主布局、Canvas、Inspector、Composer、Drawer、Lightbox、响应式

js/ui/workspace-layout.js
  重排现有 DOM，但复用原控件与事件；负责工作流导航、Drawer、Composer、Gallery、Inspector 信息收敛

creation-tools.css
js/ui/creation-tools.js
  Prompt 模板 / 本地增强 / 撤销 / 折叠式模型对比

studio-extras.css
js/ui/studio-extras.js
  最终视觉收敛、图片结果直送、Prompt 自动高度、任务角标、快捷键、设置入口和轻量 Toast
```

这一轮不会重新引入 `xxx-hotfix.js`。界面层继续按照单一职责拆分，底层生成仍只有现有 Registry / Adapter / Runtime 一套逻辑。
