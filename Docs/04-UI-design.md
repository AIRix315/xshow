# XShow 样式统一计划

基于 node-banana 主题，与 XShow 功能结合。

---

## 新增阶段 0：图标统一（先执行）

### 当前问题

项目使用 emoji 图标，不专业且与 node-banana 不一致。

### node-banana 做法

使用 **lucide-react** 图标库（项目已有此依赖）。

### 需要修改的文件

| 文件 | 改动 |
|------|------|
| `App.tsx` | Tab 标签：AI画布 → 无图标 / 使用 lucide；资源 → lucide-react；设置 → lucide-react |
| `NodeSidebar.tsx` | 节点图标：使用 lucide-react (Image, FileText, Video, Mic, Grid3x3, etc.) |
| `TransitPanel.tsx` | 筛选/操作图标：使用 lucide-react |
| `SettingsPanel.tsx` | API 类型图标：使用 lucide-react |
| `UniversalNode.tsx` | 节点标题图标 + "💾 保存模板" 文字 |
| `GridSplitNode.tsx` | 节点标题 "🔲 九宫格分拆" → 使用 lucide 图标 |
| `GridMergeNode.tsx` | 节点标题 "🧩 九宫格合拼" → 使用 lucide 图标 |
| `CropNode.tsx` | 节点标题 "图片裁剪" → 使用 lucide 图标 |
| `TextNode.tsx` | 节点标题图标 + 折叠按钮 "▼/▶" 改为 lucide 图标 |

### 额外需要修改的节点标题

所有带 emoji 的节点标题都需要改为纯文字 + 可选 lucide 图标：

```tsx
// 当前
<span>🔲 九宫格分拆</span>
<span>🧩 九宫格合拼</span>
<span>⚙️ {data.label || '万能节点'}</span>

// 改进后
<span className="text-[10px] text-text-secondary font-medium">九宫格分拆</span>
<span className="text-[10px] text-text-secondary font-medium">九宫格合拼</span>
<span className="text-[10px] text-text-secondary font-medium">{data.label || '万能节点'}</span>
```

### 完整图标映射表

| 用途 | 当前 emoji | 推荐 lucide-react |
|------|------------|-------------------|
| Tab: AI画布 | 🎨 | `Palette` / `Paintbrush` |
| Tab: 资源 | 📦 | `Package` / `FolderOpen` |
| Tab: 设置 | ⚙️ | `Settings` |
| 节点: 图片 | 🖼️ | `Image` |
| 节点: 提示词 | ✨ | `Sparkles` |
| 节点: 文本 | 📝 | `FileText` |
| 节点: 视频 | 🎬 | `Video` |
| 节点: 语音 | 🎙️ | `Mic` / `Volume2` |
| 节点: 九宫格拆 | 🔲 | `Grid3x3` |
| 节点: 九宫格拼 | 🧩 | `LayoutGrid` |
| 节点: 裁剪 | ✂️ | `Scissors` |
| 节点: 万能 | ⚙️ | `Settings` |
| 筛选: 全部 | 🏷️ | `Tag` |
| 筛选: 图片 | 🖼️ | `Image` |
| 筛选: 视频 | 🎬 | `Video` |
| 筛选: 音频 | 🎙️ | `Volume2` |
| 筛选: 文本 | 📝 | `FileText` |
| 操作: 收藏 | ⭐/☆ | `Star` |
| 操作: 删除 | 🗑️ | `Trash2` |
| 操作: 发送 |️ | `Send` |
| 操作: 加载中 | ⏳ | `Loader2` (animate-spin) |
| 空状态: 资源 | 📦 | `Package` |
| 设置: 供应商 | 🔌 | `Plug` |
| 保存模板 | 💾 | `Save` |

### 示例修改

