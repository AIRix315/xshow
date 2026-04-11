# XShow BaseNode 渲染层改进计划 V1.0

> 基于 node-banana (shrimply/node-banana) 前端显示功能对比分析
> 日期: 2026-04-11

---

## 一、改进概览

### 1.1 背景

参考 node-banana (⭐1374, MIT 许可) 的 BaseNode.tsx (333行) 实现，与当前 XShow 的 BaseNode.tsx (52行) 进行对比分析，制定 23 项改进计划。

### 1.2 node-banana 与 XShow 架构差异

| 维度 | node-banana | XShow |
|------|------------|-------|
| 框架 | Next.js 16 + React | React + Chrome Extension |
| 画布 | @xyflow/react v12 | @xyflow/react v12.10 |
| 状态 | Zustand (巨型单 Store) | Zustand (分离 Store) |
| 节点数 | 23 种 | 9 种 |
| BaseNode 行数 | 333 行 | 52 行 |
| 许可证 | MIT | 私有 |

### 1.3 改进分类

| 分类 | 数量 | 高优先级 |
|------|------|--------|
| 渲染层 (Render Layer) | 6 | 3 |
| 状态系统 (Status System) | 4 | 1 |
| 参数面板 (Parameter Panel) | 3 | 0 |
| 交互系统 (Interaction) | 4 | 0 |
| 连接系统 (Connection) | 3 | 1 |
| Canvas 扩展 | 3 | 0 |
| **总计** | **23** | **5** |

---

## 二、渲染层改进 (6 项)

### 2.1 [高优先级] 标题栏 (FloatingNodeHeader)

**当前状态**: XShow 无标题栏，各节点独立实现标题

**目标实现**: 可拖拽移动的标题栏，带图标和操作按钮

**实现位置**: `src/components/canvas/BaseNode.tsx`

**伪代码**:
```typescript
// 新增 NodeHeader 组件
interface NodeHeaderProps {
  icon: ReactNode;
  title: string;
  status?: 'idle' | 'loading' | 'complete' | 'error';
  onRun?: () => void;
  onMenu?: () => void;
  selectable?: boolean;
}

function NodeHeader({ icon, title, status, onRun, onMenu }: NodeHeaderProps) {
  return (
    <div className="node-header flex items-center justify-between px-2 py-1.5 bg-surface-hover cursor-move">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-text font-medium">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        {status === 'loading' && <Spinner />}
        <button onClick={onRun} className="nodrag p-1 hover:bg-surface rounded">
          <Play className="w-3 h-3" />
        </button>
        <button onClick={onMenu} className="nodrag p-1 hover:bg-surface rounded">
          <MoreHorizontal className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
```

**依赖**: lucide-react 图标库 (已安装)

**测试**: 手动测试拖拽、点击运行、菜单展开

---

### 2.2 [高优先级] 运行按钮内嵌

**当前状态**: 各节点组件独立实现运行按钮

**目标实现**: 标题栏内置运行按钮，统一触发节点执行

**实现位置**: `src/components/canvas/BaseNode.tsx`

**伪代码**:
```typescript
// BaseNodeWrapper 添加 runButton Props
interface BaseNodeWrapperProps {
  // existing props
  onRun?: () => void;
  showRunButton?: boolean;
}

function BaseNodeWrapper({ onRun, showRunButton = true, children, ...props }: BaseNodeWrapperProps) {
  return (
    <>
      {/* existing NodeResizer and handles */}
      {showRunButton && onRun && (
        <button 
          onClick={onRun}
          className="nodrag absolute top-2 right-2 z-10 p-1.5 bg-primary hover:bg-primary-hover rounded transition-colors"
        >
          <Play className="w-3 h-3 text-white" />
        </button>
      )}
      {children}
    </>
  );
}
```

**涉及修改**: ImageNode.tsx, TextNode.tsx, VideoNode.tsx, AudioNode.tsx

---

### 2.3 [高优先级] 菜单按钮

**当前��态**: 无菜单按钮

**目标实现**: 省略号菜单，支持设置/删除等操作

**实现位置**: `src/components/canvas/BaseNode.tsx`

