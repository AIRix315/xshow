# XShow 执行引擎与生成节点优化方案

> 对标项目：node-banana | 编制日期：2026-04-17 | 版本：v5 (去过度设计版)
>
> 核心约束：XShow 是 Chrome Extension（Side Panel）环境，非独立 Web 应用。所有优化必须轻量、低内存。
>
> 实施策略：方案 A（测试先行）— 先补测试建立安全网，再实现功能。

---

## 1. 现状分析

### 1.1 双重生成路径问题

XShow 存在两条独立的生成路径，逻辑高度重复：

| 路径 | 入口 | 用途 | 问题 |
|------|------|------|------|
| **内联路径** | 节点 header Play 按钮 → `handleGenerate` 回调 | 用户手动单节点运行 | 读取 channel 配置、调用 API、更新 node.data —— 全部内联 |
| **执行器路径** | FloatingActionBar Run → `executeWorkflow` → `generateNodeExecutors.ts` | 工作流批量执行 | 读取相同 channel 配置、调用相同 API —— 逻辑重复 |

**具体重复点**（以 ImageNode 为例）：

```
内联 handleGenerate (ImageNode.tsx L99-122):
  1. useCurrentChannel(currentChannelId) — 通过 hook 获取 channel（非 getState）
  2. effectivePrompt = textFromHandle || prompt — 手动遍历 edges 获取上游文本（非 getConnectedInputs）
  3. updateNodeData(id, { loading: true, ... })
  4. generateImage({ channelUrl, channelKey, model, prompt, ... })
  5. updateNodeData(id, { imageUrl, loading: false })

执行器 executeImageNode (generateNodeExecutors.ts L24-81):
  1. useSettingsStore.getState().apiConfig.channels     ← 等价（直接 getState 方式）
  2. ctx.getConnectedInputs(node.id) 合并 prompt          ← 更完整（还处理上游图片输入）
  3. updateNodeData(node.id, { loading: true, ... })      ← 相同
  4. generateImage({ channelUrl, channelKey, model, ... }) ← 相同
  5. updateNodeData(node.id, { imageUrl, loading: false }) ← 相同
```

> **内联路径与执行器的差异**（统一后需处理）：
> - **ImageNode**：内联路径不处理上游图片输入（`referenceImages`），不支持图生图模式的连线输入。统一后将自动获得此能力（行为增强，无回归风险）。
> - **TextNode**：内联路径有 `autoSplit` 逻辑（生成后自动创建子节点并连线，L68-102），执行器 `executeTextNode` 中无此逻辑。详见 §3.1 autoSplit 架构决策。
> - ~~**VideoNode**：内联路径与执行器使用等价 API~~ — 已确认 `generateVideo()` 就是 `submitVideoTask() + pollVideoTask()` 的封装（videoApi.ts L104-109），无差异。

5 个生成节点全部存在此问题：ImageNode、VideoNode、TextNode、GenerateAudioNode、Generate3DNode。

### 1.2 执行引擎现状

```
executionEngine.ts (126 行)
├── buildLayers()     — BFS 拓扑分层
├── executeCanvas()   — 按层 Promise.allSettled，150ms 层间延迟
└── executeFromNode() — 从指定节点出发 BFS

缺失能力：
  - 无并发控制（同层全部并行，可能同时发出 10+ API 请求）
  - 无暂停/恢复（仅有 stopWorkflow / AbortController.abort）
  - 无跳过传播（上游失败不阻止下游执行）
```

### 1.3 节点功能缺失

| 特性 | node-banana | XShow 现状 |
|------|-------------|-----------|
| 生成历史轮播 | ImageNode/VideoNode 有 `imageHistory` 数组，左右箭头切换 | ❌ 无历史，每次生成覆盖 |
| 自动缩放预览 | ResizeObserver + CSS transition 自适应内容高度 | ❌ 固定高度 |
| settingsPanel 动画 | ResizeObserver 驱动的展开/收起动画 | ❌ XShow 的 settingsPanel 简单条件渲染，无动画（且仅 RhAppNode 传递 undefined，实际未使用） |
| 节点级 Provider/Model | BaseNode 集成，所有生成节点可切换 | ✅ ProviderModelSelector 组件，但仅在 hover header |

### 1.4 性能约束

Chrome Extension Side Panel 环境：
- 内存限制：Extension 总内存 ~300MB（Side Panel 共享进程）
- 无 Node.js 运行时，纯浏览器 API
- `manifest.json` 已声明 `unlimitedStorage`（IndexedDB 无限），但 API 调用并发仍受浏览器限制（同一域名最多 6 并发 HTTP/1.1 连接）
- `CanvasSettings.reduceAnimations` 已存在 —— 任何动画特性必须尊重此开关

---

## 2. 优化方案总览

| 编号 | 优化项 | 优先级 | Sprint | 核心收益 |
|------|--------|--------|--------|---------|
| **U1** | 统一生成路径（消除双重路径） | P0 | S1 | 消除 5 个节点的逻辑重复，新增功能只需改一处 |
| **E1** | 执行引擎并发控制 | P0 | S1 | 防止 Side Panel 同时发出过多 API 请求 |
| **N1** | 生成历史轮播 | P1 | S2 | 保留历史结果，可对比选择 |
| **E2** | 执行引擎 fail-fast 与错误传播 | P1 | S2 | 上游失败阻止下游无效执行（硬编码启用） |
| **N2** | 图片/视频预览自适应高度 | P2 | S3 | 减少滚动，提升浏览体验 |

