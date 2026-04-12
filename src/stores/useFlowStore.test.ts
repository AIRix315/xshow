// Ref: §4.1 — useFlowStore 测试
import { describe, it, expect, beforeEach } from 'vitest';
import { useFlowStore } from './useFlowStore';
import type { Node, Edge } from '@xyflow/react';

// 创建测试用节点
function makeNode(id: string, type: string): Node {
  return { id, type, position: { x: 0, y: 0 }, data: {} };
}

describe('useFlowStore', () => {
  beforeEach(() => {
    useFlowStore.setState({ nodes: [], edges: [], highlightedNodeId: null });
  });

  describe('addNode / removeNode', () => {
    it('adds a node to the canvas', () => {
      const node = makeNode('n1', 'imageNode');
      useFlowStore.getState().addNode(node);
      expect(useFlowStore.getState().nodes).toHaveLength(1);
      expect(useFlowStore.getState().nodes[0]!.id).toBe('n1');
    });

    it('removes a node and its connected edges', () => {
      const n1 = makeNode('n1', 'imageNode');
      const n2 = makeNode('n2', 'textNode');
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' };

      useFlowStore.getState().addNode(n1);
      useFlowStore.getState().addNode(n2);
      useFlowStore.getState().addEdge(edge);

      useFlowStore.getState().removeNode('n1');

      expect(useFlowStore.getState().nodes).toHaveLength(1);
      expect(useFlowStore.getState().nodes[0]!.id).toBe('n2');
      expect(useFlowStore.getState().edges).toHaveLength(0);
    });
  });

  describe('addEdge / removeEdge', () => {
    it('adds an edge', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' };
      useFlowStore.getState().addEdge(edge);
      expect(useFlowStore.getState().edges).toHaveLength(1);
    });

    it('removes an edge', () => {
      const edge: Edge = { id: 'e1', source: 'n1', target: 'n2' };
      useFlowStore.getState().addEdge(edge);
      useFlowStore.getState().removeEdge('e1');
      expect(useFlowStore.getState().edges).toHaveLength(0);
    });
  });

  describe('updateNodeData', () => {
    it('updates specific fields of node data', () => {
      const node = makeNode('n1', 'imageNode');
      useFlowStore.getState().addNode(node);

      useFlowStore.getState().updateNodeData('n1', { prompt: 'test', loading: true });

      const updated = useFlowStore.getState().nodes.find((n) => n.id === 'n1');
      expect(updated?.data).toEqual({ prompt: 'test', loading: true });
    });

    it('merges data without replacing existing fields', () => {
      const node: Node = { id: 'n1', type: 'textNode', position: { x: 0, y: 0 }, data: { prompt: 'hello', label: 'text' } };
      useFlowStore.getState().addNode(node);

      useFlowStore.getState().updateNodeData('n1', { loading: true });

      const updated = useFlowStore.getState().nodes.find((n) => n.id === 'n1');
      expect(updated?.data).toEqual({ prompt: 'hello', label: 'text', loading: true });
    });
  });

  describe('setHighlightedNode', () => {
    it('sets the highlighted node ID', () => {
      useFlowStore.getState().setHighlightedNode('n1');
      expect(useFlowStore.getState().highlightedNodeId).toBe('n1');
    });

    it('clears the highlighted node', () => {
      useFlowStore.getState().setHighlightedNode('n1');
      useFlowStore.getState().setHighlightedNode(null);
      expect(useFlowStore.getState().highlightedNodeId).toBeNull();
    });
  });

  describe('clearCanvas', () => {
    it('removes all nodes, edges, and highlighted node', () => {
      useFlowStore.getState().addNode(makeNode('n1', 'imageNode'));
      useFlowStore.getState().addEdge({ id: 'e1', source: 'n1', target: 'n2' });
      useFlowStore.getState().setHighlightedNode('n1');

      useFlowStore.getState().clearCanvas();

      expect(useFlowStore.getState().nodes).toHaveLength(0);
      expect(useFlowStore.getState().edges).toHaveLength(0);
      expect(useFlowStore.getState().highlightedNodeId).toBeNull();
    });
  });

  describe('addNodes (batch)', () => {
    it('adds multiple nodes at once', () => {
      const nodes = [
        makeNode('n1', 'textNode'),
        makeNode('n2', 'textNode'),
        makeNode('n3', 'textNode'),
      ];

      useFlowStore.getState().addNodes(nodes);

      expect(useFlowStore.getState().nodes).toHaveLength(3);
      expect(useFlowStore.getState().nodes.map((n) => n.id)).toEqual(['n1', 'n2', 'n3']);
    });

    it('appends nodes to existing nodes', () => {
      useFlowStore.getState().addNode(makeNode('n1', 'imageNode'));

      const nodes = [
        makeNode('n2', 'textNode'),
        makeNode('n3', 'textNode'),
      ];

      useFlowStore.getState().addNodes(nodes);

      expect(useFlowStore.getState().nodes).toHaveLength(3);
      expect(useFlowStore.getState().nodes[0]!.id).toBe('n1');
      expect(useFlowStore.getState().nodes[1]!.id).toBe('n2');
      expect(useFlowStore.getState().nodes[2]!.id).toBe('n3');
    });

    it('adds empty array without changing state', () => {
      useFlowStore.getState().addNode(makeNode('n1', 'imageNode'));

      useFlowStore.getState().addNodes([]);

      expect(useFlowStore.getState().nodes).toHaveLength(1);
    });

    it('works with different node types', () => {
      const nodes = [
        makeNode('n1', 'imageNode'),
        makeNode('n2', 'textNode'),
        makeNode('n3', 'videoNode'),
        makeNode('n4', 'audioNode'),
      ];

      useFlowStore.getState().addNodes(nodes);

      expect(useFlowStore.getState().nodes).toHaveLength(4);
      expect(useFlowStore.getState().nodes.map((n) => n.type)).toEqual(['imageNode', 'textNode', 'videoNode', 'audioNode']);
    });
  });
});