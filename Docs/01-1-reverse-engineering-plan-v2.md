# XShow — 反推重建源码项目方案 V2

> 📎 **配套文档**: [02-Reference.md](./02-Reference.md) — 开源项目参考与复用指南
> 📎 **V1 方案**: [01-reverse-engineering-plan.md](./01-reverse-engineering-plan.md) — 原始完整版（含多开环境、会员系统）

## 变更摘要（V1 → V2）

| 变更项 | V1 | V2 | 原因 |
|--------|----|----|------|
| 项目名称 | 一毛AI画布 | **XShow** | 统一命名 |
| 多开环境 | ✅ 含 Cookie 注入 | ❌ 移除（无账号面板，无 Cookie） | 非 API 通道功能 |
| 会员激活 | ✅ 包含 | ❌ 移除 | 非核心需求 |
| API 配置 | AccountConfig {id,name,url,key,cookies,...} | ✅ ChannelConfig {id,name,url,key} | 原结构精简：改名+去Cookie字段，机制不变 |
| 多账号切换 | Cookie 抓取 + 切换登录态 | ❌ 纯 API 端点配置 | 通道只有 url+key，无 Cookie |
| Chrome 权限 | cookies/scripting/\<all_urls\> | scripting/\<all_urls\>（无 cookies） | 保留 scripting（sendToActiveTab），移除 cookies |
| App 结构 | 4 Tab | **3 Tab**（AI画布 / 资源 / 设置） | 砍掉"多开环境"，设置仍为独立 Tab |
| sendToActiveTab | ✅ 含 chrome.scripting | ✅ 保留 | 双窗口核心：左侧画布→右侧网站自动填入 |
| 工时估算 | ✅ 包含 | ❌ 移除 | 质量优先，不赶时间 |

---

## 〇、代码质量标准（强制）

> 以下要求适用于项目中**每一行代码**，实施阶段视为硬性约束。

### 0.1 注释规范

- **仅作功能注释**：注释只解释"做了什么"，不解释"怎么做的"或"为什么这么做"
- **禁止废话注释**：不允许 `// set loading to true`、`// handle click` 等自明性注释
- **禁止区段分隔注释**：不允许 `// ===== 以下为 API 调用 =====` 等
- **接口/类型字段注释**：行尾 `//` 简要说明，不超过 10 字
- **函数注释**：仅当函数名无法自说明时，在函数上方一行 `//` 注释

```typescript
// ✅ 允许
const IMAGE_GENERATION_TIMEOUT = 600_000; // 10 分钟超时
interface ApiConfig {
   channels: ChannelConfig[];       // 供应商池
   imageChannelId: string;          // 生图供应商 ID
 }

// ❌ 禁止
// 这个函数用来处理图片生成的逻辑，它会调用 Gemini API 并返回 base64 数据
const handleGenerateImage = () => { ... }
// ===== API 配置 =====
```

### 0.2 实现标准

- **所有 API 调用**：必须参照 Context7 文档或参考项目（node-banana / flowcraft）的最佳实践实现，不凭经验编写
- **所有 React Flow 用法**：必须对照 `@xyflow/react ^12.10` 官方文档，不使用已废弃 API
- **所有 Chrome Extension API**：必须对照 Chrome Developers 官方文档，不使用 MV2 API
- **所有 Zustand 用法**：必须对照 Zustand v5 文档
- **禁止类型逃逸**：不允许 `as any`、`@ts-ignore`、`@ts-expect-error`
- **禁止静默捕获**：不允许 `catch(e) {}` 或 `catch(e) { /* ignore */ }`
- **禁止 TODO 留存**：代码中不允许 `// TODO`，做到位再提交

### 0.3 参考项目引用

实现每个模块时，必须在模块文件头部标注参考来源（供代码审查验证）：

```typescript
// Ref: node-banana/src/components/nodes/GenerateImageNode.tsx
// Ref: flowcraft/lib/store/use-canvas-store.ts
```

---

## 一、项目概述

| 属性 | 详情 |
|------|------|
| **名称** | XShow |
| **类型** | Chrome 浏览器扩展 (Manifest V3) |
| **描述** | 节点式可视化 AI 工作流编辑器 |
| **核心功能** | 画布 + 8 种节点 + 资源中转站 + 通道配置 + 双窗口交互 |
| **项目路径** | `E:\projects\XShow` |

## 二、技术栈

