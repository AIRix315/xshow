# node-banana vs XShow Canvas 完整对比分析

> 分析日期: 2026-04-11
> 对比版本: node-banana (完整调查) vs XShow (当前实现 - 已复核 + 用户实际运行验证)
> 文档版本: v1.2 (新增用户验证反馈)

---

## 0. 用户实际运行验证发现 (User Verification)

用户实际运行 node-banana 后发现以下关键点：

1. ✅ **Handle 有类型分类** - image, text, audio, video, 3d 颜色不同
2. ✅ **悬浮菜单在底部** - FloatingActionBar 固定在底部中央
3. ✅ **图片节点区分输入输出** - 左侧 2 个输入 (image 35%, text 65%)，右侧 1 个输出 (image 50%)
4. ✅ **切换模型统一在画布底部菜单** - FloatingActionBar 内 "All models" 按钮
5. ✅ **节点设置默认隐藏，仅悬停显示图标** - FloatingNodeHeader showControls 逻辑
6. ✅ **顶部栏整合设置和资源** - Header 组件包含各种设置入口

---

## 一、画布容器 (Canvas Container)

### 1.1 ReactFlow 主容器

| 特性 | node-banana | XShow 当前 | 状态 | 执行范围 |
|------|-------------|-----------|------|----------|
| 背景色 | `bg-neutral-900` | ❌ 无设置 | 需修改 | FlowCanvas |
| 背景网格 | `<Background color="#404040" gap={20} size={1} />` | ✅ 有 | 无需修改 | - |
| Controls 样式 | 定制样式 | ✅ 有 | 需对齐 | FlowCanvas |
| MiniMap | ✅ 有完整配置 | ✅ 有 | 需对齐样式 | FlowCanvas |
| MiniMap 节点颜色 | 每个类型不同颜色 | ❌ 无颜色映射 | 需添加 | FlowCanvas |

**XShow 当前代码 (FlowCanvas.tsx):**
```tsx
<ReactFlow
  nodes={styledNodes}
  edges={edges}
  // ... 其他配置
>
  <Background />
  <Controls />
  <MiniMap />
</ReactFlow>
```

**需修改为 node-banana 样式:**
```tsx
<ReactFlow
  className="bg-neutral-900"  // 需添加
  proOptions={{ hideAttribution: true }}  // 需添加
  defaultEdgeOptions={{ type: "editable", animated: false }}  // 需添加
>
  <Background color="#404040" gap={20} size={1} />
  <Controls className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg [&>button]:bg-neutral-800 [&>button]:border-neutral-700" />  // 需添加样式
  <MiniMap
    className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg"  // 需添加样式
    maskColor="rgba(0, 0, 0, 0.6)"
    pannable
    zoomable
    nodeColor={(node) => { /* 每个类型不同颜色 */ }}  // 需添加
  />
</ReactFlow>
```

**最佳实践要求:**
- Background 设置固定，不要用默认
- Controls 需要覆盖默认样式
- MiniMap 需要按节点类型显示不同颜色

### 1.2 画布交互配置

| 配置项 | node-banana | XShow 当前 | 状态 | 执行范围 |
|--------|-------------|-----------|------|----------|
| deleteKeyCode | `["Backspace", "Delete"]` | ❌ 无 | 需添加 | FlowCanvas |
| multiSelectionKeyCode | `"Shift"` | ? | 需核对 | FlowCanvas |
| selectionOnDrag | 根据导航设置 | ? | 需核对 | FlowCanvas |
| selectionKeyCode | 根据导航设置 | ? | 需核对 | FlowCanvas |
| panOnDrag | 根据导航设置 | ? | 需核对 | FlowCanvas |
| zoomOnScroll | `false` | ? | 需核对 | FlowCanvas |
| zoomOnPinch | `!isModalOpen` | ? | 需核对 | FlowCanvas |
| minZoom/maxZoom | `0.1` / `4` | ? | 需核对 | FlowCanvas |
| nodeDragThreshold | `5` | ? | 需核对 | FlowCanvas |
| nodeClickDistance | `5` | ? | 需核对 | FlowCanvas |

**最佳实践要求:**
- 必须添加 deleteKeyCode 以支持键盘删除节点
- 其他配置按需对齐

