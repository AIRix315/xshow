// Ref: connectedInputs.ts — 核心数据流函数测试
import { describe, it, expect } from 'vitest';
import { getConnectedInputs, getUpstreamNodes, isVideoHandle, isAudioHandle } from './connectedInputs';
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
          config: { outputType: 'text' }, // 即使配置是 text，URL 扩展名优先
        }),
        makeNode('n2', 'outputNode'),
      ];
      const edges = [makeEdge('e1', 'n1', 'n2')];

      const result = getConnectedInputs('n2', nodes, edges);

      expect(result.images).toHaveLength(1);
      expect(result.images[0]).toBe('https://example.com/output.jpg');
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
});