**伪代码**:
```typescript
// 添加 NodeMenu 组件
interface NodeMenuProps {
  onSettings?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}

function NodeMenu({ onSettings, onDuplicate, onDelete }: NodeMenuProps) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative nodrag">
      <button onClick={() => setOpen(!open)} className="p-1 hover:bg-surface rounded">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-surface border border-border rounded shadow-lg z-50">
          <button onClick={onSettings} className="w-full px-3 py-2 text-left text-xs hover:bg-surface-hover">
            设置
          </button>
          <button onClick={onDuplicate} className="w-full px-3 py-2 text-left text-xs hover:bg-surface-hover">
            复制
          </button>
          <button onClick={onDelete} className="w-full px-3 py-2 text-left text-xs text-error hover:bg-surface-hover">
            删除
          </button>
        </div>
      )}
    </div>
  );
}
```

**测试**: 点击菜单展开、各操作触发

---

### 2.4 [中优先级] 多 Handle 位置

**当前状态**: 固定左右两侧各一个 Handle

**目标实现**: 支持 top/bottom/left/right 多位置，可配置多个 Handle

**实现位置**: `src/components/canvas/BaseNode.tsx`

**伪代码**:
```typescript
// 新增 handleConfig 参数
interface HandleConfig {
  type: 'target' | 'source';
  position: Position;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}

// BaseNodeWrapper 添加 handles Prop
interface BaseNodeWrapperProps {
  // existing props
  handles?: HandleConfig[];
}

function BaseNodeWrapper({ handles = defaultHandles, children, ...props }: BaseNodeWrapperProps) {
  return (
    <>
      {handles.map((handle, idx) => (
        <Handle
          key={`${handle.type}-${handle.position}-${idx}`}
          type={handle.type}
          position={handle.position}
          id={handle.id}
          className={handle.className}
          style={handle.style}
        />
      ))}
      {children}
    </>
  );
}

// 默认配置
const defaultHandles: HandleConfig[] = [
  { type: 'target', position: Position.Left },
  { type: 'source', position: Position.Right },
];
```

**涉及修改**: 需要更新各节点组件传入自定义 Handle 配置

---

### 2.5 [中优先级] 多数据通道 Handle

**当前状态**: 单一数据通道

**目标实现**: Handle 带 dataType (image/text/audio/video) 区分，支持类型检查

**实现位置**: `src/types.ts`, `src/components/canvas/BaseNode.tsx`

**伪代码**:
```typescript
// types.ts 新增
type HandleDataType = 'image' | 'text' | 'audio' | 'video' | 'any';

interface HandleConfig {
  type: 'target' | 'source';
  position: Position;
  id: string;
  dataType: HandleDataType;  // 新增
  label?: string;
}

// BaseNodeWrapper 使用 dataType
<Handle
  type={handle.type}
  position={handle.position}
  id={handle.id}
  data-type={handle.dataType}  // React Flow 支持
  // ...
/>
```

**涉及修改**: types.ts 添加 HandleDataType, 各节点组件配置 dataType

---

### 2.6 [低优先级] Handle 样式增强

**当前状态**: 基础 hover 效果

**目标实现**: 连接高亮、悬停动画、连接中状态样式

**实现位置**: `src/components/canvas/BaseNode.tsx`

**伪代码**:
```typescript
// Handle 样式增强
const handleStyles = {
  default: '!bg-handle-default !w-5 !h-5 !border-[3px] !border-[#222]',
  hover: 'hover:!bg-primary hover:!w-6 hover:!h-6 hover:!border-white',
  connecting: '!bg-primary !border-primary animate-pulse',
  connected: '!bg-primary !border-primary',
  invalid: '!bg-error !border-error',
};

// 应用样式
<Handle 
  className={isConnecting ? handleStyles.connecting : handleStyles.default}
/>
```

**依赖**: React Flow onConnect/ onConnectEnd 事件

---

## 三、状态系统改进 (4 项)

### 3.1 [高优先级] 4 种状态指示

**当前状态**: 仅 loading/error 两种状态

**目标实现**: idle/loading/complete/error 四种状态完整显示

**实现位置**: `src/components/canvas/BaseNode.tsx`