**明确排除的项**：
- ~~settingsPanel 动画~~ — XShow 的 settingsPanel 无动画，RhAppNode 传 undefined，实际未使用，不适用
- ~~暂停/恢复~~ — Chrome Extension Side Panel 场景下工作流通常较短（生成图片/视频），复杂度过高收益过低
- ~~节点内嵌 ProviderModelSelector~~ — 已在 hover header 中实现，当前位置合理
- ~~磁盘持久化历史~~ — Chrome Extension 不适合频繁文件 I/O，使用内存存储
- ~~VideoNode API 对齐~~ — 已确认 `generateVideo()` 与 `submitVideoTask + pollVideoTask` 完全等价（videoApi.ts L104-109），无需对齐
- ~~autoSplit 迁移到 executor~~ — 采用组件后置方案（§3.1），executor 不涉及图结构操作

---

## 3. 详细方案

### 3.1 U1-前序：TextNode autoSplit 架构决策

**问题**：U1 统一后，TextNode 的 `handleGenerate` 变成调用 `executeTextNode(ctx)`。autoSplit 逻辑目前写在组件内（L68-102，调用 `addNodes`/`addEdge` 创建子节点），统一后会丢失。

**评估过的方案**：

| 方案 | executor 纯度 | 改动量 | 可测试性 | 与 node-banana 一致性 | 结论 |
|------|:---:|:---:|:---:|:---:|------|
| A: ctx 回调注入（addNodes/addEdge） | ❌ 破坏 | 小 | ⚠️ 需 mock | ❌ 偏离 | ❌ 不选 |
| B: 执行器返回副作用描述 | ✅ 保持 | 大 | ✅ 最佳 | ✅ 一致 | ❌ 过度设计 |
| C: onSideEffects 回调 | ⚠️ 半纯 | 中 | ✅ 良好 | ⚠️ 半一致 | ❌ 过度抽象 |
| **D: 组件后置处理** | **✅ 保持** | **最小** | **✅ 良好** | **✅ 一致** | **✅ 采用** |

**采用方案 D 的理由**：

1. **executor 保持纯逻辑层** — 只更新 `node.data`，不操作图结构，与 node-banana 一致（node-banana executor 中零处调用 addNode/addEdge）
2. **改动最小、零回归风险** — executor 唯一变化是多写 `splitItems` 到 `nodeData`，autoSplit 逻辑留在组件几乎不动
3. **autoSplit 是 XShow 特有的 UI 行为**，非 executor 通用职责。未来如需加确认弹窗、limit 等交互逻辑，改组件比改 executor 更自然
4. **Zustand store 可在任意位置调用** — `addNodes`/`addEdge` 来自 `useFlowStore`（非 ReactFlow hook），在组件回调中调用无障碍

**实现方式**：

```typescript
// executeTextNode 尾部（generateNodeExecutors.ts）— 唯一变更：传递 splitItems
updateNodeData(node.id, {
  text: result.text,
  loading: false,
  splitItems: result.splitItems || [],  // 新增：传递给组件层
});

// TextNode.tsx handleGenerate（组件层）— autoSplit 逻辑几乎不变
const handleGenerate = useCallback(async () => {
  // ... 构造 ctx 并调用执行器 ...
  await executeTextNode(ctx);

  // 统一调用后，检查 autoSplit（保持现有逻辑）
  const freshNode = useFlowStore.getState().nodes.find(n => n.id === id);
  const splitItems = freshNode?.data?.splitItems as AutoSplitResult[] | undefined;
  if (autoSplit && splitItems?.length) {
    // ... 现有 autoSplit 逻辑（创建子节点、连线）不变 ...
  }
}, [id, autoSplit]);
```

---

### 3.2 U1: 统一生成路径

**目标**：将内联 `handleGenerate` 逻辑统一到执行器层，节点组件只负责构造 ctx 并调用执行器。

**策略**：保留执行器路径（`generateNodeExecutors.ts`）作为唯一生成逻辑入口，内联路径改为构造 `NodeExecutionContext` 后调用同一执行器。

#### 变更文件清单

| 文件 | 操作 | 变更内容 |
|------|------|---------|
| `src/components/canvas/ImageNode.tsx` | 修改 | `handleGenerate` 改为构造 ctx → 调用 `executeImageNode(ctx)` |
| `src/components/canvas/VideoNode.tsx` | 修改 | 同上模式 |
| `src/components/canvas/TextNode.tsx` | 修改 | 同上模式 + autoSplit 组件后置处理（§3.1） |
| `src/components/canvas/GenerateAudioNode.tsx` | 修改 | 同上模式 |
| `src/components/canvas/Generate3DNode.tsx` | 修改 | 同上模式（placeholder 状态） |
| `src/store/execution/generateNodeExecutors.ts` | 微调 | `executeTextNode` 成功后额外写入 `splitItems` 到 nodeData（§3.1） |

#### 统一模式伪代码（以 ImageNode 为例）