| 技术 | 版本 | 参考项目 |
|------|------|---------|
| **React** | `^19.0.0` | node-banana, flowcraft |
| **React DOM** | `^19.0.0` | — |
| **@xyflow/react** | **`^12.10.x`** | node-banana, flowcraft |
| **Zustand** | `^5.x` | flowcraft (Slice 模式) |
| **Lucide React** | `^0.460` | — |
| **LocalForage** | `^1.10` | — |
| **Tailwind CSS** | **`^4.2` (CSS-first)** | flowcraft |
| **Vite** | 6+ | — |
| **@crxjs/vite-plugin** | `^2.x` | AIPex |

> ⚠️ **Tailwind CSS v4**: CSS-first 配置，不使用 `tailwind.config.js`
> ```css
> @import "tailwindcss";
> /* 主题变量从产物 CSS 中复制 */
> ```

## 三、核心数据结构定义

### 3.1 通道配置与全局 API 配置

```typescript
// V2：去掉 Cookie 相关字段，只保留 API 端点配置，增加 protocol 协议类型
// protocol 决定 API 调用的请求/响应格式，不绑定特定供应商
// 用户可通过切换 protocol 让同一 url+key 适配不同 API 格式
interface ChannelConfig {
  id: string;               // 唯一标识，如 "default"
  name: string;             // 供应商名称，如 "API Studio"
  url: string;              // API 端点地址
  key: string;              // API 密钥
  protocol: 'openai' | 'gemini' | 'custom';  // 协议类型，决定请求/响应格式
}

interface ApiConfig {
  channels: ChannelConfig[];       // 供应商池（全局共享）
  imageChannelId: string;          // 生图选中的供应商 ID
  drawingModel: string;            // 生图模型，换行分隔多模型
  videoChannelId: string;           // 生视频选中的供应商 ID
  videoModel: string;              // 生视频模型，换行分隔多模型
  textChannelId: string;            // LLM 选中的供应商 ID
  textModel: string;                // LLM 模型，换行分隔多模型
  audioChannelId: string;           // 语音选中的供应商 ID
  audioModel: string;               // 语音模型，换行分隔多模型
  ttsVoice: string;                 // TTS 语音，用户自定义填入
  videoDurations: string;           // 视频时长选项，换行分隔
  presetPrompts: PresetPrompt[];    // 预设词
}
```

> **通道选择机制**：4 种 API 类型各自从 `channels[]` 中选一个供应商，选中后自动提供该供应商的 url+key+protocol。模型名独立于供应商，以多行文本自由填写，节点内可切换同类型的不同模型。
>
> **协议分派机制**：每个通道的 `protocol` 字段决定 API 调用的请求构建和响应解析方式：
> - `'openai'`：使用 OpenAI 兼容格式（Bearer 鉴权、`/v1/` 路径前缀、`choices` 响应结构等）
> - `'gemini'`：使用 Google Gemini 格式（URL 参数鉴权、`/v1beta/models/{model}:generateContent`、`candidates` 响应结构等）
> - `'custom'`：用户自定义端点配置，由万能节点覆盖
>
> 同一个 `url+key` 切换 `protocol` 后即可适配不同 API 格式，无需重复添加供应商。

### 3.2 资源中转站

```typescript
interface TransitResource {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'text';
  timestamp: number;
  pageUrl: string;
  pageTitle: string;
  isFavorite?: boolean;        // 收藏标记，用于筛选和防清理
}
```

### 3.3 预设词

```typescript
interface PresetPrompt {
  title: string;
  prompt: string;
  type: 'image' | 'text' | 'video' | 'all';
  enabled: boolean;
}
```

### 3.4 图片节点数据

```typescript
interface ImageNodeData {
  imageUrl?: string;
  prompt: string;
  aspectRatio: string;     // '16:9', '1:1' 等
  imageSize: string;        // '1K', '2K' 等
  selectedModel?: string;
  drawingModel: string;     // 换行分隔多模型
  selectedContextResources: TransitResource[];
  loading: boolean;
  errorMessage?: string;
  presetPrompts: PresetPrompt[];
  onGenerate?: (nodeId: string, prompt: string, size: string, model?: string) => void;
  onCrop?: (nodeId: string, imageUrl: string) => void;       // 弹出裁剪节点
  onZoom?: (imageUrl: string) => void;                         // 全屏预览
  onEdit?: (nodeId: string, imageUrl: string) => void;        // 进入编辑模式
  onAddImage?: (nodeId: string, dataUrl: string) => void;
  onStop?: (nodeId: string) => void;
  onShowToast?: (msg: string) => void;
  onSendToActiveTab?: (resource: string | { url: string; type: string }) => void;  // 支持图片和视频
}
```

### 3.5 文本节点数据