**伪代码**:
```typescript
// types.ts 添加
type NodeStatus = 'idle' | 'loading' | 'complete' | 'error';

interface BaseNodeData {
  status: NodeStatus;
  errorMessage?: string;
}

// BaseNodeWrapper 完整状态
function BaseNodeWrapper({ status = 'idle', errorMessage, children, ...props }: BaseNodeWrapperProps) {
  const statusConfig = {
    idle: { borderColor: 'border-border', showSpinner: false },
    loading: { borderColor: 'border-primary animate-pulse', showSpinner: true },
    complete: { borderColor: 'border-green-500', showSpinner: false },
    error: { borderColor: 'border-error', showSpinner: false },
  };
  
  return (
    <div className={`border-2 ${statusConfig[status].borderColor} rounded-lg`}>
      {statusConfig[status].showSpinner && <LoadingOverlay />}
      {status === 'error' && <ErrorDisplay message={errorMessage} />}
      {children}
    </div>
  );
}
```

**涉及修改**: types.ts 添加 NodeStatus, 各节点组件更新状态值

---

### 3.2 [中优先级] 状态颜色系统

**当前状态**: 部分状态颜色

**目标实现**: 统一状态颜色配置 (灰/蓝脉冲/绿/红)

**实现位置**: `src/components/canvas/BaseNode.tsx`, `src/tailwind.css`

**伪代码**:
```typescript
// tailwind.css 添加状态颜色
@theme {
  --color-status-idle: #333;
  --color-status-loading: #3b82f6;
  --color-status-complete: #22c55e;
  --color-status-error: #ef4444;
}

// 使用
const statusColors = {
  idle: 'border-status-idle',
  loading: 'border-status-loading animate-pulse',
  complete: 'border-status-complete',
  error: 'border-status-error',
};
```

---

### 3.3 [中优先级] 状态图标

**当前状态**: 仅加载动画

**目标实现**: 加载动画、✅ 完成图标、❌ 错误图标

**实现位置**: `src/components/canvas/BaseNode.tsx`

**伪代码**:
```typescript
import { Loader2, Check, XCircle } from 'lucide-react';

function StatusIndicator({ status }: { status: NodeStatus }) {
  return {
    idle: null,
    loading: <Loader2 className="w-4 h-4 animate-spin" />,
    complete: <Check className="w-4 h-4 text-green-500" />,
    error: <XCircle className="w-4 h-4 text-red-500" />,
  }[status];
}
```

---

### 3.4 [低优先级] 运行时边动画

**当前状态**: 无边动画

**目标实现**: 执行时 animated 边显示数据流动

**实现位置**: `src/utils/executionEngine.ts`, `src/components/canvas/FlowCanvas.tsx`

**伪代码**:
```typescript
// executionEngine.ts 边动画
async function executeCanvas(nodes, edges, callbacks, signal) {
  for (const layer of layers) {
    // 执行前设置 animated
    const layerEdges = edges.filter(e => 
      layer.includes(e.source) && layer.includes(e.target)
    );
    updateEdges(layerEdges.map(e => ({ ...e, animated: true })));
    
    await Promise.allSettled(layerNodes.map(executeNode));
    
    // 执行后移除动画
    updateEdges(layerEdges.map(e => ({ ...e, animated: false })));
  }
}
```

---

## 四、参数面板改进 (3 项)

### 4.1 [中优先级] InlineParameterPanel

**当前状态**: 参数直接内联显示

**目标实现**: 可展开/折叠的参数面板区域

**实现位置**: `src/components/canvas/BaseNode.tsx`

**伪代码**:
```typescript
// 新增 InlineParameterPanel 组件
interface InlineParameterPanelProps {
  title?: string;
  defaultExpanded?: boolean;
  children: ReactNode;
}

function InlineParameterPanel({ title, defaultExpanded = true, children }: InlineParameterPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  
  return (
    <div className="border-t border-border">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-2 py-1 text-xs text-text-secondary hover:bg-surface-hover"
      >
        <span>{title || 'Parameters'}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && <div className="p-2">{children}</div>}
    </div>
  );
}
```

---

### 4.2 [低优先级] ControlPanel (侧边面板)

**当前状态**: 无侧边面板

**目标实现**: 选中节点时右侧弹出集中参数编辑面板

**新增文件**: `src/components/canvas/ControlPanel.tsx`

**实现**:
```typescript
// FlowCanvas.tsx 添加 ControlPanel
function FlowCanvas() {
  const selectedNode = useFlowStore(s => s.nodes.find(n => s.highlightedNodeId === n.id));
  
  return (
    <div className="flex h-full">
      <ReactFlow ... />
      {selectedNode && <ControlPanel node={selectedNode} />}
    </div>
  );
}
```