```typescript
// 修改前 (ImageNode.tsx L99-122)
const handleGenerate = useCallback(async () => {
  // ~24 行内联逻辑：读 channel、读 prompt、调 generateImage、更新 data...
}, [...dependencies]);

// 修改后 — 所有 5 个生成节点统一遵循此模式
import { executeImageNode } from '@/store/execution/generateNodeExecutors';
import { getConnectedInputs } from '@/utils/connectedInputs';

const handleGenerate = useCallback(async () => {
  // 使用 getState() 获取最新状态，避免闭包陈旧问题
  const { nodes, edges } = useFlowStore.getState();
  const abortController = new AbortController();

  const ctx: NodeExecutionContext = {
    node: nodes.find(n => n.id === id)!,        // 从 store 获取完整 Node
    nodes,
    edges,
    getConnectedInputs: (nodeId) => getConnectedInputs(nodeId, nodes, edges),
    updateNodeData: (nid, patch) => useFlowStore.getState().updateNodeData(nid, patch),
    getFreshNode: (nid) => useFlowStore.getState().nodes.find(n => n.id === nid),
    signal: abortController.signal,              // 传入 AbortSignal
  };
  await executeImageNode(ctx);
  // UI 回调在执行器之后（toast 通知等）
}, [id]);  // 依赖最小化 — nodes/edges 通过 getState() 获取
```

#### TextNode 特殊处理（autoSplit 组件后置）

```typescript
// TextNode.tsx — 在统一调用后追加 autoSplit
const handleGenerate = useCallback(async () => {
  const { nodes, edges } = useFlowStore.getState();
  const abortController = new AbortController();

  const ctx: NodeExecutionContext = {
    node: nodes.find(n => n.id === id)!,
    nodes, edges,
    getConnectedInputs: (nodeId) => getConnectedInputs(nodeId, nodes, edges),
    updateNodeData: (nid, patch) => useFlowStore.getState().updateNodeData(nid, patch),
    getFreshNode: (nid) => useFlowStore.getState().nodes.find(n => n.id === nid),
    signal: abortController.signal,
  };
  await executeTextNode(ctx);

  // autoSplit：组件后置处理（§3.1）
  const freshNode = useFlowStore.getState().nodes.find(n => n.id === id);
  const splitItems = freshNode?.data?.splitItems as AutoSplitResult[] | undefined;
  if (autoSplit && splitItems && splitItems.length > 0) {
    const parentNode = freshNode!;
    const childNodes: Node[] = splitItems.map((item, index) => ({
      id: `textNode-split-${Date.now()}-${index}`,
      type: 'textNode',
      position: { x: parentNode.position.x + 250, y: parentNode.position.y + index * 100 },
      data: {
        label: item.title,
        text: item.content,
        prompt: '',
        expanded: true,
        autoSplit: false,
        textModel: parentNode.data.textModel,
        loading: false,
        selectedContextResources: [],
        presetPrompts: [],
      },
      style: { width: 400, height: 240 },
    }));
    useFlowStore.getState().addNodes(childNodes);
    childNodes.forEach((child) => {
      useFlowStore.getState().addEdge({
        id: `${id}-${child.id}`,
        source: id,
        target: child.id,
      });
    });
  }
}, [id, autoSplit]);
```

**关键约束**：
- 节点内联路径仍支持 `onGenerate` 回调（用于 toast 通知等 UI 反馈），在调用执行器后追加
- 执行器不处理 UI 回调（toast、zoom 等），保持纯逻辑层
- **必须使用 `getState()` 获取 nodes/edges**：React 组件中的 `nodes`/`edges` 是闭包快照，在异步执行期间可能已变化。构造 ctx 时必须通过 `useFlowStore.getState()` 获取最新值（参考 `executeWorkflow` 中 L277-287 的做法）
- **必须传入 `signal`**：`NodeExecutionContext.signal` 字段已定义（`types.ts` L30），内联路径应创建 `AbortController` 并传入

#### 风险评估
- **低风险**：executor 不需要改动图结构（autoSplit 留在组件），改动范围可控
- **回归点**：5 个生成节点的内联生成必须保持行为一致
- **正向变更**：ImageNode 内联路径统一后自动获得上游图片输入处理能力

---

### 3.3 E1: 执行引擎并发控制

**目标**：同层节点执行时，限制最大并发 API 调用数。

#### 变更文件清单

| 文件 | 操作 | 变更内容 |
|------|------|---------|
| `src/utils/executionEngine.ts` | 修改 | `executeCanvas` 内部增加分块并发，`MAX_CONCURRENT` 常量硬编码为 3 |

#### executionEngine.ts 核心变更

```typescript
// 修改前
await Promise.allSettled(layerNodes.map(async (node) => { ... }));

// 修改后：带并发控制的分块执行（常量硬编码）
const MAX_CONCURRENT = 3; // Side Panel 保守值，低于浏览器 6 并发上限

async function runWithConcurrency(
  items: Node[],
  fn: (node: Node) => Promise<void>,
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = [];
  for (let i = 0; i < items.length; i += MAX_CONCURRENT) {
    const chunk = items.slice(i, i + MAX_CONCURRENT);
    const chunkResults = await Promise.allSettled(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}
```

