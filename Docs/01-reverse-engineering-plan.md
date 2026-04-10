# 一毛AI画布 — 反推重建源码项目方案

> 📎 **配套参考文档**: [02-Reference.md](./02-Reference.md) — 开源项目参考与复用指南

## 一、项目概述

| 属性 | 详情 |
|------|------|
| **名称** | 一毛AI画布 |
| **版本** | 1.0.3 |
| **类型** | Chrome 浏览器扩展 (Manifest V3) |
| **描述** | 多账号管理 + AI 生图画布功能 |
| **形态** | 当前为构建产物，无源代码 |
| **反推可行性** | 🟢 95%+ — 产物代码可读率 80%+，所有核心逻辑明文可读 |

## 二、技术栈识别

| 技术 | 识别依据 | 推荐版本 | 参考项目 |
|------|---------|---------|---------|
| **React** | `Symbol.for('react.transitional.element')` → React 19 | `^19.0.0` | node-banana, flowcraft |
| **React DOM** | 与 React 19 配套 | `^19.0.0` | — |
| **@xyflow/react** | `NodeResizer` + `useNodesState` + `useHandleConnections` | **`^12.10.x`** | node-banana, flowcraft |
| **Zustand** | `create(set => ({...}))` 模式 | `^5.x` | node-banana, flowcraft, FlowForge AI |
| **Lucide React** | `<Play>`、`<ZoomIn>`、`<Crop>`、`<Download>` 等 | `^0.460` | — |
| **LocalForage** | `J.default.getItem` → IndexedDB 封装 | `^1.10` | — |
| **Tailwind CSS** | 产物 CSS `/*! tailwindcss v4.2.1 */` | **`^4.2` (CSS-first)** | flowcraft |
| **Vite** | `__vite__mapDeps` + `rolldown-runtime` | Vite 6+ | — |
| **@crxjs/vite-plugin** | Chrome Extension 构建插件 | `^2.x` | AIPex |

> ⚠️ **Tailwind CSS v4 重要**: v4 使用 CSS-first 配置，不再使用 `tailwind.config.js`。入口 CSS 文件应为：
> ```css
> @import "tailwindcss";
> /* 自定义主题变量从产物 CSS 中复制 */
> ```

## 三、核心数据结构定义

### 3.1 账号配置

```typescript
interface AccountConfig {
  id: string;
  name: string;
  url: string;
  key: string;
}
```

### 3.2 会员等级

```typescript
type MembershipType = 'FREE' | 'PRO' | 'VIP';

interface Membership {
  type: MembershipType;
  expiry: number;
}

const MEMBERSHIP_LIMITS = {
  FREE: { accounts: 5,  presets: 5,  dailyGenerations: 100,   name: '普通版' },
  PRO:  { accounts: 30, presets: 20, dailyGenerations: 500,   name: '高级版' },
  VIP:  { accounts: 200,presets: 50, dailyGenerations: 10000, name: '专业版' },
};
```

### 3.3 资源中转站

```typescript
interface TransitResource {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'text';
  timestamp: number;
  pageUrl: string;
  pageTitle: string;
}
```

### 3.4 预设词

```typescript
interface PresetPrompt {
  title: string;
  prompt: string;
  type: 'image' | 'text' | 'video' | 'all';
  enabled: boolean;
}
```

