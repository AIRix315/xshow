# Contributing to XShow

感谢你对 XShow 的贡献兴趣！本文档涵盖开发环境搭建、项目架构、技术规范和提交规范。

## 开发环境

### 环境要求

- Node.js 20+
- npm 10+
- Chrome 116+（支持 SidePanel API）

### 安装依赖

```bash
git clone https://github.com/<your-username>/XShow.git
cd XShow
npm install
```

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动开发服务器 (http://localhost:5173) |
| `npm run build` | 类型检查 + 生产构建 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run test` | 运行单元测试 |
| `npm run test:watch` | 单元测试监听模式 |
| `npm run test:coverage` | 单元测试 + 覆盖率报告 |
| `npm run test:e2e` | 运行 E2E 测试 (Playwright) |
| `npm run lint` | ESLint 检查 |
| `npm run lint:fix` | ESLint 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run format:check` | Prettier 格式检查 |

### 加载为 Chrome 扩展

1. `npm run build`
2. Chrome → `chrome://extensions/` → 开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选择 `dist/` 目录

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| UI 框架 | React + TypeScript | 19 / ~5.7 |
| 画布引擎 | @xyflow/react | 12 |
| 状态管理 | Zustand | 5 |
| 样式 | Tailwind CSS | 4 |
| 构建 | Vite | 6 |
| 单元测试 | Vitest + React Testing Library | 3 |
| E2E 测试 | Playwright | 1.59+ |
| Lint | ESLint 9 (flat config) | 9 |
| 格式化 | Prettier | 3 |
| 扩展规范 | Chrome Extension Manifest V3 (SidePanel) | — |

## 项目结构

```
src/
├── api/                # API 抽象层
│   ├── audioApi.ts     # TTS 音频生成
│   ├── comfyApi.ts     # ComfyUI 协议
│   ├── imageApi.ts     # 图片生成 (多渠道)
│   ├── modelListApi.ts # 模型列表获取
│   ├── rhApi.ts        # RunningHub API
│   ├── textApi.ts      # LLM 文本生成
│   └── videoApi.ts     # 视频生成
├── components/
│   ├── canvas/         # 30+ 画布节点组件
│   ├── edges/          # 边组件
│   ├── settings/       # 设置面板
│   └── transit/        # 资源中转面板
├── execution/          # 节点执行引擎
│   ├── index.ts        # 执行器注册表 (getNodeExecutor)
│   ├── types.ts         # NodeExecutionContext / NodeExecutor 类型
│   ├── simpleNodeExecutors.ts  # 简单处理节点执行器
│   ├── generateNodeExecutors.ts # 生成节点执行器
│   ├── omniExecutor.ts # 万能节点执行器
│   ├── rhAppExecutor.ts # RH APP 执行器
│   ├── rhWfExecutor.ts  # RH Workflow 执行器
│   └── rhZipExecutor.ts # RH ZIP 解压执行器
├── hooks/              # React Hooks
│   ├── useAdaptiveHeight.ts
│   └── useTransitResources.ts
├── stores/             # Zustand 状态管理
│   ├── useFlowStore.ts  # 画布状态 (节点/边/执行)
│   └── useSettingsStore.ts # 全局设置 (API keys/渠道)
├── utils/              # 工具函数
│   ├── executionEngine.ts  # BFS 分层执行引擎
│   ├── connectedInputs.ts  # 上游输入收集
│   ├── projectManager.ts   # .xshow 项目导入/导出
│   ├── patchManager.ts     # 增量保存 (fast-json-patch)
│   ├── fileSystemAccess.ts # File System Access API
│   ├── chromeHelpers.ts    # Chrome Extension API 封装
│   ├── chromeStorage.ts    # chrome.storage 封装
│   ├── imageProcessing.ts  # 图片裁剪/处理
│   ├── mediaExternalizer.ts # 媒体资源外置
│   ├── nodeFactory.ts     # 节点工厂
│   ├── canvasState.ts      # 画布状态持久化
│   └── zipExtractor.ts     # ZIP 解压
├── config.ts           # 外部 URL 常量集中管理
├── types.ts            # 核心类型定义 (30+ 节点类型)
├── App.tsx             # 根组件
├── main.tsx            # 入口
└── tailwind.css         # Tailwind 主题 + 全局样式
```

## 架构概览

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  UI Layer    │────▶│  Store Layer │────▶│Execution Layer│
│  (React)     │     │  (Zustand)   │     │  (BFS Engine) │
│  30+ Nodes   │     │  FlowStore   │     │  Executors     │
│  Edges/Side  │     │  Settings    │     │  ↕ API Layer  │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                           ┌──────┴──────┐
                                           │  API Layer   │
                                           │  rh/image/  │
                                           │  video/text  │
                                           └─────────────┘
```

**数据流**：用户点击节点运行按钮 → `useFlowStore.executeWorkflow()` → `executionEngine.ts` (BFS 分层) → 逐层调用各 `NodeExecutor` → `api/*` 发起请求 → 结果回写 Store → React 重渲染。

## 代码规范

### 命名

- 文件：`camelCase.ts` / `camelCase.tsx`（组件 PascalCase：`ImageNode.tsx`）
- 导出：`export function` / `export const`，默认仅用于页面组件
- Store：`use{Name}Store`（Zustand 约定）
- 类型：`PascalCase` + `Type`/`Config`/`Data` 后缀

### 外部 URL

所有外部 URL（API 地址等）集中在 `src/config.ts`，禁止在业务代码中硬编码。

### 版本号

`package.json` → `__APP_VERSION__` (Vite define) → `manifest.json` (构建插件自动同步)。只改 `package.json` 的 `version` 字段即可。

### Console 语句

- 开发时可以使用 `console.warn` / `console.error`
- 生产构建自动剥离 `console.log` / `console.debug` / `debugger`（esbuild.drop）
- ESLint 规则 `no-console` 会警告 `console.log` 使用

### 测试

- 单元测试：`*.test.ts` / `*.test.tsx`，与源文件同目录
- E2E 测试：`*.e2e.test.ts`（需要真实 API Key，常规 CI 跳过）
- Playwright 测试：`e2e/*.spec.ts`
- 覆盖率：`npm run test:coverage`，报告输出到 `coverage/`

### 提交规范

```
feat: 新功能
fix: 修复 bug
refactor: 重构（无功能变更）
test: 测试补充
docs: 文档
chore: 构建/工具配置
```

## CI/CD

- **CI** (`main` / PR)：typecheck → lint → test → build → Chrome Extension 完整性验证
- **Release** (tag `v*`)：build → 验证 manifest/图标/入口 → zip → GitHub Release

详见 `.github/workflows/ci.yml` 和 `.github/workflows/release.yml`。