> **设计说明**：采用"分块"式并发控制。`MAX_CONCURRENT` 为常量（硬编码 3），不暴露为用户设置——当前无用户反馈"并发太高被限流"，需要时改一行常量即可。不暴露 CanvasSettings 字段和 SettingsPanel UI，避免 YAGNI。

#### 风险评估
- **低风险**：仅影响执行引擎调度，不改变节点执行逻辑

---

### 3.4 N1: 生成历史轮播

**目标**：ImageNode 和 VideoNode 保留最近 N 次生成结果，支持左右箭头切换。

**策略**：纯内存存储（`node.data` 字段），不写磁盘，上限 10 条。

#### 变更文件清单

| 文件 | 操作 | 变更内容 |
|------|------|---------|
| `src/types.ts` | 修改 | `ImageNodeData` / `VideoNodeData` 增加历史字段 |
| `src/store/execution/generateNodeExecutors.ts` | 修改 | 执行器生成成功后写入历史数组 |
| `src/components/canvas/ImageNode.tsx` | 修改 | 预览区增加左右箭头和历史切换逻辑 |
| `src/components/canvas/VideoNode.tsx` | 修改 | 同上 |

#### 类型定义

```typescript
// ImageNodeData 新增
export interface ImageNodeData extends BaseNodeData {
  // ...existing fields
  /** 生成历史（内存，最多 10 条） */
  imageHistory?: Array<{ imageUrl: string; prompt: string; timestamp: number }>;
  /** 当前显示的历史索引 */
  selectedHistoryIndex?: number;
}

// VideoNodeData 新增
export interface VideoNodeData extends BaseNodeData {
  // ...existing fields
  /** 生成历史（内存，最多 10 条） */
  videoHistory?: Array<{ videoUrl: string; thumbnailUrl: string; prompt: string; timestamp: number }>;
  /** 当前显示的历史索引 */
  selectedVideoHistoryIndex?: number;
}
```

#### 执行器写入逻辑

```typescript
// executeImageNode 尾部（generateImage 成功后）
const MAX_HISTORY = 10;
const history = [...(nodeData.imageHistory || []), { imageUrl, prompt, timestamp: Date.now() }];
updateNodeData(node.id, {
  imageUrl,
  loading: false,
  imageHistory: history.slice(-MAX_HISTORY),
  selectedHistoryIndex: history.length - 1,
});
```

#### UI 交互

```
┌──────────────────────────┐
│  [◀] [2/5] [▶]          │  ← 历史指示器（仅历史数 > 1 时显示）
│  ┌──────────────────┐    │
│  │                  │    │
│  │    当前图片预览    │    │
│  │                  │    │
│  └──────────────────┘    │
│  prompt: xxxxxxxx        │  ← 切换历史时显示对应 prompt
└──────────────────────────┘
```

- 左右箭头切换 `selectedHistoryIndex`，同步更新 `imageUrl`/`videoUrl`
- 最新结果索引始终为 `imageHistory.length - 1`
- 当生成新结果时自动跳转到最新

#### 性能考量
- 每条历史记录仅存 URL 字符串 + prompt + timestamp，单条约 200B
- 10 条历史 ≈ 2KB/node，50 个图片节点 ≈ 100KB 总内存增加
- 浏览器图片缓存自动管理已有图片的内存，无需手动释放

#### 风险评估
- **低风险**：纯 UI + 内存数据，不影响执行引擎
- **持久化处理**：历史数据随 node.data 序列化，但 save 路径应在序列化前删除 `imageHistory`/`videoHistory` 字段（纯内存数据，不跨会话保留），load 后历史自然为空

---

### 3.5 E2: 执行引擎 fail-fast 与错误传播

**目标**：上游节点失败时，阻止其下游节点执行，避免浪费 API 调用。默认行为，硬编码启用。

#### 变更文件清单

| 文件 | 操作 | 变更内容 |
|------|------|---------|
| `src/utils/executionEngine.ts` | 修改 | `executeCanvas` 增加失败节点集合，层执行前跳过上游失败的节点 |
| `src/stores/useFlowStore.ts` | 修改 | `executeWorkflow` 的回调中提供 `onNodeSkipped` 处理 |

#### 核心逻辑

```typescript
// ExecutionCallbacks 新增回调
interface ExecutionCallbacks {
  // ...existing: executeNode, onNodeStart, onNodeComplete, onNodeError, onLayerStart
  /** 节点被跳过时回调（新增） */
  onNodeSkipped?: (nodeId: string) => void;
}

// executeCanvas 内部 — fail-fast 硬编码启用
const failedNodeIds = new Set<string>();

// 层执行前：检查该层每个节点的上游是否有失败节点
const shouldSkip = layerNodes.filter(node => {
  const upstreamEdges = edges.filter(e => e.target === node.id);
  return upstreamEdges.some(e => failedNodeIds.has(e.source));
});
// 跳过上游失败的节点，并传播跳过状态到间接下游
for (const node of shouldSkip) {
  failedNodeIds.add(node.id);  // ← 关键：将被跳过的节点也加入失败集合，确保间接下游也被跳过
  callbacks.onNodeStart?.(node.id);
  callbacks.onNodeSkipped?.(node.id);
}
```

