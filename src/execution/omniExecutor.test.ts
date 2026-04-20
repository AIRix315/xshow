// Ref: omniExecutor.ts — 万能节点执行器测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeOmniNode } from './omniExecutor';
import type { NodeExecutionContext } from './types';
import type { ConnectedInputs } from '@/utils/connectedInputs';
import type { Node, Edge } from '@xyflow/react';

// Mock comfyApi
vi.mock('@/api/comfyApi', () => ({
  executeComfyWorkflow: vi.fn(),
  parseWorkflowNodes: vi.fn(),
  uploadImageToComfyUI: vi.fn(),
}));

// Mock connectedInputs
vi.mock('@/utils/connectedInputs', () => ({
  getConnectedInputs: vi.fn(),
  getInputsByHandle: vi.fn(),
}));

// Mock settings store
const mockComfyuiConfig = {
  localUrl: 'http://localhost:8188',
  cloudUrl: '',
  runninghubApiKey: '',
};

vi.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      comfyuiConfig: mockComfyuiConfig,
    })),
  },
}));

// Helper
function makeContext(
  node: Node,
  nodes: Node[],
  edges: Edge[],
  connectedInputs: ConnectedInputs = { images: [], videos: [], audio: [], text: null, textItems: [], model3d: null }
): NodeExecutionContext {
  return {
    node,
    nodes,
    edges,
    getConnectedInputs: vi.fn(() => connectedInputs),
    updateNodeData: vi.fn(),
    getFreshNode: vi.fn(() => node),
    signal: undefined,
  };
}

function makeNode(id: string, data: Record<string, unknown> = {}): Node {
  return { id, type: 'omniNode', position: { x: 0, y: 0 }, data };
}