```tsx
// NodeSidebar.tsx 改造示例
import { Image, FileText, Video, Mic, Grid3x3, Scissors, Settings } from 'lucide-react';

const NODE_TYPES = [
  { type: 'imageNode', label: '图片', icon: Image },
  { type: 'textNode', label: '文本', icon: FileText },
  { type: 'videoNode', label: '视频', icon: Video },
  { type: 'audioNode', label: '语音', icon: Mic },
  { type: 'gridSplitNode', label: '九宫格拆', icon: Grid3x3 },
  { type: 'cropNode', label: '裁剪', icon: Scissors },
  { type: 'customNode', label: '万能', icon: Settings },
  // ...
];

// 渲染时
{NODE_TYPES.map(({ type, label, icon: Icon }) => (
  <div key={type} className="...">
    <Icon className="w-4 h-4 text-text-secondary" />
    <span className="text-[9px] text-text-secondary">{label}</span>
  </div>
))}
```

---

## 一、计划概览

| 阶段 | 内容 | 文件 |
|------|------|------|
| 1 | 扩展 Tailwind 主题变量 | `tailwind.css` |
| 2 | 统一 BaseNode 样式 | `BaseNode.tsx` |
| 3 | 统一节点组件样式 | 各类 Node 组件 |
| 4 | 统一侧边栏样式 | `NodeSidebar.tsx` |
| 5 | 统一画布全局样式 | `FlowCanvas.tsx` + CSS |

---

## 二、阶段 1：扩展 Tailwind 主题

**目标**：添加 node-banana 风格的颜色变量

```css
/* tailwind.css 扩展 */
@theme {
  /* 现有变量保留 */
  --color-background: #121212;
  --color-surface: #1c1c1c;
  --color-surface-hover: #252525;
  --color-border: #333333;
  --color-border-hover: #555555;
  --color-primary: #3b82f6;
  --color-primary-hover: #60a5fa;
  --color-error: #ef4444;
  --color-error-bg: rgba(239, 68, 68, 0.1);
  --color-text: #e5e5e5;
  --color-text-secondary: #9ca3af;
  --color-text-muted: #6b7280;

  /* 新增 - 参考 node-banana neutral 色调 */
  --color-node-bg: #262626;          /* 节点背景 */
  --color-node-bg-hover: #333333;    /* 节点悬浮 */
  --color-node-border: #404040;      /* 节点边框 */

  /* Handle 类型化颜色 */
  --color-handle-image: #10b981;     /* 绿色 - 图片 */
  --color-handle-text: #3b82f6;      /* 蓝色 - 文本 */
  --color-handle-video: #f97316;    /* 橙色 - 视频 */
  --color-handle-audio: #a855f7;    /* 紫色 - 音频 */
  --color-handle-default: #525252;  /* 灰色 - 默认 */
}
```

---

## 三、阶段 2：BaseNode 样式统一

### 当前问题

- 硬编码 `#1a1a1a`, `#555` 等颜色
- 无统一阴影/圆角模式
- Handle 样式粗糙

### 改进后的样式

#### 节点容器

```tsx
className={`
  bg-node-bg
  rounded-lg
  shadow-lg
  border
  ${selected 
    ? 'ring-2 ring-primary/40 shadow-primary/25' 
    : 'border-node-border'}
  ${loading ? 'border-primary ring-1 ring-primary/20' : ''}
  ${errorMessage ? 'border-error' : ''}
`}
```

#### Handle

```tsx
// 左侧 Handle（输入）
<Handle 
  type="target" 
  position={Position.Left} 
  className="!bg-handle-default !w-5 !h-5 !border-[3px] !border-[#222] hover:!bg-primary hover:!w-6 hover:!h-6 hover:!border-white transition-all duration-200 z-20 shadow-lg cursor-crosshair" 
/>

// 右侧 Handle（输出）
<Handle 
  type="source" 
  position={Position.Right} 
  className="!bg-handle-default !w-5 !h-5 !border-[3px] !border-[#222] hover:!bg-primary hover:!w-6 hover:!h-6 hover:!border-white transition-all duration-200 z-20 shadow-lg cursor-crosshair" 
/>
```

#### Loading 状态

```tsx
<div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-secondary bg-surface/80 backdrop-blur-sm z-10">
  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  <span className="text-xs">处理中...</span>
</div>
```

#### Error 状态

```tsx
<div className="text-error text-[10px] p-2 border border-error/30 rounded bg-error/10 flex items-start gap-1.5 mb-1">
  <span className="break-all leading-tight">{errorMessage}</span>
</div>
```

#### NodeResizer

