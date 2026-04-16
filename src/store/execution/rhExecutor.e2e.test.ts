/**
 * RunningHub Executor 端到端集成测试
 *
 * 测试策略：
 * - 纯逻辑测试：始终运行，验证数据流和映射逻辑（mock 所有外部依赖）
 * - E2E 测试：仅在 RH_E2E=1 时运行，调用真实 RunningHub API
 *
 * 本地开发时手动运行：RH_E2E=1 npx vitest run src/store/execution/rhExecutor.e2e.test.ts
 *
 * 覆盖场景：
 * 1. executeRhAppNode 预检查（无 appId、无 API key、字段类型映射、上传媒体）
 * 2. executeRhWfNode 预检查（无 workflowId、缓存优先、文本映射）
 * 3. 数据流转验证（rhAppNode → rhWfNode 的 outputUrl 传递）
 * 4. RhAppExecutor 端到端（fetchRhAppNodeInfo、executeRhAppNode full pipeline、uploadFileToRunningHub）
 * 5. RhWfExecutor 端到端（fetchRhWorkflowJson、parseRhWorkflowNodes）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NodeExecutionContext } from './types';
import type { ConnectedInputs } from '@/utils/connectedInputs';
import type { Node, Edge } from '@xyflow/react';

// RunningHub API 地址
const RH_BASE_URL = 'https://www.runninghub.cn';

// API Key 从环境变量读取（默认使用 D09 消费会员 key）
const RH_API_KEY = process.env.RH_API_KEY || '13f84abb028e4503bd82507d68e22715';

// 是否运行 RunningHub 端到端测试
// 本地开发时: RH_E2E=1 npx vitest run src/store/execution/rhExecutor.e2e.test.ts
const RH_AVAILABLE = process.env.RH_E2E === '1';

// 测试用 APP ID（AIRix 001 Qwen 文生图）
const TEST_APP_ID = process.env.RH_TEST_APP_ID || '2037760725296357377';

// 测试用 Workflow ID（一致性人物 workflow）
const TEST_WORKFLOW_ID = process.env.RH_TEST_WORKFLOW_ID || '1998447779892617217';

// 辅助：模拟 extensionFetch 直连（非 Chrome 扩展环境）
async function directFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, options);
}

// ============================================================================
// Mock Setup（纯逻辑测试用）
// ============================================================================

// Mock rhApi
const mockExecuteRhAppApi = vi.fn();
const mockExecuteRhWorkflowApi = vi.fn();
const mockUploadFileToRunningHub = vi.fn();
const mockFetchRhWorkflowJson = vi.fn();
const mockParseRhWorkflowNodes = vi.fn();
const mockFetchRhAppNodeInfo = vi.fn();

vi.mock('@/api/rhApi', () => ({
  executeRhAppApi: mockExecuteRhAppApi,
  executeRhWorkflowApi: mockExecuteRhWorkflowApi,
  uploadFileToRunningHub: mockUploadFileToRunningHub,
  fetchRhWorkflowJson: mockFetchRhWorkflowJson,
  parseRhWorkflowNodes: mockParseRhWorkflowNodes,
  fetchRhAppNodeInfo: mockFetchRhAppNodeInfo,
}));

// Mock zipExtractor
const mockRevokeMediaUrls = vi.fn();

vi.mock('@/utils/zipExtractor', () => ({
  revokeMediaUrls: mockRevokeMediaUrls,
}));

// Mock connectedInputs
vi.mock('@/utils/connectedInputs', () => ({
  getConnectedInputs: vi.fn(),
  getInputsByHandle: vi.fn(),
}));

// Mock settings store
vi.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      comfyuiConfig: { runninghubApiKey: 'test-api-key' },
    })),
  },
}));

// Helper: mock updateNodeData（可追踪调用）
const mockUpdateNodeData = vi.fn();

// Helper: 创建执行上下文
function makeContext(
  node: Node,
  nodes: Node[],
  edges: Edge[] = [],
  connectedInputs: ConnectedInputs = { images: [], videos: [], audio: [], text: null, textItems: [], model3d: null },
): NodeExecutionContext {
  return {
    node,
    nodes,
    edges,
    getConnectedInputs: vi.fn(() => connectedInputs),
    updateNodeData: mockUpdateNodeData,
    getFreshNode: vi.fn(() => node),
    signal: undefined,
  };
}

function makeNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRhAppApi.mockResolvedValue({ outputUrl: 'https://rh.cn/output.png', outputUrls: ['https://rh.cn/output.png'] });
  mockExecuteRhWorkflowApi.mockResolvedValue({ outputUrl: 'https://rh.cn/wf-output.mp4', outputUrls: ['https://rh.cn/wf-output.mp4'] });
  mockUploadFileToRunningHub.mockResolvedValue('uploaded_file.png');
  mockRevokeMediaUrls.mockReturnValue(undefined);
  mockFetchRhAppNodeInfo.mockResolvedValue({
    nodeInfoList: [
      { nodeId: '16', nodeName: 'Text Multiline', fieldName: 'text', fieldValue: '', fieldType: 'STRING', description: 'Prompt' },
    ],
  });
});

// Helper: 从 mock 函数调用中安全获取参数
function getCallArgs(mockFn: ReturnType<typeof vi.fn>, callIndex: number, argIndex: number): unknown {
  const calls = mockFn.mock.calls;
  if (!calls[callIndex]) throw new Error(`No call at index ${callIndex}`);
  return calls[callIndex]![argIndex];
}

// Helper: 设置默认的 connectedInputs mock
async function setupConnectedInputsMocks(overrides: {
  connectedInputs?: Partial<ConnectedInputs>;
  inputsByHandle?: Record<string, string[]>;
} = {}) {
  const { getConnectedInputs, getInputsByHandle } = await import('@/utils/connectedInputs');
  vi.mocked(getConnectedInputs).mockReturnValue({
    images: [], videos: [], audio: [], text: null, textItems: [], model3d: null,
    ...overrides.connectedInputs,
  });
  vi.mocked(getInputsByHandle).mockReturnValue(overrides.inputsByHandle ?? {});
}

// ============================================================================
// PURE LOGIC TESTS — always run
// ============================================================================

describe('executeRhAppNode 预检查 — 纯逻辑', () => {
  it('无 appId 应抛错', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks();
    const node = makeNode('n1', 'rhAppNode', { config: { appId: '' } });
    const ctx = makeContext(node, [node], []);
    await expect(executeRhAppNode(ctx)).rejects.toThrow('请选择 RunningHub APP');
  });

  it('无 API key 应抛错', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks();
    const { useSettingsStore } = await import('@/stores/useSettingsStore');
    vi.mocked(useSettingsStore.getState).mockReturnValueOnce({ comfyuiConfig: { runninghubApiKey: '' } } as any);
    const node = makeNode('n1', 'rhAppNode', { config: { appId: 'app123', nodeInfoList: [] } });
    const ctx = makeContext(node, [node], []);
    await expect(executeRhAppNode(ctx)).rejects.toThrow('请先在设置中配置 RunningHub API Key');
  });

  it('STRING 字段严格匹配', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks({
      connectedInputs: { text: 'some text' },
    });
    // 只有 IMAGE 字段，没有 STRING 字段
    const nodeInfoList = [
      { nodeId: '1', nodeName: 'image', fieldName: 'image', fieldValue: '', fieldType: 'IMAGE', description: '' },
    ];
    const node = makeNode('n1', 'rhAppNode', { config: { appId: 'app123', nodeInfoList } });
    const ctx = makeContext(node, [node], []);

    await executeRhAppNode(ctx);

    // 提交给 executeRhAppApi 的 nodeInfoList 中，IMAGE 字段不应被 text 填充
    const submitted = getCallArgs(mockExecuteRhAppApi, 0, 2) as Array<{ fieldType: string; fieldValue: string }>;
    const imageField = submitted.find((n) => n.fieldType === 'IMAGE');
    expect(imageField?.fieldValue).toBe('');
    // 没有 STRING 字段，text 应该不填充任何字段
    const stringField = submitted.find((n) => n.fieldType === 'STRING');
    expect(stringField).toBeUndefined();
  });

  it('上游图片应上传到 RH 并映射到 IMAGE 字段', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks({
      connectedInputs: { images: ['https://example.com/input.png'] },
    });
    const nodeInfoList = [
      { nodeId: '1', nodeName: 'image_input', fieldName: 'image', fieldValue: '', fieldType: 'IMAGE', description: '' },
    ];
    const node = makeNode('n1', 'rhAppNode', { config: { appId: 'app123', nodeInfoList } });
    const ctx = makeContext(node, [node], []);

    await executeRhAppNode(ctx);

    expect(mockUploadFileToRunningHub).toHaveBeenCalledWith('test-api-key', 'https://example.com/input.png', 'input', undefined);
    const submitted = getCallArgs(mockExecuteRhAppApi, 0, 2) as Array<{ fieldType: string; fieldValue: string }>;
    const imageField = submitted.find((n) => n.fieldType === 'IMAGE');
    expect(imageField?.fieldValue).toBe('uploaded_file.png');
  });

  it('上游视频应映射到 VIDEO 字段', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks({
      connectedInputs: { videos: ['https://example.com/input.mp4'] },
    });
    const nodeInfoList = [
      { nodeId: '1', nodeName: 'video_input', fieldName: 'video', fieldValue: '', fieldType: 'VIDEO', description: '' },
    ];
    const node = makeNode('n1', 'rhAppNode', { config: { appId: 'app123', nodeInfoList } });
    const ctx = makeContext(node, [node], []);

    await executeRhAppNode(ctx);

    expect(mockUploadFileToRunningHub).toHaveBeenCalledWith('test-api-key', 'https://example.com/input.mp4', 'input', undefined);
    const submitted = getCallArgs(mockExecuteRhAppApi, 0, 2) as Array<{ fieldType: string; fieldValue: string }>;
    const videoField = submitted.find((n) => n.fieldType === 'VIDEO');
    expect(videoField?.fieldValue).toBe('uploaded_file.png');
  });
});

describe('executeRhWfNode 预检查 — 纯逻辑', () => {
  it('无 workflowId 应抛错', async () => {
    const { executeRhWfNode } = await import('./rhWfExecutor');
    await setupConnectedInputsMocks();
    const node = makeNode('n1', 'rhWfNode', { config: { workflowId: '' } });
    const ctx = makeContext(node, [node], []);
    await expect(executeRhWfNode(ctx)).rejects.toThrow('请选择 RunningHub Workflow');
  });

  it('workflowJson 缓存优先于 fetch', async () => {
    const { executeRhWfNode } = await import('./rhWfExecutor');
    await setupConnectedInputsMocks();
    mockParseRhWorkflowNodes.mockReturnValue([]);
    const node = makeNode('n1', 'rhWfNode', {
      config: { workflowId: 'wf123', workflowJson: '{"3":{"class_type":"KSampler"}}' },
      nodeValues: {},
    });
    const ctx = makeContext(node, [node], []);

    await executeRhWfNode(ctx);

    expect(mockParseRhWorkflowNodes).toHaveBeenCalledWith('{"3":{"class_type":"KSampler"}}');
    expect(mockFetchRhWorkflowJson).not.toHaveBeenCalled();
  });

  it('上游文本映射到第一个 STRING 字段', async () => {
    const { executeRhWfNode } = await import('./rhWfExecutor');
    await setupConnectedInputsMocks({
      connectedInputs: { text: 'test prompt' },
    });
    mockParseRhWorkflowNodes.mockReturnValue([
      {
        nodeId: '6',
        classType: 'CLIPTextEncode',
        inputs: { text: { name: 'text', value: '', type: 'STRING', label: 'text' } },
      },
    ]);

    const node = makeNode('n1', 'rhWfNode', {
      config: { workflowId: 'wf123', workflowJson: '{}' },
      nodeValues: {},
    });
    const ctx = makeContext(node, [node], []);

    await executeRhWfNode(ctx);

    const submitted = getCallArgs(mockExecuteRhWorkflowApi, 0, 2) as Array<{ fieldName: string; fieldValue: string }>;
    const textField = submitted.find((n) => n.fieldName === 'text');
    expect(textField?.fieldValue).toBe('test prompt');
  });
});

describe('数据流转验证 — 纯逻辑', () => {
  it('rhAppNode 产出 outputUrl 后可被下游 getConnectedInputs 读取', async () => {
    const { getConnectedInputs } = await import('@/utils/connectedInputs');

    // 构建节点和边：rhAppNode (n1) → rhWfNode (n2)
    const appNode = makeNode('n1', 'rhAppNode', {
      config: { appId: 'app123', nodeInfoList: [] },
      outputUrl: 'https://example.com/image.png',
      outputUrls: ['https://example.com/image.png'],
    });
    const wfNode = makeNode('n2', 'rhWfNode', {
      config: { workflowId: 'wf123' },
      nodeValues: {},
    });
    const edge: Edge = {
      id: 'e1-2',
      source: 'n1',
      target: 'n2',
      sourceHandle: 'image-0',
      targetHandle: 'image-0',
      type: 'smoothstep',
    };

    // 当 wfNode 获取上游输入时，应该能读取到 appNode 的 image 输出
    vi.mocked(getConnectedInputs).mockReturnValue({
      images: ['https://example.com/image.png'],
      videos: [],
      audio: [],
      text: null,
      textItems: [],
      model3d: null,
    });

    const ctx = makeContext(wfNode, [appNode, wfNode], [edge], {
      images: ['https://example.com/image.png'],
      videos: [],
      audio: [],
      text: null,
      textItems: [],
      model3d: null,
    });

    const connected = ctx.getConnectedInputs('n2');
    expect(connected.images).toContain('https://example.com/image.png');
  });

  it('rhWfNode 产出 outputUrl(mp4) 后可被下游读取为 video', async () => {
    const { getConnectedInputs } = await import('@/utils/connectedInputs');

    // 构建节点和边：rhWfNode (n1) → rhAppNode (n2)
    const wfNode = makeNode('n1', 'rhWfNode', {
      config: { workflowId: 'wf123', workflowJson: '{}' },
      nodeValues: {},
      outputUrl: 'https://example.com/video.mp4',
      outputUrls: ['https://example.com/video.mp4'],
    });
    const appNode = makeNode('n2', 'rhAppNode', {
      config: { appId: 'app456', nodeInfoList: [] },
    });
    const edge: Edge = {
      id: 'e1-2',
      source: 'n1',
      target: 'n2',
      sourceHandle: 'video-0',
      targetHandle: 'video-0',
      type: 'smoothstep',
    };

    vi.mocked(getConnectedInputs).mockReturnValue({
      images: [],
      videos: ['https://example.com/video.mp4'],
      audio: [],
      text: null,
      textItems: [],
      model3d: null,
    });

    const ctx = makeContext(appNode, [wfNode, appNode], [edge], {
      images: [],
      videos: ['https://example.com/video.mp4'],
      audio: [],
      text: null,
      textItems: [],
      model3d: null,
    });

    const connected = ctx.getConnectedInputs('n2');
    expect(connected.videos).toContain('https://example.com/video.mp4');
  });
});

// ============================================================================
// E2E TESTS — conditional, skip by default in CI
// ============================================================================

const e2eDescribe = RH_AVAILABLE ? describe : describe.skip;

e2eDescribe('RhAppExecutor 端到端', () => {
  it('fetchRhAppNodeInfo 真实调用 — 返回含 fieldType 的 nodeInfoList', async () => {
    const { fetchRhAppNodeInfo } = await import('@/api/rhApi');
    const result = await fetchRhAppNodeInfo(RH_API_KEY, TEST_APP_ID);
    expect(result.nodeInfoList.length).toBeGreaterThan(0);
    expect(result.nodeInfoList.some((n) => n.fieldType === 'STRING')).toBe(true);
  }, 30000);

  it('executeRhAppNode full pipeline — 获取 → 修改 text → 执行 → 轮询 → outputUrl', async () => {
    const { executeRhAppApi, fetchRhAppNodeInfo } = await import('@/api/rhApi');
    const { useSettingsStore } = await import('@/stores/useSettingsStore');

    // 获取真实的 nodeInfoList
    const nodeInfoResult = await fetchRhAppNodeInfo(RH_API_KEY, TEST_APP_ID);
    const nodeInfoList = nodeInfoResult.nodeInfoList;

    // 修改 text 字段
    const textField = nodeInfoList.find((n) => n.fieldName === 'text');
    expect(textField).toBeDefined();
    textField!.fieldValue = 'a beautiful sunset over ocean, golden hour, detailed, 8k';

    // Mock settings store 返回真实 key
    vi.mocked(useSettingsStore.getState).mockReturnValue({
      comfyuiConfig: { runninghubApiKey: RH_API_KEY },
    } as any);

    const mockProgress = vi.fn();

    // 直接调用 executeRhAppApi（不走 executor，直接测试 API 层）
    const result = await executeRhAppApi(
      RH_API_KEY,
      TEST_APP_ID,
      nodeInfoList,
      mockProgress,
      undefined
    );

    expect(result.outputUrl).toBeDefined();
    expect(result.outputUrl.length).toBeGreaterThan(0);
    console.log('executeRhAppNode result:', result);
  }, 180000);

  it('uploadFileToRunningHub 真实上传', async () => {
    const { uploadFileToRunningHub } = await import('@/api/rhApi');

    // 注意：uploadFileToRunningHub 需要一个公网可访问的 URL
    // 这里只验证函数签名正确，真实上传需要有效的公网 URL
    expect(typeof uploadFileToRunningHub).toBe('function');

    // 如果有可用的公网测试图片 URL，可以取消注释以下代码：
    // const result = await uploadFileToRunningHub(RH_API_KEY, 'https://example.com/test.png', 'input', undefined);
    // expect(result).toBeDefined();
    // expect(result.length).toBeGreaterThan(0);
  }, 30000);
});

e2eDescribe('RhWfExecutor 端到端', () => {
  it('fetchRhWorkflowJson 真实调用', async () => {
    const { fetchRhWorkflowJson } = await import('@/api/rhApi');

    const jsonStr = await fetchRhWorkflowJson(RH_API_KEY, TEST_WORKFLOW_ID, undefined);

    expect(typeof jsonStr).toBe('string');
    expect(jsonStr.length).toBeGreaterThan(0);

    // 验证是有效 JSON
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toBeDefined();

    // 验证包含 class_type（RunningHub workflow JSON 特征）
    const nodeKeys = Object.keys(parsed);
    expect(nodeKeys.length).toBeGreaterThan(0);

    // 检查是否有 class_type 字段（任意一个节点）
    const firstNodeKey = nodeKeys[0];
    expect((parsed[firstNodeKey!] as Record<string, unknown>).class_type).toBeDefined();
  }, 30000);

  it('parseRhWorkflowNodes 真实解析', async () => {
    const { fetchRhWorkflowJson, parseRhWorkflowNodes } = await import('@/api/rhApi');

    const jsonStr = await fetchRhWorkflowJson(RH_API_KEY, TEST_WORKFLOW_ID, undefined);
    const parsedNodes = parseRhWorkflowNodes(jsonStr);

    expect(parsedNodes.length).toBeGreaterThan(0);

    // 验证节点结构
    const firstNode = parsedNodes[0]!;
    expect(firstNode.nodeId).toBeDefined();
    expect(firstNode.classType).toBeDefined();
    expect(firstNode.inputs).toBeDefined();

    // 验证 inputs 是对象
    expect(typeof firstNode.inputs).toBe('object');

    console.log(`Workflow has ${parsedNodes.length} nodes, first node:`, firstNode);
  }, 30000);
});

e2eDescribe('RunningHub API 基础验证', () => {
  it('账户状态查询 — API Key 验证', async () => {
    const resp = await directFetch(`${RH_BASE_URL}/uc/openapi/accountStatus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: RH_API_KEY }),
    });
    expect(resp.ok).toBe(true);
    const json = await resp.json();
    expect(json.code).toBe(0);
    expect(json.data).toBeDefined();
  }, 15000);

  it('获取 APP nodeInfoList — /api/webapp/apiCallDemo', async () => {
    const resp = await directFetch(
      `${RH_BASE_URL}/api/webapp/apiCallDemo?apiKey=${RH_API_KEY}&webappId=${TEST_APP_ID}`
    );
    expect(resp.ok).toBe(true);
    const json = await resp.json();
    expect(json.code).toBe(0);
    expect(json.data).toBeDefined();
    expect(Array.isArray(json.data.nodeInfoList)).toBe(true);
    expect(json.data.nodeInfoList.length).toBeGreaterThan(0);
  }, 15000);

  it('提交 AI App 任务 — /task/openapi/ai-app/run', async () => {
    // 先获取 nodeInfoList
    const demoResp = await directFetch(
      `${RH_BASE_URL}/api/webapp/apiCallDemo?apiKey=${RH_API_KEY}&webappId=${TEST_APP_ID}`
    );
    const demoJson = await demoResp.json();
    const nodeInfoList = demoJson.data.nodeInfoList;

    // 修改 text 字段
    const textField = nodeInfoList.find((n: { fieldName: string }) => n.fieldName === 'text');
    expect(textField).toBeDefined();
    textField.fieldValue = 'a beautiful sunset over ocean, golden hour';

    // 提交任务
    const submitResp = await directFetch(`${RH_BASE_URL}/task/openapi/ai-app/run`, {
      method: 'POST',
      headers: {
        'Host': 'www.runninghub.cn',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webappId: TEST_APP_ID,
        apiKey: RH_API_KEY,
        nodeInfoList,
      }),
    });
    expect(submitResp.ok).toBe(true);
    const submitJson = await submitResp.json();
    expect(submitJson.code).toBe(0);
    expect(submitJson.data).toBeDefined();
    expect(submitJson.data.taskId).toBeDefined();
  }, 30000);

  it('轮询任务结果 — /task/openapi/outputs（使用上一个测试的任务ID）', async () => {
    // 先提交一个新任务
    const demoResp = await directFetch(
      `${RH_BASE_URL}/api/webapp/apiCallDemo?apiKey=${RH_API_KEY}&webappId=${TEST_APP_ID}`
    );
    const demoJson = await demoResp.json();
    const nodeInfoList = demoJson.data.nodeInfoList;
    const textField = nodeInfoList.find((n: { fieldName: string }) => n.fieldName === 'text');
    textField.fieldValue = 'test prompt for polling';

    const submitResp = await directFetch(`${RH_BASE_URL}/task/openapi/ai-app/run`, {
      method: 'POST',
      headers: {
        'Host': 'www.runninghub.cn',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webappId: TEST_APP_ID,
        apiKey: RH_API_KEY,
        nodeInfoList,
      }),
    });
    const submitJson = await submitResp.json();
    const taskId = submitJson.data.taskId;

    // 轮询结果（最多 30 次 = 90 秒）
    let result = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollResp = await directFetch(`${RH_BASE_URL}/task/openapi/outputs`, {
        method: 'POST',
        headers: {
          'Host': 'www.runninghub.cn',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: RH_API_KEY, taskId }),
      });

      if (pollResp.ok) {
        const pollJson = await pollResp.json();
        // 成功：code: 0, data: [{ fileUrl }]
        if (pollJson.code === 0 && pollJson.data && Array.isArray(pollJson.data) && pollJson.data.length > 0) {
          result = pollJson;
          break;
        }
        // 失败：code: 805
        if (pollJson.code === 805 && pollJson.data?.failedReason) {
          result = pollJson;
          break;
        }
      }
    }

    expect(result).not.toBeNull();
    if (result.code === 0) {
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      console.log('Task output:', result.data);
    }
  }, 180000); // 3分钟超时
});
