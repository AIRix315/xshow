# XShow — 开源参考项目与复用指南

> 📎 **项目路径**: `E:\projects\XShow`
> 📎 **配套方案**: [01-1-reverse-engineering-plan-v2.md](./01-1-reverse-engineering-plan-v2.md)

## 一、参考项目总览

| 项目 | GitHub | Stars | 技术栈 | 许可证 | 相关度 |
|------|--------|-------|--------|--------|--------|
| **node-banana** | [shrimbly/node-banana](https://github.com/shrimbly/node-banana) | ⭐ 1374 | React + @xyflow/react + Zustand + Gemini + Tailwind | MIT | 🟢 极高 |
| **flowcraft** | [mblanc/flowcraft](https://github.com/mblanc/flowcraft) | ⭐ 1 | Next.js + @xyflow/react 12.10 + Gemini + Zustand + shadcn/ui | Apache-2.0 | 🟢 极高 |
| **FlowForge AI** | [0xDaniiel/flowforge-ai](https://github.com/0xDaniiel/flowforge-ai) | ⭐ 28 | Next.js + React Flow + Zustand + Tailwind | MIT | 🟡 高 |
| **Tersa** | [vercel-labs/tersa](https://github.com/vercel-labs/tersa) | ⭐ 961 | Next.js + React Flow + AI SDK Gateway | - | 🟡 高 |
| **nodetool** | [nodetool-ai/nodetool](https://github.com/nodetool-ai/nodetool) | ⭐ 301 | Electron + React Flow + Python 后端 | - | 🟡 中 |

> **最高优先级参考**: node-banana（架构最接近、MIT 许可、功能覆盖最广）
> **版本精确参考**: flowcraft（使用与产物完全相同的 @xyflow/react 12.10）

---

## 二、按模块对照：可参考 / 可复用 / 需自实现

### 图例说明

- 🔄 **可复用** — 代码结构可直接借鉴或移植，只需适配调整
- 📖 **可参考** — 实现思路可借鉴，但代码需按一毛逻辑重写
- 🔧 **需自实现** — 一毛独有功能，无开源参考，需从产物反推

---

### 2.1 React Flow 画布主体

| 功能点 | node-banana | flowcraft | FlowForge AI | 复用级别 |
|--------|------------|-----------|-------------|---------|
| **画布初始化 + ReactFlowProvider** | `WorkflowCanvas.tsx` (2322 行) | `flow-canvas.tsx` | `FlowCanvas.tsx` | 🔄 可复用 |
| **自定义节点注册** | `nodes/index.ts` (24 种节点) | `node-registry.ts` | 内联注册 | 🔄 可复用 |
| **拖拽添加节点** | `WorkflowCanvas.tsx` 内 | `flow-canvas.tsx` | `FlowCanvas.tsx` | 🔄 可复用 |
| **节点连线 (Handle/Edge)** | `BaseNode.tsx` 中统一 Handle | 各节点独立 Handle | 各节点独立 | 📖 可参考 |
| **NodeResizer** | `BaseNode.tsx` 内嵌 | 各节点内嵌 | 未使用 | 🔄 可复用 |
| **screenToFlowPosition** | `WorkflowCanvas.tsx` | `flow-canvas.tsx` | `FlowCanvas.tsx` | 🔄 可复用 |
| **fitView** | 初始化时调用 | 初始化时调用 | 初始化时调用 | 🔄 可复用 |
| **Group 节点自动调整** | — | — | — | 🔧 需自实现 |
| **边动画 (animated)** | `WorkflowCanvas.tsx` | `flow-canvas.tsx` | 未使用 | 📖 可参考 |
| **右键菜单** | `WorkflowCanvas.tsx` | — | — | 📖 可参考 |

**关键参考文件**:
- node-banana: `src/components/WorkflowCanvas.tsx` — 完整的画布实现，2322 行，涵盖拖拽、连线、执行、缩放等所有功能
- node-banana: `src/components/nodes/BaseNode.tsx` (333 行) — 所有节点的基类，包含 NodeResizer、执行状态、设置面板
- flowcraft: `components/canvas/flow-canvas.tsx` — 核心画布上下文组件
- flowcraft: `lib/node-registry.ts` — 节点注册表

**一毛独有 → 需自实现**:
- Group 节点拖拽自动调整（产物行 50，监听 nodes 变化计算子节点边界框）
- 边的 `animated` 属性随节点加载状态切换

---

### 2.2 自定义节点实现

| 一毛节点 | node-banana 对应节点 | flowcraft 对应节点 | 复用级别 |
|---------|---------------------|-------------------|---------|
| **ImageNode (图片生成)** | `GenerateImageNode.tsx` (857 行) | `image-node.tsx` | 🔄 可复用 |
| **TextNode (文本生成)** | `LLMGenerateNode.tsx` | `llm-node.tsx` | 📖 可参考 |
| **VideoNode (视频生成)** | `GenerateVideoNode.tsx` | `video-node.tsx` | 🔄 可复用 |
| **AudioNode (听音断句 + TTS)** | `GenerateAudioNode.tsx` | — | 📖 可参考 |
| **GridSplitNode (九宫格分拆)** | `SplitGridNode.tsx` | — | 🔄 可复用 |
| **GridMergeNode (九宫格合拼)** | — | — | 🔧 需自实现 |
| **CropNode (图片裁剪)** | — | — | 🔧 需自实现 |
| **UniversalNode (万能节点)** | — | — | 🔧 需自实现 |

**详细说明**:

#### ImageNode 🔄 可复用
- node-banana 的 `GenerateImageNode.tsx`: 多 Provider 支持、模型选择、宽高比配置、参考图上传
- flowcraft 的 `image-node.tsx`: Gemini 3 Pro / 2.5 Flash Image，宽高比、分辨率
- **一毛差异**: 预设词下拉、@素材绑定、发送到网站按钮 → 需在 node-banana 基础上扩展
- **建议**: 以 `GenerateImageNode.tsx` 为骨架，参照产物添加预设词和素材绑定

#### TextNode 📖 可参考
- node-banana 的 `LLMGenerateNode.tsx`: Gemini/OpenAI/Anthropic 文本生成
- flowcraft 的 `llm-node.tsx`: Gemini 文本生成 + 工具 + JSON 输出
- **一毛差异**: autoSplit（自动拆分文本为子节点）→ node-banana 无此功能
- **建议**: 参考 `LLMGenerateNode.tsx` 的基础结构，autoSplit 逻辑从产物反推

#### VideoNode 🔄 可复用
- node-banana 的 `GenerateVideoNode.tsx`: 视频 API 调用
- flowcraft 的 `video-node.tsx`: Veo 3.1 Fast/Pro
- **一毛差异**: 时长选择下拉、进度追踪、thumbnail 显示 → 可从 node-banana 基础上扩展
- **建议**: 以 `GenerateVideoNode.tsx` 为骨架

#### AudioNode 📖 可参考
- node-banana 的 `GenerateAudioNode.tsx`: TTS 音频生成
- **V2 双模式**: (1) 听音断句 — 上传音频 → Whisper 转录 → 分句结果；(2) TTS — 输入文本 → 语音 API → 生成音频
- **建议**: 参考 node-banana 的音频节点 UI 结构，业务逻辑从产物反推

#### GridSplitNode 🔄 可复用
- node-banana 的 `SplitGridNode.tsx`: 将图片切割为网格
- **建议**: 复用 `SplitGridNode.tsx` 的 UI 和 Handle 结构

#### GridMergeNode 🔧 需自实现
- **无开源对应物** — 将多张子图合拼为一张九宫格大图
- **建议**: 反向于 GridSplitNode，从产物反推实现

#### UniversalNode 🔧 需自实现
- **无任何开源对应物** — 这是"一毛AI画布"最独特的节点
- 功能：自定义 API 配置、`{{变量}}` 模板、同步/异步执行、AI 辅助配置
- **实现策略**: 从产物代码反推（行 37-90，逻辑完全可读），分阶段实现：
  1. 先实现同步模式（简单 fetch + resultPath 提取）
  2. 再叠加异步模式（轮询）
  3. 最后叠加 AI 辅助配置

---

### 2.3 API 调用层

| 功能点 | node-banana | flowcraft | 复用级别 |
|--------|------------|-----------|---------|
| **Gemini 图片生成** | API Route `/api/generate` + `@google/generative-ai` | `executors.ts` + Vertex AI | 🔄 可复用 |
| **多 Provider 抽象** | `lib/providers/index.ts` (201 行) 工厂模式 | — | 🔄 可复用 |
| **OpenAI 文本** | `LLMGenerateNode.tsx` 内调用 | `llm-node.tsx` | 📖 可参考 |
| **视频生成 + 轮询** | `GenerateVideoNode.tsx` + 执行器 | `video-node.tsx` | 📖 可参考 |
| **Provider 接口定义** | `lib/providers/types.ts` (ProviderType, ProviderInterface) | — | 🔄 可复用 |

**关键参考文件**:
- node-banana: `src/lib/providers/index.ts` — Provider 注册工厂，`getProvider()` / `getConfiguredProviders()`
- node-banana: `src/lib/providers/types.ts` — 接口定义，ProviderType / ProviderInterface / ProviderModel
- node-banana: `src/lib/providers/fal.ts` / `replicate.ts` / `wavespeed.ts` — 具体 Provider 实现
- flowcraft: `lib/executors.ts` — Vertex AI 执行层

**一毛差异**: 
- 一毛不用 Provider 工厂模式，而是用户自定义 API URL + Key（更灵活）
- 一毛的"万能节点"本质上是一个"任意 Provider"适配器
- **建议**: 不采用 node-banana 的 Provider 工厂，但参考其接口定义设计万能节点的 outputType 逻辑

---

### 2.4 Zustand 状态管理

| 功能点 | node-banana | flowcraft | FlowForge AI | 复用级别 |
|--------|------------|-----------|-------------|---------|
| **核心 Store** | `workflowStore.ts` (2652 行) | `use-canvas-store.ts` + `use-flow-store.ts` | `flowStore.ts` | 📖 可参考 |
| **nodes/edges 管理** | `workflowStore.ts` 内 | `graph-slice.ts` | `flowStore.ts` 内 | 🔄 可复用 |
| **undo/redo** | `undoHistory.ts` | — | — | 📖 可参考 |
| **执行状态** | `execution/` 目录 | `workflow-engine.ts` | `simulateFlow()` | 📖 可参考 |
| **API Keys 管理** | `workflowStore.ts` 内 | Project Settings | — | 📖 可参考 |
| **Slice 模式** | — | `graph-slice.ts` + `ui-slice.ts` | — | 🔄 可复用 |

**关键参考文件**:
- node-banana: `src/store/workflowStore.ts` — 巨型 Store，管理一切
- flowcraft: `lib/store/` 目录 — 切分为多个 Slice（graph-slice、ui-slice）
- FlowForge AI: `stores/flowStore.ts` — 精简版，适合学习基础结构

**V2 差异**:
- V2 Store 管理：channels（通道配置）、apiConfig（4 类 API 通道选择 + 模型）、projects（项目）、customNodeTemplates（万能节点模板）、globalTasks（异步任务）
- **不再包含**: accounts（多开环境）、membership（会员系统）
- **建议**: 采用 flowcraft 的 Slice 模式拆分，而非 node-banana 的巨型 Store

---

### 2.5 节点执行引擎

| 功能点 | node-banana | flowcraft | FlowForge AI | 复用级别 |
|--------|------------|-----------|-------------|---------|
| **拓扑排序执行** | `execution/index.ts` | `workflow-engine.ts` | `simulateFlow()` | 🔄 可复用 |
| **单节点执行** | `execution/executeNode.ts` | `executors.ts` | 内联逻辑 | 📖 可参考 |
| **批量执行** | `execution/batchExecution.ts` | `workflow-engine.ts` | — | 📖 可参考 |
| **BFS 依次运行** | — | — | — | 🔧 需自实现 |
| **执行高亮** | — | — | `highlightedNodeId` | 🔄 可复用 |

**关键参考文件**:
- node-banana: `src/store/execution/` 目录 — 最完整的执行引擎
- flowcraft: `lib/workflow-engine.ts` — 并行执行器 + 拓扑排序
- FlowForge AI: `stores/flowStore.ts` 中 `simulateFlow()` — 最简单的串行执行

**一毛差异**:
- 一毛使用 BFS 按层依次运行（产物行 91-93），而非纯拓扑排序
- 一毛支持 autoSplit 生成子节点后继续执行
- **建议**: 参考 node-banana 的执行器结构，BFS 逻辑从产物反推

---

### 2.6 Chrome Extension 架构

| 功能点 | 参考项目 | 复用级别 |
|--------|---------|---------|
| **Manifest V3 + Side Panel** | [GoogleChrome/chrome-extensions-samples](https://github.com/GoogleChrome/chrome-extensions-samples) `cookbook.sidepanel-open` | 🔄 可复用 |
| **Side Panel + React SPA** | [AIPexStudio/AIPex](https://github.com/AIPexStudio/AIPex) | 🔄 可复用 |
| **Vite 构建扩展** | [jonghakseo/chrome-extension-boilerplate-react-vite](https://github.com/jonghakseo/chrome-extension-boilerplate-react-vite) | 🔄 可复用 |
| **通道配置管理** | — | — | 🔧 需自实现 |
| **资源中转站** | — | 🔧 需自实现 |
| **右键菜单 → Side Panel** | 原产 `background.js` 直接复用 | 🔄 可复用 |

**关键参考项目**:
- chrome-extensions-samples: `functional-samples/cookbook.sidepanel-open/service-worker.js` — Google 官方示例
- AIPex: Chrome Extension + Side Panel + React + Vite 的完整实现
- boilerplate-react-vite: Vite + React + Chrome Extension MV3 的脚手架

**V2 独有 → 需自实现**:
- **通道配置管理**: ChannelConfig {id, name, url, key} 供应商配置 + 4 类 API 通道选择 → 纯 API 端点，无 Cookie
- **资源中转站**: 右键保存 → chrome.storage → Side Panel 读取 → @绑定到节点
- **发送图片到网站**: `chrome.scripting.executeScript` → 将图片注入当前标签页

---

### 2.7 UI / 样式

| 功能点 | 参考来源 | 复用级别 |
|--------|---------|---------|
| **Tailwind CSS v4 配置** | 一毛产物 `index-BoJrPcWC.css` 头部 | 🔄 可复用 |
| **深色主题变量** | 一毛产物中完整 CSS 变量 | 🔄 可复用 |
| **lucide-react 图标** | 产物中使用的所有图标名可读 | 🔄 可复用 |
| **custom-scrollbar** | 产物中 CSS 样式 | 🔄 可复用 |
| **Toast 组件** | node-banana / flowcraft 均有 | 📖 可参考 |
| **nodrag / drag-handle** | React Flow 标准模式 | 🔄 可复用 |

---

## 三、复用策略矩阵

> 🔄 = 可复用 | 📖 = 可参考 | 🔧 = 需自实现

| 模块 | node-banana | flowcraft | FlowForge AI | Chrome 示例 | 产物反推 |
|------|:-----------:|:---------:|:------------:|:----------:|:-------:|
| 画布主体 | 🔄 | 🔄 | 📖 | — | 📖 |
| ImageNode | 🔄 | 🔄 | — | — | 📖 |
| TextNode | 📖 | 📖 | — | — | 📖 |
| VideoNode | 🔄 | 🔄 | — | — | 📖 |
| AudioNode(断句+TTS) | 📖 | — | — | — | 📖 |
| GridSplitNode | 🔄 | — | — | — | 📖 |
| GridMergeNode | — | — | — | — | 🔧 |
| CropNode | — | — | — | — | 🔧 |
| UniversalNode | — | — | — | — | 🔧 |
| API 调用层 | 🔄 | 📖 | — | — | 📖 |
| Zustand Store | 📖 | 🔄 | 📖 | — | 📖 |
| 执行引擎 | 🔄 | 🔄 | 📖 | — | 📖 |
| Chrome Extension | — | — | — | 🔄 | 📖 |
| 通道配置管理 | — | — | — | — | 🔧 |
| 资源中转站 | — | — | — | — | 🔧 |
| UI/样式 | 📖 | 📖 | — | — | 🔄 |

---

## 四、具体文件映射：一毛 → 参考来源

### 4.1 画布相关

| 一毛目标文件 | 首选参考 | 次选参考 | 说明 |
|-------------|---------|---------|------|
| `FlowCanvas.tsx` | node-banana `WorkflowCanvas.tsx` | flowcraft `flow-canvas.tsx` | 画布初始化、节点注册、连线 |
| `NodeResizer.tsx` | node-banana `BaseNode.tsx` | React Flow 官方 `NodeResizer` | 从 `@xyflow/react` 导入 |
| `ImageNode.tsx` | node-banana `GenerateImageNode.tsx` | flowcraft `image-node.tsx` | 多 Provider 图片生成 |
| `TextNode.tsx` | node-banana `LLMGenerateNode.tsx` | flowcraft `llm-node.tsx` | 文本生成 + autoSplit |
| `VideoNode.tsx` | node-banana `GenerateVideoNode.tsx` | flowcraft `video-node.tsx` | 视频生成 + 轮询进度 |
| `AudioNode.tsx` | node-banana `GenerateAudioNode.tsx` | — | 听音断句 + TTS 双模式 |
| `GridSplitNode.tsx` | node-banana `SplitGridNode.tsx` | — | 九宫格分拆 |
| `GridMergeNode.tsx` | **产物反推** | — | 九宫格合拼（无开源对应） |
| `CropNode.tsx` | **产物反推** | — | 图片裁剪（无开源对应） |
| `UniversalNode.tsx` | **产物反推** | — | 无开源对应 |

### 4.2 状态与逻辑

| 一毛目标文件 | 首选参考 | 次选参考 | 说明 |
|-------------|---------|---------|------|
| `useFlowStore.ts` | flowcraft `use-canvas-store.ts` | node-banana `workflowStore.ts` | Slice 拆分模式 |
| `imageApi.ts` | node-banana `/api/generate` 路由 | flowcraft `executors.ts` | Gemini 调用格式 |
| `textApi.ts` | node-banana `LLMGenerateNode.tsx` | flowcraft `llm-node.tsx` | OpenAI 格式 |
| `videoApi.ts` | node-banana `GenerateVideoNode.tsx` | flowcraft `video-node.tsx` | 异步轮询 |
| `audioApi.ts` | 产物反推 | — | Whisper 格式 |

### 4.3 Chrome Extension

| 一毛目标文件 | 首选参考 | 次选参考 | 说明 |
|-------------|---------|---------|------|
| `manifest.json` | 原产物直接复用 | — | — |
| `background.js` | 原产物直接复用 | — | — |
| `chromeHelpers.ts` | AIPex `background.ts` | chrome-extensions-samples | scripting/sendToActiveTab |
| `versionCheck.ts` | 产物反推 | — | 混淆较重 |

### 4.4 面板组件（V2 独有功能为主）

| 一毛目标文件 | 参考策略 | 说明 |
|-------------|---------|------|
| `SettingsPanel.tsx` | 📖 node-banana Project Settings + 🔧 产物反推 | 通道管理 + 4 类 API 通道选择 + 模型配置 + 测试连接 |
| `TransitPanel.tsx` | 🔧 产物反推 | 资源中转站（含收藏/清理） |
| `Toast.tsx` | 📖 node-banana / flowcraft | 简单通知组件 |

---

## 五、推荐实施顺序（降低难度）

基于复用策略，推荐以下实施顺序，每步都有参考可用：

```
Phase 1: 基础骨架（🔄 大量复用）
   ├─ 项目初始化 (Vite + React + @xyflow/react + Tailwind v4 + @crxjs/vite-plugin)
   ├─ manifest.json + background.js 直接复用（移除 cookies 权限）
   ├─ useSettingsStore（ApiConfig + ChannelConfig + 项目管理）
   ├─ App.tsx 3 Tab 路由（AI画布 / 资源 / 设置）
   └─ FlowCanvas.tsx ← 参考 node-banana WorkflowCanvas.tsx

Phase 2: 核心节点（🔄 复用为主）
   ├─ BaseNode.tsx ← 参考 node-banana BaseNode.tsx
   ├─ nodeFactory.ts ← 参考 flowcraft（8 种节点注册 + 回调注入）
   ├─ ImageNode.tsx + imageApi.ts ← 参考 node-banana（含裁剪/放大/编辑/发送）
   ├─ TextNode.tsx + textApi.ts（含 autoSplit）
   └─ CropNode.tsx（独立裁剪）

Phase 3: 扩展节点（📖 参考 + 📖 反推）
   ├─ VideoNode.tsx + videoApi.ts（含轮询 + 进度追踪）
   ├─ AudioNode.tsx + audioApi.ts（听音断句 + TTS 双模式）
   ├─ GridSplitNode.tsx ← 参考 node-banana SplitGridNode.tsx
   └─ GridMergeNode.tsx（产物反推）

Phase 4: 执行引擎（🔄 复用）
  ├─ useFlowStore.ts ← 参考 flowcraft Slice 模式
  ├─ BFS 依次运行 ← 产物反推
  └─ 执行高亮 ← 参考 FlowForge AI highlightedNodeId

Phase 5: 独有功能（🔧 自实现）
   ├─ UniversalNode.tsx ← 产物反推（分步：同步→异步→AI辅助）
   ├─ TransitPanel.tsx ← 产物反推（双向资源流转 + 收藏/清理）
   ├─ SettingsPanel.tsx ← 参考 node-banana Project Settings + 产物反推（通道管理 + 模型配置 + 测试连接）
   └─ sendToActiveTab ← chromeHelpers.ts（scripting 注入目标网站）

Phase 6: 集成测试
  └─ 安装原扩展逐功能对比验证
```

---

## 六、注意事项

### 6.1 node-banana 使用 Next.js，一毛使用纯 React + Chrome Extension

node-banana 是 Next.js 应用，API 调用走 Next.js API Routes。一毛是 Chrome Extension，API 调用直接在客户端 `fetch`。**需要剥离 Next.js 依赖**：
- `/api/generate` 路由 → 转为 `src/api/imageApi.ts` 直接客户端 fetch
- `@google/generative-ai` SDK → 可选使用，或直接 fetch（产物中使用直接 fetch）

### 6.2 flowcraft 使用 Google Cloud + Vertex AI

flowcraft 的 Gemini 调用走 Vertex AI（需要 GCP 配置）。一毛使用原生 Gemini API（`?key=` 参数）。**API 调用格式不同**，但节点 UI 结构可参考。

### 6.3 Tailwind CSS v4 vs v3

node-banana/flowcraft 使用 Tailwind v3（JS 配置文件）。一毛产物使用 Tailwind v4（CSS-first 配置）。**v4 配置方式不同**：
```css
/* v3: tailwind.config.js */
/* v4: 直接在 CSS 中 */
@import "tailwindcss";
@theme {
  /* 自定义变量 */
}
```

### 6.4 许可证兼容性

| 项目 | 许可证 | 商用限制 |
|------|--------|---------|
| node-banana | MIT | ✅ 可自由使用、修改、分发 |
| flowcraft | Apache-2.0 | ✅ 可自由使用，需保留版权声明 |
| FlowForge AI | MIT | ✅ 可自由使用 |

> **重要**: 可参考架构和实现思路，但不要直接复制粘贴代码。应以参考项目的架构为指导，根据一毛的业务逻辑独立实现。