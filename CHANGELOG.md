# Changelog

All notable changes to XShow will be documented in this file.

## [0.1.9] - 2026-04-16

### UI 重构：节点标题栏 + 悬停交互 + 浮动栏优化

**BaseNodeWrapper 重构**
- 标题栏改为悬浮在节点上方（absolute -top），不再占据节点内容区高度
- 新增 `showHoverHeader` 模式：悬停时显示切换（设置/展开）和运行按钮
- 新增 `onRun` / `onToggle` 回调替代旧的 `onSettings`
- 悬停展开从 CSS `group-hover` 切换为 JS 状态驱动 `expanded`，支持点击切换
- 错误消息 z-index 提升（z-30），调试信息层级调整（z-20）

**节点批量适配**
- ImageNode / VideoNode / TextNode / Generate3DNode / GenerateAudioNode：移除节点内嵌运行按钮，改用 `showHoverHeader + onRun`
- AnnotateNode / FrameGrabNode / GridSplitNode / VideoStitchNode / VideoTrimNode：启用 `showHoverHeader`
- RhAppNode / RhWfNode：移除底部运行/停止按钮和 settingsPanel，改用 `showHoverHeader + onRun + onToggle`
- OmniNode：移除内嵌标题栏和配置/运行切换按钮，改用 `showHoverHeader`，默认 minHeight 提升至 480
- RhZipNode：添加 `showHoverHeader + onRun + onToggle`

**节点尺寸调整**
- imageNode: 224×224 → 260×380 / videoNode: 320×320 → 260×380 / textNode: 400×240 → 260×260
- promptNode: 400×240 → 260×260 / audioNode: 320×280 → 260×320 / omniNode: 400×300 → 320×480

**FloatingActionBar 优化**
- 新增折叠/展开切换箭头（默认展开，可收起）
- 底部吸附对齐（bottom-0），添加展开/收起动画
- "All nodes" 按钮文案缩短为 "Nodes"

**ConnectionDropMenu 重构**
- 支持按拖拽方向（source/target）智能展开对应分组
- 改为可折叠分组 UI（带 ChevronDown 箭头）
- 搜索框和文字缩小，整体宽度缩减为 150px
- 新增 rhZipNode 到兼容节点列表

**NodeSidebar 分类调整**
- rhZipNode（ZIP）从 RunningHub 移至 Custom 分类

**小地图功能增强**
- 新增 `minimapPosition` 设置：右上 / 右下 / 关闭
- SettingsPanel 画布设置页新增小地图位置分段控制
- FlowCanvas 使用 minimapPosition 替代旧的 showMinimap 布尔开关
- 小地图圆角和遮罩样式优化

**样式微调**
- 多个节点预览区域添加 `rounded` 圆角
- OmniNode 默认 executionMode 改为 `async`
- React Flow 控件面板添加 `overflow: hidden`
- minimap 添加 `border-radius: 8px` 和 `overflow: hidden`



## [0.1.8] - 2026-04-16

### 版本升级

> - **节点系统**：UniversalNode (万能节点) / OmniNode / ZipNode / ImageNode / TextNode / CropNode / VideoNode / AudioNode / GridSplit / GridMerge / RouterNode / OutputGalleryNode / FloatingActionBar
> - **RunningHub 集成**：RhAppNode (APP快捷创作) / RhWfNode (工作流节点) / 完整 API 封装 (任务提交/轮询/文件上传)
> - **执行引擎**：BFS 执行引擎 + 节点执行器体系 + 执行高亮
> - **数据流**：connectedInputs 工具 / 智能连线 / 类型感知路由 / 泛型输入
> - **资源管理**：File System Access API / 资源库菜单 / 3D 模型支持
> - **持久化**：项目导入导出 (.xshow) / 差量保存 (fast-json-patch) / IndexedDB / 静默自动保存

## [0.1.7] - 2026-04-16

### ZIP 解压节点 & 类型感知路由 & 智能连线

#### 新增

- **RhZipNode** (`src/components/canvas/RhZipNode.tsx`) — ZIP 解压节点
  - 三种输入方式：上游连线传入 ZIP URL、粘贴 URL、本地/拖拽上传 ZIP 文件
  - 解压后自动输出媒体文件（outputUrl/outputUrls/outputUrlTypes）
  - 支持多文件预览（网格布局）
  - 分类逻辑由下游路由节点负责
