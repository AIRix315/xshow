// Ref: connectedInputs.ts — 核心数据流函数测试
import { describe, it, expect } from 'vitest';
import { getConnectedInputs, getUpstreamNodes, getInputsByHandle, isVideoHandle, isAudioHandle } from './connectedInputs';
import type { Node, Edge } from '@xyflow/react';

// 测试辅助函数
function makeNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function makeEdge(id: string, source: string, target: string, sourceHandle?: string, targetHandle?: string): Edge {
  const edge: Edge = { id, source, target };
  if (sourceHandle) edge.sourceHandle = sourceHandle;
  if (targetHandle) edge.targetHandle = targetHandle;
  return edge;
}

describe('connectedInputs', () => {
  describe('getConnectedInputs', () => {
    it('returns empty data when no edges connect to node', () => {
      const nodes = [makeNode('n1', 'imageNode')];
      const edges: Edge[] = [];

      const result = getConnectedInputs('n1', nodes, edges);

      expect(result.images).toEqual([]);
      expect(result.videos).toEqual([]);
      expect(result.audio).toEqual([]);
      expect(result.text).toBeNull();
      expect(result.model3d).toBeNull();
    });

    it('extracts image from imageNode', () => {
      const nodes = [
        makeNode('n1', 'imageNode', { imageUrl: 'https://example.com/image.png' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/image.png');
    });

    it('extracts video from videoNode', () => {
      const nodes = [
        makeNode('n1', 'videoNode', { videoUrl: 'https://example.com/video.mp4' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'video')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toBe('https://example.com/video.mp4');
    });

    it('extracts audio from audioNode', () => {
      const nodes = [
        makeNode('n1', 'audioInputNode', { audioUrl: 'https://example.com/audio.mp3' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'audio')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.audio).toHaveLength(1);
      expect(result.audio[0]).toBe('https://example.com/audio.mp3');
    });

    it('extracts text from textNode', () => {
      const nodes = [
        makeNode('n1', 'textNode', { text: 'Hello World' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', undefined, 'text')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.text).toBe('Hello World');
    });

    it('extracts image from imageInputNode', () => {
      const nodes = [
        makeNode('n1', 'imageInputNode', { imageUrl: 'https://example.com/input.png' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/input.png');
    });

    it('extracts video from videoInputNode', () => {
      const nodes = [
        makeNode('n1', 'videoInputNode', { videoUrl: 'https://example.com/input.mp4' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'video')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toBe('https://example.com/input.mp4');
    });

    it('extracts text from textInputNode', () => {
      const nodes = [
        makeNode('n1', 'textInputNode', { text: 'Input text' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', undefined, 'text')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.text).toBe('Input text');
    });

    it('extracts image from cropNode', () => {
      const nodes = [
        makeNode('n1', 'cropNode', { croppedImageUrl: 'https://example.com/cropped.png' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/cropped.png');
    });

    it('extracts image from annotateNode', () => {
      const nodes = [
        makeNode('n1', 'annotateNode', { outputImageUrl: 'https://example.com/annotated.png' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/annotated.png');
    });

    it('extracts video from videoTrimNode', () => {
      const nodes = [
        makeNode('n1', 'videoTrimNode', { resultUrl: 'https://example.com/trimmed.mp4' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'video')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toBe('https://example.com/trimmed.mp4');
    });

    it('extracts video from videoStitchNode', () => {
      const nodes = [
        makeNode('n1', 'videoStitchNode', { resultUrl: 'https://example.com/stitched.mp4' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'video')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toBe('https://example.com/stitched.mp4');
    });

    it('extracts image from gridMergeNode', () => {
      const nodes = [
        makeNode('n1', 'gridMergeNode', { mergedImageUrl: 'https://example.com/merged.png' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/merged.png');
    });

    it('extracts output from omniNode (image type)', () => {
      const nodes = [
        makeNode('n1', 'omniNode', {
          outputUrl: 'https://example.com/custom.png',
          config: { outputType: 'image' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/custom.png');
    });

    it('infers omniNode image from URL extension', () => {
      const nodes = [
        makeNode('n1', 'omniNode', {
          outputUrl: 'https://example.com/output.jpg',
          config: { outputType: 'auto' }, // auto 模式：URL 扩展名优先推断
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/output.jpg');
    });

    it('omniNode explicit text type filters out image URL', () => {
      // 显式类型模式：outputType='text' 只输出文本，即使 outputUrl 是图片也过滤掉
      const nodes = [
        makeNode('n1', 'omniNode', {
          outputUrl: 'https://example.com/output.jpg',
          textOutput: 'some text',
          config: { outputType: 'text' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(0);
      expect(result.text).toBe('some text');
    });

    it('omniNode auto mode routes image to image targetHandle', () => {
      // auto 模式：下游 targetHandle='image' 时，从 outputUrls 中筛选图片
      const nodes = [
        makeNode('n1', 'omniNode', {
          outputUrl: 'https://example.com/output.jpg',
          config: { outputType: 'auto' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', undefined, 'image')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/output.jpg');
    });

    it('omniNode auto mode routes text to text targetHandle', () => {
      // auto 模式：下游 targetHandle='text' 时，返回 textOutput
      const nodes = [
        makeNode('n1', 'omniNode', {
          outputUrl: 'https://example.com/output.jpg',
          textOutput: 'hello world',
          config: { outputType: 'auto' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', undefined, 'text')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(0);
      expect(result.text).toBe('hello world');
    });

    it('infers omniNode video from URL', () => {
      const nodes = [
        makeNode('n1', 'omniNode', {
          outputUrl: 'https://example.com/video.mp4',
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toBe('https://example.com/video.mp4');
    });

    it('infers omniNode audio from URL', () => {
      const nodes = [
        makeNode('n1', 'omniNode', {
          outputUrl: 'https://example.com/audio.mp3',
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.audio).toHaveLength(1);
      expect(result.audio[0]).toBe('https://example.com/audio.mp3');
    });

    it('recognizes ComfyUI view endpoint as image', () => {
      const nodes = [
        makeNode('n1', 'omniNode', {
          outputUrl: 'http://localhost:8188/view?filename=output.png&subfolder=&type=output',
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('http://localhost:8188/view?filename=output.png&subfolder=&type=output');
    });

    it('extracts text output from omniNode (text type)', () => {
      const nodes = [
        makeNode('n1', 'omniNode', {
          textOutput: 'Custom API response',
          config: { outputType: 'text' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', undefined, 'text')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.text).toBe('Custom API response');
    });

    it('collects multiple images from multiple sources', () => {
      const nodes = [
        makeNode('n1', 'imageNode', { imageUrl: 'https://example.com/a.png' }),
        makeNode('n2', 'imageNode', { imageUrl: 'https://example.com/b.png' }),
        makeNode('n3', 'outputGalleryNode'),
      ];
      const edges = [
        makeEdge('e1', 'n1', 'n3'),
        makeEdge('e2', 'n2', 'n3'),
      ];

      const result = getConnectedInputs('n3', nodes, edges);

      expect(result.images).toHaveLength(2);
      expect(result.images).toContain('https://example.com/a.png');
      expect(result.images).toContain('https://example.com/b.png');
    });

    it('handles routerNode passthrough', () => {
      const nodes = [
        makeNode('n1', 'imageNode', { imageUrl: 'https://example.com/router-test.png' }),
        makeNode('n2', 'routerNode', {}),
        makeNode('n3', 'outputNode'),
      ];
      const edges = [
        makeEdge('e1', 'n1', 'n2'),
        makeEdge('e2', 'n2', 'n3', 'image'),
      ];

      const result = getConnectedInputs('n3', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/router-test.png');
    });

    it('handles nodes with no output data', () => {
      const nodes = [
        makeNode('n1', 'imageNode', {}), // no imageUrl
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(0);
    });

    it('prevents infinite loops with visited set', () => {
      const nodes = [
        makeNode('n1', 'routerNode', {}),
        makeNode('n2', 'routerNode', {}),
      ];
      const edges = [
        makeEdge('e1', 'n1', 'n2', 'image'),
        makeEdge('e2', 'n2', 'n1', 'image'),
      ];

      // Should not throw or hang
      const result = getConnectedInputs('n1', nodes, edges);
      expect(result).toBeDefined();
    });
  });

  describe('getUpstreamNodes', () => {
    it('returns upstream nodes with edge info', () => {
      const nodes = [
        makeNode('n1', 'imageNode', { imageUrl: 'https://example.com/test.png' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getUpstreamNodes('n2', nodes, edges);

      expect(result).toHaveLength(1);
      expect(result[0]?.node.id).toBe('n1');
      expect(result[0]?.edge.id).toBe('e1');
    });

    it('returns empty array when no upstream nodes', () => {
      const nodes = [makeNode('n1', 'outputNode')];
      const edges: Edge[] = [];

      const result = getUpstreamNodes('n1', nodes, edges);

      expect(result).toHaveLength(0);
    });

    it('ignores edges from missing nodes', () => {
      const nodes = [makeNode('n2', 'outputNode')];
      const edges = [makeEdge('e1', 'n1', 'n2')]; // n1 doesn't exist

      const result = getUpstreamNodes('n2', nodes, edges);

      expect(result).toHaveLength(0);
    });
  });

  describe('isVideoHandle', () => {
    it('returns true for video handle', () => {
      expect(isVideoHandle('video')).toBe(true);
      expect(isVideoHandle('video-1')).toBe(true);
      expect(isVideoHandle('video-output')).toBe(true);
    });

    it('returns false for non-video handle', () => {
      expect(isVideoHandle('image')).toBe(false);
      expect(isVideoHandle('text')).toBe(false);
      expect(isVideoHandle(null)).toBe(false);
      expect(isVideoHandle(undefined)).toBe(false);
    });
  });

  describe('isAudioHandle', () => {
    it('returns true for audio handle', () => {
      expect(isAudioHandle('audio')).toBe(true);
      expect(isAudioHandle('audio-1')).toBe(true);
      expect(isAudioHandle('audio-output')).toBe(true);
    });

    it('returns false for non-audio handle', () => {
      expect(isAudioHandle('image')).toBe(false);
      expect(isAudioHandle('video')).toBe(false);
      expect(isAudioHandle(null)).toBe(false);
      expect(isAudioHandle(undefined)).toBe(false);
    });
  });

  describe('P0 fixes — distribution by type (not just handleId)', () => {
    it('routes image type to images[] when targetHandle is "any" (was bug: data lost)', () => {
      const nodes = [
        makeNode('n1', 'imageNode', { imageUrl: 'https://example.com/img.png' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'image', 'any')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/img.png');
    });

    it('routes video type to videos[] when targetHandle is "any"', () => {
      const nodes = [
        makeNode('n1', 'videoNode', { videoUrl: 'https://example.com/vid.mp4' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'video', 'any')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toBe('https://example.com/vid.mp4');
    });

    it('routes audio type to audio[] when targetHandle is "any"', () => {
      const nodes = [
        makeNode('n1', 'audioInputNode', { audioUrl: 'https://example.com/audio.mp3' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'audio', 'any')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.audio).toHaveLength(1);
      expect(result.audio[0]).toBe('https://example.com/audio.mp3');
    });

    it('routes text type to text when targetHandle is "any"', () => {
      const nodes = [
        makeNode('n1', 'textNode', { text: 'Hello' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'text', 'any')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.text).toBe('Hello');
    });

    it('extracts image from omniNode when targetHandle is "any"', () => {
      const nodes = [
        makeNode('n1', 'omniNode', {
          outputUrl: 'https://example.com/omni.png',
          config: { outputType: 'image' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'custom-output', 'any')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/omni.png');
    });

    it('extracts gridSplitNode splitResults as multiple images', () => {
      const nodes = [
        makeNode('n1', 'gridSplitNode', {
          splitResults: ['https://example.com/cell0.png', 'https://example.com/cell1.png', 'https://example.com/cell2.png'],
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'cell-0-0', 'image')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(3);
      expect(result.images[0]).toBe('https://example.com/cell0.png');
      expect(result.images[1]).toBe('https://example.com/cell1.png');
      expect(result.images[2]).toBe('https://example.com/cell2.png');
    });

    it('routes gridSplitNode image-01 handle to correct split result', () => {
      const nodes = [
        makeNode('n1', 'gridSplitNode', {
          splitResults: ['https://example.com/cell0.png', 'https://example.com/cell1.png'],
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'image-02', 'image')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/cell1.png');
    });

    it('extracts image from imageCompareNode output', () => {
      const nodes = [
        makeNode('n1', 'imageCompareNode', { outputImageUrl: 'https://example.com/compare.png' }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/compare.png');
    });

    it('extracts omniNode outputUrls as additionalValues', () => {
      // 实际 ComfyAPI 返回：outputUrl = allUrls[0], outputUrls = allUrls（完整数组）
      const nodes = [
        makeNode('n1', 'omniNode', {
          outputUrl: 'https://example.com/first.png',
          // outputUrls 包含 outputUrl（完整数组），符合 ComfyAPI 实际行为
          outputUrls: ['https://example.com/first.png', 'https://example.com/second.png', 'https://example.com/third.png'],
          config: { outputType: 'image' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      // 修复后：additionalValues 排除了 outputUrl，不重复
      expect(result.images).toHaveLength(3);
      expect(result.images[0]).toBe('https://example.com/first.png');
      expect(result.images[1]).toBe('https://example.com/second.png');
      expect(result.images[2]).toBe('https://example.com/third.png');
    });
  });

  // ========================================================================
  // rhAppNode / rhWfNode 输出推断（与 omniNode 共享 inferMediaOutput）
  // ========================================================================
  describe('rhAppNode and rhWfNode output inference', () => {
    it('extracts image from rhAppNode outputUrl', () => {
      const nodes = [
        makeNode('n1', 'rhAppNode', {
          outputUrl: 'https://rh.cn/result.png',
          config: { outputType: 'auto' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://rh.cn/result.png');
    });

    it('extracts multiple images from rhAppNode outputUrls', () => {
      const nodes = [
        makeNode('n1', 'rhAppNode', {
          outputUrl: 'https://rh.cn/img1.png',
          outputUrls: ['https://rh.cn/img1.png', 'https://rh.cn/img2.png', 'https://rh.cn/img3.png'],
          config: { outputType: 'auto' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(3);
      expect(result.images[0]).toBe('https://rh.cn/img1.png');
      expect(result.images[1]).toBe('https://rh.cn/img2.png');
      expect(result.images[2]).toBe('https://rh.cn/img3.png');
    });

    it('extracts video from rhAppNode when outputType=video', () => {
      const nodes = [
        makeNode('n1', 'rhAppNode', {
          outputUrl: 'https://rh.cn/result.mp4',
          config: { outputType: 'video' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.videos).toHaveLength(1);
      expect(result.videos[0]).toBe('https://rh.cn/result.mp4');
    });

    it('extracts audio from rhWfNode when outputType=audio', () => {
      const nodes = [
        makeNode('n1', 'rhWfNode', {
          outputUrl: 'https://rh.cn/result.mp3',
          config: { outputType: 'audio' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.audio).toHaveLength(1);
      expect(result.audio[0]).toBe('https://rh.cn/result.mp3');
    });

    it('extracts textOutput from rhWfNode when outputType=text', () => {
      const nodes = [
        makeNode('n1', 'rhWfNode', {
          outputUrl: 'https://rh.cn/ignore.png',
          textOutput: 'some json text',
          config: { outputType: 'text' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(0);
      expect(result.text).toBe('some json text');
    });

    it('returns null when rhAppNode has no output', () => {
      const nodes = [
        makeNode('n1', 'rhAppNode', {
          config: { outputType: 'auto' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(0);
    });

    it('filters outputUrls by type when outputType is explicit', () => {
      // outputType=image 但 outputUrls 包含视频和图片，只返回图片
      const nodes = [
        makeNode('n1', 'rhWfNode', {
          outputUrl: 'https://rh.cn/img1.png',
          outputUrls: ['https://rh.cn/img1.png', 'https://rh.cn/vid.mp4', 'https://rh.cn/img2.png'],
          config: { outputType: 'image' },
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(2);
      expect(result.images[0]).toBe('https://rh.cn/img1.png');
      expect(result.images[1]).toBe('https://rh.cn/img2.png');
    });
  });

  // ========================================================================
  // getInputsByHandle — 多类型 handle 支持
  // ========================================================================
  describe('getInputsByHandle — extended handle types', () => {
    it('collects video-* handle inputs', () => {
      const nodes = [
        makeNode('n1', 'videoNode', { videoUrl: 'https://example.com/vid.mp4' }),
        makeNode('n2', 'rhWfNode', { config: {} }),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'video', 'video-0')];

      const result = getInputsByHandle!( 'n2', nodes, edges);

      expect(result['video-0']).toBeDefined();
      expect(result['video-0']).toHaveLength(1);
      expect(result['video-0']![0]).toBe('https://example.com/vid.mp4');
    });

    it('collects audio-* handle inputs', () => {
      const nodes = [
        makeNode('n1', 'audioInputNode', { audioUrl: 'https://example.com/audio.mp3' }),
        makeNode('n2', 'rhWfNode', { config: {} }),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'audio', 'audio-0')];

      const result = getInputsByHandle('n2', nodes, edges);

      expect(result['audio-0']).toBeDefined();
      expect(result['audio-0']).toHaveLength(1);
      expect(result['audio-0']![0]).toBe('https://example.com/audio.mp3');
    });

    it('ignores any-input handle in getInputsByHandle', () => {
      const nodes = [
        makeNode('n1', 'imageNode', { imageUrl: 'https://example.com/img.png' }),
        makeNode('n2', 'rhAppNode', { config: {} }),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'custom-output', 'any-input')];

      const result = getInputsByHandle('n2', nodes, edges);

      // any-input 不应被收录
      expect(result['any-input']).toBeUndefined();
    });
  });
});