> **间接上游传播**：当 A → B → C 链中 A 失败时，B 被跳过并加入 `failedNodeIds`，从而在处理 C 所在层时，C 的直接上游 B 在 `failedNodeIds` 中，C 也会被跳过。如果不将被跳过节点加入集合，则只有直接上游失败才会阻止执行。

#### 风险评估
- **低风险**：硬编码启用，行为确定，减少配置面

---

### 3.6 N2: 图片/视频预览自适应高度

**目标**：图片和视频预览区根据内容实际尺寸自适应高度，减少空白或溢出。

**策略**：使用 `ResizeObserver` 监听内容尺寸变化，动态设置容器高度。尊重 `reduceAnimations` 设置。

#### 变更文件清单

| 文件 | 操作 | 变更内容 |
|------|------|---------|
| `src/components/canvas/ImageNode.tsx` | 修改 | 图片容器增加自适应高度逻辑 |
| `src/components/canvas/VideoNode.tsx` | 修改 | 视频容器增加自适应高度逻辑 |

#### 实现思路

```typescript
import { useRef, useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

function useAdaptiveHeight(maxHeight = 400) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const reduceAnimations = useSettingsStore((s) => s.canvasSettings.reduceAnimations);

  // 图片/视频加载完成后计算适配高度
  const handleMediaLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
    const el = e.currentTarget;
    const container = containerRef.current;
    if (!container || !el.naturalWidth) return;
    const containerWidth = container.getBoundingClientRect().width;
    const naturalRatio = (el as HTMLImageElement).naturalHeight / (el as HTMLImageElement).naturalWidth;
    setPreviewHeight(Math.min(containerWidth * naturalRatio, maxHeight));
  }, [maxHeight]);

  // 监听容器宽度变化（侧边栏拖拽、窗口 resize 等）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const img = container.querySelector('img');
      const video = container.querySelector('video');
      const media = img || video;
      if (media && (media as HTMLImageElement).naturalWidth) {
        const containerWidth = container.getBoundingClientRect().width;
        const naturalRatio =
          (media as HTMLImageElement).naturalHeight / (media as HTMLImageElement).naturalWidth;
        setPreviewHeight(Math.min(containerWidth * naturalRatio, maxHeight));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [maxHeight]);

  const containerStyle: React.CSSProperties = {
    height: previewHeight ?? 'auto',
    minHeight: 120, // 回退最小高度
    transition: reduceAnimations ? 'none' : 'height 200ms ease',
  };

  return { containerRef, handleMediaLoad, containerStyle };
}
```

**使用方式**：

```tsx
function ImagePreview({ imageUrl }: { imageUrl: string }) {
  const { containerRef, handleMediaLoad, containerStyle } = useAdaptiveHeight(400);
  return (
    <div ref={containerRef} style={containerStyle}>
      <img src={imageUrl} onLoad={handleMediaLoad} alt="预览" className="max-w-full max-h-full object-contain" />
    </div>
  );
}
```

**性能考量**：
- `onLoad` 事件仅在图片首次加载时触发，不持续消耗性能
- `ResizeObserver` 仅在容器尺寸变化时触发回调，使用 passive 模式（浏览器默认），不影响渲染性能
- CSS `transition` 仅在 `reduceAnimations === false` 时启用
- 最大高度限制 400px，防止超大图片撑开节点
- 提取为 `useAdaptiveHeight` 自定义 hook，ImageNode 和 VideoNode 可复用

#### 风险评估
- **低风险**：纯 CSS/JS 尺寸计算，不影响数据流
- **注意事项**：需处理图片加载失败时的回退高度（`minHeight: 120` 已在 hook 中设置）
- **注意事项**：`ResizeObserver` 在所有现代浏览器中均可用，Chrome Extension 环境无兼容问题

---

## 4. 测试策略

### 4.1 现有测试覆盖

| 测试文件 | 用例数 | 覆盖模块 |
|----------|--------|---------|
| `generateNodeExecutors.test.ts` | ~21 | executeImageNode/TextNode/VideoNode/AudioNode（校验、成功、上游输入、错误） |
| `simpleNodeExecutors.test.ts` | ~16 | output/input/crop/frameGrab/videoStitch/imageCompare |
| `useFlowStore.test.ts` | ~17 | addNode/removeNode/updateNodeData/executeWorkflow/stopWorkflow |
| `useSettingsStore.test.ts` | ~13 | channel CRUD/project CRUD/presetPrompts |
| `executionEngine.test.ts` | **不存在** | — |
| ImageNode/VideoNode/TextNode 组件测试 | **不存在** | — |

### 4.2 实施策略：方案 A（测试先行）

```
Sprint 1: T1 → T2 → [实现 U1] → [实现 E1] → T4
Sprint 2: [实现 E2] → T5 → [实现 N1] → T6
Sprint 3: [实现 N2] → T7
```

**原则**：每个功能实现前先有测试兜底。executionEngine.ts 无任何测试就直接加并发控制和 fail-fast，回归风险太高，必须先建立安全网。

### 4.3 测试任务清单

#### T1: executionEngine.test.ts（新建）— Sprint 1 前置