- **rhZipExecutor** (`src/store/execution/rhZipExecutor.ts`) — ZIP 解压执行器
  - `executeRhZipNode()` — 画布级执行（处理远程 URL）
  - `executeRhZipLocal()` — 本地上传解压

#### RouterNode 重构

- **类型感知路由**：Handle ID 即类型名（image/video/audio/text）
- **动态推导**：从 incoming edges 推断活跃输入类型，动态渲染对应 handles
- **泛型输入**：支持 any-input/generic-input 连接，自动透传所有上游数据
- **双向 handle**：左侧输入、右侧输出，一一对应

#### FlowCanvas 增强

- **自动连接映射**：`resolveTargetHandleId()` / `resolveSourceHandleId()`
  - 拖拽创建节点时自动推断目标输入 handle
  - 支持从 source 和 target 双向拖拽
- **智能连线**：选择节点后自动建立源到目标的边

#### connectedInputs 增强

- `inferMediaOutput()` 新增 `outputUrlTypes` 参数 — 精确类型元数据
- `getSourceOutput()` 新增 `rhZipNode` 分支
- RouterNode 泛型输出透传：generic-output 透传所有上游数据

#### 修改文件

- `src/types.ts` — 新增 RhZipNodeType/RhZipNodeConfig/RhZipNodeData 类型
- `src/utils/nodeFactory.ts` — 注册 RhZipNode 节点工厂
- `src/store/execution/index.ts` — 注册 rhZipNodeExecutor
- `src/utils/zipExtractor.ts` — outputUrlTypes 支持
- `src/components/canvas/NodeSidebar.tsx` — 侧边栏新增 ZIP 解压入口

## [0.1.6] - 2026-04-15

### RunningHub 独立节点 & 全栈测试覆盖

#### 新增

- **RhAppNode** (`src/components/canvas/RhAppNode.tsx`) — RunningHub APP 快捷创作节点
  - 选择 APP 后自动获取 nodeInfoList，渲染 STRING/LIST/IMAGE 字段编辑器
  - any-input 智能映射：text→STRING, image→IMAGE, video→VIDEO, audio→AUDIO
  - IMAGE 字段 >2 时自动暴露 image-N 独立 handle
  - 支持 ZIP 包（多图/混合媒体）自动解压
- **RhWfNode** (`src/components/canvas/RhWfNode.tsx`) — RunningHub 工作流节点
  - 与 rhAppNode 同架构，workflowId 驱动
  - any-input + image-N handle 支持
- **rhAppExecutor** / **rhWfExecutor** — 对应执行器，含 ANY 智能填充 + ZIP 解压 + blob URL 清理
- **rhApi.ts** — RunningHub API 封装（APP 信息获取 / 任务提交 / 轮询 / 文件上传）
- **zipExtractor.ts** — ZIP 媒体检工具（isBlobUrl / revokeMediaUrls）
- **inferMediaOutput()** — 共享函数，omniNode/rhAppNode/rhWfNode 输出类型推断

#### 修改

- `connectedInputs.ts` — getSourceOutput 新增 rhAppNode/rhWfNode 分支；getInputsByHandle 扩展 video-/audio- 前缀；新增 inferMediaOutput
- `types.ts` — 新增 RhAppNodeType/RhWfNodeType/RhAppNodeConfig/RhWfNodeConfig 等类型；fieldData/descriptionEn 字段
- `nodeFactory.ts` — 注册 RhAppNode/RhWfNode 节点工厂
- `store/execution/index.ts` — 注册 rhAppNode/rhWfNode 执行器
- `comfyApi.ts` — 移除 RunningHub 逻辑（独立为 rhApi）
- `OmniNode.tsx` — 移除 inline RH 配置 UI
- `NodeSidebar.tsx` — 侧边栏新增 RhApp/RhWf 入口
- `FloatingActionBar.tsx` / `SettingsPanel.tsx` / `OutputGalleryNode.tsx` — 小幅适配

#### 全栈测试（335 pass / 19 skip）

- `connectedInputs.test.ts` — 新增 10 个 rhAppNode/rhWfNode 测试（51 total）
- `rhExecutors.test.ts` — 18 个 RH 执行器纯逻辑测试
- `dataFlow.integration.test.ts` — 19 个跨节点数据流集成测试
- `rhExecutor.e2e.test.ts` — 10 逻辑 + 9 条件 E2E（RH_E2E=1 启用）
- `RhAppNode.test.tsx` — 14 个组件渲染测试
- `RhWfNode.test.tsx` — 12 个组件渲染测试
- `OmniNode.test.tsx` — 20 个组件渲染测试
- `setup-tests.ts` / `vitest.config.ts` — RTL + jsdom + setup 配置
- 新增依赖：@testing-library/react, @testing-library/jest-dom, @testing-library/user-event, jsdom

