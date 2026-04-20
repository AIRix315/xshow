// rhAppExecutor.ts + rhWfExecutor.ts — RH 节点执行器测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NodeExecutionContext } from './types';
import type { ConnectedInputs } from '@/utils/connectedInputs';
import type { Node, Edge } from '@xyflow/react';

// Mock rhApi
const mockExecuteRhAppApi = vi.fn();
const mockExecuteRhWorkflowApi = vi.fn();
const mockUploadFileToRunningHub = vi.fn();
const mockFetchRhWorkflowJson = vi.fn();
const mockParseRhWorkflowNodes = vi.fn();

vi.mock('@/api/rhApi', () => ({
  executeRhAppApi: mockExecuteRhAppApi,
  executeRhWorkflowApi: mockExecuteRhWorkflowApi,
  uploadFileToRunningHub: mockUploadFileToRunningHub,
  fetchRhWorkflowJson: mockFetchRhWorkflowJson,
  parseRhWorkflowNodes: mockParseRhWorkflowNodes,
}));

// Mock zipExtractor
const mockRevokeMediaUrls = vi.fn();

vi.mock('@/utils/zipExtractor', () => ({
  revokeMediaUrls: mockRevokeMediaUrls,
}));

// Mock connectedInputs — inline factory (no external var refs)
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

// Helper: mock updateNodeData (可追踪调用)
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
  mockExecuteRhWorkflowApi.mockResolvedValue({ outputUrl: 'https://rh.cn/wf-output.png', outputUrls: ['https://rh.cn/wf-output.png'] });
  mockUploadFileToRunningHub.mockResolvedValue('uploaded_file.png');
  mockRevokeMediaUrls.mockReturnValue(undefined);
});

// Helper: 从 mock 函数调用中安全获取参数
function getCallArgs(mockFn: ReturnType<typeof vi.fn>, callIndex: number, argIndex: number): any {
  const calls = mockFn.mock.calls;
  if (!calls[callIndex]) throw new Error(`No call at index ${callIndex}`);
  return calls[callIndex]![argIndex];
}

