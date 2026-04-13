# XShow 节点指导手册

> 本文档记录 XShow 节点系统的命名规范、分类体系、实现架构和数据流转。
> 
> **参考版本**: 2025-04-14

---

## 目录

1. [命名规范](#1-命名规范)
2. [节点分类体系](#2-节点分类体系)
3. [节点类型速查表](#3-节点类型速查表)
4. [核心数据结构](#4-核心数据结构)
5. [画布流转机制](#5-画布流转机制)
6. [执行引擎架构](#6-执行引擎架构)
7. [nodeFactory + executor 数据流图](#7-nodefactory--executor-数据流图)
8. [与 node-banana 的对照与设计目的](#8-与-node-banana-的对照与设计目的)
9. [开发指南](#9-开发指南)

---

## 1. 命名规范

### 1.1 核心规则

XShow 采用功能优先的命名规范，与 node-banana 保持对齐：

| 规则 | 命名模式 | 示例 | 说明 |
|------|----------|------|------|
| **生成节点** | `{功能}Node` | `imageNode`, `videoNode`, `audioNode`, `textNode` | 无后缀，表示"生成"动作 |
| **输入节点** | `{功能}InputNode` | `imageInputNode`, `videoInputNode`, `audioInputNode`, `textInputNode` | `Input` 后缀表示数据输入 |
| **处理节点** | `{功能}Node` | `cropNode`, `gridSplitNode`, `videoStitchNode` | 表示数据处理操作 |
| **输出节点** | `{功能}Node` | `outputNode`, `outputGalleryNode` | 表示数据输出端 |
| **特殊节点** | 自定义 | `omniNode`, `d3Node`, `viewer3DNode` | 功能性命名 |

### 1.2 命名约定

```typescript
// ✅ 正确命名
'imageNode'      // 图片生成
'imageInputNode' // 图片输入
'audioNode'      // 音频生成 (TTS)
'audioInputNode' // 音频输入
'd3Node'         // 3D 生成
'omniNode'       // 万能节点

// ❌ 错误命名（旧版已废弃）
'generateAudioNode'  // → 改为 audioNode
'generate3DNode'     // → 改为 d3Node
'customNode'         // → 改为 omniNode
```

### 1.3 数据类型别名

为向后兼容，提供以下类型别名：

```typescript
// types.ts 兼容性别名
export type AudioNodeType = AudioNode;           // 音频生成节点别名
export type UniversalNodeType = OmniNodeType;    // 万能节点别名
export type Generate3DNodeType = D3NodeType;     // 3D 节点别名
export type GenerateAudioNodeType = AudioNode;   // TTS 节点别名
```

---

## 2. 节点分类体系

XShow 节点按功能分为 **7 大类**：

```
┌─────────────────────────────────────────────────────────────┐
│                    XShow 节点分类                            │
├─────────────────────────────────────────────────────────────┤
│  Input 输入层                                                │
│  ├── imageInputNode    图片输入上传                           │
│  ├── videoInputNode    视频输入上传                           │
│  ├── audioInputNode    音频输入上传                           │
│  ├── textInputNode     文本输入/上传                          │
│  └── viewer3DNode      3D 模型查看器                          │
├─────────────────────────────────────────────────────────────┤
│  Text 文本层                                                 │
│  ├── promptNode         提示词节点 (共用 TextNode 组件)       │
│  └── promptConstructorNode  提示词构造器                     │
├─────────────────────────────────────────────────────────────┤
│  Generate 生成层                                             │
│  ├── imageNode    图片生成 (Gemini/DALL-E)                   │
│  ├── videoNode    视频生成                                   │
│  ├── audioNode    音频生成 (TTS)                             │
│  ├── textNode     文本生成 (LLM)                             │
│  └── d3Node        3D 模型生成                               │
├─────────────────────────────────────────────────────────────┤
│  Process 处理层                                              │
│  ├── cropNode          图片裁剪                              │
│  ├── annotateNode      图片标注                              │
│  ├── gridSplitNode     九宫格拆分                            │
│  ├── gridMergeNode     九宫格合并                            │
│  ├── videoStitchNode   视频拼接                              │
│  ├── videoTrimNode     视频裁剪                              │
│  ├── frameGrabNode     帧提取                                │
│  ├── imageCompareNode  图片对比                              │
│  └── easeCurveNode     缓动曲线                              │
├─────────────────────────────────────────────────────────────┤
│  Route 路由层                                                │
│  ├── routerNode           数据路由                           │
│  ├── switchNode           开关控制                           │
│  └── conditionalSwitchNode 条件路由                          │
├─────────────────────────────────────────────────────────────┤
│  Output 输出层                                               │
│  ├── outputNode       单输出节点                             │
│  └── outputGalleryNode 图集输出                             │
├─────────────────────────────────────────────────────────────┤
│  Custom 自定义层                                             │
│  └── omniNode   万能节点 (HTTP API / ComfyUI)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 节点类型速查表

### 3.1 输入节点 (Input Nodes)

| 类型 | 数据接口 | 默认尺寸 | 功能描述 |
|------|----------|----------|----------|
| `imageInputNode` | 输出: `image` | 280×280 | 上传图片，输出 `imageUrl` |
| `videoInputNode` | 输出: `video` | 320×280 | 上传视频，输出 `videoUrl` |
| `audioInputNode` | 输出: `audio` | 360×200 | 上传音频，输出 `audioUrl` |
| `textInputNode` | 输出: `text` | 300×200 | 文本输入/上传，输出 `text` |
| `viewer3DNode` | 输出: `3d` | 320×320 | 3D 模型查看器 |

### 3.2 生成节点 (Generate Nodes)

| 类型 | 输入 | 输出 | 默认尺寸 | 功能描述 |
|------|------|------|----------|----------|
| `imageNode` | `image`, `text` | `image` | 224×224 | 图片生成 (AI) |
| `videoNode` | `image`, `text` | `video` | 320×320 | 视频生成 |
| `audioNode` | `text` | `audio` | 320×280 | 音频生成 (TTS) |
| `textNode` | `text` | `text` | 400×240 | 文本生成 (LLM) |
| `promptNode` | - | `text` | 400×240 | 提示词构造 (共用 TextNode) |
| `d3Node` | `text`, `image` | `3d` | 320×300 | 3D 模型生成 |

### 3.3 处理节点 (Process Nodes)

| 类型 | 输入 | 输出 | 默认尺寸 | 功能描述 |
|------|------|------|----------|----------|
| `cropNode` | `image` | `image` | 300×300 | 图片裁剪 |
| `annotateNode` | `image` | `image` | 400×400 | 图片标注 |
| `gridSplitNode` | `image` | 多个 `image` | 300×300 | 九宫格拆分 |
| `gridMergeNode` | 多个 `image` | `image` | 300×300 | 九宫格合并 |
| `videoStitchNode` | 多个 `video` | `video` | 320×300 | 视频拼接 |
| `videoTrimNode` | `video` | `video` | 320×300 | 视频裁剪 |
| `frameGrabNode` | `video` | `image` | 320×300 | 帧提取 |
| `imageCompareNode` | 2×`image` | `image` | 320×280 | 图片对比 |

### 3.4 路由节点 (Route Nodes)

| 类型 | 输入 | 输出 | 功能描述 |
|------|------|------|----------|
| `routerNode` | 任意类型 | 多路输出 | 数据分流 |
| `switchNode` | 任意类型 | 多路输出 | 条件开关 |
| `conditionalSwitchNode` | `text` | 多路输出 | 规则路由 |

### 3.5 输出节点 (Output Nodes)

| 类型 | 输入 | 功能描述 |
|------|------|----------|
| `outputNode` | `image`, `video`, `audio`, `text` | 单项输出 |
| `outputGalleryNode` | 多个 media | 图集输出展示 |

### 3.6 特殊节点

| 类型 | 功能描述 |
|------|----------|
| `omniNode` | 万能节点，支持 HTTP API / ComfyUI 工作流 |

---

## 4. 核心数据结构

### 4.1 节点数据接口

所有节点数据接口继承自 `BaseNodeData`：

```typescript
// types.ts
export interface BaseNodeData extends Record<string, unknown> {
  label?: string;
  loading?: boolean;
  errorMessage?: string;
}

// ReactFlow Node 类型别名
export type ImageNode = Node<ImageNodeData, 'imageNode'>;
export type VideoNode = Node<VideoNodeData, 'videoNode'>;
// ... 其他节点类型
```

### 4.2 nodeFactory 结构

```typescript
// src/utils/nodeFactory.ts

// 1. nodeTypes 映射表：类型 → 组件
export const nodeTypes: Record<string, ComponentType<NodeProps>> = {
  // 生成节点
  imageNode: ImageNode,
  textNode: TextNode,
  promptNode: TextNode,      // ⚠️ 共用 TextNode 组件
  videoNode: VideoNode,
  audioNode: GenerateAudioNode,
  d3Node: D3Node,
  omniNode: UniversalNode,
  
  // 输入节点
  textInputNode: TextInputNode,
  videoInputNode: VideoInputNode,
  imageInputNode: ImageInputNode,
  audioInputNode: AudioNode,
  viewer3DNode: Viewer3DNode,
  
  // 处理节点
  cropNode: CropNode,
  // ... 其他处理节点
};

// 2. NODE_DEFAULTS：类型 → 默认尺寸
const NODE_DEFAULTS: Record<string, { width: number; height: number }> = {
  imageNode: { width: 224, height: 224 },
  textNode: { width: 400, height: 240 },
  // ... 其他节点尺寸
};

// 3. getDefaultData：类型 → 默认数据
function getDefaultData(type: string): Record<string, unknown> {
  switch (type) {
    case 'imageNode':
      return { prompt: '', aspectRatio: '1:1', imageSize: '1K', ... };
    case 'textNode':
    case 'promptNode':        // ⚠️ 共用默认数据
      return { prompt: '', label: type === 'promptNode' ? '提示词' : '文本节点', ... };
    // ... 其他节点默认数据
  }
}
```

### 4.3 nodeExecutors 注册表

```typescript
// src/store/execution/index.ts

export const nodeExecutors: NodeExecutorRegistry = {
  // 输出节点
  outputNode: executeOutput,
  outputGalleryNode: executeOutputGallery,

  // 输入节点（数据透传）
  imageInputNode: executeImageInput,
  videoInputNode: executeVideoInput,
  audioInputNode: executeAudioInput,
  textInputNode: executeTextInput,
  viewer3DNode: undefined,  // 无执行逻辑

  // 生成节点
  imageNode: executeImageNode,
  textNode: executeTextNode,
  promptNode: executeTextNode,  // ⚠️ 共用执行器
  videoNode: executeVideoNode,
  audioNode: executeAudioNode,
  d3Node: undefined,  // 待实现

  // 处理节点
  cropNode: executeCrop,
  annotateNode: executeAnnotate,
  // ... 其他处理节点

  // 万能节点
  omniNode: executeUniversalNode,
};
```

---

## 5. 画布流转机制

### 5.1 数据流概述

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Input Node   │────▶│ Process Node │────▶│ Output Node  │
│  (数据输入)   │     │  (数据处理)   │     │  (结果输出)   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                     │
       │                     │
       ▼                     ▼
┌──────────────┐     ┌──────────────┐
│ Generate Node │     │  Router Node │
│  (AI 生成)    │     │  (数据路由)   │
└──────────────┘     └──────────────┘
```

### 5.2 Handle 类型映射

节点间通过 Handle 连接，Handle 类型决定数据流方向：

| Handle 类型 | 数据格式 | 使用节点 |
|-------------|----------|----------|
| `image` | 图片 URL (string) | imageInputNode, imageNode, cropNode... |
| `video` | 视频 URL (string) | videoInputNode, videoNode, videoStitchNode... |
| `audio` | 音频 URL (string) | audioInputNode, audioNode |
| `text` | 文本内容 (string) | textInputNode, textNode, promptNode... |
| `3d` | 3D 模型 URL (string) | d3Node, viewer3DNode |

### 5.3 connectedInputs 数据流

```typescript
// src/utils/connectedInputs.ts

export interface ConnectedInputs {
  images: string[];    // 图片 URL 数组
  videos: string[];    // 视频 URL 数组
  audio: string[];    // 音频 URL 数组
  text: string | null; // 文本内容
  textItems: string[]; // 文本项数组
  model3d: string | null; // 3D 模型 URL
}

// 获取节点所有上游输入
function getConnectedInputs(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  visited?: Set<string>
): ConnectedInputs
```

---

## 6. 执行引擎架构

### 6.1 执行流程

```
用户触发执行
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                     executeCanvas()                          │
│  1. BFS 拓扑排序节点                                         │
│  2. 按层级顺序执行节点                                        │
│  3. 每个节点获取上游数据                        │
│  4. 调用节点执行器 (nodeExecutors)                           │
│  5. 更新节点状态 (loading, errorMessage, outputUrl)         │
└─────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Node Executor                              │
│  执行器签名:                                                  │
│  type NodeExecutor = (                                       │
│    node: Node,                                               │
│    nodes: Node[],                                            │
│    edges: Edge[],                                            │
│    context: NodeExecutionContext                             │
│  ) => Promise<void>                                          │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 节点执行器分类

```typescript
// 简单节点执行器：数据透传或简单转换
export {
  executeOutput,        // 输出节点：保存结果
  executeOutputGallery,  // 图集输出：收集多媒体
  executeImageInput,     // 图片输入：透传 imageUrl
  executeVideoInput,     // 视频输入：透传 videoUrl
  executeAudioInput,     // 音频输入：透传 audioUrl
  executeTextInput,      // 文本输入：透传 text
  executeCrop,           // 裁剪：图片处理
  executeAnnotate,       // 标注：图片处理
  // ...
} from './simpleNodeExecutors';

// 生成节点执行器：调用 AI API
export {
  executeImageNode,     // 图片生成：调用 Gemini/DALL-E
  executeTextNode,      // 文本生成：调用 LLM
  executeVideoNode,     // 视频生成：调用视频 API
  executeAudioNode,     // 音频生成：TTS
} from './generateNodeExecutors';

// 万能节点执行器：HTTP API / ComfyUI
export { executeUniversalNode } from './universalExecutor';
```

---

## 7. nodeFactory + executor 数据流图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         用户创建节点                                     │
│                              │                                           │
│                              ▼                                           │
│                    ┌─────────────────┐                                   │
│                    │  createNode()   │                                   │
│                    │  nodeFactory.ts │                                   │
│                    └────────┬────────┘                                   │
│                             │                                             │
│         ┌───────────────────┼───────────────────┐                        │
│         │                   │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │ nodeTypes[] │    │NODE_DEFAULTS│    │getDefaultData│                 │
│  │ 类型→组件   │    │ 类型→尺寸    │    │ 类型→数据    │                  │
│  └─────────────┘    └─────────────┘    └─────────────┘                  │
│         │                   │                   │                        │
│         └───────────────────┴───────────────────┘                        │
│                             │                                             │
│                             ▼                                             │
│                    ┌─────────────────┐                                   │
│                    │   ReactFlow Node │                                   │
│                    │   {id, type,    │                                   │
│                    │    position,    │                                   │
│                    │    data, style} │                                   │
│                    └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                         用户执行工作流                                   │
│                              │                                           │
│                              ▼                                           │
│                    ┌─────────────────┐                                   │
│                    │ executeCanvas() │                                   │
│                    │ execution/index │                                   │
│                    └────────┬────────┘                                   │
│                             │                                             │
│         ┌───────────────────┼───────────────────┐                        │
│         │ BFS 拓扑排序      │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │  Layer 0    │    │  Layer 1    │    │  Layer N    │                  │
│  │ (输入节点)  │───▶│ (处理节点)  │───▶│ (输出节点)  │                  │
│  └─────────────┘    └─────────────┘    └─────────────┘                  │
│         │                   │                   │                        │
│         └───────────────────┴───────────────────┘                        │
│                             │                                             │
│                             ▼                                             │
│                    ┌─────────────────┐                                   │
│                    │getNodeExecutor()│                                   │
│                    │ nodeExecutors   │                                   │
│                    └────────┬────────┘                                   │
│                             │                                             │
│         ┌───────────────────┼───────────────────┐                        │
│         │                   │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │simpleExecutor│   │generateExecutor│  │universalExecutor│              │
│  │ 数据透传     │    │ AI API 调用  │    │ HTTP/ComfyUI │                  │
│  └─────────────┘    └─────────────┘    └─────────────┘                  │
│         │                   │                   │                        │
│         └───────────────────┴───────────────────┘                        │
│                             │                                             │
│                             ▼                                             │
│                    ┌─────────────────┐                                   │
│                    │ updateNodeData()│                                   │
│                    │ useFlowStore    │                                   │
│                    └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. 与 node-banana 的对照与设计目的

### 8.1 命名对照表

| XShow 类型 | node-banana 类型 | 说明 |
|------------|------------------|------|
| `imageNode` | `imageNode` | ✅ 一致 |
| `imageInputNode` | `imageInputNode` | ✅ 一致 |
| `videoNode` | `videoNode` | ✅ 一致 |
| `videoInputNode` | `videoInputNode` | ✅ 一致 |
| `audioNode` | `generateAudioNode` | ⚠️ XShow 简化命名 |
| `audioInputNode` | `audioNode` | ⚠️ node-banana 名为音频输入 |
| `textNode` | `textNode` | ✅ 一致 |
| `textInputNode` | `textInputNode` | ✅ 一致 |
| `promptNode` | `promptNode` | ✅ 一致 |
| `d3Node` | `generate3DNode` | ⚠️ XShow 简化命名 |
| `omniNode` | `customNode` | ⚠️ XShow 更语义化命名 |
| `viewer3DNode` | `viewer3DNode` | ✅ 一致 |

### 8.2 设计目的

#### 为什么统一命名规范？

1. **可读性提升**
   - `audioNode` vs `generateAudioNode`：更简洁，功能明确
   - `d3Node` vs `generate3DNode`：避免冗余前缀
   - `omniNode` vs `customNode`：语义更准确（万能节点）

2. **架构清晰**
   - `Input` 后缀明确表示"输入节点"
   - 无后缀表示"生成节点"
   - 处理节点用功能命名（`cropNode`, `gridSplitNode`）

3. **组件复用**
   - `promptNode` 与 `textNode` 共用组件和执行器
   - 减少代码重复，降低维护成本

#### 与 node-banana 的对齐策略

```typescript
// 1. 类型别名保持兼容
export type UniversalNodeType = OmniNodeType;
export type Generate3DNodeType = D3NodeType;

// 2. 执行器映射
nodeExecutors: {
  promptNode: executeTextNode,  // 共用执行器
  // ...
}

// 3. 组件复用
nodeTypes: {
  promptNode: TextNode,  // 共用组件
  // ...
}
```

---

## 9. 开发指南

### 9.1 新增节点步骤

1. **定义类型** (`src/types.ts`)
```typescript
// 1. 定义数据接口
export interface NewNodeData extends BaseNodeData {
  myField?: string;
  // ...
}

// 2. 定义 Node 类型别名
export type NewNodeType = Node<NewNodeData, 'newNode'>;

// 3. 添加到 AppNode 联合类型
export type AppNode = ... | NewNodeType;
```

2. **创建组件** (`src/components/canvas/NewNode.tsx`)
```typescript
function NewNode({ id, data, selected }: NodeProps<NewNodeType>) {
  // 组件实现
}
export default memo(NewNode);
```

3. **注册 nodeTypes** (`src/utils/nodeFactory.ts`)
```typescript
const NewNode = lazy(() => import('@/components/canvas/NewNode'));

export const nodeTypes = {
  // ...
  newNode: NewNode as unknown as ComponentType<NodeProps>,
};

const NODE_DEFAULTS = {
  // ...
  newNode: { width: 300, height: 200 },
};

function getDefaultData(type: string) {
  switch (type) {
    // ...
    case 'newNode':
      return { myField: '' } as NewNodeData;
  }
}
```

4. **实现执行器** (`src/store/execution/simpleNodeExecutors.ts` 或 `generateNodeExecutors.ts`)
```typescript
export async function executeNewNode(
  node: Node,
  nodes: Node[],
  edges: Edge[],
  context: NodeExecutionContext
): Promise<void> {
  // 执行逻辑
}
```

5. **注册执行器** (`src/store/execution/index.ts`)
```typescript
import { executeNewNode } from './simpleNodeExecutors';

export const nodeExecutors = {
  // ...
  newNode: executeNewNode,
};
```

6. **添加 UI 入口** (`src/components/canvas/NodeSidebar.tsx`)
```typescript
const NODE_CATEGORIES = [
  // ...
  {
    title: 'Category Name',
    items: [
      // ...
      { type: 'newNode', label: '新节点', icon: NewIcon },
    ],
  },
];
```

### 9.2 测试验证

```bash
# 类型检查
npm run typecheck

# 运行测试
npm test

# 构建验证
npm run build
```

---

## 附录：文件结构

```
src/
├── types.ts                        # 所有类型定义
├── utils/
│   ├── nodeFactory.ts              # nodeTypes + createNode
│   └── connectedInputs.ts          # 数据流映射
├── components/canvas/
│   ├── ImageNode.tsx               # 图片生成节点
│   ├── VideoNode.tsx               # 视频生成节点
│   ├── AudioNode.tsx               # 音频输入节点
│   ├── GenerateAudioNode.tsx       # 音频生成节点 (TTS)
│   ├── TextNode.tsx                # 文本节点 (promptNode 共用)
│   ├── TextInputNode.tsx           # 文本输入节点
│   ├── ImageInputNode.tsx          # 图片输入节点
│   ├── VideoInputNode.tsx          # 视频输入节点
│   ├── UniversalNode.tsx           # 万能节点 (omniNode)
│   ├── Generate3DNode.tsx          # 3D 生成节点 (d3Node)
│   ├── Viewer3DNode.tsx            # 3D 查看器
│   ├── NodeSidebar.tsx             # 节点侧边栏
│   └── ...                         # 其他节点组件
├── store/execution/
│   ├── index.ts                    # nodeExecutors 注册
│   ├── types.ts                    # 执行器类型定义
│   ├── simpleNodeExecutors.ts      # 简单执行器
│   ├── generateNodeExecutors.ts    # 生成节点执行器
│   └── universalExecutor.ts        # 万能节点执行器
└── stores/
    ├── useFlowStore.ts             # 画布状态管理
    └── useSettingsStore.ts         # 设置状态管理
```

---

**文档版本**: 2025-04-14  
**维护者**: XShow Team  
**参考项目**: node-banana (命名规范对齐)