```typescript
interface TextNodeData {
  text?: string;
  prompt: string;
  label: string;
  expanded: boolean;
  autoSplit?: boolean;
  selectedModel?: string;
  textModel: string;
  fontSize?: number;
  selectedContextResources: TransitResource[];
  loading: boolean;
  errorMessage?: string;
  presetPrompts: PresetPrompt[];
  onGenerateText?: (nodeId: string, prompt: string, autoSplit: boolean, model?: string) => void;
  onAddImage?: (nodeId: string, dataUrl: string) => void;
  onStop?: (nodeId: string) => void;
  onShowToast?: (msg: string) => void;
}
```

### 3.6 视频节点数据

```typescript
interface VideoNodeData {
  videoUrl?: string;
  thumbnailUrl?: string;
  prompt: string;
  size: string;             // '1280x720'
  selectedModel?: string;
  videoModel: string;
  videoDurations: string;   // 换行分隔
  selectedSeconds?: string;
  selectedContextResources: TransitResource[];
  loading: boolean;
  progress?: number;
  errorMessage?: string;
  presetPrompts: PresetPrompt[];
  onGenerateVideo?: (nodeId: string, prompt: string, size: string, model?: string, duration?: string) => void;
  onAddImage?: (nodeId: string, dataUrl: string) => void;
  onStop?: (nodeId: string) => void;
  onShowToast?: (msg: string) => void;
}
```

### 3.7 音频节点数据

```typescript
interface AudioNodeData {
  audioUrl?: string;                                // 音频 URL（上传或生成）
  audioName?: string;                                // 文件名
  chunks?: Array<{ start: number; end: number; text: string }>;  // 听音断句结果
  ttsText?: string;                                  // TTS 输入文本
  selectedModel?: string;                             // 当前选中模型
  loading: boolean;
  errorMessage?: string;
  onGenerateAudio?: (nodeId: string) => void;        // 听音断句
  onGenerateTTS?: (nodeId: string) => void;           // 文本转语音
  onShowToast?: (msg: string) => void;
}
```

> **双模式**：(1) 听音断句 — 上传音频 → 语音转录 → 分句结果；(2) TTS 文本转语音 — 输入文本 → 调用语音 API → 生成音频。具体请求/响应格式由所选通道的 `protocol` 决定。

### 3.8 九宫格分拆节点

```typescript
interface GridSplitNodeData {
  gridCount: number;        // 默认 3
  cellSize: number;         // 默认 512
  aspectRatio: string;      // 默认 '1:1'
  titlePattern: string;     // 默认 'id{num}'
}
```

> 将一张大图切为 N×N 张子图，每张生成独立 ImageNode 子节点。

### 3.9 九宫格合拼节点

```typescript
interface GridMergeNodeData {
  gridCount: number;        // 默认 3
  cellSize: number;         // 默认 512
  aspectRatio: string;      // 默认 '1:1'
}
```

> 将多张子图合拼为一张九宫格大图。接收来自多个 ImageNode 连线的图片输入。

### 3.10 万能节点配置

```typescript
interface CustomNodeConfig {
  apiUrl: string;
  method: string;
  headers: string;          // JSON 字符串
  body: string;             // 支持 {{变量名}}
  outputType: 'text' | 'image' | 'video' | 'audio';
  executionMode: 'sync' | 'async';
  resultPath: string;
  taskIdPath?: string;
  pollingUrl?: string;
  pollingMethod?: string;
  pollingHeaders?: string;
  pollingBody?: string;
  pollingResultPath?: string;
  pollingCompletedValue?: string;
  pollingFailedValue?: string;
  pollingErrorPath?: string;
  pollingProgressPath?: string;
  pollingResultDataPath?: string;
  rawTextOutput?: boolean;
  variables?: Record<string, string>;
}

interface UniversalNodeData {
  label: string;
  configMode: boolean;
  config: CustomNodeConfig;
  loading: boolean;
  progress?: number;
  resultData?: string;
  errorMessage?: string;
  onAIAssist?: (desc: string, config: CustomNodeConfig) => Promise<string>;
  onGenerateCustom?: (nodeId: string) => void;
  onSaveTemplate?: (name: string, config: CustomNodeConfig) => void;
  onShowToast?: (msg: string) => void;
  onStop?: (nodeId: string) => void;
}
```

### 3.11 全局任务追踪

```typescript
interface GlobalTask {
  id: string;
  type: 'video' | 'custom';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  prompt?: string;
  errorMsg?: string;
  resultUrl?: string;
  thumbnailUrl?: string;
}
```

### 3.12 裁剪节点数据

