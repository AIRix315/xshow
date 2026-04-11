# XShow — 分阶段实施计划

> 📎 **规范文档**: [01-1-reverse-engineering-plan-v2.md](./01-1-reverse-engineering-plan-v2.md)
> 📎 **参考指南**: [02-Reference.md](./02-Reference.md)

## 〇、全局约定

### 版本管理
- Git 仓库，初始版本 `0.0.1`，每 Phase 完成递增 patch（Phase 1 → `0.0.1`，Phase 2 → `0.0.2`，...）
- 每个 Phase 提交前必须通过该 Phase 的全部测试

### 测试策略
- **Vitest** 单元测试：store / API / utils（TDD：先写测试，再实现）
- **手动验证**：每 Phase 末尾加载扩展至 Chrome，按验证清单逐项检查
- 测试文件与源文件同目录：`Foo.ts` → `Foo.test.ts`

### 代码质量（硬性，引自 §0）
- 禁止 `as any` / `@ts-ignore` / `@ts-expect-error`
- 禁止空 catch
- 禁止 `// TODO`
- 注释只说"做了什么"，不说"怎么做的"和"为什么"
- 接口字段注释行尾 `//`，不超 10 字
- 每个模块文件头部 `// Ref:` 标注参考来源
- 所有 API 调用参照 Context7 文档或参考项目最佳实践
- 所有 React Flow 用法对照 `@xyflow/react ^12.10` 官方文档
- 所有 Chrome Extension API 对照 Chrome Developers 官方文档
- 所有 Zustand 用法对照 Zustand v5 文档

### 参考项目文件路径

**node-banana** (shrimbly/node-banana):
| 用途 | 路径 |
|------|------|
| 画布主体 | `src/components/WorkflowCanvas.tsx` |
| 基础节点 | `src/components/nodes/BaseNode.tsx` |
| 图片生成节点 | `src/components/nodes/GenerateImageNode.tsx` |
| 文本生成节点 | `src/components/nodes/LLMGenerateNode.tsx` |
| 视频生成节点 | `src/components/nodes/GenerateVideoNode.tsx` |
| 音频生成节点 | `src/components/nodes/GenerateAudioNode.tsx` |
| 九宫格分拆节点 | `src/components/nodes/SplitGridNode.tsx` |
| 节点注册 | `src/components/nodes/index.ts` |
| 工作流 Store | `src/store/workflowStore.ts` |
| 执行引擎 | `src/store/execution/executeNode.ts` |
| 批量执行 | `src/store/execution/batchExecution.ts` |

**flowcraft** (mblanc/flowcraft):
| 用途 | 路径 |
|------|------|
| 节点工厂 | `lib/node-factory.ts` |
| 节点注册 | `lib/node-registry.ts` |
| 工作流引擎 | `lib/workflow-engine.ts` |
| 执行器 | `lib/executors.ts` |
| Store 目录 | `lib/store/` |
| 类型定义 | `lib/types.ts` |

**AIPex** (AIPexStudio/AIPex):
| 用途 | 路径 |
|------|------|
| Manifest | `packages/browser-ext/manifest.json` |
| 构建配置 | `packages/browser-ext/vite.config.ts` |
| Service Worker | `packages/browser-ext/src/background.ts` |

### Context7 文档查询清单（实施时必须查阅）

| 事项 | Context7 Library ID |
|------|---------------------|
| React Flow 画布/节点/Handle/Edge | `/xyflow/xyflow` |
| Zustand v5 Store/Slice/Middleware | `/pmndrs/zustand` v5 |
| Chrome Extension MV3 API | 查 Chrome Developers 官方文档 |

---

## Phase 1: 基础骨架（v0.0.1）

> **可运行标准**: 加载扩展 → Side Panel 渲染 → 3 Tab 切换正常 → 空画布显示