## [0.1.5] - 2026-04-15

### 资源文件系统 & 自动保存

#### 新增文件

- `src/components/ResourcesMenu.tsx` — 资源库菜单组件，支持目录选择与文件浏览
- `src/utils/fileSystemAccess.ts` — File System Access API 封装，支持持久化目录句柄
- `src/utils/patchManager.ts` — 差量保存管理器（fast-json-patch）
- `src/api/modelListApi.ts` — 模型列表 API 获取
- `src/types-file-system-access.d.ts` — File System Access API 类型声明
- `e2e/fileSystem.spec.ts` — 文件系统 E2E 测试

#### 功能变更

- **资源库菜单**：新增"资源库"按钮，点击展开目录选择器，可持久化保存用户本地文件夹
- **静默自动保存**：每 30 秒检查未保存状态 + 项目目录存在时自动写入，无 UI 反馈（仅 console 日志）
- **Ctrl+S 快捷键**：全局键盘快捷键，保存当前项目
- **3D 模型支持**：SettingsPanel 新增 3D 模型配置 Tab（Channel + Model），扩展 API_SECTIONS

#### 修改文件

- `src/App.tsx` — 资源菜单按钮、自动保存定时器、Ctrl+S 快捷键
- `src/components/settings/SettingsPanel.tsx` — 3D 模型配置 Section、新增 ApiType
- `src/stores/useSettingsStore.ts` — 3D 渠道/模型配置字段
- `src/stores/useFlowStore.ts` — hasUnsavedChanges 状态管理
- `src/api/comfyApi.ts` — 模型列表相关 API
- `src/store/execution/omniExecutor.ts` — 执行器逻辑更新
- `src/utils/canvasState.ts` — 画布状态工具
- `src/utils/connectedInputs.ts` — 输入连接工具
- `src/types.ts` — 新增类型定义

#### 质量保证

- TypeScript 编译通过
- 单元测试全部通过

## [0.1.4] - 2026-04-14

### 项目保存与导出系统

实现完整的项目文件导出/导入功能，支持多项目管理和媒体资源持久化。

#### 新增文件

- `src/utils/projectManager.ts` — 项目文件导出（chrome.downloads）/ 导入（FileReader）核心逻辑
- `src/utils/mediaExternalizer.ts` — blob/http URL → base64 序列化；移除不可序列化的回调函数

#### 功能变更

- **导出项目**：将当前画布（nodes + edges）序列化为 `.xshow` JSON 文件，通过 `chrome.downloads` API 触发下载对话框
- **导入项目**：从 `.xshow` / `.json` 文件导入，自动创建新项目并加载画布数据
- **Base64 嵌入选项**：用户可选择是否将图片/视频转为 Base64 内嵌到文件（自包含但体积大）或不嵌入（轻量但链接会断开）
- **未保存状态追踪**：所有画布操作（增删节点、连线、撤销重做等）自动标记为"未保存"，顶部栏实时显示状态
- **多项目隔离**：项目列表支持切换/新建/删除，IndexedDB 按 projectId 隔离存储画布状态

#### 修改文件

- `src/types.ts` — 新增 `XShowWorkflowFile` 接口
- `src/stores/useFlowStore.ts` — 新增 `hasUnsavedChanges`/`lastSavedAt`/`isSaving` 状态；`saveProject`/`loadProject`/`markDirty` Action；所有 mutation 自动标记 dirty
- `src/stores/useSettingsStore.ts` — 新增 `importProjectFromFile` Action
- `src/App.tsx` — 顶部栏接入导入/新建/保存按钮；保存状态文字动态联动
- `src/components/settings/SettingsPanel.tsx` — ProjectTab 重构：文件操作区（导入/导出）、Base64 开关含双色提示框
- `package.json`、`public/manifest.json` — 版本 0.1.4

#### 质量保证

- TypeScript 编译通过
- 206 个单元测试全部通过
- 生产构建成功

## [0.1.3] - 2026-04-14

### Handle 类型标签显示优化