```typescript
interface CropNodeData {
  sourceImageUrl?: string;  // 待裁剪的原图 URL
  onCropComplete?: (nodeId: string, croppedDataUrl: string) => void;  // 裁剪完成回调
  onCancel?: (nodeId: string) => void;
}
```

> 独立裁剪节点：用户在图片上框选区域，裁剪后输出子图。从 ImageNode 的"裁剪"按钮触发，弹出裁剪画布，确认后生成新的 ImageNode。
> 裁剪框选区域（坐标/尺寸）是组件内部 UI 临时状态，不作为节点数据持久化。
> `sourceImageUrl` 在产品中为 `imageUrl`，V2 加 `source` 前缀以区分裁剪源图与裁剪结果。

### 3.13 画布项目

```typescript
interface Project {
  id: string;          // 默认 "default"，新建用 Date.now().toString()
  name: string;        // 项目名，如 "默认项目"
}
```

> 每个项目的画布状态存储在 localforage 中，key 为 `canvas-state-v1-${projectId}`。至少保留一个项目。

### 3.14 自定义节点模板

```typescript
interface CustomNodeTemplate {
  id: string;                 // Date.now().toString()
  name: string;                // 模板名称
  config: CustomNodeConfig;    // 万能节点配置
}
```

## 四、文件结构

```
E:\projects\XShow\
├── package.json
├── vite.config.ts                       # Vite + @crxjs/vite-plugin
├── tsconfig.json
├── tailwind.css                         # Tailwind v4 入口 (CSS-first)
├── index.html                           # SPA 入口
├── manifest.json                        # Chrome MV3（移除 cookies 权限）
├── background.js                        # Service Worker（复用）
├── public/
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   ├── favicon.svg
│   ├── logo.png
│   └── icons.svg
└── src/
    ├── main.tsx
    ├── App.tsx                          # 3 Tab 路由 + 全局状态
    ├── types.ts                          # 所有数据结构定义
    ├── stores/
    │   ├── useFlowStore.ts              # 画布状态（节点/边/执行）
    │   └── useSettingsStore.ts          # 全局 ApiConfig + 项目 + 模板
    ├── hooks/
    │   └── useTransitResources.ts
    ├── components/
    │   ├── canvas/
    │   │   ├── FlowCanvas.tsx           # 画布主组件
    │   │   ├── BaseNode.tsx             # NodeResizer + 状态 + Handle
    │   │   ├── ImageNode.tsx            # 图片生成节点
    │   │   ├── TextNode.tsx             # 文本生成 + autoSplit
    │   │   ├── VideoNode.tsx            # 视频生成 + 轮询
    │   │   ├── AudioNode.tsx            # 听音断句 + TTS
    │   │   ├── GridSplitNode.tsx        # 九宫格分拆
    │   │   ├── GridMergeNode.tsx        # 九宫格合拼
    │   │   ├── CropNode.tsx             # 图片裁剪
    │   │   └── UniversalNode.tsx        # AI驱动 API 适配器
    │   ├── transit/
    │   │   └── TransitPanel.tsx         # 资源中转站（含收藏/清理）
    │   ├── settings/
    │   │   └── SettingsPanel.tsx         # 供应商管理 + 模型配置 + 测试连接
    │   └── common/
    │       └── Toast.tsx
    ├── api/
    │   ├── imageApi.ts                  # 图片生成（协议分派: gemini/openai）
    │   ├── textApi.ts                   # 文本生成 + autoSplit（协议分派: openai/gemini）
    │   ├── videoApi.ts                  # 视频生成 + 轮询
    │   └── audioApi.ts                  # 语音处理（协议分派: openai/gemini）
    └── utils/
        ├── chromeHelpers.ts             # sendToActiveTab + storage 封装
        └── nodeFactory.ts              # 节点创建 + 回调注入 + 默认尺寸
```

## 五、API 模块核心逻辑

> **通道选择机制**：所有 API 调用通过 `channels.find(c => c.id === channelId)` 获取当前供应商的 url+key+protocol，再根据 `protocol` 分派到对应的请求构建和响应解析逻辑。
>
> **协议分派规范**：每个 API 模块根据通道的 `protocol` 字段决定请求格式，不硬编码任何供应商协议。

### 5.1 imageApi.ts — 图片生成（协议分派）