---

## 二、节点组件 (Node Components)

### 2.1 BaseNode 容器

| 特性 | node-banana | XShow 当前 | 状态 | 执行范围 |
|------|-------------|-----------|------|----------|
| 架构 | **纯容器，无 Handle** | 旧版有默认 handles (已重构为纯容器) | ✅ 已修复 | BaseNode |
| 渲染内容 | NodeResizer + children + settingsPanel | 同 | ✅ 已对齐 | - |
| Handle 定义 | 各节点自行定义 | 各节点已自行定义 | ⚠️ 需验证 | 各节点 |
| 设置面板 | `settingsPanel` prop | 无 | 暂不需 | - |

**当前 XShow BaseNode 问题:**
- ❌ `setHoveredNodeId` 不存在，应为 `setHighlightedNode` (已修复，但仍有问题)
- LSP 显示错误：`Cannot find name 'setHoveredNodeId'`

**修复:**
```tsx
onMouseEnter={(e) => {
  if (e.buttons !== 0) return;
  setHighlightedNode(id);  // 已修复
}}
onMouseLeave={(e) => {
  if (e.buttons !== 0) return;
  setHighlightedNode(null);  // 需修复 setHoveredNodeId -> setHighlightedNode
}}
```

### 2.2 节点样式

| 样式属性 | node-banana | XShow 当前 | 状态 | 执行范围 |
|----------|-------------|-----------|------|----------|
| 容器背景 | `bg-neutral-800` | ✅ `bg-neutral-800` | ✅ 已对齐 | BaseNode |
| 边框默认 | `border-neutral-700/60` | ✅ `border-neutral-700/60` | ✅ 已对齐 | BaseNode |
| 边框圆角 | `rounded-lg` | ✅ `rounded-lg` | ✅ 已对齐 | BaseNode |
| 阴影 | `shadow-lg` | ✅ `shadow-lg` | ✅ 已对齐 | BaseNode |
| 选中边框 | `border-blue-500` | ✅ `border-blue-500` | ✅ 已对齐 | BaseNode |
| 选中光环 | `ring-2 ring-blue-500/40` | ✅ `ring-2 ring-blue-500/40` | ✅ 已对齐 | BaseNode |
| 选中阴影 | `shadow-lg shadow-blue-500/25` | ✅ `shadow-lg shadow-blue-500/25` | ✅ 已对齐 | BaseNode |
| 执行中边框 | `border-blue-500 ring-1 ring-blue-500/20` | ✅ 已映射到 `isExecuting` | ✅ 已对齐 | BaseNode |
| 错误边框 | `border-red-500` | ✅ 已映射到 `hasError` | ✅ 已对齐 | BaseNode |
| 内容区内边距 | `px-3 pb-4` | ❌ 内边距在节点内 | 需调整 | 各节点 |

### 2.3 节点类型列表

| node-banana 类型 | XShow 当前 | 状态 |
|------------------|------------|------|
| imageInput | ImageNode | ✅ 对应 |
| audioInput | AudioNode | ✅ 对应 |
| videoInput | VideoNode | ✅ 对应 |
| annotation | ❌ | 暂不需要 |
| prompt | TextNode | ✅ 对应 |
| array | ❌ | 暂不需要 |
| promptConstructor | ❌ | 暂不需要 |
| nanoBanana | ImageNode (Gemini) | ✅ 对应 |
| generateVideo | VideoNode | ✅ 对应 |
| generate3d | ❌ | 暂不需要 |
| generateAudio | AudioNode | ✅ 对应 |
| llmGenerate | TextNode | ✅ 对应 |
| splitGrid | GridSplitNode | ✅ 对应 |
| output | ❌ | 暂不需要 |
| outputGallery | ❌ | 暂不需要 |
| imageCompare | ❌ | 暂不需要 |
| videoStitch | GridMergeNode | ✅ 对应 |
| easeCurve | ❌ | 暂不需要 |
| videoTrim | CropNode | ✅ 对应 |
| videoFrameGrab | ❌ | 暂不需要 |
| router | ❌ | 暂不需要 |
| switch | ❌ | 暂不需要 |
| conditionalSwitch | ❌ | 暂不需要 |
| glbViewer | ❌ | 暂不需要 |

