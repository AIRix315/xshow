// dataFlow.integration.test.ts
// Cross-node data flow integration tests for omniNode, rhAppNode, rhWfNode
import { describe, it, expect } from 'vitest';
import { getConnectedInputs, getInputsByHandle } from '@/utils/connectedInputs';
import type { Node, Edge } from '@xyflow/react';

function makeNode(id: string, type: string, data: Record<string, unknown> = {}): Node {
  return { id, type, position: { x: 0, y: 0 }, data };
}

function makeEdge(id: string, source: string, target: string, sourceHandle?: string, targetHandle?: string): Edge {
  const edge: Edge = { id, source, target };
  if (sourceHandle) edge.sourceHandle = sourceHandle;
  if (targetHandle) edge.targetHandle = targetHandle;
  return edge;
}

describe('dataFlow — omniNode / rhAppNode / rhWfNode cross-node integration', () => {

  // ========================================================================
  // Group 1: omniNode as downstream — reads from built-in nodes
  // ========================================================================
  describe('Group 1: omniNode as downstream — reads from built-in nodes', () => {
    it('imageNode → omniNode(any-input): getConnectedInputs returns images', () => {
      const nodes = [
        makeNode('img', 'imageNode', { imageUrl: 'https://example.com/test.png' }),
        makeNode('omni', 'omniNode', {}),
      ];
      const edges = [makeEdge('e1', 'img', 'omni', undefined, 'any-input')];

      const result = getConnectedInputs('omni', nodes, edges);

      expect(result.images).toEqual(['https://example.com/test.png']);
    });

    it('textNode → omniNode(any-input): getConnectedInputs returns text', () => {
      const nodes = [
        makeNode('txt', 'textNode', { text: 'hello' }),
        makeNode('omni', 'omniNode', {}),
      ];
      const edges = [makeEdge('e1', 'txt', 'omni', undefined, 'any-input')];

      const result = getConnectedInputs('omni', nodes, edges);

      expect(result.text).toBe('hello');
    });

    it('videoNode → omniNode(any-input): getConnectedInputs returns videos', () => {
      const nodes = [
        makeNode('vid', 'videoNode', { videoUrl: 'https://example.com/video.mp4' }),
        makeNode('omni', 'omniNode', {}),
      ];
      const edges = [makeEdge('e1', 'vid', 'omni', undefined, 'any-input')];

      const result = getConnectedInputs('omni', nodes, edges);

      expect(result.videos).toEqual(['https://example.com/video.mp4']);
    });

    it('audioNode → omniNode(any-input): getConnectedInputs returns audio', () => {
      const nodes = [
        makeNode('aud', 'audioNode', { audioUrl: 'https://example.com/audio.mp3' }),
        makeNode('omni', 'omniNode', {}),
      ];
      const edges = [makeEdge('e1', 'aud', 'omni', undefined, 'any-input')];

      const result = getConnectedInputs('omni', nodes, edges);

      expect(result.audio).toEqual(['https://example.com/audio.mp3']);
    });
  });

  // ========================================================================
  // Group 2: rhAppNode as downstream — reads from built-in nodes
  // ========================================================================
  describe('Group 2: rhAppNode as downstream — reads from built-in nodes', () => {
    it('imageNode → rhAppNode(any-input): getConnectedInputs returns images', () => {
      const nodes = [
        makeNode('img', 'imageNode', { imageUrl: 'https://example.com/img.png' }),
        makeNode('app', 'rhAppNode', {}),
      ];
      const edges = [makeEdge('e1', 'img', 'app', undefined, 'any-input')];

      const result = getConnectedInputs('app', nodes, edges);

      expect(result.images).toEqual(['https://example.com/img.png']);
    });

    it('textNode → rhAppNode(any-input): getConnectedInputs returns text', () => {
      const nodes = [
        makeNode('txt', 'textNode', { text: 'prompt' }),
        makeNode('app', 'rhAppNode', {}),
      ];
      const edges = [makeEdge('e1', 'txt', 'app', undefined, 'any-input')];

      const result = getConnectedInputs('app', nodes, edges);

      expect(result.text).toBe('prompt');
    });

    it('rhAppNode(outputUrl=out.png) → rhAppNode(any-input): inferMediaOutput branch returns images', () => {
      const nodes = [
        makeNode('app1', 'rhAppNode', { outputUrl: 'https://rh.cn/out.png' }),
        makeNode('app2', 'rhAppNode', {}),
      ];
      const edges = [makeEdge('e1', 'app1', 'app2', undefined, 'any-input')];

      const result = getConnectedInputs('app2', nodes, edges);

      expect(result.images).toEqual(['https://rh.cn/out.png']);
    });

    it('omniNode(executionType=comfyui) → rhAppNode(any-input): inferMediaOutput branch for omniNode returns images', () => {
      const nodes = [
        makeNode('omni', 'omniNode', {
          outputUrl: 'https://example.com/out.png',
          config: { executionType: 'comfyui', comfyuiOutputType: 'auto' },
        }),
        makeNode('app', 'rhAppNode', {}),
      ];
      const edges = [makeEdge('e1', 'omni', 'app', undefined, 'any-input')];

      const result = getConnectedInputs('app', nodes, edges);

      expect(result.images).toEqual(['https://example.com/out.png']);
    });
  });

  // ========================================================================
  // Group 3: rhWfNode as downstream — reads from built-in nodes
  // ========================================================================
  describe('Group 3: rhWfNode as downstream — reads from built-in nodes', () => {
    it('imageNode → rhWfNode(any-input): getConnectedInputs returns images', () => {
      const nodes = [
        makeNode('img', 'imageNode', { imageUrl: 'https://example.com/img.png' }),
        makeNode('wf', 'rhWfNode', {}),
      ];
      const edges = [makeEdge('e1', 'img', 'wf', undefined, 'any-input')];

      const result = getConnectedInputs('wf', nodes, edges);

      expect(result.images).toEqual(['https://example.com/img.png']);
    });

    it('rhAppNode(outputUrl=out.png) → rhWfNode(any-input): getConnectedInputs returns images', () => {
      const nodes = [
        makeNode('app', 'rhAppNode', { outputUrl: 'https://rh.cn/out.png' }),
        makeNode('wf', 'rhWfNode', {}),
      ];
      const edges = [makeEdge('e1', 'app', 'wf', undefined, 'any-input')];

      const result = getConnectedInputs('wf', nodes, edges);

      expect(result.images).toEqual(['https://rh.cn/out.png']);
    });

    it('rhWfNode(outputUrl=out.mp4) → rhWfNode(any-input): getConnectedInputs returns videos', () => {
      const nodes = [
        makeNode('wf1', 'rhWfNode', { outputUrl: 'https://rh.cn/out.mp4' }),
        makeNode('wf2', 'rhWfNode', {}),
      ];
      const edges = [makeEdge('e1', 'wf1', 'wf2', undefined, 'any-input')];

      const result = getConnectedInputs('wf2', nodes, edges);

      expect(result.videos).toEqual(['https://rh.cn/out.mp4']);
    });
  });

  // ========================================================================
  // Group 4: Three custom nodes as upstream — output → downstream reads
  // ========================================================================
  describe('Group 4: Three custom nodes as upstream — output → downstream reads', () => {
    it('omniNode with outputUrls → imageNode(image): getConnectedInputs returns all URLs', () => {
      const nodes = [
        makeNode('omni', 'omniNode', {
          outputUrl: 'https://example.com/out.png',
          outputUrls: ['https://example.com/out.png', 'https://example.com/out2.png'],
        }),
        makeNode('img', 'imageNode', {}),
      ];
      const edges = [makeEdge('e1', 'omni', 'img', undefined, 'image')];

      const result = getConnectedInputs('img', nodes, edges);

      expect(result.images).toContain('https://example.com/out.png');
      expect(result.images).toContain('https://example.com/out2.png');
      expect(result.images).toHaveLength(2);
    });

    it('rhAppNode with outputUrls → imageNode(image): getConnectedInputs returns all URLs', () => {
      const nodes = [
        makeNode('app', 'rhAppNode', {
          outputUrl: 'https://rh.cn/out.png',
          outputUrls: ['https://rh.cn/out.png', 'https://rh.cn/out2.png'],
        }),
        makeNode('img', 'imageNode', {}),
      ];
      const edges = [makeEdge('e1', 'app', 'img', undefined, 'image')];

      const result = getConnectedInputs('img', nodes, edges);

      expect(result.images).toContain('https://rh.cn/out.png');
      expect(result.images).toContain('https://rh.cn/out2.png');
      expect(result.images).toHaveLength(2);
    });

    it('rhWfNode(outputUrl=out.mp4) → videoNode: getConnectedInputs returns videos', () => {
      const nodes = [
        makeNode('wf', 'rhWfNode', { outputUrl: 'https://rh.cn/out.mp4' }),
        makeNode('vid', 'videoNode', {}),
      ];
      const edges = [makeEdge('e1', 'wf', 'vid', undefined, 'video')];

      const result = getConnectedInputs('vid', nodes, edges);

      expect(result.videos).toEqual(['https://rh.cn/out.mp4']);
    });
  });

  // ========================================================================
  // Group 5: image-N handle precise mapping
  // ========================================================================
  describe('Group 5: image-N handle precise mapping', () => {
    it('getInputsByHandle returns correct URLs per image-N handle; getConnectedInputs collects any-input', () => {
      const nodes = [
        makeNode('img1', 'imageNode', { imageUrl: 'https://example.com/img1.png' }),
        makeNode('img2', 'imageNode', { imageUrl: 'https://example.com/img2.png' }),
        makeNode('img3', 'imageNode', { imageUrl: 'https://example.com/img3.png' }),
        makeNode('app', 'rhAppNode', {}),
      ];
      const edges = [
        makeEdge('e1', 'img1', 'app', undefined, 'image-0'),
        makeEdge('e2', 'img2', 'app', undefined, 'image-1'),
        makeEdge('e3', 'img3', 'app', undefined, 'any-input'),
      ];

      const byHandle = getInputsByHandle('app', nodes, edges);
      expect(byHandle).toEqual({
        'image-0': ['https://example.com/img1.png'],
        'image-1': ['https://example.com/img2.png'],
      });

      const connected = getConnectedInputs('app', nodes, edges);
      // any-input edge flows through as image type
      expect(connected.images).toContain('https://example.com/img3.png');
    });
  });

  // ========================================================================
  // Group 6: outputType explicit mode
  // ========================================================================
  describe('Group 6: outputType explicit mode', () => {
    it('rhAppNode(outputType=video) → omniNode: getConnectedInputs returns videos not images', () => {
      const nodes = [
        makeNode('app', 'rhAppNode', {
          outputUrl: 'https://rh.cn/out.mp4',
          config: { outputType: 'video' },
        }),
        makeNode('omni', 'omniNode', {}),
      ];
      const edges = [makeEdge('e1', 'app', 'omni', undefined, 'any-input')];

      const result = getConnectedInputs('omni', nodes, edges);

      expect(result.videos).toEqual(['https://rh.cn/out.mp4']);
      expect(result.images).toHaveLength(0);
    });

    it('rhAppNode(outputType=text, textOutput) → omniNode: getConnectedInputs returns text not images', () => {
      const nodes = [
        makeNode('app', 'rhAppNode', {
          outputUrl: 'https://rh.cn/out.png',
          textOutput: 'hello',
          config: { outputType: 'text' },
        }),
        makeNode('omni', 'omniNode', {}),
      ];
      const edges = [makeEdge('e1', 'app', 'omni', undefined, 'any-input')];

      const result = getConnectedInputs('omni', nodes, edges);

      expect(result.text).toBe('hello');
      expect(result.images).toHaveLength(0);
    });
  });

  // ========================================================================
  // Group 7: URL format edge cases
  // ========================================================================
  describe('Group 7: URL format edge cases', () => {
    it('blob URL with .png suffix is detected as image', () => {
      const nodes = [
        makeNode('app', 'rhAppNode', { outputUrl: 'blob:uuid/result.png' }),
        makeNode('omni', 'omniNode', {}),
      ];
      const edges = [makeEdge('e1', 'app', 'omni', undefined, 'any-input')];

      const result = getConnectedInputs('omni', nodes, edges);

      expect(result.images).toEqual(['blob:uuid/result.png']);
    });

    it('/view? URL is detected as image', () => {
      const nodes = [
        makeNode('app', 'rhAppNode', { outputUrl: 'https://rh.cn/api/view?filename=test.png' }),
        makeNode('omni', 'omniNode', {}),
      ];
      const edges = [makeEdge('e1', 'app', 'omni', undefined, 'any-input')];

      const result = getConnectedInputs('omni', nodes, edges);

      expect(result.images).toEqual(['https://rh.cn/api/view?filename=test.png']);
    });
  });

});
