# XShow 项目修正计划 V1.0

> 基于 `01-1-reverse-engineering-plan-v2.md` 检查结果
> 日期: 2026-04-11

---

## 一、修正概览

| 序号 | 问题 | 优先级 | 影响范围 |
|------|------|--------|----------|
| P1 | API 模块协议分派未实现 | 高 | imageApi.ts, textApi.ts, audioApi.ts, SettingsPanel.tsx |
| P2 | autoSplit 子节点自动生成未实现 | 中 | TextNode.tsx, executionEngine.ts, useFlowStore.ts |
| P3 | API 调用未传入 protocol 参数 | 高 | 各节点组件调用 API 时 |

---

## 二、修正详情

### P1: API 模块协议分派未实现

#### 问题描述

方案要求每个通道的 `protocol` 字段决定 API 调用格式，但实际代码：

- `imageApi.ts` - 硬编码 Gemini 格式
- `textApi.ts` - 仅支持 OpenAI 格式
- `audioApi.ts` - 仅支持 OpenAI 格式
- `SettingsPanel.tsx` - 测试连接硬编码 chat/completions

#### 修正方案

**2.1 imageApi.ts 修正**

```typescript
// 修改前
export async function generateImage({ channelUrl, channelKey, model, ... }: GenerateImageParams): Promise<string> {
  // 硬编码 Gemini
}

// 修改后 - 添加 protocol 参数 + 协议分派
export async function generateImage({
  channelUrl,
  channelKey,
  protocol,  // 新增
  model,
  ...
}: GenerateImageParams): Promise<string> {
  if (protocol === 'gemini') {
    // Gemini 格式
  } else if (protocol === 'openai') {
    // OpenAI 格式: /v1/images/generations
  }
}
```

**涉及修改对象**:
- `src/api/imageApi.ts` - 添加 protocol 参数 + OpenAI 分支
- `src/api/imageApi.test.ts` - 添加 OpenAI 协议测试用例

**2.2 textApi.ts 修正**

```typescript
// 修改前
export async function generateText({ channelUrl, channelKey, model, messages, autoSplit }: GenerateTextParams)

// 修改后 - 添加 protocol 参数 + Gemini 分支
export async function generateText({
  channelUrl,
  channelKey,
  protocol,  // 新增
  model,
  messages,
  autoSplit,
}: GenerateTextParams)
```

**涉及修改对象**:
- `src/api/textApi.ts` - 添加 protocol 参数 + Gemini 分支
- `src/api/textApi.test.ts` - 添加 Gemini 协议测试用例

**2.3 audioApi.ts 修正**

```typescript
// 修改前
export async function transcribeAudio({ channelUrl, channelKey, model, audioFile })
export async function generateTTS({ channelUrl, channelKey, model, input, voice })

// 修改后 - 添加 protocol 参数
export async function transcribeAudio({ channelUrl, channelKey, protocol, model, audioFile })
export async function generateTTS({ channelUrl, channelKey, protocol, model, input, voice })
```

**涉及修改对象**:
- `src/api/audioApi.ts` - 添加 protocol 参数 + Gemini 分支
- `src/api/audioApi.test.ts` - 添加 Gemini 协议测试用例

**2.4 SettingsPanel.tsx 测试连接修正**

```typescript
// 修改前 - 硬编码
const url = `${channel.url}/v1/chat/completions`;

// 修改后 - 按 protocol 分派
const url = protocol === 'gemini'
  ? `${channel.url}/v1beta/models/${firstModel}:generateContent?key=${channel.key}`
  : `${channel.url}/v1/chat/completions`;
```

**涉及修改对象**:
- `src/components/settings/SettingsPanel.tsx` - TestConnectionButton 组件
- 可能需要调整测试用例（如果有相关测试）

---

### P2: autoSplit 子节点自动生成未实现

#### 问题描述

方案要求：autoSplit 开启时，生成的文本应自动拆分为多个子节点并连线。

