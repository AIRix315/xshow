# AGENTS.md — XShow 项目指南

XShow 是一个 **Chrome Manifest V3 侧边栏扩展**，提供节点式可视化 AI 工作流编辑器。用户在画布上拖拽节点（图片/文本/视频/音频/裁剪/九宫格/万能节点），连接边后通过 BFS 引擎依次执行。

## Build / Lint / Test 命令

```bash
npm run dev          # Vite 开发服务器
npm run build        # tsc -b && vite build（生产构建）
npm run preview      # 预览生产构建
npm test             # vitest run（一次性运行全部测试）
npm run test:watch   # vitest --watch（监听模式）
npm run typecheck    # tsc --noEmit（类型检查，不输出文件）
```

### 运行单个测试

```bash
npx vitest run src/api/imageApi.test.ts          # 按路径
npx vitest run -t "sends POST"                    # 按测试名匹配
npx vitest run src/stores/                        # 运行目录下全部测试
```

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | React | 19 |
| 语言 | TypeScript | ~5.7 |
| 构建 | Vite | 6 |
| 画布 | @xyflow/react | ^12.10 |
| 状态 | Zustand | 5 |
| 样式 | Tailwind CSS | 4 |
| 图标 | lucide-react | ^0.460 |
| 存储 | localforage / chrome.storage.local | — |
| 测试 | Vitest | 3 |
| 运行时 | Chrome Extension Manifest V3 | — |

## 目录结构

```
src/
├── main.tsx                       # 应用入口（React.StrictMode）
├── App.tsx                         # 三标签页路由（AI画布/资源/设置）
├── tailwind.css                   # Tailwind v4 主题变量
├── types.ts                        # 所有接口 & 类型定义 + 默认常量
├── vite-env.d.ts                   # Vite 类型声明
│
├── api/                            # API 调用层（每模块对应一个节点类型）
│   ├── imageApi.ts                 #   Gemini 图片生成
│   ├── textApi.ts                  #   OpenAI 文本 + autoSplit
│   ├── videoApi.ts                 #   视频生成
│   ├── audioApi.ts                 #   音频/TTS
│   └── *.test.ts                   #   同目录测试文件
│
├── components/
│   ├── canvas/                     # ReactFlow 画布节点
│   │   ├── FlowCanvas.tsx          #   主画布（拖拽、连线、高亮）
│   │   ├── NodeSidebar.tsx         #   左侧节点选择栏
│   │   ├── BaseNode.tsx            #   节点封装（标题栏+错误+加载态）
│   │   ├── ImageNode.tsx           #   图片生成节点
│   │   ├── TextNode.tsx            #   文本节点
│   │   ├── VideoNode.tsx           #   视频节点
│   │   ├── AudioNode.tsx           #   音频节点
│   │   ├── CropNode.tsx            #   裁剪节点
│   │   ├── GridSplitNode.tsx       #   九宫格拆分节点
│   │   ├── GridMergeNode.tsx       #   九宫格合并节点
│   │   └── UniversalNode.tsx       #   万能自定义 API 节点
│   ├── transit/
│   │   └── TransitPanel.tsx        # 资源中转站面板
│   └── settings/
│       └── SettingsPanel.tsx       # 设置面板
│
├── hooks/                          # 自定义 hooks（目前也含 Zustand store）
│   └── useTransitResources.ts      # 资源中转站 store
│
├── stores/                         # Zustand 状态管理
│   ├── useFlowStore.ts             # 画布状态（nodes/edges/highlight）
│   └── useSettingsStore.ts         # 持久化设置（API config/projects/templates）
│
├── utils/                          # 纯工具函数
│   ├── nodeFactory.ts              # 节点工厂（createNode + nodeTypes 注册）
│   ├── executionEngine.ts          # BFS 拓扑分层执行引擎
│   ├── canvasState.ts              # 画布状态辅助
│   └── chromeHelpers.ts            # Chrome Extension API 辅助
│
└── setup.test.ts                   # 项目骨架验证测试
```

## 代码风格规范

### 导入

- **使用 `@/` 路径别名**引用 `src/` 下的模块，不用相对路径跨层引用：
  ```typescript
  import { useFlowStore } from '@/stores/useFlowStore';
  import type { ImageNode } from '@/types';
  import { generateImage } from '@/api/imageApi';
  ```
- **相对导入**仅用于同级目录内的模块：
  ```typescript
  import BaseNodeWrapper from './BaseNode';  // 同目录组件
  ```
- **类型导入**使用 `import type`：
  ```typescript
  import type { NodeProps } from '@xyflow/react';
  import type { ImageNode as ImageNodeType } from '@/types';
  ```

### TypeScript 严格规则

tsconfig 已启用以下严格检查，**必须遵守**：

- `strict: true` — 全部严格模式
- `noUnusedLocals` / `noUnusedParameters` — 禁止未使用变量
- `noUncheckedIndexedAccess` — 数组索引访问需处理 `undefined`
- **禁止** `as any`、`@ts-ignore`、`@ts-expect-error`
- **禁止** 空的 `catch(e) {}` — 必须至少有日志或注释说明意图

### 接口与类型

