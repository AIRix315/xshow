// Ref: Zustand v5 + flowcraft lib/store/ + §4.1 + §4.2 — 节点数据流闭环
import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, type OnNodesChange, type OnEdgesChange, type Node, type Edge } from '@xyflow/react';

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  highlightedNodeId: string | null;
}

interface FlowActions {
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  addNode: (node: Node) => void;
  addNodes: (nodes: Node[]) => void;
  removeNode: (id: string) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  addEdge: (edge: Edge) => void;
  removeEdge: (id: string) => void;
  setHighlightedNode: (id: string | null) => void;
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;
  clearCanvas: () => void;
}

type FlowStore = FlowState & FlowActions;

export const useFlowStore = create<FlowStore>()((set) => ({
  nodes: [],
  edges: [],
  highlightedNodeId: null,

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  addNode: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
    }));
  },

  addNodes: (nodes) => {
    set((state) => ({
      nodes: [...state.nodes, ...nodes],
    }));
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
    }));
  },

  updateNodeData: (id, patch) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
      ),
    }));
  },

  addEdge: (edge) => {
    set((state) => ({
      edges: [...state.edges, edge],
    }));
  },

  removeEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    }));
  },

  setHighlightedNode: (id) => {
    set({ highlightedNodeId: id });
  },

  setNodes: (nodes) => {
    set({ nodes });
  },

  setEdges: (edges) => {
    set({ edges });
  },

  clearCanvas: () => {
    set({ nodes: [], edges: [], highlightedNodeId: null });
  },
}));

/**
 * 获取指定节点的全部上游节点数据（按边连接关系）。
 * 在组件中使用：const upstream = useFlowStore(useFlowStore.getState().getUpstreamNodes);
 * 或直接调用：getUpstreamNodes(nodeId)
 */
export function getUpstreamNodes(nodeId: string): Array<{ edge: Edge; node: Node }> {
  const { nodes, edges } = useFlowStore.getState();
  const incomingEdges = edges.filter((e: Edge) => e.target === nodeId);
  return incomingEdges.map((edge: Edge) => {
    const sourceNode = nodes.find((n: Node) => n.id === edge.source);
    if (!sourceNode) return null;
    return { edge, node: sourceNode };
  }).filter((item: { edge: Edge; node: Node } | null): item is { edge: Edge; node: Node } => item !== null);
}