// Helper: 设置默认的 connectedInputs mock（每个 test 需要单独调用来覆盖）
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
// RhAppNode Executor
// ============================================================================
describe('executeRhAppNode', () => {
  it('throws if no appId configured', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks();
    const node = makeNode('n1', 'rhAppNode', { config: { appId: '' } });
    const ctx = makeContext(node, [node], []);
    await expect(executeRhAppNode(ctx)).rejects.toThrow('请选择 RunningHub APP');
  });

  it('throws if no API key', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks();
    const { useSettingsStore } = await import('@/stores/useSettingsStore');
    vi.mocked(useSettingsStore.getState).mockReturnValueOnce({ comfyuiConfig: { runninghubApiKey: '' } } as any);
    const node = makeNode('n1', 'rhAppNode', { config: { appId: 'app123', nodeInfoList: [] } });
    const ctx = makeContext(node, [node], []);
    await expect(executeRhAppNode(ctx)).rejects.toThrow('请先在设置中配置 RunningHub API Key');
  });

  it('maps upstream text to STRING field', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks({
      connectedInputs: { text: 'hello prompt' },
    });
    const nodeInfoList = [
      { nodeId: '1', nodeName: 'prompt', fieldName: 'text', fieldValue: '', fieldType: 'STRING', description: '' },
      { nodeId: '2', nodeName: 'seed', fieldName: 'seed', fieldValue: '42', fieldType: 'STRING', description: '' },
    ];
    const node = makeNode('n1', 'rhAppNode', { config: { appId: 'app123', nodeInfoList } });
    const ctx = makeContext(node, [node], []);

    await executeRhAppNode(ctx);

    // executeRhAppApi(apiKey, appId, nodeInfoList, onProgress, signal) → arg index 2 = nodeInfoList
    const submitted = getCallArgs(mockExecuteRhAppApi, 0, 2) as any[];
    const stringField = submitted.find((n: any) => n.fieldType === 'STRING');
    expect(stringField.fieldValue).toBe('hello prompt');
  });

  it('does NOT map text to IMAGE field (bug fix #7)', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks({
      connectedInputs: { text: 'some text' },
    });
    const nodeInfoList = [
      { nodeId: '1', nodeName: 'image', fieldName: 'image', fieldValue: '', fieldType: 'IMAGE', description: '' },
    ];
    const node = makeNode('n1', 'rhAppNode', { config: { appId: 'app123', nodeInfoList } });
    const ctx = makeContext(node, [node], []);

    await executeRhAppNode(ctx);

    const submitted = getCallArgs(mockExecuteRhAppApi, 0, 2) as any[];
    const imageField = submitted.find((n: any) => n.fieldType === 'IMAGE');
    expect(imageField.fieldValue).toBe('');
  });

  it('uploads upstream image to RH and maps to IMAGE field', async () => {
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
    const submitted = getCallArgs(mockExecuteRhAppApi, 0, 2) as any[];
    const imageField = submitted.find((n: any) => n.fieldType === 'IMAGE');
    expect(imageField.fieldValue).toBe('uploaded_file.png');
  });

  it('uploads upstream video to RH and maps to VIDEO field', async () => {
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
    const submitted = getCallArgs(mockExecuteRhAppApi, 0, 2) as any[];
    const videoField = submitted.find((n: any) => n.fieldType === 'VIDEO');
    expect(videoField.fieldValue).toBe('uploaded_file.png');
  });

  it('uploads upstream audio to RH and maps to AUDIO field', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks({
      connectedInputs: { audio: ['https://example.com/input.mp3'] },
    });
    const nodeInfoList = [
      { nodeId: '1', nodeName: 'audio_input', fieldName: 'audio', fieldValue: '', fieldType: 'AUDIO', description: '' },
    ];
    const node = makeNode('n1', 'rhAppNode', { config: { appId: 'app123', nodeInfoList } });
    const ctx = makeContext(node, [node], []);

    await executeRhAppNode(ctx);

    expect(mockUploadFileToRunningHub).toHaveBeenCalledWith('test-api-key', 'https://example.com/input.mp3', 'input', undefined);
  });

  it('maps image-* handle inputs to corresponding IMAGE fields', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks({
      inputsByHandle: {
        'image-0': ['https://example.com/img0.png'],
        'image-1': ['https://example.com/img1.png'],
      },
    });
    mockUploadFileToRunningHub.mockImplementation(async (_key: string, url: string) => {
      if (url.includes('img0')) return 'file_0.png';
      if (url.includes('img1')) return 'file_1.png';
      return 'file_x.png';
    });

    const nodeInfoList = [
      { nodeId: '1', nodeName: 'img0', fieldName: 'image', fieldValue: '', fieldType: 'IMAGE', description: '' },
      { nodeId: '2', nodeName: 'img1', fieldName: 'image', fieldValue: '', fieldType: 'IMAGE', description: '' },
    ];
    const node = makeNode('n1', 'rhAppNode', { config: { appId: 'app123', nodeInfoList } });
    const ctx = makeContext(node, [node], []);

    await executeRhAppNode(ctx);

    const submitted = getCallArgs(mockExecuteRhAppApi, 0, 2) as any[];
    expect(submitted[0].fieldValue).toBe('file_0.png');
    expect(submitted[1].fieldValue).toBe('file_1.png');
  });

  it('handles ZIP response by outputting URL as textOutput for downstream rhZipNode', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks();
    mockExecuteRhAppApi.mockResolvedValue({
      outputUrl: 'https://rh.cn/output.zip',
      outputUrls: ['https://rh.cn/output.zip'],
    });

    const node = makeNode('n1', 'rhAppNode', { config: { appId: 'app123', nodeInfoList: [] } });
    const ctx = makeContext(node, [node], []);

    await executeRhAppNode(ctx);

    // ZIP 结果应直接输出 URL，不再解压
    const calls = mockUpdateNodeData.mock.calls;
    const lastCall = calls[calls.length - 1]!;
    expect(lastCall[1].outputUrl).toBe('https://rh.cn/output.zip');
    expect(lastCall[1].textOutput).toBe('https://rh.cn/output.zip');
    expect(lastCall[1].outputUrls).toBeUndefined();
    expect(lastCall[1].outputUrlTypes).toBeUndefined();
  });

  it('revokes previous blob URLs before new execution', async () => {
    const { executeRhAppNode } = await import('./rhAppExecutor');
    await setupConnectedInputsMocks();
    const node = makeNode('n1', 'rhAppNode', {
      config: { appId: 'app123', nodeInfoList: [] },
      outputUrls: ['blob:old1', 'blob:old2'],
      outputUrl: 'blob:old0',
    });
    const ctx = makeContext(node, [node], []);

    await executeRhAppNode(ctx);

    expect(mockRevokeMediaUrls).toHaveBeenCalledWith(['blob:old1', 'blob:old2']);
  });
});