| 测试场景 | 说明 |
|----------|------|
| buildLayers — 基础拓扑排序 | A→B→C 链应产生 3 层 |
| buildLayers — 并行节点同层 | A→C, B→C 应产生 2 层（A、B 同层，C 第二层） |
| buildLayers — 孤立节点 | 无边的节点应在第一层 |
| buildLayers — 环路处理 | 环路中的节点应不阻塞（当前 BFS 实现天然不阻塞） |
| executeCanvas — 调用每个节点 | 验证 executeNode 回调被调用 |
| executeCanvas — AbortSignal 中止 | AbortController.abort() 后不再执行后续节点 |
| executeCanvas — 150ms 层间延迟 | 层间应有延迟（可 mock timer 验证） |

#### T2: generateNodeExecutors.test.ts（扩展）— Sprint 1 前置

| 测试场景 | 说明 |
|----------|------|
| executeTextNode — autoSplit 返回 splitItems | autoSplit=true 时，updateNodeData 应包含 splitItems 字段 |
| executeTextNode — autoSplit=false 不返回 splitItems | 验证 splitItems 为空数组 |
| executeImageNode — AbortSignal 传播 | signal.abort() 后应抛出 AbortError |
| executeVideoNode — 进度回调 | 验证 updateNodeData 被调用多次传递 progress |

#### T4: executionEngine.test.ts（扩展）— E1 实现后

| 测试场景 | 说明 |
|----------|------|
| runWithConcurrency — maxConcurrent=1 串行 | 同层 3 个节点应按顺序执行 |
| runWithConcurrency — maxConcurrent=999 全并行 | 行为与未加并发控制时一致 |
| runWithConcurrency — chunk 内错误不影响后续 | 第一个 chunk 一个失败，第二个 chunk 仍执行 |

#### T5: executionEngine.test.ts（扩展）— E2 实现后

| 测试场景 | 说明 |
|----------|------|
| fail-fast — 直接上游失败阻止下游 | A→B，A 失败后 B 被跳过 |
| fail-fast — 间接上游传播 | A→B→C，A 失败后 B 和 C 都被跳过 |
| fail-fast — onNodeSkipped 回调 | 被跳过的节点应触发 onNodeSkipped |

#### T6: generateNodeExecutors.test.ts（扩展）— N1 实现后

| 测试场景 | 说明 |
|----------|------|
| executeImageNode — 写入 imageHistory | 成功后 updateNodeData 应包含 imageHistory |
| executeImageNode — MAX_HISTORY 截断 | 第 11 条历史应淘汰第 1 条 |
| executeImageNode — selectedHistoryIndex 更新 | 新结果应将索引设为最新 |

#### T7: useAdaptiveHeight.test.ts（新建）— N2 实现后

| 测试场景 | 说明 |
|----------|------|
| handleMediaLoad — 计算正确高度 | 16:9 图片在 300px 容器中应为 533px（capped at 400） |
| handleMediaLoad — maxHeight 上限 | 超大图片高度不超过 maxHeight |
| ResizeObserver — 容器 resize 后重新计算 | 容器宽度变化时高度更新 |
| reduceAnimations — 禁用 transition | containerStyle.transition 应为 'none' |

### 4.4 测试基础设施（已有）

| 项目 | 配置 |
|------|------|
| 框架 | Vitest + jsdom |
| UI 渲染 | @testing-library/react + jest-dom matchers |
| Setup | `src/setup-tests.ts`（RTL cleanup + URL polyfills） |
| Mock 模式 | `vi.mock()` 隔离 API/Store，`makeContext`/`makeNode` 工厂函数 |

---

## 5. Sprint 规划

### Sprint 1 (P0 — 基础设施)

| 任务 | 文件数 | 依赖 |
|------|--------|---------|
| T1 executionEngine 基础测试 | 1（新建） | 无 |
| T2 generateNodeExecutors 扩展测试 | 1（扩展） | 无 |
| **U1 统一生成路径** | 6 | T1, T2 |
| **E1 并发控制** | 1 | T1 |
| T4 并发控制扩展测试 | 1（扩展） | E1 |

**并行策略**：T1 + T2 先行（并行），完成后 U1 + E1 并行，最后 T4。

### Sprint 2 (P1 — 功能增强)

| 任务 | 文件数 | 依赖 |
|------|--------|---------|
| **E2 fail-fast** | 2 | E1 |
| T5 fail-fast 扩展测试 | 1（扩展） | E2 |
| **N1 生成历史轮播** | 4 | U1 |
| T6 历史轮播扩展测试 | 1（扩展） | N1 |

**并行策略**：E2 + T5 与 N1 + T6 可并行。

### Sprint 3 (P2 — 体验优化)

| 任务 | 文件数 | 依赖 |
|------|--------|---------|
| **N2 自适应高度** | 2 | 无 |
| T7 自适应高度测试 | 1（新建） | N2 |

**Sprint 3 可与 Sprint 2 并行。**

---

## 6. 不做的事情