```tsx
<NodeResizer
  isVisible={selected}
  minWidth={minWidth}
  minHeight={minHeight}
  lineStyle={{ borderColor: '#3b82f6' }}
  handleStyle={{ 
    borderColor: '#3b82f6', 
    backgroundColor: '#1c1c1c', 
    width: 8, 
    height: 8 
  }}
/>
```

---

## 四、阶段 3：节点组件样式统一

### 样式对照表（以 ImageNode 为例）

| 元素 | 当前 | 改进后 |
|------|------|--------|
| 输入框背景 | `bg-[#2a2a2a]` | `bg-surface` |
| 输入框边框 | `border-[#444]` | `border-border` |
| 输入框聚焦 | `focus:border-blue-500` | `focus:border-primary` |
| 按钮背景 | `bg-blue-600` | `bg-primary` |
| 按钮悬浮 | `hover:bg-blue-700` | `hover:bg-primary-hover` |
| 按钮禁用 | `disabled:bg-gray-600` | `disabled:bg-surface-hover` |
| 尺寸选项-未选中 | `border-[#444] text-gray-400 bg-[#222]` | `border-border text-text-secondary bg-surface` |
| 尺寸选项-选中 | `border-blue-500 bg-blue-500/20 text-blue-400` | `border-primary bg-primary/20 text-primary` |
| 图片预览边框 | `border border-[#444]` | `border border-border rounded` |

### ImageNode 完整改进

```tsx
{/* 提示词输入 */}
<textarea
  value={prompt}
  onChange={(e) => {
    setPrompt(e.target.value);
    updateNodeData(id, { prompt: e.target.value });
  }}
  placeholder="输入图片描述..."
  className="w-full bg-surface text-text text-xs rounded p-1.5 resize-none border border-border focus:border-primary outline-none"
  rows={2}
/>

{/* 模型选择 */}
<select
  value={currentModel}
  onChange={(e) => {
    setSelectedModel(e.target.value);
    updateNodeData(id, { selectedModel: e.target.value });
  }}
  className="w-full bg-surface text-text text-xs rounded p-1 border border-border"
>
  {models.map((m) => (
    <option key={m} value={m}>{m}</option>
  ))}
</select>

{/* 尺寸选项按钮 */}
<button
  onClick={() => {
    setAspectRatio(ar);
    updateNodeData(id, { aspectRatio: ar });
  }}
  className={`px-1.5 py-0.5 text-[10px] rounded border ${
    aspectRatio === ar 
      ? 'border-primary bg-primary/20 text-primary' 
      : 'border-border text-text-secondary bg-surface hover:bg-surface-hover'
  }`}
>
  {ar}
</button>

{/* 生成按钮 */}
<button
  onClick={handleGenerate}
  disabled={loading || !prompt.trim()}
  className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1.5 rounded font-medium"
>
  {loading ? '生成中...' : '生成图片'}
</button>

{/* 图片预览 */}
<img
  src={imageUrl}
  alt="生成结果"
  className="w-full rounded border border-border"
  style={{ maxHeight: '200px', objectFit: 'contain' }}
/>
```

---

## 五、阶段 4：NodeSidebar 改进

### 当前

```tsx
className="w-[72px] bg-[#1a1a1a] border-r border-[#333] flex flex-col items-center py-2 gap-1 overflow-y-auto"
```

### 改进后

```tsx
className="w-[72px] bg-surface border-r border-border flex flex-col items-center py-2 gap-1 overflow-y-auto"
```

### 节点按钮

```tsx
// 当前
className="flex flex-col items-center justify-center w-[58px] h-[54px] bg-[#252525] hover:bg-[#333] border border-[#444] rounded cursor-grab active:cursor-grabbing transition-colors"

// 改进
className="flex flex-col items-center justify-center w-[58px] h-[54px] bg-surface hover:bg-surface-hover border border-border rounded-lg cursor-grab active:cursor-grabbing transition-colors"
```

---

## 六、阶段 5：画布全局样式

### FlowCanvas.tsx 改进