---

## 三、节点标题栏 (Node Header)

### 3.1 FloatingNodeHeader 组件

| 特性 | node-banana | XShow 当前 | 状态 | 执行范围 |
|------|-------------|-----------|------|----------|
| 组件 | FloatingNodeHeader.tsx | ❌ 无 | 暂不实现 | - |
| 渲染方式 | ViewportPortal 浮动渲染 | - | - | - |
| 显示条件 | `isHovered \|\| selected` | - | - | - |

**当前状态:**
- XShow 的 NodeHeader 在 BaseNode 内，功能类似但实现不同
- 暂不需要实现独立 FloatingNodeHeader（除非需要更复杂的交互）

### 3.2 标题栏按钮

| 按钮 | node-banana | XShow 当前 | 状态 | 备注 |
|------|-------------|-----------|------|------|
| Run 按钮 | FloatingNodeHeader | ✅ BaseNode 内 | ⚠️ 需移出 | 当前在节点内 |
| Expand 按钮 | FloatingNodeHeader | ❌ 无 | 暂不需要 | - |
| Comment 按钮 | FloatingNodeHeader | ❌ 无 | 暂不需要 | - |
| Settings 按钮 | ❌ 无 | ✅ BaseNode 内 (下拉菜单) | 保持 | 当前实现 |
| Delete 按钮 | ❌ 无 (键盘删除) | ✅ BaseNode 内 | 保持 | 当前实现 |
| Duplicate 按钮 | ❌ 无 | ✅ BaseNode 内 | 保持 | 当前实现 |

---

## 四、连接线 (Edges)

### 4.1 Edge 类型

| Edge 类型 | node-banana | XShow 当前 | 状态 | 执行范围 |
|-----------|-------------|-----------|------|----------|
| editable | EditableEdge.tsx | ❌ 使用默认 | 暂不需要 | - |
| reference | ReferenceEdge.tsx | ❌ 无 | 暂不需要 | - |

### 4.2 Edge 样式

| 样式属性 | node-banana | XShow 当前 | 状态 |
|----------|-------------|-----------|------|
| 默认颜色 | `#94a3b8` | 使用默认 | 需核对 |
| 选中/悬停 | `#3b82f6` | 使用默认 | 需核对 |

### 4.3 EdgeToolbar

| 特性 | node-banana | XShow 当前 | 状态 |
|------|-------------|-----------|------|
| 组件 | EdgeToolbar.tsx | ❌ 无 | 暂不需要 |

---

## 五、连接验证 (Connection Validation)

### 5.1 Handle 类型定义

| Handle Type | 颜色/标识 | node-banana | XShow 当前 | 状态 |
|-------------|----------|--------------|-----------|------|
| image | 绿色 | ✅ | ✅ 有 id="image" | ⚠️ 需验证颜色 |
| text | 蓝色 | ✅ | ✅ 有 id="text" | ⚠️ 需验证颜色 |
| audio | 紫色 | ✅ | ✅ 有 id="audio" | ⚠️ 需验证颜色 |
| video | ? | ✅ | ✅ 有 id="video" | ⚠️ 需验证颜色 |

**XShow 当前代码 (ImageNode.tsx):**
```tsx
<Handle type="target" position={Position.Left} id="image" style={{ top: '35%' }} className="!bg-handle-default ..." />
```

**问题:** XShow 没有定义 Handle 颜色，需要添加 `data-handletype` 属性和对应的 CSS 变量

### 5.2 连接规则

| 规则 | node-banana | XShow 当前 | 状态 |
|------|-------------|-----------|------|
| 同类型连接 | ✅ 强制同类型 | ✅ 有验证函数 | ⚠️ 需验证 |

**XShow 当前代码 (FlowCanvas.tsx):**
```tsx
function validateConnection(connection: Connection, _nodes: Node[]): boolean {
  // 已有基本验证
  // 需完善：同类型强制检查
}
```

---

## 六、工具栏 (Toolbars)

### 6.1 MultiSelectToolbar

| 特性 | node-banana | XShow 当前 | 状态 |
|------|-------------|-----------|------|
| 组件 | MultiSelectToolbar.tsx | ❌ 无 | 暂不需要 |

### 6.2 EdgeToolbar