- **`interface`** 用于定义数据结构（节点 Data、Config、State）：
  ```typescript
  interface ImageNodeData { ... }
  interface ApiConfig { ... }
  ```
- **`type`** 用于联合类型、类型别名、工具类型：
  ```typescript
  type TabId = 'canvas' | 'transit' | 'settings';
  type ImageNode = Node<ImageNodeData, 'imageNode'>;
  type FlowStore = FlowState & FlowActions;
  ```
- 所有节点数据接口必须包含 `[key: string]: unknown` 索引签名（ReactFlow 兼容要求）

### 命名约定

| 类别 | 风格 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `FlowCanvas.tsx`, `ImageNode.tsx` |
| Store 文件 | camelCase with use 前缀 | `useFlowStore.ts` |
| API 文件 | camelCase + Api 后缀 | `imageApi.ts`, `textApi.ts` |
| 工具文件 | camelCase | `nodeFactory.ts`, `executionEngine.ts` |
| 测试文件 | 源文件名.test.ts | `useFlowStore.test.ts` |
| Store hooks | use 前缀 | `useFlowStore`, `useSettingsStore` |
| ReactFlow 节点类型字符串 | camelCase | `'imageNode'`, `'gridSplitNode'` |
| 常量 | UPPER_SNAKE_CASE 或 PascalCase | `DEFAULT_API_CONFIG`, `LAYER_DELAY` |

### 组件模式

- 自定义节点组件用 `memo()` 包裹优化渲染：
  ```typescript
  export default memo(ImageNode);
  ```
- 节点组件签名统一使用 `NodeProps<T>`：
  ```typescript
  function ImageNode({ data, selected }: NodeProps<ImageNodeType>) { ... }
  ```
- BaseNode 组件提供统一的标题栏 + 加载动画 + 错误展示包裹层
- 节点数据通过 `data` prop 传入，状态用组件内部 `useState` 管理
- 错误信息通过 `errorMessage` 字段传递，BaseNode 统一渲染

### 状态管理

- 全局状态使用 **Zustand** store（`create<Store>()(...)`）：
  ```typescript
  export const useFlowStore = create<FlowStore>()((set) => ({ ... }));
  ```
- 需要持久化的 store 使用 `persist` 中间件 + `createJSONStorage`：
  ```typescript
  persist(
    (set) => ({ ... }),
    { name: 'xshow-settings', storage: createJSONStorage(() => createChromeStorage() ?? localStorage) }
  )
  ```
- Chrome 扩展环境优先使用 `chrome.storage.local`，回退到 `localStorage`
- 组件中选择 store 切片以避免不必要重渲染：
  ```typescript
  const channels = useSettingsStore((s) => s.apiConfig.channels);
  ```

### 样式

- **Tailwind CSS v4** — 使用 `@theme` 块定义设计令牌（在 `src/tailwind.css`）
- 深色主题，核心色值：
  - 背景 `bg-background` (#121212)、表面 `bg-surface` (#1c1c1c)、悬浮 `bg-surface-hover` (#252525)
  - 边框 `border-border` (#333)、文字 `text-text` (#e5e5e5)、次要文字 `text-text-secondary` (#9ca3af)
  - 主色 `bg-primary` (#3b82f6)，错误 `text-error` (#ef4444)
- 优先使用语义化 Tailwind 类（`bg-surface`, `text-text`），避免硬编码 hex
- ReactFlow 的类覆盖使用 `!` 前缀（`!bg-[#555]`, `!w-3`）

### 错误处理

- API 调用统一 try/catch 包裹，finally 中恢复加载态：
  ```typescript
  try {
    const result = await someApiCall(params);
    // 更新状态
  } catch (err) {
    const msg = err instanceof Error ? err.message : '默认错误信息';
    setErrorMessage(msg);
  } finally {
    setLoading(false);
  }
  ```
- 请求超时使用 `AbortController` + `setTimeout`
- 错误信息使用中文（面向中文用户）
- **禁止**静默吞掉异常

### 文件头注释

每个源文件头部标注参考来源：
```typescript
// Ref: §五 — Gemini 图片生成
// Ref: node-banana /api/generate
// Ref: @xyflow/react 自定义节点文档 + §6.3
```

## 测试规范

- 测试框架：**Vitest**（`describe` / `it` / `expect` / `vi` / `beforeEach`）
- 测试文件放在源文件同目录，命名 `*.test.ts`
- Store 测试在 `beforeEach` 中重置状态：
  ```typescript
  beforeEach(() => {
    useFlowStore.setState({ nodes: [], edges: [], highlightedNodeId: null });
  });
  ```
- API 测试使用 `vi.fn()` mock `globalThis.fetch`
- 禁止删除测试来"通过"构建

## Chrome 扩展注意事项

- `manifest.json` 使用 Manifest V3
- 权限：`contextMenus`, `storage`, `unlimitedStorage`, `activeTab`, `tabs`, `sidePanel`, `downloads`, `scripting`
- `host_permissions: ["<all_urls>"]`
- 入口文件通过 `side_panel.default_path` 指向 `index.html`
- 使用 `chrome.storage.local` 进行持久化存储（需封装为 Storage 兼容接口）
- 构建输出到 `dist/`，需手动加载到 Chrome 扩展页面调试