```tsx
// 画布背景
className="bg-background"

// Background 组件
<Background color="#333" gap={16} />

// Controls 样式（已有部分优化）
<Controls className="bg-surface border-border [&>button]:bg-surface [&>button]:border-border [&>button]:text-text [&>button]:hover:bg-surface-hover" />

// MiniMap 样式（已有部分优化）
<MiniMap
  nodeColor="#3b82f6"
  maskColor="rgba(0, 0, 0, 0.7)"
  className="bg-surface border-border"
/>
```

### 全局 CSS（新增到 tailwind.css 或单独 CSS 文件）

```css
/* ReactFlow Handle 样式 */
.react-flow__handle {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

/* 类型化 Handle（通过 data 属性） */
[data-handletype="image"] { background: var(--color-handle-image); }
[data-handletype="text"] { background: var(--color-handle-text); }
[data-handletype="video"] { background: var(--color-handle-video); }
[data-handletype="audio"] { background: var(--color-handle-audio); }

/* Controls 样式 */
.react-flow__controls {
  background: var(--color-surface) !important;
  border: 1px solid var(--color-border) !important;
  border-radius: 8px !important;
}

/* Edge 样式 */
.react-flow__edge-path {
  stroke: #94a3b8;
  stroke-width: 3;
}

.react-flow__edge.selected .react-flow__edge-path,
.react-flow__edge:hover .react-flow__edge-path {
  stroke: #3b82f6;
}
```

---

## 七、保持不变的部分

以下内容**不修改**：

- **功能逻辑**：API 调用、执行引擎、Store 等
- **组件结构**：节点组件的内部逻辑不变
- **数据流**：节点间数据传递方式
- **Tab 导航**：App.tsx 三标签页结构
- **TransitPanel / SettingsPanel**：除非用户要求

---

## 八、待修改文件清单

| 序号 | 文件路径 | 主要改动 |
|------|----------|----------|
| 0 | `App.tsx` | Tab 标签使用 lucide-react 图标 |
| 0 | `NodeSidebar.tsx` | 节点图标使用 lucide-react |
| 0 | `TransitPanel.tsx` | 筛选/操作图标使用 lucide-react |
| 0 | `SettingsPanel.tsx` | API 类型图标使用 lucide-react |
| 0 | `UniversalNode.tsx` | 节点标题图标 + "保存模板" 文字 |
| 0 | `GridSplitNode.tsx` | 节点标题图标 |
| 0 | `GridMergeNode.tsx` | 节点标题图标 |
| 0 | `CropNode.tsx` | 节点标题图标 |
| 0 | `TextNode.tsx` | 节点标题图标 + 折叠按钮 |
| 1 | `src/tailwind.css` | 主题变量扩展 |
| 2 | `src/components/canvas/BaseNode.tsx` | 统一节点容器样式 |
| 3 | `src/components/canvas/ImageNode.tsx` | 统一输入框/按钮/预览样式 |
| 4 | `src/components/canvas/TextNode.tsx` | 同上 |
| 5 | `src/components/canvas/VideoNode.tsx` | 同上 |
| 6 | `src/components/canvas/AudioNode.tsx` | 同上 |
| 7 | `src/components/canvas/CropNode.tsx` | 同上 |
| 8 | `src/components/canvas/GridSplitNode.tsx` | 同上 |
| 9 | `src/components/canvas/GridMergeNode.tsx` | 同上 |
| 10 | `src/components/canvas/UniversalNode.tsx` | 同上 |
| 11 | `src/components/canvas/NodeSidebar.tsx` | 侧边栏样式（除图标外的其他样式） |
| 12 | `src/components/canvas/FlowCanvas.tsx` | 全局 CSS/画布样式 |

---

## 九、参考来源

- node-banana (shrimbly/node-banana) BaseNode.tsx
- node-banana globals.css Tailwind 配置
- flowcraft (mblanc/flowcraft) shadcn/ui 组件风格
- XShow 现有 AGENTS.md 规范

---

## 十、执行顺序

0. **图标统一** — 使用 lucide-react 替换所有 emoji 图标
1. **主题变量** — 扩展 tailwind.css 变量
2. **BaseNode** — 核心容器样式
3. **节点组件** — 使用新变量统一样式
4. **侧边栏/画布** — 全局样式

---

*计划完成，等待审查后执行*