| 特性 | node-banana | XShow 当前 | 状态 |
|------|-------------|-----------|------|
| 组件 | EdgeToolbar.tsx | ❌ 无 | 暂不需要 |

### 6.3 FloatingActionBar

| 特性 | node-banana | XShow 当前 | 状态 |
|------|-------------|-----------|------|
| 组件 | FloatingActionBar.tsx | ❌ 无 | 暂不需要 |

### 6.4 ConnectionDropMenu

| 特性 | node-banana | XShow 当前 | 状态 |
|------|-------------|-----------|------|
| 组件 | ConnectionDropMenu.tsx | ❌ 无 | 暂不需要 |

---

## 七、分组功能 (Groups)

### 7.1 GroupBackgroundsPortal

| 特性 | node-banana | XShow 当前 | 状态 |
|------|-------------|-----------|------|
| 组件 | GroupBackgroundsPortal.tsx | ❌ 无 | 暂不需要 |

### 7.2 GroupControlsOverlay

| 特性 | node-banana | XShow 当前 | 状态 |
|------|-------------|-----------|------|
| 组件 | GroupControlsOverlay.tsx | ❌ 无 | 暂不需要 |

---

## 八、其他画布元素

### 8.1 MiniMap 节点颜色映射

**当前 XShow:** 无颜色映射

**需添加:**
```tsx
nodeColor={(node) => {
  switch (node.type) {
    case 'imageNode': return '#3b82f6';
    case 'textNode': return '#f97316';
    case 'videoNode': return '#9333ea';
    case 'audioNode': return '#d946ef';
    // ... 其他类型
    default: return '#94a3b8';
  }
}}
```

---

## 九、已验证可执行操作清单

### ✅ 高优先级 - 已验证需要修改

| # | 项目 | 当前状态 | 目标状态 | 执行文件 | 备注 |
|---|------|---------|---------|---------|------|
| 1 | FlowCanvas 背景色 | 无设置 | `bg-neutral-900` | FlowCanvas.tsx | 添加 className |
| 2 | Controls 样式 | 默认 | 定制样式 | FlowCanvas.tsx | 添加 className |
| 3 | MiniMap 样式 | 默认 | 定制样式 | FlowCanvas.tsx | 添加 className + maskColor |
| 4 | MiniMap 节点颜色 | 无 | 按类型区分 | FlowCanvas.tsx | 添加 nodeColor 函数 |
| 5 | deleteKeyCode | 无 | `["Backspace", "Delete"]` | FlowCanvas.tsx | 需添加 |
| 6 | BaseNode 变量名错误 | `setHoveredNodeId` | `setHighlightedNode` | BaseNode.tsx:190 | 修复拼写错误 |

### ⚠️ 中优先级 - 需进一步验证

| # | 项目 | 当前状态 | 目标状态 | 执行文件 | 备注 |
|---|------|---------|---------|---------|------|
| 7 | Handle 颜色变量 | 无 | 需添加 | tailwind.css | 需验证是否需要 |
| 8 | 画布交互配置 | 部分实现 | 完整对齐 | FlowCanvas.tsx | 需核对所有配置 |

### ✅ 已完成/无需修改

| # | 项目 | 状态 |
|---|------|------|
| 1 | BaseNode 纯容器架构 | ✅ 已重构 |
| 2 | 节点样式 neutral-800 | ✅ 已对齐 |
| 3 | NodeResizer 选中显示 | ✅ 已实现 |
| 4 | Background 网格 | ✅ 已有 |
| 5 | Controls/MiniMap | ✅ 已有（需对齐样式） |
| 6 | 连接验证函数 | ✅ 已实现 |

---

## 十、具体修复指令

### 1. 修复 BaseNode.tsx 变量错误

```typescript
// 行 190 当前错误代码:
setHoveredNodeId(null);

// 修复为:
setHighlightedNode(null);
```

### 2. 增强 FlowCanvas.tsx 配置