describe('omniExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ComfyUI mode', () => {
    it('throws error when workflow is not selected', async () => {
      const node = makeNode('omni1', {
        config: {
          executionType: 'comfyui',
          comfyuiSubType: 'local',
          workflowJson: undefined,
        },
      });
      const ctx = makeContext(node, [node], []);

      await expect(executeOmniNode(ctx)).rejects.toThrow('请先选择工作流');
    });

    it('parses workflow nodes and finds STRING fields for text mapping', async () => {
      const { executeComfyWorkflow, parseWorkflowNodes } = await import('@/api/comfyApi');
      const { getConnectedInputs, getInputsByHandle } = await import('@/utils/connectedInputs');

      vi.mocked(parseWorkflowNodes).mockReturnValue([
        {
          nodeId: '10',
          classType: 'CLIPTextEncode',
          inputs: {
            prompt: { name: 'prompt', type: 'STRING', value: 'default prompt', label: '提示词' },
          },
        },
      ]);

      vi.mocked(getConnectedInputs).mockReturnValue({
        images: [],
        videos: [],
        audio: [],
        text: 'upstream text from connected node',
        textItems: [],
        model3d: null,
      });

      vi.mocked(getInputsByHandle).mockReturnValue({});

      vi.mocked(executeComfyWorkflow).mockResolvedValueOnce({
        outputUrl: 'http://localhost:8188/view?filename=output.png',
        outputUrls: ['http://localhost:8188/view?filename=output.png'],
      });

      const node = makeNode('omni1', {
        config: {
          executionType: 'comfyui',
          comfyuiSubType: 'local',
          workflowJson: '{}',
        },
      });
      const ctx = makeContext(node, [node], []);

      await executeOmniNode(ctx);

      // Verify executeComfyWorkflow was called with nodeInfoList containing the text field
      expect(executeComfyWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeInfoList: expect.arrayContaining([
            expect.objectContaining({
              nodeId: '10',
              fieldName: 'prompt',
              defaultValue: 'upstream text from connected node',
            }),
          ]),
        })
      );
    });

    it('maps image-* handles to LoadImage IMAGE fields', async () => {
      const { executeComfyWorkflow, parseWorkflowNodes, uploadImageToComfyUI } = await import('@/api/comfyApi');
      const { getConnectedInputs, getInputsByHandle } = await import('@/utils/connectedInputs');

      vi.mocked(parseWorkflowNodes).mockReturnValue([
        {
          nodeId: '5',
          classType: 'LoadImage',
          inputs: {
            image: { name: 'image', type: 'IMAGE', value: '', label: '图片' },
          },
        },
        {
          nodeId: '6',
          classType: 'LoadImage',
          inputs: {
            image: { name: 'image', type: 'IMAGE', value: '', label: '图片' },
          },
        },
      ]);

      vi.mocked(getConnectedInputs).mockReturnValue({
        images: [],
        videos: [],
        audio: [],
        text: null,
        textItems: [],
        model3d: null,
      });

      vi.mocked(getInputsByHandle).mockReturnValue({
        'image-0': ['https://example.com/image1.png'],
        'image-1': ['https://example.com/image2.png'],
      });

      vi.mocked(uploadImageToComfyUI)
        .mockResolvedValueOnce('uploaded_1.png')
        .mockResolvedValueOnce('uploaded_2.png');

      vi.mocked(executeComfyWorkflow).mockResolvedValueOnce({
        outputUrl: 'http://localhost:8188/view?filename=output.png',
        outputUrls: ['http://localhost:8188/view?filename=output.png'],
      });

      const node = makeNode('omni1', {
        config: {
          executionType: 'comfyui',
          comfyuiSubType: 'local',
          workflowJson: '{}',
        },
      });
      const ctx = makeContext(node, [node], []);

      await executeOmniNode(ctx);

      // Verify uploads were called
      expect(uploadImageToComfyUI).toHaveBeenCalledTimes(2);
      expect(uploadImageToComfyUI).toHaveBeenNthCalledWith(
        1,
        'http://localhost:8188',
        'https://example.com/image1.png',
        undefined
      );
      expect(uploadImageToComfyUI).toHaveBeenNthCalledWith(
        2,
        'http://localhost:8188',
        'https://example.com/image2.png',
        undefined
      );

      // Verify nodeInfoList contains uploaded filenames
      expect(executeComfyWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeInfoList: expect.arrayContaining([
            expect.objectContaining({
              nodeId: '5',
              fieldName: 'image',
              defaultValue: 'uploaded_1.png',
            }),
            expect.objectContaining({
              nodeId: '6',
              fieldName: 'image',
              defaultValue: 'uploaded_2.png',
            }),
          ]),
        })
      );
    });

    it('merges nodeValues from nodeData with config.nodeInfoList', async () => {
      const { executeComfyWorkflow, parseWorkflowNodes } = await import('@/api/comfyApi');
      const { getConnectedInputs, getInputsByHandle } = await import('@/utils/connectedInputs');

      vi.mocked(parseWorkflowNodes).mockReturnValue([
        {
          nodeId: '10',
          classType: 'KSampler',
          inputs: {
            seed: { name: 'seed', type: 'INT', value: 0, label: '种子' },
            steps: { name: 'steps', type: 'INT', value: 20, label: '步数' },
          },
        },
      ]);

      vi.mocked(getConnectedInputs).mockReturnValue({
        images: [],
        videos: [],
        audio: [],
        text: null,
        textItems: [],
        model3d: null,
      });

      vi.mocked(getInputsByHandle).mockReturnValue({});

      vi.mocked(executeComfyWorkflow).mockResolvedValueOnce({
        outputUrl: 'http://localhost:8188/view?filename=output.png',
        outputUrls: [],
      });

      const node = makeNode('omni1', {
        config: {
          executionType: 'comfyui',
          comfyuiSubType: 'local',
          workflowJson: '{}',
          nodeInfoList: [
            { nodeId: '10', fieldName: 'steps', defaultValue: '30' },
          ],
        },
        nodeValues: {
          '10': { seed: '42' },
        },
      });
      const ctx = makeContext(node, [node], []);

      await executeOmniNode(ctx);

      // Verify both nodeValues and default nodeInfoList are merged
      expect(executeComfyWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          nodeInfoList: expect.arrayContaining([
            expect.objectContaining({
              nodeId: '10',
              fieldName: 'seed',
              defaultValue: '42',
            }),
            expect.objectContaining({
              nodeId: '10',
              fieldName: 'steps',
              defaultValue: '30',
            }),
          ]),
        })
      );
    });
  });

  describe('HTTP mode', () => {
    it('throws error when config is missing', async () => {
      const node = makeNode('omni1', {});
      const ctx = makeContext(node, [node], []);

      await expect(executeOmniNode(ctx)).rejects.toThrow('万能节点配置缺失');
    });

    it('executes synchronous HTTP request successfully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ result: 'success' }),
      });

      const node = makeNode('omni1', {
        config: {
          executionType: 'http',
          method: 'POST',
          apiUrl: 'https://api.example.com/endpoint',
          headers: '{}',
          body: '{}',
          resultPath: 'result',
          executionMode: 'sync',
        },
      });
      const ctx = makeContext(node, [node], []);

      await executeOmniNode(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('omni1', { loading: true, errorMessage: '', progress: 0 });
      expect(ctx.updateNodeData).toHaveBeenCalledWith('omni1', expect.objectContaining({
        textOutput: 'success',
        loading: false,
      }));
    });

    it('maps upstream text to variables', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'response' }),
      });

      const node = makeNode('omni1', {
        config: {
          executionType: 'http',
          method: 'POST',
          apiUrl: 'https://api.example.com/{{text}}',
          headers: '{}',
          body: '{"prompt": "{{text}}"}',
          resultPath: 'data',
          executionMode: 'sync',
        },
      });
      const ctx = makeContext(node, [node], [], {
        images: [],
        videos: [],
        audio: [],
        text: 'hello world',
        textItems: [],
        model3d: null,
      });

      await executeOmniNode(ctx);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/hello world',
        expect.objectContaining({
          body: '{"prompt": "hello world"}',
        })
      );
    });
  });
});