### 1.1 项目初始化

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 1.1.1 | `npm create vite` React+TS 模板 | — | `npm run build` 成功 |
| 1.1.2 | 安装依赖: `@xyflow/react ^12.10`, `zustand ^5`, `lucide-react ^0.460`, `localforage ^1.10`, `tailwindcss ^4.2` | — | `npm ls` 无缺失 |
| 1.1.3 | 安装开发依赖: `vitest`, `@crxjs/vite-plugin ^2`, `@tailwindcss/vite` | — | `vitest run` 可执行 |
| 1.1.4 | 配置 `vite.config.ts`（@crxjs/vite-plugin + react + tailwind） | AIPex `packages/browser-ext/vite.config.ts` | 构建产物含 manifest |
| 1.1.5 | 配置 `tsconfig.json`（strict, paths @/→src/） | — | `tsc --noEmit` 零错误 |
| 1.1.6 | Git 初始化 + `.gitignore` + 初始提交 v0.0.1 | — | `git log` 有记录 |

### 1.2 Chrome Extension 基础

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 1.2.1 | `manifest.json`（V2 权限集：scripting/\<all_urls\>，无 cookies） | §九 + AIPex manifest.json | Context7 查 Chrome MV3 manifest 规范 |
| 1.2.2 | `background.js` 从产物直接复用 | 产物 `E:\Projects\1mao\background.js` | 扩展安装无报错 |
| 1.2.3 | 复制 public/ 静态资源（icon16/48/128, favicon, logo, icons） | 产物 `E:\Projects\1mao\public\` | 图标正常加载 |
| 1.2.4 | `index.html` SPA 入口 | AIPex sidepanel 入口 | 页面加载无白屏 |

### 1.3 Tailwind v4 配置

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 1.3.1 | `tailwind.css` 入口（@import + @theme 变量从产物 CSS 复制） | 产物 `index-BoJrPcWC.css` 头部 | 深色主题变量生效 |
| 1.3.2 | Vite 插件集成 `@tailwindcss/vite` | Tailwind v4 CSS-first 文档 | class 类名生效 |

### 1.4 类型定义

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 1.4.1 | `src/types.ts` — 定义全部接口（§3.1-3.14） | §三 全部数据结构 | Vitest: 类型编译通过 |
| 1.4.2 | 默认值常量导出（DEFAULT_CHANNEL, DEFAULT_API_CONFIG, DEFAULT_PROJECT） | §三 + 产物默认值 | Vitest: `getDefaultApiConfig()` 返回正确结构 |

### 1.5 全局状态 Store

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 1.5.1 | `src/stores/useSettingsStore.ts` — ApiConfig + channels + projects + templates | Zustand v5 文档 + flowcraft `lib/store/` | **先写测试**: channel CRUD / channelId 选择 / model 更新 / project CRUD |
| 1.5.2 | 持久化中间件（chrome.storage.local） | Zustand v5 persist middleware | Vitest: store 操作后状态正确 |

### 1.6 App 骨架

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 1.6.1 | `src/main.tsx` — React 挂载点 | AIPex sidepanel 入口 | DOM 渲染 |
| 1.6.2 | `src/App.tsx` — 3 Tab 路由（AI画布/资源/设置） | §七 + 产物 Tab 切换 | 手动: Tab 切换正常 |
| 1.6.3 | Tab 占位组件（EmptyCanvas, EmptyTransit, EmptySettings） | — | 3 个 Tab 各显示标题文字 |

### 1.7 画布基础

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 1.7.1 | `src/components/canvas/FlowCanvas.tsx` — ReactFlow 空画布 + ReactFlowProvider | @xyflow/react ^12.10 文档 + node-banana `WorkflowCanvas.tsx` | 手动: 空画布可渲染+拖拽 |
| 1.7.2 | 画布初始化（fitView + miniMap + background） | @xyflow/react 文档 | 手动: 迷你地图+网格背景可见 |

### Phase 1 手动验证清单

```
□ Chrome 加载扩展无报错
□ Side Panel 打开显示 3 Tab
□ Tab 切换正常（AI画布/资源/设置）
□ AI画布 Tab 显示空 ReactFlow 画布
□ 画布可拖拽/缩放
□ 设置 Tab 显示空白占位
□ 资源 Tab 显示空白占位
□ Vitest 全部通过
```

---

## Phase 2: 核心节点（v0.0.2）

> **可运行标准**: 画布创建 ImageNode/TextNode/CropNode → 输入提示词 → 调用 API 生成图片/文本

### 2.1 BaseNode

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 2.1.1 | `BaseNode.tsx` — NodeResizer + Handle(Left=target/Right=source) + loading/error 状态 + 展开/折叠 | node-banana `BaseNode.tsx` + @xyflow/react NodeResizer 文档 | 手动: 节点选中高亮+可缩放 |
| 2.1.2 | 样式：选中蓝边框(#3b82f6)、拖拽手柄、缩放手柄 | 产物 BaseNode 样式 | 视觉匹配 |

### 2.2 NodeFactory + 节点注册

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 2.2.1 | `src/utils/nodeFactory.ts` — 创建节点实例 + 注入回调 + 默认数据/尺寸 | flowcraft `lib/node-factory.ts` + `lib/node-registry.ts` | Vitest: `createNode('imageNode', pos)` 返回正确结构 |
| 2.2.2 | 节点类型注册表（9 种 node type → 组件映射） | §6.1 + node-banana `nodes/index.ts` | Vitest: 所有 9 种 type 可创建 |
| 2.2.3 | promptNode → ImageNode 别名映射 | §6.1 | Vitest: promptNode 使用 ImageNode 组件 |

### 2.3 ImageNode + imageApi

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 2.3.1 | `src/api/imageApi.ts` — 图片生成（协议分派: gemini/openai） | §5.1 + 根据 protocol 分派请求格式 | **先写测试**: 模拟 fetch → 验证协议分派逻辑 |
| 2.3.2 | `ImageNode.tsx` — 提示词+模型下拉+预设词+@资源绑定+生成按钮 | node-banana `GenerateImageNode.tsx` + @xyflow/react 自定义节点文档 | 手动: 输入提示词→生成图片 |
| 2.3.3 | 工具栏按钮：放大(onZoom)/裁剪(onCrop)/编辑(onEdit)/下载 | §6.3 + 产物 ImageNode 工具栏 | 手动: 各按钮响应 |
| 2.3.4 | 多模型下拉切换（drawingModel split \n → 列表） | §3.4 + 产物 `.split('\n')` 模式 | 手动: 切换模型 |
| 2.3.5 | @ 资源绑定弹窗（暂用空弹窗，Phase 5 完善） | — | 手动: 弹窗出现 |
| 2.3.6 | 参考图连线输入（接收 imageUrl → inlineData） | §6.3 | 手动: 连线后参考图显示 |

### 2.4 TextNode + textApi

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 2.4.1 | `src/api/textApi.ts` — 文本生成 + autoSplit（协议分派: openai/gemini） | §5.2 + 根据 protocol 分派请求格式 | **先写测试**: 模拟 fetch → 验证协议分派逻辑 |
| 2.4.2 | `TextNode.tsx` — 提示词+模型下拉+autoSplit+@资源绑定 | node-banana `LLMGenerateNode.tsx` | 手动: 生成文本 |
| 2.4.3 | autoSplit 逻辑：response_format json → 解析 items → 生成子节点 + 连线 | §5.2 + §6.4 | 手动: autoSplit 生成子节点 |

### 2.5 CropNode

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 2.5.1 | `CropNode.tsx` — 接收 sourceImageUrl → canvas 框选 → onCropComplete 输出 | §3.12 + §6.9 + 产物 cropNode je | 手动: ImageNode 裁剪→弹出 CropNode→框选→生成新 ImageNode |
| 2.5.2 | 裁剪框选 UI（canvas 绘制 + 鼠标拖拽选区） | 产物 cropNode 组件 | 手动: 框选区域高亮 |

### 2.6 画布拖拽创建

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 2.6.1 | 侧边栏节点按钮 → 拖拽到画布创建节点 | node-banana `WorkflowCanvas.tsx` + @xyflow/react DnD 文档 | 手动: 拖拽创建 ImageNode |

### Phase 2 手动验证清单

```
□ 拖拽创建 ImageNode 到画布
□ ImageNode 输入提示词 → 调用 imageApi → 显示生成图片
□ ImageNode 模型下拉切换
□ ImageNode 预设词选择
□ ImageNode 点击裁剪 → 弹出 CropNode → 框选 → 生成新图片节点
□ ImageNode 放大/下载按钮工作
□ 拖拽创建 TextNode 到画布
□ TextNode 生成文本
□ TextNode autoSplit 生成子节点
□ 两个节点间可连线
□ 图片节点接收文本连线输入作为参考
□ Vitest 全部通过
```

---

## Phase 3: 扩展节点（v0.0.3）

> **可运行标准**: VideoNode/AudioNode/GridSplit/GridMerge 均可创建并执行

### 3.1 VideoNode + videoApi

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 3.1.1 | `src/api/videoApi.ts` — FormData 提交 + 轮询 + 进度 | §5.3 + node-banana `GenerateVideoNode.tsx` + `generateVideoExecutor.ts` | **先写测试**: 提交格式/轮询逻辑/超时 |
| 3.1.2 | `VideoNode.tsx` — 提示词+模型+尺寸+时长+进度条 | node-banana `GenerateVideoNode.tsx` | 手动: 生成视频 |
| 3.1.3 | GlobalTask 追踪（提交→更新 progress→完成/失败） | §3.11 GlobalTask | Vitest: globalTask 状态流转正确 |
| 3.1.4 | 时长下拉（videoDurations split \n） | §3.6 | 手动: 选择时长 |

### 3.2 AudioNode + audioApi

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 3.2.1 | `src/api/audioApi.ts` — 语音处理（协议分派: openai/gemini） | §5.4 + 根据 protocol 分派请求格式 | **先写测试**: 模拟 fetch → 验证协议分派逻辑 |
| 3.2.2 | `AudioNode.tsx` — 双模式 UI（断句上传区 + TTS 文本输入） | §3.7 + §6.6 | 手动: 上传音频→断句结果; 输入文本→生成音频 |
| 3.2.3 | 音频转写文本 → chunks 合并逻辑 | §5.4 | Vitest: 文本→chunks 转换正确 |
| 3.2.4 | 连线输入接收音频 URL | §6.6 | 手动: 连线提供音频 |

### 3.3 GridSplitNode

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 3.3.1 | `GridSplitNode.tsx` — 参数配置 + N×N Handle + 切图逻辑 | node-banana `SplitGridNode.tsx` | 手动: 上传大图→切为9张→各生成子 ImageNode |
| 3.3.2 | 动态 Handle：gridCount 变化 → 重新生成 target Handle | @xyflow/react 动态 Handle 文档 | 手动: 改 gridCount 后 Handle 数量正确 |

### 3.4 GridMergeNode

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 3.4.1 | `GridMergeNode.tsx` — 接收多图连线 → canvas 合拼输出 | §3.9 + §6.8 + 产物反推 | 手动: 9图连线→合拼为1张大图 |
| 3.4.2 | canvas 绘制：按 gridCount 排列子图 | §3.9 | 手动: 合拼结果尺寸正确 |

### Phase 3 手动验证清单

```
□ VideoNode 生成视频 + 进度条 + 完成后可播放
□ VideoNode 模型/尺寸/时长下拉均工作
□ AudioNode 听音断句：上传音频 → 显示分句结果
□ AudioNode TTS：输入文本 → 生成可播放音频
□ AudioNode 模型选择工作
□ GridSplitNode 上传图 → 切为9子图 → 各自独立
□ GridMergeNode 9图连线 → 合拼为大图
□ 所有节点可正常创建、连线、删除
□ Vitest 全部通过
```

---

## Phase 4: 执行引擎（v0.0.4）

> **可运行标准**: 多节点连线 → BFS 依次运行 → 项目管理 CRUD

### 4.1 useFlowStore

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 4.1.1 | `src/stores/useFlowStore.ts` — nodes/edges/执行状态 | Zustand v5 Slice 模式 + flowcraft `lib/store/` | **先写测试**: addNode/removeNode/addEdge/updateNodeData |
| 4.1.2 | Slice 拆分：graphSlice(nodes/edges操作) + uiSlice(选中/展开) | flowcraft graph-slice/ui-slice 模式 | Vitest: 各 Slice 独立可测 |

### 4.2 BFS 依次运行

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 4.2.1 | BFS 引擎：沿 edge BFS → 按层 Promise.all → 失败停分支 → 150ms 间隔 | §6.12 + flowcraft `workflow-engine.ts` | **先写测试**: 简单链 A→B→C → 按序执行; 分支失败不影响其他分支 |
| 4.2.2 | autoSplit 子节点入队：autoSplit 生成 → 子节点加入 BFS 队列 | §6.4 + §6.12 | Vitest: autoSplit 后子节点被引擎执行 |
| 4.2.3 | 执行高亮：当前运行节点 border 闪烁 | FlowForge AI `highlightedNodeId` | 手动: 运行时节点高亮 |
| 4.2.4 | AbortController 管理：运行中可停止 | §6.1 | 手动: 点停止→节点停止执行 |

### 4.3 项目管理 CRUD

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 4.3.1 | 创建项目（弹窗输入名称 + Date.now() ID） | §3.13 + §6.15 | Vitest: 创建后 projects 数组+1 |
| 4.3.2 | 切换项目（select 下拉 + localStorage lastOpenedProjectId） | §6.15 | 手动: 切换→画布状态切换 |
| 4.3.3 | 删除项目（至少保留1个 + 清理 localforage） | §6.15 | Vitest: 删除后 projects-1 + localforage 清理 |
| 4.3.4 | 画布状态持久化（localforage key: canvas-state-v1-${projectId}） | §3.13 + §6.15 | 手动: 切换项目→回来后画布恢复 |

### 4.4 Group 节点自动调整

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 4.4.1 | 监听 nodes 变化 → 遍历 type='group' → 计算子节点边界框 → padding 40px | §6.13 + 产物反推 | 手动: 拖入 group → 子节点→group 自动调整大小 |

### Phase 4 手动验证清单

```
□ 3 节点链 A→B→C → BFS 按序执行
□ 分支执行：A→[B,C] → B和C并行执行
□ 节点运行中高亮显示
□ 运行中可点停止
□ autoSplit 后子节点被继续执行
□ 创建/切换/删除画布项目
□ 切换项目后画布状态正确恢复
□ Group 节点随子节点拖拽自动调整
□ Vitest 全部通过
```

---

## Phase 5: 独有功能（v0.0.5）

> **可运行标准**: 完整 E2E 流程：配置通道→创建节点→执行→发送到网站

### 5.1 UniversalNode

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 5.1.1 | `UniversalNode.tsx` — configMode 配置 UI | §3.10 + §6.10 + 产物反推 | 手动: 切换配置/运行模式 |
| 5.1.2 | 同步执行：收集连线输入 → {{变量}}替换 → fetch → resultPath 提取 | §5.5 + 产物 customNode 同步逻辑 | **先写测试**: 模拟 API → 变量替换 + 结果提取 |
| 5.1.3 | 异步执行：提交 → taskIdPath → 轮询 pollingUrl → 完成提取 | §5.5 + 产物 customNode 异步逻辑 | Vitest: 轮询状态流转 |
| 5.1.4 | AI 辅助：描述需求 → 调 textApi → 自动填充 config | §5.5 + §6.10 | 手动: 输入描述→配置自动填充 |
| 5.1.5 | 模板保存/加载：onSaveTemplate → customNodeTemplates | §3.14 + §6.10 | 手动: 保存模板→从模板创建新节点 |

### 5.2 TransitPanel

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 5.2.1 | `src/hooks/useTransitResources.ts` — 资源 CRUD + localforage/chrome.storage | §3.2 + §6.14 | **先写测试**: add/remove/toggleFavorite |
| 5.2.2 | `TransitPanel.tsx` — 资源列表 + 类型筛选 + 收藏 + 清理 | §6.14 + 产物反推 | 手动: 右键"发送到资源"→Side Panel 显示 |
| 5.2.3 | @ 绑定：节点内按 @ → 弹出资源列表 → selectedContextResources 更新 | §6.14 | 手动: @ 选择资源→节点显示绑定 |
| 5.2.4 | 收藏 isFavorite：清理时跳过收藏资源 | §3.2 | 手动: 收藏资源不被清理 |

### 5.3 SettingsPanel

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 5.3.1 | 供应商管理区：添加/编辑/删除 ChannelConfig | §7.2 + useSettingsStore | 手动: CRUD 操作正常 |
| 5.3.2 | 4 个 API 配置区（LLM/图像/视频/语音）+ 供应商 select + 模型 textarea | §7.2 | 手动: 选供应商→url+key 自动填入 |
| 5.3.3 | TTS 语音 select（预设: alloy/echo/fable/onyx/nova/shimmer） | §7.2 + §3.1 ttsVoice | 手动: 选择语音 |
| 5.3.4 | 测试连接按钮（POST /v1/chat/completions {max_tokens:5}） | §7.2 | 手动: 测试成功/失败提示 |
| 5.3.5 | 视频时长选项 textarea | §7.2 | 手动: 输入时长 |
| 5.3.6 | 持久化：chrome.storage.local 自动保存 | §7.2 | 手动: 重启扩展→设置保留 |

### 5.4 sendToActiveTab

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 5.4.1 | `src/utils/chromeHelpers.ts` — sendToActiveTab 实现 | §7.3 + 产物 `jt` 函数 + Chrome scripting 文档 | **先写测试**: 模拟 chrome.tabs/scripting → 验证注入脚本逻辑 |
| 5.4.2 | base64→File→DataTransfer→input.files→触发 change+input 事件 | §7.3 | 手动: 点击"发送到网站"→目标页面 input 自动填入 |
| 5.4.3 | 支持 string 和 {url, type} 两种资源参数 | §3.4 onSendToActiveTab | 手动: 图片+视频均可发送 |
| 5.4.4 | 注入的 input 闪烁蓝色边框 1 秒 | §7.3 | 手动: 发送后 input 闪烁 |

### 5.5 预设词管理

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 5.5.1 | SettingsPanel 中预设词 CRUD（title/prompt/type/enabled） | §3.3 + §7.2 | 手动: 添加/删除预设词→节点可用 |
| 5.5.2 | 节点内按类型过滤 presetPrompts | §3.3 | 手动: imageNode 只显示 type=image/all |

### 5.6 右键菜单

| # | 子任务 | 参考 | 测试 |
|---|--------|------|------|
| 5.6.1 | background.js 右键菜单"发送到资源" | 产物 `background.js` + Chrome contextMenus 文档 | 手动: 网页右键→点击→Side Panel 收到资源 |

### Phase 5 手动验证清单

```
□ UniversalNode 配置模式：手动填写 apiUrl/headers/body
□ UniversalNode 运行模式：同步执行 + resultPath 提取
□ UniversalNode 异步执行：轮询 → 完成
□ UniversalNode AI 辅助：输入描述→自动填充配置
□ UniversalNode 模板保存 → 从模板创建新节点
□ TransitPanel 显示右键传入的资源
□ @ 绑定：节点内选资源 → selectedContextResources 更新
□ 收藏资源不被批量清理
□ SettingsPanel 4 个 API 区配置正常
□ TTS 语音选择
□ 测试连接按钮工作
□ sendToActiveTab：点击→目标网站 input 自动填入图片
□ sendToActiveTab：input 闪烁蓝框
□ 预设词管理 + 节点内过滤
□ 右键菜单"发送到资源"工作
□ 完整 E2E: 配置通道→创建节点→生成内容→发送到网站
□ Vitest 全部通过
```

---

## 版本里程碑

| 版本 | Phase | 完成标志 |
|------|-------|---------|
| 0.0.1 | 基础骨架 | 3 Tab + 空画布渲染 |
| 0.0.2 | 核心节点 | ImageNode/TextNode/CropNode 生成内容 |
| 0.0.3 | 扩展节点 | VideoNode/AudioNode/GridSplit/GridMerge 工作 |
| 0.0.4 | 执行引擎 | BFS 依次运行 + 项目 CRUD |
| 0.0.5 | 独有功能 | 完整 E2E: UniversalNode + Transit + Settings + sendToActiveTab |

## 最终交付标准（v0.0.5 达成后）

- 全部 Vitest 测试通过
- 全部手动验证清单通过
- 无 TypeScript 类型错误
- 无 ESLint 错误
- 每个模块文件头部有 `// Ref:` 参考来源
- 扩展可在 Chrome 中安装并正常运行