当前状态：
- `textApi.ts` 返回了 `splitItems`
- `TextNode.tsx` 未使用 `splitItems` 创建子节点
- `executionEngine.ts` 未处理 autoSplit 场景

#### 修正方案

**2.5 useFlowStore.ts 批量添加节点方法**

```typescript
// 在 useFlowStore.ts 添加
interface FlowActions {
  // ... 现有方法
  addNodes: (nodes: Node[]) => void;  // 新增
}

// 实现
addNodes: (nodes) => set((state) => ({ nodes: [...state.nodes, ...nodes] })),
```

**涉及修改对象**:
- `src/stores/useFlowStore.ts` - 添加 addNodes 方法
- `src/stores/useFlowStore.test.ts` - 添加 addNodes 测试用例

**2.6 TextNode.tsx autoSplit 处理**

```typescript
// 在 handleGenerate 成功后添加
if (autoSplit && result.splitItems) {
  const parentNode = nodes.find(n => n.id === id);  // 需要获取当前节点位置
  const childNodes = result.splitItems.map((item, index) => createNode('textNode', {
    x: parentNode.position.x + 250,
    y: parentNode.position.y + index * 100,
  }, {
    label: item.title,
    text: item.content,
    prompt: '',
    expanded: true,
    autoSplit: false,
    textModel: data.textModel,
    loading: false,
    selectedContextResources: [],
    presetPrompts: [],
  }));
  // 添加子节点
  addNodes(childNodes);
  // 添加连线（从父节点到每个子节点）
  childNodes.forEach(child => {
    addEdge({
      id: `${id}-${child.id}`,
      source: id,
      target: child.id,
    });
  });
}
```

**涉及修改对象**:
- `src/components/canvas/TextNode.tsx` - 添加 autoSplit 子节点生成逻辑

**2.7 nodeFactory.ts 添加相对位置创建节点方法**

```typescript
// 修改 createNode 签名，支持相对位置
export function createNode(
  type: string,
  position: { x: number; y: number },  // 改为可选，支持从父节点计算
  partialData?: Record<string, unknown>,
  parentPosition?: { x: number; y: number },  // 新增：父节点位置
  index?: number,  // 新增：子节点索引，用于计算偏移
): Node {
  // 如果提供了 parentPosition 和 index，计算新位置
  const finalPosition = parentPosition && index !== undefined
    ? { x: parentPosition.x + 250, y: parentPosition.y + index * 100 }
    : position;
  // ...
}
```

**涉及修改对象**:
- `src/utils/nodeFactory.ts` - 调整 createNode 支持相对位置

---

### P3: API 调用未传入 protocol 参数

#### 问题描述

各节点组件调用 API 时未传入 protocol 参数，导致协议分派无法生效。

#### 修正方案

**2.8 ImageNode.tsx 协议参数传入**

```typescript
// 修改前
const dataUrl = await generateImage({
  channelUrl: channel.url,
  channelKey: channel.key,
  model: currentModel,
  // ...
});

// 修改后
const dataUrl = await generateImage({
  channelUrl: channel.url,
  channelKey: channel.key,
  protocol: channel.protocol,  // 新增
  model: currentModel,
  // ...
});
```

**涉及修改对象**:
- `src/components/canvas/ImageNode.tsx` - 添加 protocol 参数

**2.9 TextNode.tsx 协议参数传入**

```typescript
// 修改 handleGenerate 调用
const result = await generateText({
  channelUrl: channel.url,
  channelKey: channel.key,
  protocol: channel.protocol,  // 新增
  model: currentModel,
  // ...
});
```

**涉及修改对象**:
- `src/components/canvas/TextNode.tsx` - 添加 protocol 参数

**2.10 AudioNode.tsx 协议参数传入**

需要检查 audioApi 调用处，添加 protocol 参数。

**涉及修改对象**:
- `src/components/canvas/AudioNode.tsx` - 添加 protocol 参数

---

## 三、检验标准

### 3.1 单元测试