```
根据通道 protocol 分派：

protocol='gemini':
  端点: ${channel.url}/v1beta/models/${model}:generateContent?key=${channel.key}
  鉴权: URL 参数 ?key=
  请求: { contents: [{ role: 'user', parts }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio, imageSize } } }
  parts: 文本→{text}, 参考图base64→{inlineData}
  超时: 10 分钟
  响应: candidates[0].content.parts → inlineData.base64

protocol='openai':
  端点: ${channel.url}/v1/images/generations
  鉴权: Authorization: Bearer ${channel.key}
  请求: { model, prompt, size, response_format: 'b64_json' }
  超时: 10 分钟
  响应: data[0].b64_json 或 data[0].url

protocol='custom':
  由万能节点覆盖，不走 imageApi

下载: chrome.downloads.download / <a> download
→ 参考: node-banana /api/generate, flowcraft executors.ts
```

### 5.2 textApi.ts — 文本生成（协议分派）

```
根据通道 protocol 分派：

protocol='openai':
  端点: ${channel.url}/v1/chat/completions
  鉴权: Authorization: Bearer ${channel.key}
  请求: { model, messages, temperature: 0.7, response_format? }
  响应: choices[0].message.content

protocol='gemini':
  端点: ${channel.url}/v1beta/models/${model}:generateContent?key=${channel.key}
  鉴权: URL 参数 ?key=
  请求: { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { ... } }
  响应: candidates[0].content.parts[0].text

protocol='custom':
  由万能节点覆盖，不走 textApi

autoSplit（仅 openai 协议有效）: system prompt → JSON { items: [{title, content}] } → 生成子节点
  请求追加: response_format: { type: 'json_object' }
→ 参考: node-banana LLMGenerateNode.tsx
```

### 5.3 videoApi.ts — 视频生成

```
视频生成暂无可用的 Gemini 格式，当前仅支持 openai 兼容协议：

protocol='openai':
  提交: POST ${channel.url} (FormData: model, prompt, size, seconds, input_reference, Authorization: Bearer ${channel.key})
  轮询: GET ${channel.url}/v1/videos/${taskId}，5 秒间隔，最多 720 次
  完成: video_url, thumbnail_url

protocol='gemini':
  同 openai 格式（视频生成服务普遍采用 openai 兼容接口）

protocol='custom':
  由万能节点覆盖

→ 参考: node-banana GenerateVideoNode.tsx
```

### 5.4 audioApi.ts — 语音处理（协议分派）

```
根据通道 protocol 分派：

--- 听音断句（模式1）---

protocol='openai':
  端点: ${channel.url}/v1/audio/transcriptions
  鉴权: Authorization: Bearer ${channel.key}
  请求: FormData (model, file, response_format: verbose_json, timestamp_granularities[]: word)
  响应: words[] → 合并为 chunks [{start, end, text}]

protocol='gemini':
  端点: ${channel.url}/v1beta/models/${model}:generateContent?key=${channel.key}
  鉴权: URL 参数 ?key=
  请求: { contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data } }] }] }
  响应: candidates[0].content.parts[0].text → 解析为带时间戳文本或直接分行

--- TTS 文本转语音（模式2）---

protocol='openai':
  端点: ${channel.url}/v1/audio/speech
  鉴权: Authorization: Bearer ${channel.key}
  请求: { model, input: text, voice }
  响应: 音频二进制流 → URL.createObjectURL

protocol='gemini':
  端点: ${channel.url}/v1beta/models/${model}:generateContent?key=${channel.key}
  请求: { contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'] } }
  响应: candidates[0].content.parts[0].inlineData.data → base64 音频

protocol='custom':
  由万能节点覆盖

→ 参考: node-banana GenerateAudioNode.tsx
```

### 5.5 UniversalNode — AI 驱动的 API 适配器

```
核心定位: 用户描述需求（或粘贴 API 文档），LLM 自动分析并填充完整配置
同步: 收集连线输入 → {{变量}}替换 → fetch → resultPath提取
异步: 提交 → taskIdPath → 轮询pollingUrl → 完成提取
AI辅助: 描述需求 → 调文本API → 自动生成 config JSON → 用户无需手动核对参数
→ 产物反推（无开源对应）
> 注意: UniversalNode 的 custom 协议与 ChannelConfig.protocol='custom' 互补，
> 后者用于标准节点类型，前者用于完全自定义的 API 调用。
```

## 六、组件核心逻辑

### 6.1 FlowCanvas

```
ReactFlow 画布，注册 9 种 node type（8 种独立组件 + promptNode 别名映射到 ImageNode）
node type 注册表: imageNode, promptNode(→ImageNode), textNode, videoNode,
                  audioNode, gridSplitNode, gridMergeNode, cropNode, customNode(万能)
即 8 种独立节点组件: Image, Text, Video, Audio, GridSplit, GridMerge, Crop, Universal
promptNode 是 imageNode 的别名，共享同一组件，注册时映射到 ImageNode
依次运行 (BFS) + Group 自动调整 + AbortController 管理
检验: 画布渲染 + 节点拖拽创建 + 连线 + BFS 执行
→ 参考: node-banana WorkflowCanvas.tsx
```

