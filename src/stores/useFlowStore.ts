// Ref: Zustand v5 + flowcraft lib/store/ + §4.1 + §4.2 — 节点数据流闭环
// Ref: node-banana workflowStore.ts — BFS 分层执行引擎
import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, type OnNodesChange, type OnEdgesChange, type Node, type Edge } from '@xyflow/react';
import { executeCanvas } from '@/utils/executionEngine';
import { getConnectedInputs } from '@/utils/connectedInputs';
import { getNodeExecutor } from '@/store/execution';

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  highlightedNodeId: string | null;
  // 执行状态
  isRunning: boolean;
  currentNodeIds: string[];
  _abortController: AbortController | null;
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
  // 执行方法
  executeWorkflow: () => Promise<void>;
  stopWorkflow: () => void;
}

type FlowStore = FlowState & FlowActions;

export const useFlowStore = create<FlowStore>()((set, get) => ({
  nodes: [],
  edges: [],
  highlightedNodeId: null,
  isRunning: false,
  currentNodeIds: [],
  _abortController: null,

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

  // BFS 分层执行整个画布
  executeWorkflow: async () => {
    const { nodes, edges, isRunning } = get();

    if (isRunning) {
      console.warn('[executeWorkflow] 已在执行中，忽略请求');
      return;
    }

    const abortController = new AbortController();
    set({ isRunning: true, currentNodeIds: [], _abortController: abortController });

    console.log('[executeWorkflow] 开始执行', { nodeCount: nodes.length, edgeCount: edges.length });

    try {
      await executeCanvas(nodes, edges, {
        // 执行单个节点
        executeNode: async (node, edges, allNodes) => {
          const executor = getNodeExecutor(node.type || '');
          if (!executor) {
            // 没有执行器的节点（如输入节点）跳过
            console.log(`[executeWorkflow] 节点 ${node.id} (${node.type}) 无执行器，跳过`);
            return;
          }

          // 检查中止信号
          if (abortController.signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }

          console.log(`[executeWorkflow] 执行节点 ${node.id} (${node.type})`);

          // 构建执行上下文
          const ctx = {
            node,
            nodes: allNodes,
            edges,
            getConnectedInputs: (nodeId: string) => getConnectedInputs(nodeId, allNodes, edges),
            updateNodeData: (nodeId: string, patch: Record<string, unknown>) => {
              get().updateNodeData(nodeId, patch);
            },
            getFreshNode: (nodeId: string) => get().nodes.find((n) => n.id === nodeId),
            signal: abortController.signal,
          };

          await executor(ctx);
        },

        // 节点开始执行
        onNodeStart: (nodeId) => {
          set((state) => ({
            currentNodeIds: [...state.currentNodeIds, nodeId],
          }));
        },

        // 节点执行完成
        onNodeComplete: (nodeId) => {
          set((state) => ({
            currentNodeIds: state.currentNodeIds.filter((id) => id !== nodeId),
          }));
        },

        // 节点执行错误
        onNodeError: (nodeId, error) => {
          console.error(`[executeWorkflow] 节点 ${nodeId} 执行失败:`, error);
          get().updateNodeData(nodeId, { loading: false, errorMessage: error });
          set((state) => ({
            currentNodeIds: state.currentNodeIds.filter((id) => id !== nodeId),
          }));
        },

        // 层开始
        onLayerStart: (layerIndex, nodeIds) => {
          console.log(`[executeWorkflow] 层 ${layerIndex} 开始:`, nodeIds);
        },
      }, abortController.signal);

      console.log('[executeWorkflow] 执行完成');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('[executeWorkflow] 执行已取消');
      } else {
        console.error('[executeWorkflow] 执行失败:', error);
      }
    } finally {
      set({ isRunning: false, currentNodeIds: [], _abortController: null });
    }
  },

  // 停止执行
  stopWorkflow: () => {
    const controller = get()._abortController;
    if (controller) {
      controller.abort('user-cancelled');
    }
    set({ isRunning: false, currentNodeIds: [], _abortController: null });
    console.log('[stopWorkflow] 执行已停止');
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