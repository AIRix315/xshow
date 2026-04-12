# XShow Canvas 原型待实现功能清单

> 本文档记录在原型中无法完全展示、需要实际开发时重点实现的功能

## 1. 动态连线与连接菜单

### ConnectionDropMenu (连线时自动弹出可连接节点菜单)

**参考实现**: node-banana/src/components/ConnectionDropMenu.tsx

**功能描述**: 
当用户从一个节点的输出端点拖拽连接线，但未连接到目标节点时，自动弹出一个菜单列表，显示可以接受该类型输入的节点。

**触发条件**:
- 拖拽连接线时
- 未成功连接到目标节点
- 松开鼠标时

**菜单逻辑** (按输入类型分类):

| 输入类型 | 可连接节点 |
|---------|-----------|
| Image | Annotate, Generate Image, Generate Video, Split Grid, Output, Output Gallery, Image Compare, Router |
| Text | LLM Generate, Prompt Constructor, Array, Output |
| Video | Video Stitch, Video Trim, Frame Grab, Output, Output Gallery |
| Audio | Generate Audio, Output, Output Gallery |
| 3D | Output Gallery |

**UI 样式**:
- 浮动在连线末端位置
- 显示节点图标 + 节点名称
- 点击后自动创建新节点并连接

**实现要点**:
1. 使用 ReactFlow 的 `onConnectEnd` 回调
2. 检测连接是否未成功（target 为空）
3. 根据 sourceHandle 的类型获取对应可连接节点列表
4. 渲染浮动菜单供用户选择

---

## 2. 节点 Handle (连接点) 交互

### 多类型 Handle

node-banana 的节点通常有多个 Handle:
- **Image Input**: source (image)
- **Generate Image**: target (image, text), source (image)
- **LLM Generate**: target (text), source (text)
- **Router**: 多个 source (根据规则数量动态生成)

**实现要点**:
- 每个 Handle 需要设置 `data-handletype` 属性
- 连接时限制类型匹配（只允许 compatible 的 handle 连接）

---

## 3. 节点悬停展开效果

### 当前状态
原型已实现 CSS 悬停效果：`group-hover` 控制 `.node-minimal-content` 和 `.node-hover-content` 的显示切换。

### 实际实现注意事项
1. 悬停展开会导致节点高度变化
2. 需要使用 ResizeObserver 动态调整节点尺寸
3. 展开/收起动画时间约 160ms

**参考实现**: node-banana/src/components/nodes/BaseNode.tsx (useLayoutEffect for settings panel)

---

## 4. 节点状态显示

### 执行状态
- **loading**: 显示加载动画 (旋转图标)
- **error**: 显示错误覆盖层
- **completed**: 显示完成状态

### 节点图标
- 右上角设置按钮 (⚙)
- 悬停时显示 (`opacity-0 group-hover:opacity-100`)

---

## 5. 画布交互功能

| 功能 | 说明 |
|------|------|
| 缩放 (Zoom) | 滚轮/按钮缩放 |
| 平移 (Pan) | 空格+拖拽/中键拖拽 |
| 网格对齐 | 节点拖拽时吸附到网格 |
| 小地图 | 右下角/右上角显示画布概览 |
| Controls | 左下角缩放按钮组 |

---

## 6. 节点类型完整列表

| 分类 | 节点类型 | Type ID |
|------|---------|---------|
| Input | Image Input | `imageInput` |
| Input | Audio Input | `audioInput` |
| Input | Video Input | `videoInput` |
| Input | 3D Viewer | `glbViewer` |
| Text | Prompt | `prompt` |
| Text | Prompt Constructor | `promptConstructor` |
| Text | Array | `array` |
| Generate | Generate Image | `nanoBanana` |
| Generate | Generate Video | `generateVideo` |
| Generate | Generate 3D | `generate3d` |
| Generate | Generate Audio | `generateAudio` |
| Generate | LLM Generate | `llmGenerate` |
| Process | Annotate | `annotation` |
| Process | Split Grid | `splitGrid` |
| Process | Video Stitch | `videoStitch` |
| Process | Video Trim | `videoTrim` |
| Process | Ease Curve | `easeCurve` |
| Process | Frame Grab | `videoFrameGrab` |
| Process | Image Compare | `imageCompare` |
| Route | Router | `router` |
| Route | Switch | `switch` |
| Route | Conditional Switch | `conditionalSwitch` |
| Output | Output | `output` |
| Output | Output Gallery | `outputGallery` |

---

## 7. 设置面板功能

### 标签页结构 (已原型实现)
- 项目 (Project)
- 模型 (Model) - 渠道商 + 模型配置
- 提示词 (Prompt)
- 画布 (Canvas) - 画布设置 + 节点默认值
- 系统 (System)

### 折叠 Section (已原型实现)
- 每个大分类可通过 `>` 箭头展开/收起

---

## 8. 下一步开发优先级

1. **P0 - 核心功能**
   - ReactFlow 画布基础搭建
   - 节点渲染 (至少基础节点)
   - 连接线 (基础拖拽连接)
   - **ConnectionDropMenu** (高优先级)

2. **P1 - 重要交互**
   - 节点悬停展开效果
   - 执行状态显示 (loading/error)
   - 设置面板

3. **P2 - 辅助功能**
   - 小地图
   - Controls
   - 节点图标交互
   - 网格吸附

---

*最后更新: 2026-04-11*