---

### 4.3 [低优先级] 模型选择器

**当前状态**: 各节点独立实现

**目标实现**: 统一的模型选择下拉组件

**新增文件**: `src/components/canvas/ModelSelect.tsx`

**伪代码**:
```typescript
interface ModelSelectProps {
  models: string[];
  value: string;
  onChange: (model: string) => void;
  label?: string;
}

function ModelSelect({ models, value, onChange, label }: ModelSelectProps) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {models.map(m => <option key={m} value={m}>{m}</option>)}
    </select>
  );
}
```

---

## 五、交互系统改进 (4 项)

### 5.1 [中优先级] 右键菜单

**当前状态**: 无右键菜单

**目标实现**: 右键删除/复制/粘贴/运行

**实现位置**: `src/components/canvas/FlowCanvas.tsx`

**伪代码**:
```typescript
// FlowCanvas.tsx
function FlowCanvas() {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);
  
  return (
    <ReactFlow onNodeContextMenu={onNodeContextMenu} ...>
      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onDelete={() => removeNode(contextMenu.nodeId)}
          onDuplicate={() => duplicateNode(contextMenu.nodeId)}
          onRun(() => executeNode(contextMenu.nodeId)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </ReactFlow>
  );
}
```

---

### 5.2 [低优先级] 键盘快捷键

**当前状态**: 无键盘快捷键

**目标实现**: Delete/V/H/G 等快捷键

**实现位置**: `src/components/canvas/FlowCanvas.tsx`

**伪代码**:
```typescript
// FlowCanvas.tsx
function FlowCanvas() {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete' && selectedNodes.length > 0) {
        selectedNodes.forEach(n => removeNode(n.id));
      } else if (event.key === 'v' && event.ctrlKey) {
        pasteNode();
      } else if (event.key === 'c' && event.ctrlKey) {
        copyNode();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
```

---

### 5.3 [低优先级] 节点复制 (Ctrl+D)

**当前状态**: 无复制功能

**目标实现**: 复制选中的节点

**实现位置**: `src/stores/useFlowStore.ts`

**伪代码**:
```typescript
// useFlowStore.ts
interface FlowActions {
  // existing actions
  duplicateNode: (id: string) => void;
}

duplicateNode: (id) => set((state) => {
  const node = state.nodes.find(n => n.id === id);
  if (!node) return state;
  
  const newNode = createNode(node.type, {
    x: node.position.x + 50,
    y: node.position.y + 50,
  }, node.data);
  
  return { nodes: [...state.nodes, newNode] };
}),
```

---

### 5.4 [低优先级] 批量选择 (Shift+点击)

**当前状态**: 无批量选择

**目标实现**: Shift+点击多选

**实现位置**: `src/components/canvas/FlowCanvas.tsx`

**伪代码**:
```typescript
// FlowCanvas.tsx
function FlowCanvas() {
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (event.shiftKey) {
      setSelectedNodes(prev => 
        prev.includes(node.id) 
          ? prev.filter(id => id !== node.id)
          : [...prev, node.id]
      );
    } else {
      setSelectedNodes([node.id]);
    }
  }, []);
}
```

---

## 六、连接系统改进 (3 项)

### 6.1 [高优先级] 连接验证

**当前状态**: 无类型检查

**目标实现**: 连接时验证 source/target 数据类型兼容性

**实现位置**: `src/components/canvas/FlowCanvas.tsx`

**伪代码**:
```typescript
// FlowCanvas.tsx - onConnect 验证
const onConnect = useCallback((connection: Connection) => {
  const sourceNode = nodes.find(n => n.id === connection.source);
  const targetNode = nodes.find(n => n.id === connection.target);
  
  // 获取 handle 的 dataType
  const sourceDataType = getHandleDataType(sourceNode, connection.sourceHandleId);
  const targetDataType = getHandleDataType(targetNode, connection.targetHandleId);
  
  // 验��类型兼容
  if (!isCompatible(sourceDataType, targetDataType)) {
    toast.error('数据类型不兼容');
    return;
  }
  
  addEdge({ ...connection, type: 'smoothstep' });
}, []);
```

**涉及修改**: types.ts 添加 dataType 获取函数

---

### 6.2 [低优先级] 连接 DropMenu