| 排除项 | 原因 |
|--------|------|
| settingsPanel 展开/收起动画 | XShow 的 settingsPanel 为简单条件渲染，无动画，且仅 RhAppNode 传递 undefined，实际未使用 |
| 暂停/恢复执行 | Side Panel 工作流通常较短，复杂度过高收益过低；已有 stopWorkflow 足够 |
| 节点内嵌 ProviderModelSelector | 已在 hover header 实现，当前位置合理，不重复 |
| 历史磁盘持久化 | Chrome Extension 频繁文件 I/O 不实际，IndexedDB save/load 已自动包含 node.data |
| 全局进度条 | 当前逐节点 loading 状态已足够，Side Panel 空间有限 |
| 节点级 skip 状态 UI | E2 的跳过逻辑在引擎层完成，暂不在 UI 上显示 "已跳过" 标识，避免 scope 膨胀 |
| 自动缩放设置项 | N2 自适应高度直接生效，无需用户配置开关 |
| VideoNode API 对齐 | 已确认 `generateVideo()` = `submitVideoTask() + pollVideoTask()`（videoApi.ts L104-109），无差异 |
| autoSplit 迁移到 executor | 采用组件后置方案（§3.1），executor 不涉及图结构操作，与 node-banana 一致 |
| ctx 注入 addNodes/addEdge | executor 保持纯逻辑层，不操作图结构（§3.1 方案对比） |
| fail-fast 用户开关 | YAGNI — 无用户需求要求关闭，硬编码启用，避免 CanvasSettings 字段 + SettingsPanel UI |
| maxConcurrent 用户设置 | YAGNI — 常量 3 满足 99% 场景，需要时改一行常量 |
| 历史截断逻辑 | 纯内存数据，save 时直接删除 history 字段即可，无需截断逻辑 |

---

## 7. 验证清单

### Sprint 1 验证
- [ ] **T1**：buildLayers 正确处理链/并行/孤立/环路拓扑
- [ ] **T1**：executeCanvas 的 AbortSignal 中止后续节点
- [ ] **T2**：executeTextNode autoSplit=true 时写入 splitItems 到 nodeData
- [ ] **T2**：AbortSignal 在 executor 中正确传播
- [ ] **U1**：ImageNode hover Play 按钮生成的结果，与 FloatingActionBar Run 执行的结果完全一致
- [ ] **U1**：所有 5 个生成节点内联路径均走执行器
- [ ] **U1**：ImageNode 内联路径正确处理上游图片输入（图生图模式）
- [ ] **U1**：内联路径的 AbortController 可正确取消进行中的生成
- [ ] **U1**：TextNode autoSplit 在统一后仍正确创建子节点并连线
- [ ] **T4**：并发控制生效，同层节点按 MAX_CONCURRENT=3 分块执行
- [ ] **T4**：chunk 内错误不影响后续 chunk 执行

### Sprint 2 验证
- [ ] **T5**：上游失败阻止直接下游执行
- [ ] **T5**：上游失败也阻止间接下游执行（A→B→C 链，A 失败时 C 也被跳过）
- [ ] **T5**：onNodeSkipped 回调在跳过节点时正确触发
- [ ] **T6**：连续生成 3 张图片后，出现历史箭头，可切换查看
- [ ] **T6**：历史最多保留 10 条，第 11 条自动淘汰最早的
- [ ] 生成新结果后自动跳转到最新
- [ ] save file 不包含历史数据（save 时删除 history 字段）

### Sprint 3 验证
- [ ] **T7**：不同比例图片（1:1、16:9、9:16）均能正确自适应高度
- [ ] **T7**：ResizeObserver 在容器 resize 后重新计算高度
- [ ] reduceAnimations=true 时，高度切换无过渡动画
- [ ] 图片加载失败时回退到最小高度（120px）
- [ ] 视频容器自适应正常工作
- [ ] 侧边栏宽度变化时（拖拽 resize），图片预览高度重新计算

---

## 附录 A：与上一版方案的关键差异

| 项目 | 上一版 (v1) | 本版 (v2→v4) |
|------|-------------|-----------|
| I2 settingsPanel 动画 | 包含，建议添加 ResizeObserver 动画 | **删除** — 实际代码无此需求 |
| E2 暂停/恢复 | 包含，建议实现 pause/resume | **删除** — Side Panel 收益过低 |
| 节点实现假设 | 假设节点依赖执行引擎 | **修正** — 5 个节点均有内联 handleGenerate |
| 性能考量 | 未特别考虑 | **修正** — 所有方案考虑 Side Panel 内存/连接限制 |
| 双重路径 | 未识别 | **新增 U1** — 核心重构项 |
| 并发控制实现 | 未指定 | **常量 `MAX_CONCURRENT = 3`**，不暴露用户设置 |
| 历史存储 | 未明确存储方式 | **明确内存 + 随 node.data 自动持久化** |
| 测试策略 | 无 | **新增 §4** — 方案 A 测试先行，6 项测试任务（T1-T2, T4-T7） |
| autoSplit 架构 | 未识别 | **新增 §3.1** — 4 方案对比，采用组件后置方案 D |

## 附录 B：v3 审核修正记录

