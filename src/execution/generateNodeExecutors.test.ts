// Ref: generateNodeExecutors.ts — 生成节点执行器测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeImageNode,
  executeTextNode,
  executeVideoNode,
  executeAudioNode,
} from './generateNodeExecutors';
import type { NodeExecutionContext } from './types';
import type { ConnectedInputs } from '@/utils/connectedInputs';
import type { Node, Edge } from '@xyflow/react';

// Mock API 模块
vi.mock('@/api/imageApi', () => ({
  generateImage: vi.fn(),
}));

vi.mock('@/api/textApi', () => ({
  generateText: vi.fn(),
}));

vi.mock('@/api/videoApi', () => ({
  submitVideoTask: vi.fn(),
  pollVideoTask: vi.fn(),
}));

vi.mock('@/api/audioApi', () => ({
  generateTTS: vi.fn(),
}));

// Mock settings store - 提供 minimal mock config
const mockApiConfig = {
  channels: [
    { id: 'img-channel', url: 'https://img.api', key: 'key1', protocol: 'openai' },
    { id: 'txt-channel', url: 'https://txt.api', key: 'key2', protocol: 'openai' },
    { id: 'vid-channel', url: 'https://vid.api', key: 'key3', protocol: 'openai' },
    { id: 'aud-channel', url: 'https://aud.api', key: 'key4', protocol: 'openai' },
  ],
  imageChannelId: 'img-channel',
  textChannelId: 'txt-channel',
  videoChannelId: 'vid-channel',
  audioChannelId: 'aud-channel',
  drawingModel: 'dall-e-3',
  textModel: 'gpt-4',
};