### 6.2 BaseNode

```
NodeResizer (#3b82f6) + 执行状态 (loading/error) + 展开/折叠
Handle 位置: Left(target 输入), Right(source 输出)
检验: 节点选中高亮 + 拖拽缩放 + loading/error 状态切换
→ 参考: node-banana BaseNode.tsx
```

### 6.3 ImageNode (含 promptNode)

```
功能: 提示词输入 + 模型下拉(多行切换) + 预设词 + @资源绑定 + 生成按钮
生成: 调用 imageApi → base64 → 显示图片
工具栏: 放大(onZoom) / 裁剪(onCrop→弹出cropNode) / 编辑(onEdit) / 发送到网站(onSendToActiveTab) / 下载
连线输入: 接收图片URL作为参考图(inlineData)
检验: 输入提示词 → 生成图片 → 工具栏按钮各功能正常
→ 参考: node-banana GenerateImageNode.tsx
```

### 6.4 TextNode

```
功能: 提示词输入 + 模型下拉 + autoSplit(自动拆分为子节点) + @资源绑定
autoSplit: system prompt → JSON {items:[{title,content}]} → 生成多个 textNode 子节点 + 连线
检验: 文本生成 → autoSplit → 子节点自动创建
→ 参考: node-banana LLMGenerateNode.tsx
```

### 6.5 VideoNode

```
功能: 提示词 + 模型下拉 + 尺寸选择 + 时长选择 + 进度追踪
异步: 提交任务 → taskId → 5秒轮询 → thumbnail_url + video_url
全局任务追踪: globalTasks 数组实时更新
检验: 生成视频 → 进度条 → 完成/失败状态
→ 参考: node-banana GenerateVideoNode.tsx
```

### 6.6 AudioNode（双模式）

```
模式1 - 听音断句: 上传音频文件 → Whisper /v1/audio/transcriptions → chunks 分句
模式2 - TTS 文本转语音: 输入文本 → /v1/audio/speech (OpenAI 格式) 或自定义端点 → 生成音频
连线输入: 可接收来自其他节点的音频URL
检验: 上传音频 → 分句结果; 输入文本 → 生成音频播放
```

### 6.7 GridSplitNode (九宫格分拆)

```
功能: 将一张大图切为 N×N 张子图
参数: gridCount(3), cellSize(512), aspectRatio('1:1'), titlePattern('id{num}')
输出: 每个子图生成独立 ImageNode + 连线
检验: 上传大图 → 切为9张子图 → 各自独立生成
→ 参考: node-banana SplitGridNode.tsx
```

### 6.8 GridMergeNode (九宫格合拼)

```
功能: 将多张子图合拼为一张九宫格大图
输入: 接收来自多个 ImageNode 连线的图片
参数: gridCount(3), cellSize(512), aspectRatio('1:1')
检验: 9张子图连线 → 合拼为一张九宫格图
→ 参考: 产物反推
```

### 6.9 CropNode (图片裁剪)

```
功能: 独立裁剪节点，从 ImageNode 的"裁剪"按钮触发
流程: 传入 imageUrl → 画布上框选区域 → 确认裁剪 → 输出子图
输出: 裁剪后的图片作为新 ImageNode
检验: ImageNode 点击裁剪 → 框选区域 → 确认 → 生成新节点
```

### 6.10 UniversalNode (万能节点)

```
功能: AI 驱动的 API 适配器
模式: configMode(配置模式) ↔ 运行模式
配置模式: 手动填写 apiUrl/headers/body ← 或 ← AI辅助(描述需求→自动填充)
运行模式: 同步/异步执行 + {{变量}}替换 + resultPath提取
模板保存: onSaveTemplate → 存入 customNodeTemplates
→ 产物反推（无开源对应）
```

### 6.11 NodeFactory

```
创建节点实例 + 注入回调(onGenerate/onCrop/onZoom等) + 默认数据/尺寸
尺寸默认: imageNode → 224×224, videoNode → 320×320, audioNode → 360×auto
→ 参考: flowcraft node-factory.ts + node-registry.ts
```

### 6.12 BFS 依次运行

```
沿 edge BFS, 按层 Promise.all, 失败停分支, autoSplit 子节点入队
每层间隔 150ms
检验: 构建简单链 → 依次运行 → 各节点按序执行
→ 参考: flowcraft workflow-engine.ts
```

### 6.13 Group 节点自动调整

