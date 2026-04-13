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
      expect(ctx.updateNodeData).toHaveBeenCalledWith('img1', {
        imageUrl: 'https://result.com/image.png',
        loading: false,
      });
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
      expect(ctx.updateNodeData).toHaveBeenCalledWith('vid1', {
        videoUrl: 'https://result.com/video.mp4',
        thumbnailUrl: 'https://result.com/thumb.png',
        loading: false,
        progress: 0,
      });
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
});