### 3.5 图片节点数据

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
  // 回调注入
  onGenerate?: (nodeId: string, prompt: string, size: string, model?: string) => void;
  onCrop?: (nodeId: string, imageUrl: string) => void;
  onZoom?: (imageUrl: string) => void;
  onEdit?: (nodeId: string, imageUrl: string) => void;
  onAddImage?: (nodeId: string, dataUrl: string) => void;
  onStop?: (nodeId: string) => void;
  onShowToast?: (msg: string) => void;
  onSendToActiveTab?: (imageUrl: string) => void;
}
```

### 3.6 文本节点数据

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

### 3.7 视频节点数据

```typescript
interface VideoNodeData {
  videoUrl?: string;
  thumbnailUrl?: string;
  prompt: string;
  size: string;             // '1280x720'
  selectedModel?: string;
  videoModel: string;
  videoDurations: string;   // 换行分隔，如 '10\n15'
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

### 3.8 音频节点数据

```typescript
interface AudioNodeData {
  audioUrl?: string;
  chunks?: Array<{ start: number; end: number; text: string }>;
  loading: boolean;
  errorMessage?: string;
  audioApiUrl: string;
  audioApiKey: string;
  audioModel: string;
  onGenerateAudio?: (nodeId: string) => void;
  onShowToast?: (msg: string) => void;
}
```

### 3.9 九宫格节点数据

```typescript
interface GridNodeData {
  gridCount: number;        // 默认 3
  cellSize: number;         // 默认 512
  aspectRatio: string;      // 默认 '1:1'
  titlePattern: string;     // 默认 'id{num}'
}
```

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
  // 异步轮询字段
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
  customOutputType?: string;
  customRawResponse?: any;
  errorMsg?: string;
  resultUrl?: string;
  thumbnailUrl?: string;
}
```

## 四、文件结构

```
1mao-source/
├── package.json                         # 项目依赖配置
├── vite.config.ts                       # Vite 构建配置
├── tsconfig.json                        # TypeScript 配置
├── index.html                           # SPA 入口
├── manifest.json                        # Chrome MV3 清单（直接复用）
├── background.js                        # Service Worker（直接复用）
├── public/
│   ├── icon16.png                       # 复用
│   ├── icon48.png                       # 复用
│   ├── icon128.png                      # 复用
│   ├── favicon.svg                      # 复用
│   ├── logo.png                         # 复用
│   └── icons.svg                        # 复用
└── src/
    ├── main.tsx                         # React 入口挂载
    ├── App.tsx                          # 主应用（Tab 路由 + 全局状态）
    ├── types.ts                         # 类型定义
    ├── stores/
    │   └── useFlowStore.ts              # Zustand Flow 状态管理
    ├── hooks/
    │   └── useTransitResources.ts       # 资源中转站 Hook
    ├── components/
    │   ├── canvas/
    │   │   ├── FlowCanvas.tsx           # ReactFlow 画布主组件
    │   │   ├── ImageNode.tsx            # 图片生成节点
    │   │   ├── TextNode.tsx             # 文本生成节点
    │   │   ├── VideoNode.tsx            # 视频生成节点
    │   │   ├── AudioNode.tsx            # 听音断句节点
    │   │   ├── GridNode.tsx             # 九宫格拼图节点
    │   │   ├── UniversalNode.tsx        # 万能（自定义API）节点
    │   │   └── NodeResizer.tsx          # 节点缩放组件
    │   ├── accounts/
    │   │   └── AccountsPanel.tsx        # 多账号管理面板
    │   ├── transit/
    │   │   └── TransitPanel.tsx         # 资源中转站面板
    │   ├── settings/
    │   │   └── SettingsPanel.tsx        # 设置面板（API 配置）
    │   └── common/
    │       └── Toast.tsx                # Toast 通知
    ├── api/
    │   ├── imageApi.ts                  # Gemini 图片生成 API
    │   ├── textApi.ts                   # OpenAI 文本生成 API
    │   ├── videoApi.ts                  # 视频生成 API
    │   └── audioApi.ts                  # Whisper 音频处理 API
    └── utils/
        ├── chromeHelpers.ts             # Chrome Extension API 封装
        └── versionCheck.ts              # 版本检查
```

## 五、API 模块核心逻辑

### 5.1 imageApi.ts — Gemini 图片生成

```
端点: ${apiUrl}/v1beta/models/${model}:generateContent?key=${apiKey}
方法: POST
请求格式:
  {
    contents: [{ role: 'user', parts: [...] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio, imageSize }
    }
  }

parts 构建:
  - 文本 prompt → { text: prompt }
  - 参考图 base64 → { inlineData: { mimeType, data } }
  - 参考图 URL → fetch → blob → FileReader → base64

超时: 10 分钟 (600,000ms)
响应解析:
  - candidates[0].content.parts → inlineData.base64 → data:image/png;base64,...
  - 或 text 内容中提取 Markdown 图片链接 ![...](data:image/...)
  - fallback: 未生成图片 → 提示检查提示词或模型设置

下载:
  - chrome.downloads.download({ url, filename: 'yimao/generated-{timestamp}.png' })
  - fallback: <a> download
```

### 5.2 textApi.ts — OpenAI 文本生成

```
端点: ${apiUrl}/v1/chat/completions
方法: POST
请求格式:
  {
    model: selectedModel || textModel.split('\n')[0].trim(),
    messages: [...],
    temperature: 0.7,
    response_format: autoSplit && !(model includes 'deepseek' || 'claude')
      ? { type: 'json_object' }
      : undefined
  }