- **全局统一**：所有节点的 Handle 类型标签（Image/Video/Text/Audio/Model/Any 等）现在统一在鼠标悬停时显示
- **悬停交互**：标签默认隐藏（`opacity: 0`），节点悬停或选中时淡入显示
- **颜色语义**：标签颜色与 Handle 圆点颜色对应（image=绿、video=橙、audio=紫、text=蓝、model=橙、any=灰）
- **OmniNode 特殊处理**：输出 Handle 新增 "Any" 标签，替代原有纯颜色区分
- **OutputNode/OutputGalleryNode**：标签从一直显示改为悬停显示，与其他节点统一
- **清理死代码**：移除 MiniMap 中不存在的 `customNode` 引用，改用正确的 `omniNode`

#### 修改文件

- `src/tailwind.css` — `.handle-label` 全局样式 + 悬停显示规则
- `src/components/canvas/FlowCanvas.tsx` — MiniMap 颜色映射修复
- `src/components/canvas/OmniNode.tsx` — 添加 Any 标签
- `src/components/canvas/OutputNode.tsx` — 标签改为悬停显示
- `src/components/canvas/OutputGalleryNode.tsx` — 标签改为悬停显示
- `src/components/canvas/ImageNode.tsx` — 添加 Image/Text 标签
- `src/components/canvas/VideoNode.tsx` — 添加 Video 标签
- `src/components/canvas/GenerateAudioNode.tsx` — 添加 Text/Audio 标签
- `src/components/canvas/Generate3DNode.tsx` — 添加 Text/Model 标签
- `src/components/canvas/ImageInputNode.tsx` — 添加 Image/Ref 标签
- `src/components/canvas/VideoInputNode.tsx` — 添加 Video 标签
- `src/components/canvas/TextInputNode.tsx` — 添加 Text 标签
- `src/components/canvas/AnnotateNode.tsx` — 添加 Image 标签
- `src/components/canvas/FrameGrabNode.tsx` — 添加 Video/Image 标签
- `src/components/canvas/Viewer3DNode.tsx` — 添加 Image/Model 标签
- `src/components/canvas/VideoTrimNode.tsx` — 添加 Video 标签
- `src/components/canvas/VideoStitchNode.tsx` — 添加 Video 标签
- `src/components/canvas/PromptConstructorNode.tsx` — 添加 Text 标签
- `src/components/canvas/ImageCompareNode.tsx` — 添加 Image 标签
- `src/components/canvas/EaseCurveNode.tsx` — 添加 Value 标签
- `src/components/canvas/SwitchNode.tsx` — 添加 Any/On/Off 标签
- `src/components/canvas/ConditionalSwitchNode.tsx` — 添加 Any/Default 标签

## [0.1.2] - 2026-04-15

### 万能节点数据流 & UI 改进

#### 万能节点（OmniNode）"万能 handle" 机制
- 新增 `auto` 输出类型（默认），自动根据下游节点需要分发数据：连 image 入口给图片、连 text 入口给文本、连 video 入口给视频
- 显式类型（image/video/audio/text）：仅输出对应类型数据，其他类型丢弃（过滤器模式）
- `getSourceOutput` 新增 `targetHandleType` 参数，万能节点按下游 handle 类型按需返回
- Handle 颜色随 outputType 动态变化（image=绿、video=橙、audio=紫、text=蓝、auto=灰）
- `BaseNodeWrapper` 新增 `accentColor` prop，节点标题栏底边和选中态边框随类型着色
- `outputType`/`comfyuiOutputType` 类型定义扩展为 `'auto' | 'text' | 'image' | 'video' | 'audio'`

#### 输出节点显示优化
- **OutputNode**：移除冗余 "Output" 英文标题，图片/视频/音频区域从固定 `h-16`(64px) 改为 `flex-1` 填满节点，下载按钮固定底部
- **OutputGalleryNode**：移除冗余 "Output Gallery" 英文标题，网格项从固定 `h-12`(48px) 改为 `aspect-square` 自适应，底部信息行合为一行

#### 九宫格拆分节点（GridSplitNode）执行器 & 子节点
- 注册 `executeGridSplit` 执行器（BFS 引擎统一驱动），移除组件内 useEffect 自动拆分
- 新增 `SplitGridSettingsModal` 弹窗：配置子节点数量 → 一键创建 ImageInput 子节点 + reference 引用线
- `GridSplitNodeData` 新增 `gridRows`/`gridCols`/`targetCount` 字段
- `ImageInputNode` 新增 `image` + `reference` target handle

