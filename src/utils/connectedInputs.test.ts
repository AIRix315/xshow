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

    // ========================================================================
    // P0 Bug fix — bare handle IDs (image, first-frame, last-frame)
    // ========================================================================
    it('collects bare "image" handle input (no dash suffix)', () => {
      const nodes = [
        makeNode('n1', 'imageNode', { imageUrl: 'https://example.com/ref.png' }),
        makeNode('n2', 'videoNode', {}),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'image', 'image')];

      const result = getInputsByHandle('n2', nodes, edges);

      expect(result['image']).toBeDefined();
      expect(result['image']).toHaveLength(1);
      expect(result['image']![0]).toBe('https://example.com/ref.png');
    });

    it('collects "first-frame" handle input (image-to-video mode)', () => {
      const nodes = [
        makeNode('n1', 'imageNode', { imageUrl: 'https://example.com/first.png' }),
        makeNode('n2', 'videoNode', {}),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'image', 'first-frame')];

      const result = getInputsByHandle('n2', nodes, edges);

      expect(result['first-frame']).toBeDefined();
      expect(result['first-frame']).toHaveLength(1);
      expect(result['first-frame']![0]).toBe('https://example.com/first.png');
    });

    it('collects "last-frame" handle input (start-end-to-video mode)', () => {
      const nodes = [
        makeNode('n1', 'imageNode', { imageUrl: 'https://example.com/last.png' }),
        makeNode('n2', 'videoNode', {}),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'image', 'last-frame')];

      const result = getInputsByHandle('n2', nodes, edges);

      expect(result['last-frame']).toBeDefined();
      expect(result['last-frame']).toHaveLength(1);
      expect(result['last-frame']![0]).toBe('https://example.com/last.png');
    });

    it('excludes "text" handle from getInputsByHandle', () => {
      const nodes = [
        makeNode('n1', 'textNode', { text: 'hello' }),
        makeNode('n2', 'videoNode', {}),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'text', 'text')];

      const result = getInputsByHandle('n2', nodes, edges);

      expect(result['text']).toBeUndefined();
    });

    it('complete image-to-video scenario: imageNode(image) → videoNode(image)', () => {
      const nodes = [
        makeNode('img', 'imageNode', { imageUrl: 'https://example.com/ref.png' }),
        makeNode('txt', 'textNode', { text: 'A cat walking' }),
        makeNode('vid', 'videoNode', {}),
      ];
      const edges = [
        makeEdge('e1', 'img', 'vid', 'image', 'image'),
        makeEdge('e2', 'txt', 'vid', 'text', 'text'),
      ];

      const byHandle = getInputsByHandle('vid', nodes, edges);

      // image handle should collect reference image
      expect(byHandle['image']).toBeDefined();
      expect(byHandle['image']).toHaveLength(1);
      expect(byHandle['image']![0]).toBe('https://example.com/ref.png');
      // text handle should be excluded
      expect(byHandle['text']).toBeUndefined();
    });

    it('complete start-end-to-video scenario: two imageNodes → videoNode', () => {
      const nodes = [
        makeNode('img1', 'imageNode', { imageUrl: 'https://example.com/first.png' }),
        makeNode('img2', 'imageNode', { imageUrl: 'https://example.com/last.png' }),
        makeNode('txt', 'textNode', { text: 'Transition' }),
        makeNode('vid', 'videoNode', {}),
      ];
      const edges = [
        makeEdge('e1', 'img1', 'vid', 'image', 'first-frame'),
        makeEdge('e2', 'img2', 'vid', 'image', 'last-frame'),
        makeEdge('e3', 'txt', 'vid', 'text', 'text'),
      ];

      const byHandle = getInputsByHandle('vid', nodes, edges);

      expect(byHandle['first-frame']).toBeDefined();
      expect(byHandle['first-frame']![0]).toBe('https://example.com/first.png');
      expect(byHandle['last-frame']).toBeDefined();
      expect(byHandle['last-frame']![0]).toBe('https://example.com/last.png');
      // text excluded
      expect(byHandle['text']).toBeUndefined();
    });

    // ========================================================================
    // P1 — CustomInputHandle declarative routing
    // ========================================================================
    it('routes "custom-image-0" handle via customInputHandles declaration', () => {
      const nodes = [
        makeNode('n1', 'imageNode', { imageUrl: 'https://example.com/custom.png' }),
        makeNode('n2', 'videoNode', {
          customInputHandles: [{ id: 'custom-image-0', type: 'image' }],
        }),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'image', 'custom-image-0')];

      const result = getInputsByHandle('n2', nodes, edges);

      expect(result['custom-image-0']).toBeDefined();
      expect(result['custom-image-0']).toHaveLength(1);
      expect(result['custom-image-0']![0]).toBe('https://example.com/custom.png');
    });

    it('routes "custom-audio-0" handle via customInputHandles declaration', () => {
      const nodes = [
        makeNode('n1', 'audioInputNode', { audioUrl: 'https://example.com/ref.mp3' }),
        makeNode('n2', 'audioNode', {
          customInputHandles: [{ id: 'custom-audio-0', type: 'audio' }],
        }),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'audio', 'custom-audio-0')];

      const result = getInputsByHandle('n2', nodes, edges);

      expect(result['custom-audio-0']).toBeDefined();
      expect(result['custom-audio-0']).toHaveLength(1);
      expect(result['custom-audio-0']![0]).toBe('https://example.com/ref.mp3');
    });

    it('routes "custom-video-0" handle via customInputHandles declaration', () => {
      const nodes = [
        makeNode('n1', 'videoNode', { videoUrl: 'https://example.com/ref.mp4' }),
        makeNode('n2', 'videoNode', {
          customInputHandles: [{ id: 'custom-video-0', type: 'video' }],
        }),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2', 'video', 'custom-video-0')];

      const result = getInputsByHandle('n2', nodes, edges);

      expect(result['custom-video-0']).toBeDefined();
      expect(result['custom-video-0']).toHaveLength(1);
      expect(result['custom-video-0']![0]).toBe('https://example.com/ref.mp4');
    });

    it('omniNode(any-output) → videoNode(custom-image-0): declarative routing handles any→image', () => {
      const nodes = [
        makeNode('omni', 'omniNode', {
          outputUrl: 'https://example.com/omni-out.png',
          config: { outputType: 'auto' },
        }),
        makeNode('vid', 'videoNode', {
          customInputHandles: [{ id: 'custom-image-0', type: 'image', label: '参考图' }],
        }),
      ];
      const edges = [makeEdge('e1', 'omni', 'vid', 'custom-output', 'custom-image-0')];

      const result = getInputsByHandle('vid', nodes, edges);

      expect(result['custom-image-0']).toBeDefined();
      expect(result['custom-image-0']).toHaveLength(1);
      expect(result['custom-image-0']![0]).toBe('https://example.com/omni-out.png');
    });

    it('rhAppNode(any-output) → videoNode(image): any→image routing', () => {
      const nodes = [
        makeNode('app', 'rhAppNode', {
          outputUrl: 'https://rh.cn/app-out.png',
          config: { outputType: 'image' },
        }),
        makeNode('vid', 'videoNode', {}),
      ];
      const edges = [makeEdge('e1', 'app', 'vid', 'any-output', 'image')];

      const result = getInputsByHandle('vid', nodes, edges);

      expect(result['image']).toBeDefined();
      expect(result['image']).toHaveLength(1);
      expect(result['image']![0]).toBe('https://rh.cn/app-out.png');
    });
  });
});