```
监听 nodes 变化 → 遍历 type='group' → 计算子节点边界框(minX,minY,maxX,maxY) → padding=40px
拖拽中仅更新 width/height, 停止拖拽时修正 group 位置 + 子节点偏移
```

### 6.14 资源中转站与 @ 绑定

```
双向流转:
  右→左: 网页右键"发送到资源" → background.js → chrome.storage.local → SidePanel TransitPanel
  左→右: 画布节点 onSendToActiveTab → chrome.scripting.executeScript → 注入目标网站
@ 绑定: 节点内按 @ 按钮 → 弹出资源列表 → 选中 → selectedContextResources[] 更新
收藏: isFavorite 标记 → 清理时跳过收藏资源
存储: localforage(优先) → fallback chrome.storage.local
```

### 6.15 项目管理

```
CRUD: 创建(弹窗输入名称) / 切换(<select>下拉) / 删除(至少保留1个)
画布状态: 每个项目独立，localforage key = canvas-state-v1-${projectId}
持久化: chrome.storage.local({projects}) + localStorage({lastOpenedProjectId})
删除项目: 同时清理 localforage 中对应画布状态
```

## 七、App.tsx 主应用

### 7.1 页面结构

```
3 Tab 平级导航:
   ├── AI画布 (Canvas)        ← 默认页
   ├── 资源 (TransitPanel)     ← 资源中转站
   └── 设置 (SettingsPanel)    ← 供应商配置 + 画布项目

全局状态 (useSettingsStore):
   - apiConfig: ApiConfig                    // 通道 + 4 类模型配置（内含 channels）
   - projects: Project[]                     // 画布项目列表
   - currentProjectId: string                // 当前项目 ID
   - customNodeTemplates: CustomNodeTemplate[]  // 万能节点模板
   - globalTasks: GlobalTask[]               // 异步任务追踪
```

### 7.2 设置面板

```
供应商管理区:
   添加/编辑/删除供应商
   每个供应商包含：名称 + 端点地址 + API Key + 协议类型(openai/gemini/custom)
   默认供应商: { id: "default", name: "", url: "", key: "", protocol: "openai" }

4 个 API 配置区（每个区含供应商选择 + 模型配置）:
   📝 LLM 大模型
      供应商 <select> → 自动填入 url + key + protocol
      模型名 (多行文本，每行一个)
      测试连接按钮（按供应商 protocol 分派测试端点）
   🎨 图像大模型
      供应商 <select> → 自动填入 url + key + protocol
      模型名 (多行文本，每行一个)
      测试连接按钮（按供应商 protocol 分派测试端点）
   🎬 视频大模型
      供应商 <select> → 自动填入 url + key + protocol
      模型名 (多行文本，每行一个)
      时长选项 (多行文本，每行一个)
      测试连接按钮（按供应商 protocol 分派测试端点）
   🎙️ 语音（断句 + TTS）
      供应商 <select> → 自动填入 url + key + protocol
      模型名 (多行文本，每行一个)
      TTS 语音 (文本输入，用户自行填入语音标识，如 alloy/echo 等)
      测试连接按钮（按供应商 protocol 分派测试端点）

测试连接（按协议分派）:
   protocol='openai':  POST ${channel.url}/v1/chat/completions { model, messages, max_tokens: 5 }
   protocol='gemini':  POST ${channel.url}/v1beta/models/${model}:generateContent?key=${channel.key} { contents, generationConfig }
   protocol='custom':  不提供测试连接（由万能节点自行定义）
持久化: chrome.storage.local
```

### 7.3 双窗口交互（sendToActiveTab）

```
场景: Side Panel（左）与目标网站（右）并排使用
流程:
   1. 用户在画布节点中点击"发送到网站"按钮
   2. 资源（图片/视频/文本）转为 base64
   3. chrome.tabs.query 获取当前活动标签页
   4. chrome.scripting.executeScript 在目标页面注入脚本:
      - 查找 <input type="file">
      - 将 base64 转为 File 对象
      - 通过 DataTransfer 设置到 input.files
      - 触发 change + input 事件
   5. 被注入的 input 闪烁蓝色边框 1 秒
依赖权限: scripting + <all_urls>
```

## 八、直接复用文件

| 文件 | 用途 | 修改 |
|------|------|------|
| `background.js` | Service Worker | 直接复用 |
| `icon16/48/128.png` | 扩展图标 | 直接复用 |
| `favicon.svg` | 网站图标 | 直接复用 |
| `logo.png` | 品牌 Logo | 直接复用 |
| `icons.svg` | SVG 图标精灵 | 直接复用 |
| `manifest.json` | Chrome MV3 | ⚠️ 移除 cookies 权限 |

