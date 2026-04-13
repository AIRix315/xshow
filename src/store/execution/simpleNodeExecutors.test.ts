// Ref: simpleNodeExecutors.ts — 简单节点执行器测试
import { describe, it, expect, vi } from 'vitest';
import {
  executeOutput,
  executeOutputGallery,
  executeImageInput,
  executeVideoInput,
  executeAudioInput,
  executeTextInput,
  executeCrop,
  executeFrameGrab,
  executeVideoTrim,
  executeVideoStitch,
  executeImageCompare,
} from './simpleNodeExecutors';
import type { NodeExecutionContext } from './types';
import type { ConnectedInputs } from '@/utils/connectedInputs';
import type { Node, Edge } from '@xyflow/react';

// Mock helper
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

function makeEdge(id: string, source: string, target: string, targetHandle?: string): Edge {
  const edge: Edge = { id, source, target };
  if (targetHandle) edge.targetHandle = targetHandle;
  return edge;
}

describe('simpleNodeExecutors', () => {
  describe('executeOutput', () => {
    it('updates output node with upstream data', async () => {
      const node = makeNode('out', 'outputNode');
      const ctx = makeContext(node, [node], [], {
        images: ['https://example.com/img.png'],
        videos: ['https://example.com/vid.mp4'],
        audio: ['https://example.com/aud.mp3'],
        text: 'Hello',
        textItems: [],
        model3d: null,
      });

      await executeOutput(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('out', {
        inputImageUrl: 'https://example.com/img.png',
        inputVideoUrl: 'https://example.com/vid.mp4',
        inputAudioUrl: 'https://example.com/aud.mp3',
        inputValue: 'Hello',
      });
    });

    it('sets null when no upstream data', async () => {
      const node = makeNode('out', 'outputNode');
      const ctx = makeContext(node, [node], []);

      await executeOutput(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('out', {
        inputImageUrl: null,
        inputVideoUrl: null,
        inputAudioUrl: null,
        inputValue: null,
      });
    });

    it('handles first image only from multiple', async () => {
      const node = makeNode('out', 'outputNode');
      const ctx = makeContext(node, [node], [], {
        images: ['img1.png', 'img2.png'],
        videos: [],
        audio: [],
        text: null,
        textItems: [],
        model3d: null,
      });

      await executeOutput(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('out', {
        inputImageUrl: 'img1.png',
        inputVideoUrl: null,
        inputAudioUrl: null,
        inputValue: null,
      });
    });
  });

  describe('executeOutputGallery', () => {
    it('builds items array from all upstream media', async () => {
      const node = makeNode('gallery', 'outputGalleryNode');
      const ctx = makeContext(node, [node], [], {
        images: ['img1.png', 'img2.png'],
        videos: ['vid1.mp4'],
        audio: ['aud1.mp3'],
        text: null,
        textItems: [],
        model3d: null,
      });

      await executeOutputGallery(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('gallery', {
        items: [
          { type: 'image', url: 'img1.png' },
          { type: 'image', url: 'img2.png' },
          { type: 'video', url: 'vid1.mp4' },
          { type: 'audio', url: 'aud1.mp3' },
        ],
      });
    });

    it('creates empty items when no upstream data', async () => {
      const node = makeNode('gallery', 'outputGalleryNode');
      const ctx = makeContext(node, [node], []);

      await executeOutputGallery(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('gallery', {
        items: [],
      });
    });
  });

  describe('executeImageInput', () => {
    it('updates imageUrl from upstream', async () => {
      const node = makeNode('input', 'imageInputNode', { imageUrl: 'local.png', filename: 'local.png' });
      const ctx = makeContext(node, [node], [], {
        images: ['upstream.png'],
        videos: [],
        audio: [],
        text: null,
        textItems: [],
        model3d: null,
      });

      await executeImageInput(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('input', {
        imageUrl: 'upstream.png',
        filename: undefined,
      });
    });

    it('keeps local data when no upstream', async () => {
      const node = makeNode('input', 'imageInputNode', { imageUrl: 'local.png', filename: 'local.png' });
      const ctx = makeContext(node, [node], []);

      await executeImageInput(ctx);

      // Should not call updateNodeData (no upstream data)
      expect(ctx.updateNodeData).not.toHaveBeenCalled();
    });
  });

  describe('executeVideoInput', () => {
    it('updates videoUrl from upstream', async () => {
      const node = makeNode('input', 'videoInputNode', { videoUrl: 'local.mp4', filename: 'local.mp4' });
      const ctx = makeContext(node, [node], [], {
        images: [],
        videos: ['upstream.mp4'],
        audio: [],
        text: null,
        textItems: [],
        model3d: null,
      });

      await executeVideoInput(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('input', {
        videoUrl: 'upstream.mp4',
        filename: undefined,
      });
    });

    it('does nothing when no upstream video', async () => {
      const node = makeNode('input', 'videoInputNode', { videoUrl: 'local.mp4' });
      const ctx = makeContext(node, [node], []);

      await executeVideoInput(ctx);

      expect(ctx.updateNodeData).not.toHaveBeenCalled();
    });
  });

  describe('executeAudioInput', () => {
    it('updates audioUrl from upstream', async () => {
      const node = makeNode('input', 'audioInputNode', { audioUrl: 'local.mp3', audioName: 'local.mp3' });
      const ctx = makeContext(node, [node], [], {
        images: [],
        videos: [],
        audio: ['upstream.mp3'],
        text: null,
        textItems: [],
        model3d: null,
      });

      await executeAudioInput(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('input', {
        audioUrl: 'upstream.mp3',
        audioName: undefined,
      });
    });
  });

  describe('executeTextInput', () => {
    it('updates text from upstream', async () => {
      const node = makeNode('input', 'textInputNode', { text: 'old text' });
      const ctx = makeContext(node, [node], [], {
        images: [],
        videos: [],
        audio: [],
        text: 'new upstream text',
        textItems: [],
        model3d: null,
      });

      await executeTextInput(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('input', {
        text: 'new upstream text',
      });
    });

    it('does nothing when no upstream text', async () => {
      const node = makeNode('input', 'textInputNode', { text: 'existing' });
      const ctx = makeContext(node, [node], []);

      await executeTextInput(ctx);

      expect(ctx.updateNodeData).not.toHaveBeenCalled();
    });
  });

  describe('executeCrop', () => {
    it('updates sourceImageUrl from upstream', async () => {
      const node = makeNode('crop', 'cropNode', { sourceImageUrl: 'old.png' });
      const ctx = makeContext(node, [node], [], {
        images: ['source.png'],
        videos: [],
        audio: [],
        text: null,
        textItems: [],
        model3d: null,
      });

      await executeCrop(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('crop', {
        sourceImageUrl: 'source.png',
      });
    });
  });

  describe('executeFrameGrab', () => {
    it('updates inputVideoUrl from upstream', async () => {
      const node = makeNode('frame', 'frameGrabNode');
      const ctx = makeContext(node, [node], [], {
        images: [],
        videos: ['video.mp4'],
        audio: [],
        text: null,
        textItems: [],
        model3d: null,
      });

      await executeFrameGrab(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('frame', {
        inputVideoUrl: 'video.mp4',
      });
    });
  });

  describe('executeVideoTrim', () => {
    it('updates inputVideoUrl from upstream', async () => {
      const node = makeNode('trim', 'videoTrimNode');
      const ctx = makeContext(node, [node], [], {
        images: [],
        videos: ['source.mp4'],
        audio: [],
        text: null,
        textItems: [],
        model3d: null,
      });

      await executeVideoTrim(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('trim', {
        inputVideoUrl: 'source.mp4',
      });
    });
  });

  describe('executeVideoStitch', () => {
    it('collects videoUrls from all upstream nodes', async () => {
      const node = makeNode('stitch', 'videoStitchNode');
      const source1 = makeNode('s1', 'videoNode', { videoUrl: 'vid1.mp4' });
      const source2 = makeNode('s2', 'videoNode', { videoUrl: 'vid2.mp4' });
      const edges = [
        makeEdge('e1', 's1', 'stitch'),
        makeEdge('e2', 's2', 'stitch'),
      ];

      const ctx = makeContext(node, [node, source1, source2], edges);

      await executeVideoStitch(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('stitch', {
        videoUrls: ['vid1.mp4', 'vid2.mp4'],
      });
    });

    it('handles single upstream video', async () => {
      const node = makeNode('stitch', 'videoStitchNode');
      const source = makeNode('s1', 'videoNode', { videoUrl: 'single.mp4' });
      const edges = [makeEdge('e1', 's1', 'stitch')];

      const ctx = makeContext(node, [node, source], edges);

      await executeVideoStitch(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('stitch', {
        videoUrls: ['single.mp4'],
      });
    });
  });

  describe('executeImageCompare', () => {
    it('updates left and right images based on handle', async () => {
      const node = makeNode('compare', 'imageCompareNode');
      const leftSource = makeNode('left', 'imageNode', { imageUrl: 'left.png' });
      const rightSource = makeNode('right', 'imageNode', { imageUrl: 'right.png' });
      const edges = [
        makeEdge('e1', 'left', 'compare', 'image-left'),
        makeEdge('e2', 'right', 'compare', 'image-right'),
      ];

      const ctx = makeContext(node, [node, leftSource, rightSource], edges);

      await executeImageCompare(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('compare', { imageLeft: 'left.png' });
      expect(ctx.updateNodeData).toHaveBeenCalledWith('compare', { imageRight: 'right.png' });
    });

    it('only updates the side with connected edge', async () => {
      const node = makeNode('compare', 'imageCompareNode');
      const leftSource = makeNode('left', 'imageNode', { imageUrl: 'left.png' });
      const edges = [makeEdge('e1', 'left', 'compare', 'image-left')];

      const ctx = makeContext(node, [node, leftSource], edges);

      await executeImageCompare(ctx);

      expect(ctx.updateNodeData).toHaveBeenCalledWith('compare', { imageLeft: 'left.png' });
      expect(ctx.updateNodeData).not.toHaveBeenCalledWith('compare', { imageRight: expect.any(String) });
    });
  });
});