**当前状态**: 无连接候选菜单

**目标实现**: 连接时显示可连接节点候选列表

**实现位置**: `src/components/canvas/FlowCanvas.tsx`

**伪代码**:
```typescript
// ConnectionDropMenu 组件
function ConnectionDropMenu({ position, onSelect }: ConnectionDropMenuProps) {
  const compatibleNodes = useCompatibleNodes(position);
  
  return (
    <div 
      className="fixed z-50 w-48 bg-surface border border-border rounded shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      {compatibleNodes.map(node => (
        <button
          key={node.id}
          onClick={() => onSelect(node.id)}
          className="w-full px-3 py-2 text-left text-xs hover:bg-surface-hover"
        >
          {node.data.label}
        </button>
      ))}
    </div>
  );
}
```

---

### 6.3 [低优先级] 无效连接样式

**当前状态**: 无无效提示

**目标实现**: 红色虚线提示无效连接

**实现位置**: `src/components/canvas/FlowCanvas.tsx`

**伪代码**:
```typescript
// onConnectStart / onConnectEnd 事件处理
const onConnectStart = useCallback((event: React.MouseEvent, connection: Partial<Connection>) => {
  // 设置 connecting 状态用于样式
}, []);

const onConnectEnd = useCallback((event: React.MouseEvent) => {
  // 如果连接无效，显示红色虚线
  if (!isValidConnection) {
    setEdges(prev => prev.map(e => ({
      ...e,
      className: 'stroke-error dashed',
    })));
  }
}, []);
```

---

## 七、Canvas 扩展改进 (3 项)

### 7.1 [低优先级] MiniMap 节点颜色

**当前状态**: 单一颜色

**目标实现**: 按节点类型着色

**实现位置**: `src/components/canvas/FlowCanvas.tsx`

**伪代码**:
```typescript
// FlowCanvas.tsx - MiniMap 配置
<MiniMap
  nodeColor={(node) => {
    const colors: Record<string, string> = {
      imageNode: '#3b82f6',
      textNode: '#8b5cf6',
      videoNode: '#ec4899',
      audioNode: '#f59e0b',
    };
    return colors[node.type] || '#6b7280';
  }}
/>
```

---

### 7.2 [低优先级] 背景主题切换

**当前状态**: 固定深色

**目标实现**: 可切换明暗/网格样式

**实现位置**: `src/components/canvas/FlowCanvas.tsx`

**伪代码**:
```typescript
// 添加主题切换
type BackgroundTheme = 'dark' | 'light' | 'dots';

<Background 
  variant={theme === 'dark' ? 'dots' : theme === 'light' ? 'lines' : 'cross'}
  color={theme === 'dark' ? '#333' : '#ccc'}
/>
```

---

### 7.3 [低优先级] 全屏编辑 (标注节点)

**当前状态**: 无全屏模式

**目标实现**: 标注节点支持全屏编辑

**实现位置**: `src/components/canvas/AnnotationNode.tsx` (新增)

**实现**:
```typescript
// AnnotationNode 全屏模式
function AnnotationNode({ data, selected }: NodeProps<AnnotationNodeData>) {
  const [fullscreen, setFullscreen] = useState(false);
  
  return (
    <>
      <BaseNodeWrapper selected={selected}>
        <canvas ref={canvasRef} />
        <button onClick={() => setFullscreen(true)} className="nodrag">
          <Maximize2 className="w-4 h-4" />
        </button>
      </BaseNodeWrapper>
      
      {fullscreen && (
        <FullscreenEditor 
          onClose={() => setFullscreen(false)}
          onSave={(image) => updateNodeData({ outputImage: image })}
        />
      )}
    </>
  );
}
```

---

## 八、执行计划

### 8.1 Phase 1: 渲染层核心 (高优先级)

```
Phase 1: 渲染层核心 (高优��级)
├── 1.1 标题栏 NodeHeader (2h)
├── 1.2 运行按钮内嵌 (1h)
├── 1.3 菜单按钮 NodeMenu (1h)
├── 1.4 验证: npm run build
└── 1.5 手动测试
```

### 8.2 Phase 2: 状态系统 (高优先级)

```
Phase 2: 状态系统
├── 2.1 4种状态指示 (2h)
├── 2.2 状态颜色系统 (1h)
├── 2.3 状态图标 (1h)
├── 2.4 运行时边动画 (2h)
└── 2.5 验证 + 测试
```