vi.mock('@/stores/useSettingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      apiConfig: mockApiConfig,
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

function makeNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

describe('generateNodeExecutors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('executeImageNode', () => {
    it('throws error when no channel selected', async () => {
      const { useSettingsStore } = await import('@/stores/useSettingsStore');
      vi.mocked(useSettingsStore.getState).mockReturnValueOnce({
        apiConfig: {
          channels: [],
          imageChannelId: '',
          textChannelId: '',
          videoChannelId: '',
          audioChannelId: '',
          drawingModel: '',
          textModel: '',
        },
      } as unknown as ReturnType<typeof useSettingsStore.getState>);

      const node = makeNode('img1', 'imageNode', { prompt: 'test prompt' });
      const ctx = makeContext(node, [node], []);

      await expect(executeImageNode(ctx)).rejects.toThrow('未选择图片供应商');
    });

    it('throws error when prompt is empty', async () => {
      const node = makeNode('img1', 'imageNode', { prompt: '' });
      const ctx = makeContext(node, [node], []);

      await expect(executeImageNode(ctx)).rejects.toThrow('图片提示词为空');
    });

    it('generates image successfully', async () => {
      const { generateImage } = await import('@/api/imageApi');
      vi.mocked(generateImage).mockResolvedValueOnce('https://result.com/image.png');

      const node = makeNode('img1', 'imageNode', { prompt: 'a beautiful sunset' });
      const ctx = makeContext(node, [node], []);

      await executeImageNode(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('img1', { loading: true, errorMessage: '' });
      expect(ctx.updateNodeData).toHaveBeenCalledWith('img1', expect.objectContaining({
        imageUrl: 'https://result.com/image.png',
        loading: false,
      }));
    });

    it('uses upstream text as prompt when connected', async () => {
      const { generateImage } = await import('@/api/imageApi');
      vi.mocked(generateImage).mockResolvedValueOnce('https://result.com/upstream.png');

      const node = makeNode('img1', 'imageNode', { prompt: 'local prompt' });
      const ctx = makeContext(node, [node], [], { 
        images: [], 
        videos: [], 
        audio: [], 
        text: 'upstream prompt', 
        textItems: [], 
        model3d: null 
      });

      await executeImageNode(ctx);

      expect(generateImage).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'upstream prompt' })
      );
    });

    it('handles API errors', async () => {
      const { generateImage } = await import('@/api/imageApi');
      vi.mocked(generateImage).mockRejectedValueOnce(new Error('API failed'));

      const node = makeNode('img1', 'imageNode', { prompt: 'test' });
      const ctx = makeContext(node, [node], []);

      await expect(executeImageNode(ctx)).rejects.toThrow('API failed');
      expect(ctx.updateNodeData).toHaveBeenCalledWith('img1', {
        loading: false,
        errorMessage: 'API failed',
      });
    });
  });

  describe('executeTextNode', () => {
    it('throws error when no channel selected', async () => {
      const { useSettingsStore } = await import('@/stores/useSettingsStore');
      vi.mocked(useSettingsStore.getState).mockReturnValueOnce({
        apiConfig: {
          channels: [],
          imageChannelId: '',
          textChannelId: '',
          videoChannelId: '',
          audioChannelId: '',
          drawingModel: '',
          textModel: '',
        },
      } as unknown as ReturnType<typeof useSettingsStore.getState>);

      const node = makeNode('txt1', 'textNode', { prompt: 'test' });
      const ctx = makeContext(node, [node], []);

      await expect(executeTextNode(ctx)).rejects.toThrow('未选择文本供应商');
    });

    it('throws error when prompt is empty', async () => {
      const node = makeNode('txt1', 'textNode', { prompt: '' });
      const ctx = makeContext(node, [node], []);

      await expect(executeTextNode(ctx)).rejects.toThrow('文本提示词为空');
    });

    it('generates text successfully', async () => {
      const { generateText } = await import('@/api/textApi');
      vi.mocked(generateText).mockResolvedValueOnce({ text: 'Generated text' });

      const node = makeNode('txt1', 'textNode', { prompt: 'Hello' });
      const ctx = makeContext(node, [node], []);

      await executeTextNode(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('txt1', { loading: true, errorMessage: '' });
      expect(ctx.updateNodeData).toHaveBeenCalledWith('txt1', {
        text: 'Generated text',
        loading: false,
      });
    });

    it('uses upstream text when connected', async () => {
      const { generateText } = await import('@/api/textApi');
      vi.mocked(generateText).mockResolvedValueOnce({ text: 'Response' });

      const node = makeNode('txt1', 'textNode', { prompt: 'local' });
      const ctx = makeContext(node, [node], [], {
        images: [],
        videos: [],
        audio: [],
        text: 'upstream text',
        textItems: [],
        model3d: null,
      });

      await executeTextNode(ctx);

      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'upstream text' }],
        })
      );
    });
  });

  describe('executeVideoNode', () => {
    it('throws error when no channel selected', async () => {
      const { useSettingsStore } = await import('@/stores/useSettingsStore');
      vi.mocked(useSettingsStore.getState).mockReturnValueOnce({
        apiConfig: {
          channels: [],
          imageChannelId: '',
          textChannelId: '',
          videoChannelId: '',
          audioChannelId: '',
          drawingModel: '',
          textModel: '',
        },
      } as unknown as ReturnType<typeof useSettingsStore.getState>);

      const node = makeNode('vid1', 'videoNode', { prompt: 'test' });
      const ctx = makeContext(node, [node], []);

      await expect(executeVideoNode(ctx)).rejects.toThrow('未选择视频供应商');
    });

    it('throws error when prompt is empty', async () => {
      const node = makeNode('vid1', 'videoNode', { prompt: '' });
      const ctx = makeContext(node, [node], []);

      await expect(executeVideoNode(ctx)).rejects.toThrow('视频提示词为空');
    });

    it('generates video successfully with polling', async () => {
      const { submitVideoTask, pollVideoTask } = await import('@/api/videoApi');
      vi.mocked(submitVideoTask).mockResolvedValueOnce('task-123');
      vi.mocked(pollVideoTask).mockResolvedValueOnce({
        videoUrl: 'https://result.com/video.mp4',
        thumbnailUrl: 'https://result.com/thumb.png',
      });

      const node = makeNode('vid1', 'videoNode', { prompt: 'sunset video' });
      const ctx = makeContext(node, [node], []);

      await executeVideoNode(ctx);

      expect(submitVideoTask).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: 'sunset video' })
      );
      expect(ctx.updateNodeData).toHaveBeenCalledWith('vid1', expect.objectContaining({
        videoUrl: 'https://result.com/video.mp4',
        thumbnailUrl: 'https://result.com/thumb.png',
        loading: false,
        progress: 0,
      }));
    });

    it('handles API errors', async () => {
      const { submitVideoTask } = await import('@/api/videoApi');
      vi.mocked(submitVideoTask).mockRejectedValueOnce(new Error('Video API error'));

      const node = makeNode('vid1', 'videoNode', { prompt: 'test' });
      const ctx = makeContext(node, [node], []);

      await expect(executeVideoNode(ctx)).rejects.toThrow('Video API error');
      expect(ctx.updateNodeData).toHaveBeenCalledWith('vid1', {
        loading: false,
        errorMessage: 'Video API error',
        progress: 0,
      });
    });
  });

  describe('executeAudioNode', () => {
    it('throws error when no channel selected', async () => {
      const { useSettingsStore } = await import('@/stores/useSettingsStore');
      vi.mocked(useSettingsStore.getState).mockReturnValueOnce({
        apiConfig: {
          channels: [],
          imageChannelId: '',
          textChannelId: '',
          videoChannelId: '',
          audioChannelId: '',
          drawingModel: '',
          textModel: '',
        },
      } as unknown as ReturnType<typeof useSettingsStore.getState>);

      const node = makeNode('aud1', 'audioNode', { text: 'test' });
      const ctx = makeContext(node, [node], []);

      await expect(executeAudioNode(ctx)).rejects.toThrow('未选择音频供应商');
    });

    it('throws error when text is empty', async () => {
      const node = makeNode('aud1', 'audioNode', { text: '' });
      const ctx = makeContext(node, [node], []);

      await expect(executeAudioNode(ctx)).rejects.toThrow('音频文本为空');
    });

    it('generates audio successfully', async () => {
      const { generateTTS } = await import('@/api/audioApi');
      vi.mocked(generateTTS).mockResolvedValueOnce('https://result.com/audio.mp3');

      const node = makeNode('aud1', 'audioNode', { text: 'Hello world', voice: 'alloy' });
      const ctx = makeContext(node, [node], []);

      await executeAudioNode(ctx);

      expect(generateTTS).toHaveBeenCalledWith(
        expect.objectContaining({ input: 'Hello world', voice: 'alloy' })
      );
      expect(ctx.updateNodeData).toHaveBeenCalledWith('aud1', {
        audioUrl: 'https://result.com/audio.mp3',
        loading: false,
      });
    });

    it('uses upstream text when connected', async () => {
      const { generateTTS } = await import('@/api/audioApi');
      vi.mocked(generateTTS).mockResolvedValueOnce('https://result.com/upstream.mp3');

      const node = makeNode('aud1', 'audioNode', { text: 'local' });
      const ctx = makeContext(node, [node], [], {
        images: [],
        videos: [],
        audio: [],
        text: 'upstream text for TTS',
        textItems: [],
        model3d: null,
      });

      await executeAudioNode(ctx);

      expect(generateTTS).toHaveBeenCalledWith(
        expect.objectContaining({ input: 'upstream text for TTS' })
      );
    });
  });

  // ============================================================
  // T2 扩展：autoSplit / AbortSignal / 进度回调
  // ============================================================

  describe('executeTextNode — autoSplit', () => {
    it('autoSplit=true 时 updateNodeData 包含 splitItems', async () => {
      const { generateText } = await import('@/api/textApi');
      vi.mocked(generateText).mockResolvedValueOnce({
        text: 'Generated text',
        splitItems: [
          { title: '第一段', content: '内容1' },
          { title: '第二段', content: '内容2' },
        ],
      });

      const node = makeNode('txt1', 'textNode', { prompt: 'Hello', autoSplit: true });
      const ctx = makeContext(node, [node], []);

      await executeTextNode(ctx);

      // verify updateNodeData was called with splitItems
      const updateCalls = vi.mocked(ctx.updateNodeData).mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1]!;
      expect(lastCall[1]).toHaveProperty('splitItems');
      expect((lastCall[1] as Record<string, unknown>).splitItems).toHaveLength(2);
    });

    it('autoSplit=false 时不写 splitItems', async () => {
      const { generateText } = await import('@/api/textApi');
      vi.mocked(generateText).mockResolvedValueOnce({ text: 'Generated text' });

      const node = makeNode('txt1', 'textNode', { prompt: 'Hello', autoSplit: false });
      const ctx = makeContext(node, [node], []);

      await executeTextNode(ctx);

      // verify updateNodeData was called without splitItems
      const updateCalls = vi.mocked(ctx.updateNodeData).mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1]!;
      expect(lastCall[1]).not.toHaveProperty('splitItems');
    });
  });

  describe('executeImageNode — AbortSignal', () => {
    it('signal.abort() 后抛出 AbortError', async () => {
      const { generateImage } = await import('@/api/imageApi');
      // 永不 resolve 的 mock
      vi.mocked(generateImage).mockImplementation(
        () => new Promise(() => { /* never resolve */ })
      );

      const node = makeNode('img1', 'imageNode', { prompt: 'test prompt' });
      const ac = new AbortController();
      const ctx = makeContext(node, [node], []);
      ctx.signal = ac.signal;

      const promise = executeImageNode(ctx);
      ac.abort();
      await expect(promise).rejects.toThrow('abort');
    });
  });

  describe('executeVideoNode — 进度回调', () => {
    it('轮询期间 updateNodeData 被多次调用传递 progress', async () => {
      const { submitVideoTask, pollVideoTask } = await import('@/api/videoApi');
      vi.mocked(submitVideoTask).mockResolvedValueOnce('task-123');
      // 两次 progress 回调后再返回结果
      vi.mocked(pollVideoTask).mockImplementation(
        async (_url: string, _key: string, _id: string, onProgress?: (p: number) => void) => {
          onProgress?.(0.3);
          onProgress?.(0.7);
          return {
            videoUrl: 'https://result.com/video.mp4',
            thumbnailUrl: 'https://result.com/thumb.png',
          };
        }
      );

      const node = makeNode('vid1', 'videoNode', { prompt: 'sunset video' });
      const ctx = makeContext(node, [node], []);

      await executeVideoNode(ctx);

      // 验证 progress 回调被调用
      const updateCalls = vi.mocked(ctx.updateNodeData).mock.calls;
      const progressCalls = updateCalls.filter(([, patch]) => (patch as Record<string, unknown>).progress !== undefined);
      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ============================================================
  // T6: 历史轮播测试
  // ============================================================

  describe('executeImageNode — 历史轮播', () => {
    it('生成成功后写入 imageHistory 和 selectedHistoryIndex', async () => {
      const { generateImage } = await import('@/api/imageApi');
      vi.mocked(generateImage).mockResolvedValueOnce('https://result.com/image.png');

      const node = makeNode('img1', 'imageNode', { prompt: 'test prompt' });
      const ctx = makeContext(node, [node], []);

      await executeImageNode(ctx);

      const updateCalls = vi.mocked(ctx.updateNodeData).mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1]!;
      expect(lastCall[1]).toHaveProperty('imageHistory');
      expect(lastCall[1]).toHaveProperty('selectedHistoryIndex');
      const history = (lastCall[1] as Record<string, unknown>).imageHistory as Array<{ imageUrl: string; prompt: string; timestamp: number }>;
      expect(history).toHaveLength(1);
      expect(history[0]!.imageUrl).toBe('https://result.com/image.png');
      expect((lastCall[1] as Record<string, unknown>).selectedHistoryIndex).toBe(0);
    });

    it('第 11 条历史淘汰第 1 条，保留最近 10 条', async () => {
      const { generateImage } = await import('@/api/imageApi');
      const node = makeNode('img1', 'imageNode', { prompt: 'test' });
      // Stateful context: each call to executeImageNode gets updated nodeData
      let currentNode = node;
      const ctx: NodeExecutionContext = {
        node: currentNode,
        nodes: [currentNode],
        edges: [],
        getConnectedInputs: vi.fn(() => ({ images: [], videos: [], audio: [], text: null, textItems: [], model3d: null })),
        updateNodeData: vi.fn((_nodeId: string, patch: Record<string, unknown>) => {
          currentNode = { ...currentNode, data: { ...currentNode.data, ...patch } };
        }),
        getFreshNode: vi.fn(() => currentNode),
        signal: undefined,
      };

      // 连续生成 11 次
      for (let i = 0; i < 11; i++) {
        vi.mocked(generateImage).mockResolvedValueOnce(`https://result.com/image${i}.png`);
        // Update ctx.node to the latest state before each call
        ctx.node = currentNode;
        await executeImageNode(ctx);
      }

      const updateCalls = vi.mocked(ctx.updateNodeData).mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1]!;
      const history = (lastCall[1] as Record<string, unknown>).imageHistory as Array<{ imageUrl: string; prompt: string; timestamp: number }>;
      expect(history).toHaveLength(10);
      // 第 0 条应被淘汰，第 1-10 条（索引 1-10）应保留
      expect(history[0]!.imageUrl).toBe('https://result.com/image1.png');
      expect(history[history.length - 1]!.imageUrl).toBe('https://result.com/image10.png');
      expect((lastCall[1] as Record<string, unknown>).selectedHistoryIndex).toBe(9);
    });
  });

  describe('executeVideoNode — 历史轮播', () => {
    it('生成成功后写入 videoHistory 和 selectedVideoHistoryIndex', async () => {
      const { submitVideoTask, pollVideoTask } = await import('@/api/videoApi');
      vi.mocked(submitVideoTask).mockResolvedValueOnce('task-123');
      vi.mocked(pollVideoTask).mockResolvedValueOnce({
        videoUrl: 'https://result.com/video.mp4',
        thumbnailUrl: 'https://result.com/thumb.png',
      });

      const node = makeNode('vid1', 'videoNode', { prompt: 'test video' });
      const ctx = makeContext(node, [node], []);

      await executeVideoNode(ctx);

      const updateCalls = vi.mocked(ctx.updateNodeData).mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1]!;
      expect(lastCall[1]).toHaveProperty('videoHistory');
      expect(lastCall[1]).toHaveProperty('selectedVideoHistoryIndex');
      const history = (lastCall[1] as Record<string, unknown>).videoHistory as Array<{ videoUrl: string; thumbnailUrl: string; prompt: string; timestamp: number }>;
      expect(history).toHaveLength(1);
      expect(history[0]!.videoUrl).toBe('https://result.com/video.mp4');
      expect((lastCall[1] as Record<string, unknown>).selectedVideoHistoryIndex).toBe(0);
    });

    it('第 11 条历史淘汰第 1 条，保留最近 10 条', async () => {
      const { submitVideoTask, pollVideoTask } = await import('@/api/videoApi');
      const node = makeNode('vid1', 'videoNode', { prompt: 'test' });

      vi.mocked(submitVideoTask).mockResolvedValue('task-123');
      vi.mocked(pollVideoTask).mockImplementation(
        async (_url: string, _key: string, _id: string, onProgress?: (p: number) => void) => {
          onProgress?.(1);
          return { videoUrl: 'https://result.com/video.mp4', thumbnailUrl: 'https://result.com/thumb.png' };
        }
      );

      // Stateful context
      let currentNode = node;
      const ctx: NodeExecutionContext = {
        node: currentNode,
        nodes: [currentNode],
        edges: [],
        getConnectedInputs: vi.fn(() => ({ images: [], videos: [], audio: [], text: null, textItems: [], model3d: null })),
        updateNodeData: vi.fn((_nodeId: string, patch: Record<string, unknown>) => {
          currentNode = { ...currentNode, data: { ...currentNode.data, ...patch } };
        }),
        getFreshNode: vi.fn(() => currentNode),
        signal: undefined,
      };

      // 连续生成 11 次
      for (let i = 0; i < 11; i++) {
        vi.mocked(submitVideoTask).mockResolvedValueOnce(`task-${i}`);
        ctx.node = currentNode;
        await executeVideoNode(ctx);
      }

      const updateCalls = vi.mocked(ctx.updateNodeData).mock.calls;
      const lastCall = updateCalls[updateCalls.length - 1]!;
      const history = (lastCall[1] as Record<string, unknown>).videoHistory as Array<{ videoUrl: string; thumbnailUrl: string; prompt: string; timestamp: number }>;
      expect(history).toHaveLength(10);
      expect((lastCall[1] as Record<string, unknown>).selectedVideoHistoryIndex).toBe(9);
    });
  });
});