所有修改后必须通过现有测试：

```bash
npm test
# 期望: 78 tests passed
```

新增测试用例：

| 文件 | 新增测试 |
|------|----------|
| imageApi.test.ts | OpenAI 协议图片生成 |
| textApi.test.ts | Gemini 协议文本生成 |
| audioApi.test.ts | Gemini 协议音频处理 |
| useFlowStore.test.ts | addNodes 方法 |

### 3.2 类型检查

```bash
npm run typecheck
# 期望: 无错误
```

### 3.3 构建测试

```bash
npm run build
# 期望: 退出码 0
```

---

## 四、影响分析

### 4.1 依赖关系图

```
┌─────────────────────────────────────────────────────────────┐
│                     协议分派修正 (P1)                        │
├─────────────────────────────────────────────────────────────┤
│  imageApi.ts ──────┬──→ ImageNode.tsx ──→ FlowCanvas.tsx   │
│  textApi.ts ───────┼──→ TextNode.tsx ──→ FlowCanvas.tsx   │
│  audioApi.ts ──────┴──→ AudioNode.tsx ──→ FlowCanvas.tsx  │
│        │                                                       │
│        ▼                                                       │
│  SettingsPanel.tsx (测试连接)                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 autoSplit 子节点生成 (P2)                   │
├─────────────────────────────────────────────────────────────┤
│  TextNode.tsx ──→ useFlowStore.addNodes ──→ executionEngine│
│        │                                                     │
│        ▼                                                     │
│  nodeFactory.ts (createNode 调整)                           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 测试影响

| 修改 | 现有测试受影响 | 需新增测试 |
|------|---------------|-----------|
| imageApi.ts | ✅ 需适配 protocol 参数 | ✅ OpenAI 协议 |
| textApi.ts | ✅ 需适配 protocol 参数 | ✅ Gemini 协议 |
| audioApi.ts | ✅ 需适配 protocol 参数 | ✅ Gemini 协议 |
| useFlowStore.ts | ❌ 不影响 | ✅ addNodes |
| TextNode.tsx | ❌ 不影响 | - |
| SettingsPanel.tsx | ❌ 不影响 | - |

---

## 五、执行顺序

```
Phase 1: 协议分派核心 (P1 + P3)
  1.1 修改 imageApi.ts + 新增测试
  1.2 修改 textApi.ts + 新增测试
  1.3 修改 audioApi.ts + 新增测试
  1.4 修改 SettingsPanel.tsx 测试连接
  1.5 验证: npm test, npm run typecheck

Phase 2: 节点组件协议参数 (P3)
  2.1 ImageNode.tsx 添加 protocol
  2.2 TextNode.tsx 添加 protocol
  2.3 AudioNode.tsx 添加 protocol
  2.4 验证: npm run build

Phase 3: autoSplit 子节点 (P2)
  3.1 useFlowStore.ts 添加 addNodes
  3.2 nodeFactory.ts 调整
  3.3 TextNode.tsx 实现 autoSplit 逻辑
  3.4 验证: npm test

Phase 4: 最终验证
  4.1 npm test
  4.2 npm run typecheck
  4.3 npm run build
```

---

## 六、风险评估

| 风险 | 严重度 | 应对 |
|------|--------|------|
| 协议分派引入 URL 构建错误 | 中 | 新增测试覆盖边界情况 |
| autoSplit 位置计算偏移 | 低 | 手动测试验证 |
| 现有测试因参数变更失败 | 中 | 逐一适配，确保向后兼容 |

---

## 七、待补充项

- [ ] executionEngine.ts 是否需要处理 autoSplit 子节点的执行顺序（当前设计在 TextNode 组件内完成）
- [ ] Group 节点自动调整功能（方案 §6.13）未实现，是否纳入本次修正
- [ ] UniversalNode 的 protocol 处理（如果需要支持 custom 协议）

---

**修订历史**:
- V1.0 (2026-04-11): 初始版本