### 8.3 Phase 3: 连接系统 (高优先级)

```
Phase 3: 连接系统
├── 3.1 连接验证 (3h)
├── 3.2 连接 DropMenu (2h)
├── 3.3 无效连接样式 (1h)
└── 3.4 验证 + 测试
```

### 8.4 Phase 4: 交互系统 (中优先级)

```
Phase 4: 交互系统
├── 4.1 右键菜单 (2h)
├── 4.2 键盘快捷键 (2h)
├── 4.3 节点复制 (1h)
├── 4.4 批量选择 (2h)
└── 4.5 验证
```

### 8.5 Phase 5: 参数面板 (中优先级)

```
Phase 5: 参数面板
├── 5.1 InlineParameterPanel (2h)
├── 5.2 ControlPanel (4h)
├── 5.3 ModelSelect (1h)
└── 5.4 集成测试
```

### 8.6 Phase 6: Canvas 扩展 (低优先级)

```
Phase 6: Canvas 扩展
├── 6.1 MiniMap 节点颜色 (1h)
├── 6.2 背景主题切换 (2h)
├── 6.3 全屏编辑 (3h)
└── 6.4 最终测试
```

---

## 九、依赖关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 1 (渲染层核心)                     │
├─────────────────────────────────────────────────────────────────┤
│  BaseNode.tsx ───────┬──→ NodeHeader.tsx                      │
│                     ├── NodeMenu.tsx                        │
│                     └── 运行按钮 Props                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 2 (状态系统)                         │
├─────────────────────────────────────────────────────────────────┤
│  types.ts ──────────┬──→ NodeStatus 类型                    │
│  BaseNode.tsx ─────┼──→ 状态颜色 + 图标                    │
│  executionEngine.ts └──→ 边动画                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 3 (连接系统)                         │
├─────────────────────────────────────────────────────────────────┤
│  FlowCanvas.tsx ───┬──→ onConnect 验证                     │
│                    ├── ConnectionDropMenu                  │
│                    └── 无效连接样式                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 十、测试计划

### 10.1 单元测试

| 修改 | 测试覆盖 |
|------|----------|
| NodeHeader | 渲染测试 |
| NodeMenu | 菜单展开/关闭测试 |
| 状态系统 | 颜色/图标渲染测试 |
| 连接验证 | 有效/无效连接测试 |

### 10.2 手动测试

| 功能 | 测试场景 |
|------|----------|
| 标题栏 | 拖拽移动、点击运行 |
| 状态 | idle/loading/complete/error 切换 |
| 连接 | image→image ✓, image→text ✗ |
| 右键菜单 | 删除/复制/运行 |
| 键盘 | Delete 删除、Ctrl+D 复制 |

---

## 十一、风险评估

| 风险 | 严重度 | 应对 |
|------|--------|------|
| BaseNode 修改破坏现有节点 | 高 | 逐个节点回归测试 |
| 连接验证过于严格 | 中 | 放宽验证规则，支持 any |
| 状态变更影响执行逻辑 | 中 | 保持现有状态兼容 |
| 性能影响 | 低 | React.memo 优化 |

---

## 十二、验收标准

### 12.1 构建验证

```bash
npm run build
# 期望: 退出码 0
```

### 12.2 类型验证

```bash
npm run typecheck
# 期望: 无错误
```

### 12.3 功能验证

| 功能 | 通过条件 |
|------|----------|
| NodeHeader | 渲染+拖拽+点击运行 |
| 4种状态 | 正确显示 |
| 连接验证 | image→text 被阻止 |
| 右键菜单 | 删除/复制/运行 |
| 键盘快捷键 | Delete 生效 |

---

## 十三、待讨论项

- [ ] ControlPanel 是否纳入当前 Phase (功能较大)
- [ ] _annotation 节点是否需要 (全屏编辑)
- [ ] MiniMap 颜色主题是否可配置化
- [ ] 背景主题切换入口位置

---

**修订历史**:
- V1.0 (2026-04-11): 初始版本，基于 node-banana BaseNode 对比分析

---

**关联文档**:
- `02-Reference.md` - node-banana 参考
- `01-1-reverse-engineering-plan-v2.md` - 产品反推方案
- `99-corrective-plan.md` - API 协议修正计划