#### 万能节点（OmniNode）批量输出
- `executeComfyWorkflow` 返回类型从 `string` 改为 `ComfyWorkflowResult`（含 `outputUrl` + `outputUrls[]`）
- Local/Cloud 模式收集所有图片/音频输出 URL，RunningHub 模式收集所有 `fileUrl`
- `omniExecutor` 在多结果时写入 `outputUrls` 数组
- `OmniNode` 组件内手动执行同步写入 `outputUrls`

#### 版本号自动读取
- `App.tsx` 版本号从 `package.json` 通过 Vite `define` 注入，UI 自动展示
- `manifest.json` 版本同步至 `0.1.2`

### 修改文件

- `src/types.ts` — outputType 扩展、OmniNodeData、GridSplitNodeData
- `src/utils/connectedInputs.ts` — 万能 handle 分发逻辑、inferHandleType
- `src/utils/nodeFactory.ts` — omniNode 默认 outputType='auto'
- `src/utils/executionEngine.ts` — 无变更
- `src/api/comfyApi.ts` — ComfyWorkflowResult、多输出收集
- `src/store/execution/simpleNodeExecutors.ts` — executeGridSplit
- `src/store/execution/omniExecutor.ts` — outputUrls 写入
- `src/store/execution/index.ts` — 注册 gridSplitNode 执行器
- `src/components/canvas/BaseNode.tsx` — accentColor prop
- `src/components/canvas/OmniNode.tsx` — any handle + accentColor + auto 选项
- `src/components/canvas/OutputNode.tsx` — 布局重构
- `src/components/canvas/OutputGalleryNode.tsx` — 布局重构
- `src/components/canvas/GridSplitNode.tsx` — 拆分设置弹窗 + useEffect 移除
- `src/components/canvas/ImageInputNode.tsx` — 新增 target handles
- `src/components/canvas/SplitGridSettingsModal.tsx` — 新增文件
- `src/App.tsx` — 版本号自动读取
- `vite.config.ts` — define __APP_VERSION__
- `src/vite-env.d.ts` — 类型声明
- `package.json`、`public/manifest.json` — 版本 0.1.2

### 质量保证

- TypeScript 编译通过
- 206 个单元测试通过（含 3 个新增万能 handle 分发测试）

## [0.1.1] - 2026-04-14

### 节点命名体系统一

- **命名规范对齐 node-banana**：统一采用"功能优先"命名，`Input` 后缀表示输入节点，无后缀表示生成节点
- **新增文档**：`Docs/05-Node-Instruction.md` - 节点指导手册，含命名规范、分类体系、数据流图、开发指南

| 旧类型 | 新类型 | 说明 |
|--------|--------|------|
| `generateAudioNode` | `audioNode` | TTS 音频生成 |
| `audioNode` (旧) | `audioInputNode` | 音频输入上传 |
| `generate3DNode` | `d3Node` | 3D 模型生成 |
| `customNode` | `omniNode` | 万能节点 |
| `promptNode` | 共用 `TextNode` 组件 | 提示词节点 |

### 修改文件

- `src/types.ts` - 类型定义更新，新增兼容别名
- `src/utils/nodeFactory.ts` - nodeTypes 映射、NODE_DEFAULTS、getDefaultData
- `src/store/execution/index.ts` - nodeExecutors 注册表
- `src/utils/connectedInputs.ts` - getSourceOutput 类型映射
- `src/components/canvas/NodeSidebar.tsx` - UI 节点分类
- `src/components/canvas/TextInputNode.tsx` - 新增手动输入模式
- `src/utils/connectedInputs.test.ts` - 测试用例更新

### 质量保证

- TypeScript 编译通过
- 195 个单元测试通过
- 生产构建成功

## [0.1.0] - 2026-04-14

### 架构重构

- **节点状态管理模式重构**：所有节点组件从"双状态模式"（useState + Store）统一重构为 **Store-only 模式**
  - 业务数据（config、loading、errorMessage、resultData、progress 等）直接从 `data` prop 读取
  - 所有状态更新统一通过 `updateNodeData(id, { field: value })`
  - UI 瞬态（isPlaying、isDragging、currentTool 等）保留为本地 `useState`
  - 对标 node-banana 项目架构，消除状态不一致问题

### 重构节点 (22 个)