```tsx
<ReactFlow
  nodes={styledNodes}
  edges={edges}
  onNodesChange={onNodesChange}
  onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  fitView
  deleteKeyCode={["Backspace", "Delete"]}  // ← 添加
  multiSelectionKeyCode="Shift"
  selectionOnDrag={false}
  selectionKeyCode="Shift"
  panOnDrag={[1]}  // 左键拖拽平移
  selectNodesOnDrag={false}
  nodeDragThreshold={5}
  nodeClickDistance={5}
  zoomOnScroll={false}
  zoomOnPinch={true}
  minZoom={0.1}
  maxZoom={4}
  className="bg-neutral-900"  // ← 添加
  proOptions={{ hideAttribution: true }}  // ← 添加
  defaultEdgeOptions={{ type: "editable", animated: false }}  // ← 添加
>
  <Background color="#404040" gap={20} size={1} />
  <Controls className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg [&>button]:bg-neutral-800 [&>button]:border-neutral-700 [&>button]:fill-neutral-300 [&>button:hover]:bg-neutral-700 [&>button:hover]:fill-neutral-100" />
  <MiniMap
    className="bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg"
    maskColor="rgba(0, 0, 0, 0.6)"
    pannable
    zoomable
    nodeColor={(node) => {
      switch (node.type) {
        case 'imageNode': return '#3b82f6';
        case 'textNode': return '#f97316';
        case 'videoNode': return '#9333ea';
        case 'audioNode': return '#d946ef';
        case 'cropNode': return '#60a5fa';
        case 'gridSplitNode': return '#f59e0b';
        case 'gridMergeNode': return '#f97316';
        case 'universalNode': return '#06b6d4';
        default: return '#94a3b8';
      }
    }}
  />
  {/* ... */}
</ReactFlow>
```

---

## 十一、文件对应关系

| node-banana 文件 | XShow 当前文件 | 状态 | 备注 |
|-----------------|---------------|------|------|
| `components/nodes/BaseNode.tsx` | `components/canvas/BaseNode.tsx` | ⚠️ 需修复 bug | 变量名错误 |
| `components/nodes/FloatingNodeHeader.tsx` | ❌ 无 | 暂不需要 | |
| `components/WorkflowCanvas.tsx` | `components/canvas/FlowCanvas.tsx` | ⚠️ 需增强 | 需添加配置 |
| `components/edges/EditableEdge.tsx` | ❌ 无 | 暂不需要 | |
| `components/edges/ReferenceEdge.tsx` | ❌ 无 | 暂不需要 | |
| `components/EdgeToolbar.tsx` | ❌ 无 | 暂不需要 | |
| `components/MultiSelectToolbar.tsx` | ❌ 无 | 暂不需要 | |
| `components/ConnectionDropMenu.tsx` | ❌ 无 | 暂不需要 | |

---

## 十二、Handle 类型分类系统 (Handle Type Classification)

### 12.1 CSS 变量定义

**文件:** `node-banana/src/app/globals.css`

```css
:root {
  /* Handle colors (used by labels) */
  --handle-color-image: #10b981;  /* 绿色 */
  --handle-color-text: #3b82f6;  /* 蓝色 */
  --handle-color-3d: #f97316;    /* 橙色 */
  --handle-color-audio: #a855f7; /* 紫色 */
}
```

### 12.2 Handle 样式 (CSS 选择器)

```css
/* Base handle styles */
.react-flow__handle {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  z-index: 5;
}

/* Image handles - soft green */
.react-flow__handle[data-handletype="image"] {
  background: #10b981;
}

/* Text handles - soft blue */
.react-flow__handle[data-handletype="text"] {
  background: #3b82f6;
}

/* Audio handles - purple */
.react-flow__handle[data-handletype="audio"] {
  background: #a855f7;
}

/* 3D handles - orange */
.react-flow__handle[data-handletype="3d"] {
  background: #f97316;
}
```

### 12.3 节点组件中的 Handle 定义

**GenerateImageNode 示例:**
```tsx
{/* 输入 Handle 1 - Image (35% 位置) */}
<Handle
  type="target"
  position={Position.Left}
  id="image"
  style={{ top: "35%", zIndex: 10 }}
  data-handletype="image"
/>

{/* 输入 Handle 2 - Text (65% 位置) */}
<Handle
  type="target"
  position={Position.Left}
  id="text"
  style={{ top: "65%", zIndex: 10 }}
  data-handletype="text"
/>

{/* 输出 Handle - Image (50% 位置) */}
<Handle
  type="source"
  position={Position.Right}
  id="image"
  style={{ top: "50%", zIndex: 10 }}
  data-handletype="image"
/>
```