// ============================================================================
// RhWfNode Executor
// ============================================================================
describe('executeRhWfNode', () => {
  it('throws if no workflowId configured', async () => {
    const { executeRhWfNode } = await import('./rhWfExecutor');
    await setupConnectedInputsMocks();
    const node = makeNode('n1', 'rhWfNode', { config: { workflowId: '' } });
    const ctx = makeContext(node, [node], []);
    await expect(executeRhWfNode(ctx)).rejects.toThrow('请选择 RunningHub Workflow');
  });

  it('parses workflow from config.workflowJson if available', async () => {
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

  it('fetches workflow JSON dynamically if no cache', async () => {
    const { executeRhWfNode } = await import('./rhWfExecutor');
    await setupConnectedInputsMocks();
    mockFetchRhWorkflowJson.mockResolvedValue('{"3":{"class_type":"KSampler"}}');
    mockParseRhWorkflowNodes.mockReturnValue([]);
    const node = makeNode('n1', 'rhWfNode', {
      config: { workflowId: 'wf123' },
      nodeValues: {},
    });
    const ctx = makeContext(node, [node], []);

    await executeRhWfNode(ctx);

    expect(mockFetchRhWorkflowJson).toHaveBeenCalledWith('test-api-key', 'wf123', undefined);
  });

  it('maps upstream text to first STRING field via any-input', async () => {
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

    // executeRhWorkflowApi(apiKey, workflowId, nodeInfoList, onProgress, signal) → arg index 2 = nodeInfoList
    const submitted = getCallArgs(mockExecuteRhWorkflowApi, 0, 2) as any[];
    const textField = submitted.find((n: any) => n.fieldName === 'text');
    expect(textField.fieldValue).toBe('test prompt');
  });

  it('uploads upstream image via any-input to first IMAGE field', async () => {
    const { executeRhWfNode } = await import('./rhWfExecutor');
    await setupConnectedInputsMocks({
      connectedInputs: { images: ['https://example.com/img.png'] },
    });
    mockParseRhWorkflowNodes.mockReturnValue([
      {
        nodeId: '10',
        classType: 'LoadImage',
        inputs: { image: { name: 'image', value: '', type: 'IMAGE', label: 'image' } },
      },
    ]);

    const node = makeNode('n1', 'rhWfNode', {
      config: { workflowId: 'wf123', workflowJson: '{}' },
      nodeValues: {},
    });
    const ctx = makeContext(node, [node], []);

    await executeRhWfNode(ctx);

    expect(mockUploadFileToRunningHub).toHaveBeenCalledWith('test-api-key', 'https://example.com/img.png', 'input', undefined);
  });

  it('uploads upstream video via any-input to first VIDEO field', async () => {
    const { executeRhWfNode } = await import('./rhWfExecutor');
    await setupConnectedInputsMocks({
      connectedInputs: { videos: ['https://example.com/vid.mp4'] },
    });
    mockParseRhWorkflowNodes.mockReturnValue([
      {
        nodeId: '20',
        classType: 'LoadVideo',
        inputs: { video: { name: 'video', value: '', type: 'VIDEO', label: 'video' } },
      },
    ]);

    const node = makeNode('n1', 'rhWfNode', {
      config: { workflowId: 'wf123', workflowJson: '{}' },
      nodeValues: {},
    });
    const ctx = makeContext(node, [node], []);

    await executeRhWfNode(ctx);

    expect(mockUploadFileToRunningHub).toHaveBeenCalledWith('test-api-key', 'https://example.com/vid.mp4', 'input', undefined);
  });

  it('handles ZIP response by outputting URL as textOutput for downstream rhZipNode', async () => {
    const { executeRhWfNode } = await import('./rhWfExecutor');
    await setupConnectedInputsMocks();
    mockParseRhWorkflowNodes.mockReturnValue([]);
    mockExecuteRhWorkflowApi.mockResolvedValue({
      outputUrl: 'https://rh.cn/wf-output.zip',
      outputUrls: ['https://rh.cn/wf-output.zip'],
    });

    const node = makeNode('n1', 'rhWfNode', {
      config: { workflowId: 'wf123', workflowJson: '{}' },
      nodeValues: {},
    });
    const ctx = makeContext(node, [node], []);

    await executeRhWfNode(ctx);

    // ZIP 结果应直接输出 URL，不再解压
    const calls = mockUpdateNodeData.mock.calls;
    const lastCall = calls[calls.length - 1]!;
    expect(lastCall[1].outputUrl).toBe('https://rh.cn/wf-output.zip');
    expect(lastCall[1].textOutput).toBe('https://rh.cn/wf-output.zip');
    expect(lastCall[1].outputUrls).toBeUndefined();
    expect(lastCall[1].outputUrlTypes).toBeUndefined();
  });

  it('revokes previous blob URLs before new execution', async () => {
    const { executeRhWfNode } = await import('./rhWfExecutor');
    await setupConnectedInputsMocks();
    mockParseRhWorkflowNodes.mockReturnValue([]);
    const node = makeNode('n1', 'rhWfNode', {
      config: { workflowId: 'wf123', workflowJson: '{}' },
      nodeValues: {},
      outputUrls: ['blob:prev1', 'blob:prev2'],
      outputUrl: 'blob:prev0',
    });
    const ctx = makeContext(node, [node], []);

    await executeRhWfNode(ctx);

    expect(mockRevokeMediaUrls).toHaveBeenCalledWith(['blob:prev1', 'blob:prev2']);
  });
});