| 修正项 | 问题 | 修正内容 |
|--------|------|---------|
| ImageNode handleGenerate 行号 | 声称 ~L90-160 | 修正为 **L99-122**（约 24 行） |
| 双路径差异描述 | 声称两条路径"完全相同" | 补充 3 处关键差异：ImageNode 缺 referenceImages、VideoNode 两套 API、TextNode autoSplit 逻辑 |
| U1 前置任务 | 未识别 | 新增前置任务表：TextNode autoSplit 迁移（高）、VideoNode API 对齐（高） |
| NodeExecutionContext 伪代码 | 使用 React 闭包变量（nodes, edges） | 修正为 **`useFlowStore.getState()`** 获取最新值，避免异步执行期间闭包陈旧 |
| NodeExecutionContext.signal | 伪代码未包含 | **补充 `signal: abortController.signal`** |
| U1 风险评估 | 标注"低风险" | 修正为 **"中风险"**，反映前置任务的复杂度 |
| E1 并发控制方案 | 未说明选型理由 | 补充**分块式 vs 信号量式**对比说明 |
| E2 ExecutionCallbacks | 缺少 `onNodeSkipped` | **新增 `onNodeSkipped` 回调**到接口定义 |
| E2 fail-fast 间接传播 | 未考虑间接上游失败 | 补充 `failedNodeIds.add(node.id)` 确保间接下游也被跳过 |
| N1 历史数据膨胀 | 仅标注风险，无对策 | 补充**建议 save 时截断历史**（仅保留 3 条存盘） |
| N2 容器宽度获取 | 使用 `parentElement?.offsetWidth`（不可靠） | 修正为 **`containerRef.current.getBoundingClientRect()`** |
| N2 resize 响应 | 未处理容器宽度变化 | **新增 `ResizeObserver`** 监听容器尺寸变化 |
| N2 代码组织 | 内联实现 | **提取为 `useAdaptiveHeight` 自定义 hook**，ImageNode/VideoNode 复用 |
| Sprint 1 工时 | U1 标注 3h | 移除工时估算，改为任务计数 |
| 验证清单 | 缺少关键验证项 | Sprint 1 增加 3 项前置验证 + 2 项新增验证；Sprint 2 增加 3 项验证；Sprint 3 增加 1 项验证 |

## 附录 C：v4 变更记录

| 变更项 | v3 内容 | v4 修正 | 原因 |
|--------|---------|---------|------|
| **autoSplit 架构决策** | 迁移到 executor（ctx 注入 addNodes/addEdge） | **组件后置方案 D** — executor 只写 splitItems 到 nodeData，autoSplit 逻辑留在组件 | node-banana executor 零处操作图结构；executor 保持纯逻辑层；改动最小零回归 |
| **VideoNode API 对齐** | 标记为高风险前置任务 | **移除** — 不存在差异 | 已确认 `generateVideo()` = `submitVideoTask() + pollVideoTask()`（videoApi.ts L104-109） |
| **测试策略** | 无 | **新增 §4** — 方案 A 测试先行 | executionEngine.ts 无测试直接加 E1/E2 回归风险太高 |
| **Sprint 规划** | 仅含实现任务 | **加入 7 项测试任务（T1-T7）** | 测试先行 + 实现后扩展 |
| **工时估算** | Sprint 1: 4.5h, Sprint 2: 4h, Sprint 3: 1h | **移除工时估算**，改为任务计数 |
| **排除项** | 6 项 | **增加 6 项**：VideoNode API 对齐、autoSplit 迁移到 executor、ctx 注入 addNodes、fail-fast 开关、maxConcurrent 设置、历史截断逻辑 | 与架构决策对齐 + YAGNI |
| **U1 风险评估** | "中风险" | 修正为 **"低风险"** | autoSplit 不再需要迁移到 executor（组件后置），前置任务复杂度降低 |
| **U1 变更文件清单** | generateNodeExecutors.ts 改动较大（autoSplit 迁移 + VideoNode 对齐） | **微调** — 仅 executeTextNode 多写一个 splitItems 字段 | 与方案 D 一致 |
| **验证清单** | 12 项 Sprint 1 + 8 项 Sprint 2 + 5 项 Sprint 3 | **10 项 Sprint 1 + 6 项 Sprint 2 + 6 项 Sprint 3** | 移除 fail-fast=false、设置页持久化、串行/全并行等测试项 |

## 附录 D：v5 去过度设计记录（My-Guidelines 审查）

| 审查项 | v4 内容 | v5 修正 | My-Guidelines 原则 |
|--------|---------|---------|-------------------|
| **E1 maxConcurrentCalls** | CanvasSettings 新字段 + SettingsPanel UI + useFlowStore 传参 | **常量 `MAX_CONCURRENT = 3`**，不暴露设置 | §2 — *"No 'flexibility' or 'configurability' that wasn't requested."* |
| **E2 failFast 开关** | CanvasSettings 新字段 + SettingsPanel 开关 + useFlowStore 传参 + fail-fast=false 测试 | **硬编码启用**，删除字段/UI/测试 | §2 — *"No features beyond what was asked."* |
| **N1 save 截断逻辑** | save 时截断历史为 3 条 | **save 时直接删除 history 字段** | §2 — *"No error handling for impossible scenarios."* |
| **T3 参数传递测试** | 测试 useFlowStore 传递 maxConcurrent/failFast | **删除** — 测试一行接线代码，maxConcurrent/failFast 已改为常量/硬编码 | §2 — *"No abstractions for single-use code."* |
| **E2 fail-fast=false 测试** | T5 含 fail-fast=false 分支测试 | **删除** — 分支不存在 | §2 — 同上 |