### 12.4 Handle 类型颜色总结

| 类型 | CSS 变量 | 颜色代码 | data-handletype |
|------|----------|----------|-----------------|
| image | `--handle-color-image` | `#10b981` (绿色) | `image` |
| text | `--handle-color-text` | `#3b82f6` (蓝色) | `text` |
| audio | `--handle-color-audio` | `#a855f7` (紫色) | `audio` |
| 3d | `--handle-color-3d` | `#f97316` (橙色) | `3d` |

---

## 十三、底部悬浮菜单 (FloatingActionBar)

### 13.1 组件位置

**文件:** `node-banana/src/components/FloatingActionBar.tsx`

### 13.2 定位样式

```tsx
<div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
  <div className="flex items-center gap-0.5 bg-neutral-800/95 rounded-lg shadow-lg border border-neutral-700/80 px-1.5 py-1">
```

**关键样式:**
- `fixed bottom-5` - 固定在距离底部 20px
- `left-1/2 -translate-x-1/2` - 水平居中
- `z-50` - 高 z-index
- `bg-neutral-800/95` - 深色背景，95% 不透明度
- `rounded-lg shadow-lg border border-neutral-700/80` - 圆角 + 阴影 + 边框

### 13.3 按钮列表

| 按钮 | 功能 |
|------|------|
| Image | 添加 `imageInput` 节点 |
| Video | 添加 `videoInput` 节点 |
| Prompt | 添加 `prompt` 节点 |
| **Generate** (下拉) | 添加 Image/Video/3D/LLM 节点 |
| Output | 添加 `output` 节点 |
| **All nodes** (下拉) | 完整节点选择面板 |
| **All models** | 打开模型搜索对话框 |
| Edge style | 切换连线样式 (angular/curved) |
| **Run** | 执行整个工作流 |

### 13.4 下拉菜单模式

```tsx
{/* 下拉容器 */}
<div className="relative">
  <button onClick={() => setIsOpen(!isOpen)}>
    Generate
    <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`}>
      {/* chevron icon */}
    </svg>
  </button>

  {/* 下拉菜单 - 定位在按钮上方 */}
  {isOpen && (
    <div className="absolute bottom-full left-0 mb-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
      {/* menu items */}
    </div>
  )}
</div>
```

**关键:** `absolute bottom-full left-0 mb-2` 使下拉菜单显示在按钮上方

---

## 十四、顶部栏 (Header)

### 14.1 组件位置

**文件:** `node-banana/src/components/Header.tsx`

### 14.2 Header 功能列表

| 功能 | 说明 |
|------|------|
| 项目名称 | 显示当前工作流名称 |
| 保存/加载 | 工作流保存和加载 |
| 快捷键 | KeyboardShortcutsDialog |
| 工作流浏览器 | WorkflowBrowserModal |
| 费用指示器 | CostIndicator |
| 评论导航 | CommentsNavigationIcon |
| 快速开始 | WelcomeModal |

### 14.3 样式结构

```tsx
export function Header() {
  return (
    <header className="flex items-center justify-between px-4 py-2 bg-neutral-800 border-b border-neutral-700">
      {/* 左侧：项目名称 + 操作按钮 */}
      <div className="flex items-center gap-2">
        {/* 项目名称 */}
        <span className="text-sm font-medium">{workflowName}</span>
        {/* 保存/加载按钮 */}
        {/* ... */}
      </div>

      {/* 右侧：功能按钮 */}
      <div className="flex items-center gap-2">
        <button onClick={() => setShortcutsDialogOpen(true)} title="快捷键">
          {/* keyboard icon */}
        </button>
        <button onClick={() => setShowQuickstart(true)} title="快速开始">
          {/* help icon */}
        </button>
        {/* CostIndicator */}
        {/* CommentsNavigationIcon */}
      </div>
    </header>
  );
}
```

### 14.4 在页面中的使用

```tsx
// node-banana/src/app/page.tsx
<div className="h-screen flex flex-col">
  <Header />           {/* ← 顶部栏 */}
  <WorkflowCanvas />   {/* ← 画布 */}
  <FloatingActionBar /> {/* ← 底部悬浮菜单 */}