autoSplit 模式 (拆分节点):
  system prompt: "你是一个智能内容拆分助手...必须返回 JSON { items: [{title, content}] }"
  解析策略:
    1. JSON.parse → items 数组
    2. fallback: 正则 /"title"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([^"]+)"/g
  结果: 生成多个 textNode 子节点 + 连线
```

### 5.3 videoApi.ts — 视频生成

```
提交端点: ${apiUrl}
方法: POST (FormData)
请求字段:
  - model: selectedModel || videoModel.split('\n')[0].trim()
  - prompt: 参考图 prompt 前缀 + 用户输入
  - size: '1280x720' 等
  - seconds: selectedDuration
  - input_reference: base64 → Blob (逐张)

超时: 无硬超时，轮询保护
轮询:
  - 间隔: 5 秒
  - 最大次数: 720 次 (1 小时)
  - 每 120 次(~10 分钟) 提示用户仍在等
  - 端点: GET ${apiUrl}/v1/videos/${taskId}
  - completed → video_url, thumbnail_url
  - failed/error → 抛出错误

全局任务追踪: globalTasks 数组，实时更新 progress
```

### 5.4 audioApi.ts — Whisper 音频处理

```
端点: ${audioApiUrl}/v1/audio/transcriptions
方法: POST (FormData)
请求字段:
  - model: audioModel
  - file: 音频文件

返回: 分句结果数组 [{ start, end, text }]
```

### 5.5 UniversalNode — 自定义 API 节点

```
同步模式:
  1. 从连线节点收集输入数据 (imageUrl, videoUrl, text)
  2. 变量替换: {{变量名}} → 实际值
  3. URL 资源转 base64
  4. fetch(method, headers, body) → 响应
  5. resultPath 提取结果 (类似 JSONPath, 支持 data.result, choices[0].message.content)
  6. 根据 outputType 更新节点数据

异步模式:
  1. 同上提交请求 → 提取 taskIdPath 得到任务 ID
  2. 轮询 pollingUrl (5 秒间隔, 最多 120 次)
  3. pollingResultPath 判断状态
  4. pollingCompletedValue → 完成 → pollingResultDataPath 提取结果
  5. pollingFailedValue → 失败 → pollingErrorPath 提取错误
  6. pollingProgressPath → 进度百分比

AI 辅助配置:
  - 调用文本 API，system prompt 要求返回上述 JSON 配置格式
  - 用户描述需求 → 生成完整 config
```

## 六、组件核心逻辑

### 6.1 FlowCanvas — 画布主组件

```
功能:
  - ReactFlow 画布渲染
  - 节点类型注册: promptNode(图片), textNode, videoNode, audioNode, gridSplitNode, customNode
  - 拖拽添加节点
  - 右键菜单
  - 依次运行 (BFS)
  - Group 节点自动调整大小
  - 节点添加工厂函数 (注入回调和默认数据)
  - 全局 AbortController 管理 (G.current = Map<nodeId, AbortController>)
```

### 6.2 节点添加工厂函数

```typescript
const addNode = (type: string, position: Position, data: Partial<NodeData>) => {
  const id = `${type}-${Date.now()}`;
  const defaults = {
    expanded: ['promptNode', 'textNode', 'videoNode'].includes(type),
    onGenerate: type === 'promptNode' ? handleGenerateImage : undefined,
    onGenerateText: type === 'textNode' ? handleGenerateText : undefined,
    onGenerateVideo: type === 'videoNode' ? handleGenerateVideo : undefined,
    onGenerateAudio: type === 'audioNode' ? handleGenerateAudio : undefined,
    onGenerateCustom: type === 'customNode' ? handleGenerateCustom : undefined,
    onAIAssist: type === 'customNode' ? handleAIAssist : undefined,
    // ... 其他回调
  };
  // 尺寸默认: promptNode/imageNode → 224x224, videoNode → 320x320
};
```

### 6.3 依次运行功能

```
BFS 从选中节点开始:
  1. 沿 edge 方向找所有下游节点
  2. 按层执行: 当前层全部 Promise.all → 下一层
  3. 某节点失败 → 停止该分支后续
  4. autoSplit 成功 → 拆分子节点也加入执行队列
  5. 层间延迟 150ms
```

### 6.4 Group 节点自动调整

```
监听 nodes 变化:
  - 遍历 type='group' 的节点
  - 计算所有子节点边界框 (minX, minY, maxX, maxY)
  - padding = 40px
  - 拖拽中 → 仅更新 width/height
  - 停止拖拽 → 修正 group 位置 + 子节点偏移
```

### 6.5 资源中转站与 @ 绑定

```
存储: chrome.storage.local + localforage 双读降级
  - 优先 localforage (IndexedDB)
  - fallback chrome.storage.local

@ 绑定: selectedContextResources 数组在节点 data 中
  - 图片/视频 → 缩略图
  - 文本 → 标签
  - 删除 → 数组移除 + updateNodeData
```

### 6.6 AccountsPanel — 多账号管理

```
功能:
  - 账号卡片网格 (头像 + 名称 + 选中角标 √)
  - 编辑/复制 Cookie/删除 菜单
  - 添加账号弹窗 (name, url, key)
  - 默认账号: { id: 'default', name: 'API Studio', url: 'https://apistudio.cc', key: '' }
  - 选中账号 → 自动切换 API url + key
  - Cookie 注入: chrome.cookies.set → 目标网站
  - 会员等级限制检查 (账号数量上限)
```

## 七、App.tsx 主应用

### 7.1 页面结构

```
3 个 Tab:
  - 多开环境 (accounts)
  - AI画布 (canvas)
  - 资源 (transit)
  - 设置 (settings) — 从 accounts 面板进入

全局状态:
  - accounts: AccountConfig[]
  - imageApiUrl / imageApiKey
  - textApiUrl / textApiKey
  - videoApiUrl / videoApiKey
  - audioApiUrl / audioApiKey
  - currentAccountIds (各 API 独立选择)
  - membership: Membership
  - presetPrompts: PresetPrompt[]
  - projects + currentProjectId
  - dailyLimit count
```

### 7.2 设置面板

```
4 个 API 配置区:
  📝 文本大模型 — URL + Key + 模型名(多行)
  🎨 图像大模型 — URL + Key + 模型名(多行) + 测试连接
  🎬 视频大模型 — URL + Key + 模型名(多行) + 时长选项(多行)
  🎙️ 听音断句 — URL + Key + 模型名

测试连接: POST /v1/chat/completions {model, messages: [{role:'user', content:'Hi'}], max_tokens:5}
保存: localStorage 持久化
```

## 八、直接复用文件

以下文件无需修改，直接从产物目录复制：

| 文件 | 用途 |
|------|------|
| `manifest.json` | Chrome MV3 清单 |
| `background.js` | Service Worker（58行，完整可读） |
| `icon16.png` | 扩展图标 |
| `icon48.png` | 扩展图标 |
| `icon128.png` | 扩展图标 |
| `favicon.svg` | 网站图标 |
| `logo.png` | 品牌 Logo |
| `icons.svg` | SVG 图标精灵 |

## 九、测试用例规划

> 临时测试代码放于 `temp_tests/`，验证后删除

| 测试文件 | 验证目标 |
|---------|---------|
| `temp_tests/imageApi.test.ts` | Gemini API 请求格式、base64 解析、超时、AbortError |
| `temp_tests/textApi.test.ts` | OpenAI 格式、autoSplit JSON 解析、fallback 正则解析 |
| `temp_tests/videoApi.test.ts` | FormData 构建、轮询逻辑、completed/failed 状态 |
| `temp_tests/universalNode.test.ts` | {{变量}} 替换、同步/异步执行、resultPath JSON 提取 |
| `temp_tests/nodeFactory.test.ts` | 各类型节点默认数据、尺寸、回调注入正确性 |
| `temp_tests/membership.test.ts` | FREE/PRO/VIP 限制计算、每日计数重置 |

## 十、风险评估

| 风险 | 严重度 | 应对策略 | 参考来源 |
|------|--------|---------|---------|
| React Flow 版本不匹配 | ~~高~~ → **低** | 已确认应使用 `@xyflow/react ^12.10.x` | flowcraft 使用完全相同版本 |
| Tailwind v4 配置方式差异 | 中 | v4 使用 CSS-first 配置，直接复用产物 CSS 变量 | 产物 CSS 头部完整保留 |
| Group 节点自动调整时序 | 中 | 拖拽状态与布局更新需仔细处理 | 📖 产物逻辑完全可读 |
| 万能节点 (UniversalNode) 复杂度 | 中 | 分阶段实现：同步→异步→AI辅助 | 🔧 产物反推，无开源对应 |
| Cookie 注入逻辑 | 中 | `chrome.cookies.set` API 标准 | 📖 chrome-extensions-samples |
| 版本检查函数混淆 | 低 | 非核心功能，可后置 | 🔧 产物反推 |
| `promptNode` 与 `imageNode` 区别 | 低 | 产物显示为同一组件，仅 type 名不同 | — |
| hover 动画/z-index 遗漏 | 低 | 安装原扩展后逐节点对比 | — |

### 可行性确认（基于 Context7 文档验证）

| 模块 | Context7 验证结果 | 风险 |
|------|-----------------|------|
| React Flow Custom Nodes + NodeResizer | ✅ API 完全匹配 | 🟢 无 |
| useNodesState / useEdgesState / useReactFlow | ✅ 完全匹配 | 🟢 无 |
| Zustand create + persist | ✅ 完全匹配 | 🟢 无 |
| Chrome MV3 sidePanel + storage + cookies | ✅ 官方文档确认 | 🟢 无 |
| Lucide React 图标 | ✅ 完全匹配 | 🟢 无 |

## 十一、工作量估算（含参考项目复用）

> 🔄 = 可直接从参考项目移植/借鉴 | 📖 = 需参照参考项目实现 | 🔧 = 需从产物反推自实现

| 模块 | 预估行数 | 工时 | 复用级别 | 首选参考 |
|------|---------|------|---------|---------|
| 项目初始化 + 配置 | ~100 | 2h | 🔄 | Vite + @crxjs/vite-plugin 脚手架 |
| types.ts 数据结构 | ~200 | 1h | 📖 | node-banana `types.ts` |
| Zustand Store | ~80 | 1h | 🔄 | flowcraft Slice 模式 |
| imageApi.ts | ~150 | 2h | 🔄 | node-banana `/api/generate` |
| textApi.ts | ~100 | 1.5h | 📖 | node-banana `LLMGenerateNode.tsx` |
| videoApi.ts | ~150 | 2h | 📖 | node-banana `GenerateVideoNode.tsx` |
| audioApi.ts | ~50 | 1h | 🔧 | 产物反推 |
| FlowCanvas.tsx | ~200 | 2h | 🔄 | node-banana `WorkflowCanvas.tsx` |
| ImageNode.tsx | ~250 | 2h | 🔄 | node-banana `GenerateImageNode.tsx` |
| TextNode.tsx | ~200 | 2h | 📖 | node-banana `LLMGenerateNode.tsx` + 产物 |
| VideoNode.tsx | ~250 | 2.5h | 🔄 | node-banana `GenerateVideoNode.tsx` |
| AudioNode.tsx | ~150 | 2h | 🔧 | 产物反推 |
| GridNode.tsx | ~120 | 1.5h | 🔄 | node-banana `SplitGridNode.tsx` |
| UniversalNode.tsx | ~350 | 4h | 🔧 | 产物反推（无开源对应） |
| App.tsx | ~500 | 4h | 📖 | node-banana 主布局 + 产物 |
| AccountsPanel.tsx | ~250 | 3h | 🔧 | 产物反推（Chrome API） |
| TransitPanel.tsx | ~150 | 2h | 🔧 | 产物反推 |
| SettingsPanel.tsx | ~200 | 2h | 📖 | node-banana Project Settings |
| Chrome Helpers + Utils | ~80 | 1h | 🔄 | AIPex `background.ts` |
| **合计** | **~3,280** | **~34h (约 4.5 天)** | | |

> 💡 相比原始估算（36h），参考项目可节省约 2h，主要体现在画布骨架和 API 调用层。

## 十二、权限分析

| 权限 | 用途 | 风险 |
|------|------|------|
| `contextMenus` | 右键菜单"发送到资源" | 低 |
| `storage` / `unlimitedStorage` | 存储资源中转站数据 | 低 |
| `cookies` | 多账号登录态管理 | 中 |
| `activeTab` | 获取当前标签页信息 | 低 |
| `scripting` | 注入脚本到页面 | 中 |
| `tabs` | 访问标签页信息 | 低 |
| `sidePanel` | 侧边栏面板 | 低 |
| `downloads` | 下载生成的图片/视频 | 中 |
| `<all_urls>` host_permissions | 所有网站访问权限 | **高** |

**⚠️ 安全关注点**: `<all_urls>` + `cookies` + `scripting` + `downloads` 的组合权限非常广泛。如果只需在特定站点操作，应缩小 `host_permissions` 范围。