| 节点 | 重构内容 |
|------|----------|
| ImageNode | loading、errorMessage、resultUrl → Store-only |
| TextNode | loading、errorMessage、text、result → Store-only |
| VideoNode | loading、errorMessage、videoUrl、progress → Store-only |
| AudioNode | loading、errorMessage、audioUrl → Store-only |
| UniversalNode | config、loading、errorMessage、resultData、progress、nodeValues → Store-only |
| TextInputNode | text、errorMessage → Store-only |
| VideoInputNode | videoUrl、loading → Store-only |
| SwitchNode | activeIndex → Store-only |
| EaseCurveNode | curve → Store-only |
| VideoTrimNode | start、end → Store-only |
| VideoStitchNode | loading、errorMessage → Store-only |
| FrameGrabNode | frameTime、imageUrl → Store-only |
| ImageCompareNode | loading、errorMessage → Store-only |
| PromptConstructorNode | segments、result → Store-only |
| ConditionalSwitchNode | condition → Store-only |
| GenerateAudioNode | loading、errorMessage、audioUrl → Store-only |
| Generate3DNode | loading、errorMessage、modelUrl → Store-only |
| AnnotateNode | annotations、fontSize、color → Store-only |
| CropNode | 已符合 Store-only（仅 UI 状态） |
| GridSplitNode | gridCount、cellSize、splitResults → Store-only |
| GridMergeNode | gridCount、cellSize、mergedImageUrl → Store-only |

### 已符合原有模式

- ImageInputNode、AnnotateNode、CropNode 已符合 Store-only 模式

### 质量保证

- TypeScript 类型检查全部通过
- 169 个单元测试全部通过

## [0.0.9] - 2026-04-13

### 修复
- **ComfyUI 工作流扫描失败**：目录参数 `default/workflows/` 修正为 `workflows`（API 路径相对于用户根目录而非文件系统绝对路径）
- **ComfyUI 工作流文件读取 404**：列表返回的路径是相对于 `workflows/` 子目录的，读取时需加 `workflows/` 前缀；目录分隔符 URL 编码为 `%2F`
- **ComfyUI 输出图片 URL 拼接错误**：`output.images` 为 `{filename, subfolder, type}` 对象，旧代码直接拼字符串产生 `[object Object]` 导致 404，改为正确提取属性
- **ComfyUI 图片上传 FormData 序列化失败**：`extensionFetch` 代理无法序列化 `FormData`，改为直连 `fetch`（ComfyUI 已启用 CORS）

### 改进
- 工作流扫描启用递归模式（`recurse=true`），支持子目录（Backup、RHAPI 等）
- 移除 `hasProblematicChars` 过滤器（URL 编码后中文、`&`、`[]` 等字符均可正常读取）
- 连接测试成功后显示工作流文件数量
- 扫描提示文案更新为正确的 ComfyUI 操作说明

### 测试
- 新增 `comfyApi.e2e.test.ts`：11 个纯逻辑测试 + 5 个 ComfyUI 集成测试（`COMFY_E2E=1` 启用）

## [0.0.8] - 2026-04-12

### 新功能
- ComfyUI 执行支持 (local/cloud/runninghub)
- 18 种新节点类型

### 新增节点
- TextInputNode - 文本输入
- VideoInputNode - 视频输入
- ImageInputNode - 图片输入
- Generate3DNode - 3D 生成
- GenerateAudioNode - 音频生成
- PromptConstructorNode - 提示词构造
- AnnotateNode - 标注
- ConditionalSwitchNode - 条件切换
- EaseCurveNode - 缓动曲线
- FrameGrabNode - 帧提取
- ImageCompareNode - 图片对比
- OutputGalleryNode - 输出画廊
- OutputNode - 输出
- RouterNode - 路由
- SwitchNode - 开关
- VideoStitchNode - 视频拼接
- VideoTrimNode - 视频裁剪
- Viewer3DNode - 3D 查看器

### 改动
- SettingsPanel ComfyUI 工作流配置
- UniversalNode executionType 扩展
- ComfyUI API 执行引擎 (comfyApi.ts)
- 节点类型定义统一迁移到 types.ts

## [0.0.7] - 2026-04-12

- 修复侧边栏节点拖拽到画布问题
- 统一节点标题为中文
- 优化万能节点样式（默认运行模式、溢出隐藏）
- 新增图片输入节点（ImageInputNode）区分图片加载和图片生成

## [0.0.6] - 2026-04-12

- Initial release
- Node-based visual AI workflow editor
- Chrome Extension Manifest V3 sidebar support