</div>
```

---

## 十五、节点设置悬停显示 (Hidden Settings on Hover)

### 15.1 FloatingNodeHeader showControls 逻辑

**文件:** `node-banana/src/components/nodes/FloatingNodeHeader.tsx`

```typescript
const isBodyHovered = useWorkflowStore((state) => state.hoveredNodeId === id);
const isHovered = isHeaderHovered || isBodyHovered;

// 按钮仅在 hover 或选中时显示
const showControls = isHovered || selected;
```

**关键点:**
- 鼠标悬停在节点上 (`isBodyHovered`)
- 或鼠标悬停在标题栏上 (`isHeaderHovered`)
- 或节点被选中 (`selected`)
- 满足任一条件时显示控制按钮

### 15.2 按钮显示样式

```tsx
<div className={`shrink-0 flex items-center gap-1 pr-1 transition-opacity duration-200 -translate-y-1 ${
  showControls ? 'opacity-100' : 'opacity-0'
}`}>
  {/* 控制按钮仅在 showControls 为 true 时显示 */}
</div>
```

**关键样式:** `transition-opacity duration-200` + `opacity-0/opacity-100` 实现淡入淡出效果

### 15.3 节点内容默认隐藏

node-banana 节点默认只显示内容，参数设置：
- **默认隐藏** - 参数面板不显示
- **悬停显示** - 鼠标悬停时显示设置图标
- **点击展开** - 点击设置图标展开参数面板

---

## 十六、XShow 当前 vs node-banana 完整对比 (更新版)

| 类别 | node-banana | XShow 当前 | 状态 | 优先级 |
|------|-------------|-----------|------|--------|
| **Handle 类型分类** | ✅ CSS 变量 + data-handletype | ❌ 无 | 需添加 | **高** |
| **Handle 颜色** | image=#10b981, text=#3b82f6, audio=#a855f7, 3d=#f97316 | ❌ 无 | 需添加 | **高** |
| **底部悬浮菜单** | FloatingActionBar | ❌ 无 (分栏实现) | 需重构 | **高** |
| **顶部栏整合** | Header 包含设置+资源 | ❌ 分栏实现 | 需重构 | **高** |
| **节点设置隐藏** | showControls 逻辑 | ❌ 始终显示 | 需实现 | **中** |
| **图片节点 Handle** | 2 输入 (35%,65%) + 1 输出 (50%) | 已有但需验证 | 需核对 | **中** |
| **模型切换入口** | FloatingActionBar "All models" | ❌ 无 | 需添加 | **高** |

---

## 十七、待执行修复清单 (更新版)

### 高优先级 (P0)

| # | 项目 | 目标状态 | 执行文件 |
|---|------|---------|---------|
| 1 | 添加 Handle 类型 CSS 变量 | image=#10b981, text=#3b82f6 等 | tailwind.css |
| 2 | 为所有节点 Handle 添加 data-handletype | image/text/audio/video | 各节点组件 |
| 3 | 创建 FloatingActionBar 组件 | 底部悬浮菜单 | 新建组件 |
| 4 | 重构顶部栏 | Header 整合设置+资源 | 新建组件 |
| 5 | 添加 "All models" 模型切换入口 | 底部菜单内 | FloatingActionBar |
| 6 | 修复 BaseNode 变量错误 | setHighlightedNode | BaseNode.tsx |
| 7 | 添加 deleteKeyCode | 键盘删除支持 | FlowCanvas.tsx |

### 中优先级 (P1)

| # | 项目 | 目标状态 | 执行文件 |
|---|------|---------|---------|
| 8 | 实现节点设置悬停显示 | showControls 逻辑 | BaseNode/FloatingNodeHeader |
| 9 | 验证图片节点 Handle 配置 | 2 输入 + 1 输出 | ImageNode |
| 10 | MiniMap 节点颜色 | 按类型区分 | FlowCanvas.tsx |
| 11 | 画布样式对齐 | neutral-900 背景 | FlowCanvas.tsx |

---

**文档版本:** v1.2
**创建日期:** 2026-04-11
**最后更新:** 2026-04-11
**更新内容:** 新增用户实际运行验证反馈 (6 点)