## 九、权限分析

```json
{
  "permissions": [
    "contextMenus", "storage", "unlimitedStorage",
    "activeTab", "tabs", "sidePanel", "downloads",
    "scripting"
  ],
  "host_permissions": ["<all_urls>"]
}
```

| 权限 | 用途 | V1 | V2 | 说明 |
|------|------|----|----|------|
| `contextMenus` | 右键菜单"发送到资源" | ✅ | ✅ | 不变 |
| `storage` | chrome.storage.local 存储 | ✅ | ✅ | 不变 |
| `unlimitedStorage` | 大量资源存储 | ✅ | ✅ | 不变 |
| `activeTab` | 获取当前标签页信息 | ✅ | ✅ | 不变 |
| `tabs` | 标签页查询 | ✅ | ✅ | 不变 |
| `sidePanel` | 侧边栏面板 | ✅ | ✅ | 不变 |
| `downloads` | 下载生成的图片/视频 | ✅ | ✅ | 不变 |
| `scripting` | 注入脚本到目标网站 | ✅ | ✅ | sendToActiveTab 双窗口核心功能 |
| `cookies` | Cookie 注入切换登录态 | ✅ | ❌ | 移除多开环境，无 Cookie 需求 |
| `<all_urls>` | 所有网站访问 | ✅ | ✅ | scripting 需要 + 含 http:// 本地服务 |

> ⚠️ `scripting` + `<all_urls>` 是 sendToActiveTab 功能（自动填入图片到目标网站文件上传框）的必要权限。`cookies` 权限在 V2 中移除。

## 十、风险评估

| 风险 | 严重度 | 应对 | 参考 |
|------|--------|------|------|
| @xyflow/react 版本 | 低 | 已确认 `^12.10.x` | flowcraft 精确匹配 |
| Tailwind v4 CSS-first | 中 | 产物 CSS 保留完整变量 | flowcraft 同版本 |
| Group 节点时序 | 中 | 产物逻辑可读 | 产物反推 |
| UniversalNode 复杂度 | 中 | 分步: 同步→异步→AI辅助 | 产物反推 |
| UI 还原度 | 低 | 安装原扩展逐节点对比 | — |

## 十一、分阶段实施顺序

> **交付标准**：每个 Phase 完成后，必须通过 E2E 测试验证可运行。产物是完整可运行的扩展，反编译重建也必须可运行。

```
Phase 1: 基础骨架（可运行：画布渲染 + Tab 切换）
  ├─ Vite + React + @xyflow/react + Tailwind v4 + @crxjs/vite-plugin
  ├─ manifest.json + background.js（移除 cookies 权限）
  ├─ useSettingsStore（ApiConfig + ChannelConfig + 项目管理）
  ├─ App.tsx 3 Tab 路由（AI画布 / 资源 / 设置）
  └─ FlowCanvas.tsx ← flowcraft（空画布可渲染）

Phase 2: 核心节点（可运行：节点创建 + 生成图片/文本）
  ├─ BaseNode.tsx ← node-banana
  ├─ nodeFactory.ts ← flowcraft（8 种节点注册 + 回调注入）
  ├─ ImageNode.tsx + imageApi.ts ← node-banana（含裁剪/放大/编辑/发送）
  ├─ TextNode.tsx + textApi.ts（含 autoSplit）
  └─ CropNode.tsx（独立裁剪）

Phase 3: 扩展节点（可运行：视频/音频/九宫格）
  ├─ VideoNode.tsx + videoApi.ts（含轮询 + 进度追踪）
  ├─ AudioNode.tsx + audioApi.ts（听音断句 + TTS 双模式）
  ├─ GridSplitNode.tsx ← node-banana SplitGridNode
  └─ GridMergeNode.tsx

Phase 4: 执行引擎（可运行：BFS 依次运行 + 状态联动）
  ├─ useFlowStore ← flowcraft Slice
  ├─ BFS 依次运行 ← flowcraft workflow-engine
  ├─ 执行高亮 ← FlowForge AI highlightedNodeId
  └─ 项目管理 CRUD（创建/切换/删除 + localforage 存储）

Phase 5: 独有功能（可运行：完整 E2E 流程）
  ├─ UniversalNode.tsx (AI辅助配置 → 同步/异步执行 → 模板保存)
  ├─ TransitPanel.tsx（双向资源流转 + 收藏/清理）
  ├─ SettingsPanel.tsx（供应商管理 + 4 类通道选择 + 模型配置 + 测试连接）
  └─ sendToActiveTab ← chromeHelpers.ts（scripting 注入目标网站）
```