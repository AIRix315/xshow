// Ref: Zustand v5 + flowcraft lib/store/ + §4.1 + §4.2 — 节点数据流闭环
// Ref: node-banana workflowStore.ts — BFS 分层执行引擎
import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, type OnNodesChange, type OnEdgesChange, type Node, type Edge } from '@xyflow/react';
import { executeCanvas } from '@/utils/executionEngine';
import { getConnectedInputs } from '@/utils/connectedInputs';
import { getNodeExecutor } from '@/store/execution';
import { exportProjectFile } from '@/utils/projectManager';
import { saveProjectWithPatch } from '@/utils/patchManager';
import { fsManager } from '@/utils/fileSystemAccess';
import type { AppNode } from '@/types';

/** 深拷贝（剥离响应式 + 防止循环引用问题） */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

interface FlowState {
  nodes: Node[];
  edges: Edge[];
  highlightedNodeId: string | null;
  // 执行状态
  isRunning: boolean;
  currentNodeIds: string[];
  _abortController: AbortController | null;
  // 撤销/重做
  _undoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  _redoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  // 复制/粘贴
  _clipboard: Array<{ nodes: Node[]; edges: Edge[] }>;
  // 项目保存状态
  hasUnsavedChanges: boolean;
  lastSavedAt: number | null;
  isSaving: boolean;
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
  // 撤销/重做
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  // 复制/粘贴
  copySelectedNodes: (selectedNodeIds: string[]) => void;
  pasteNodes: () => void;
  // 执行方法
  executeWorkflow: () => Promise<void>;
  stopWorkflow: () => void;
  // 项目保存
  saveProject: (projectId: string, projectName: string, embedBase64: boolean) => Promise<boolean>;
  loadProject: (nodes: Node[], edges: Edge[], lastSavedAt?: number | null) => void;
  markDirty: () => void;
  markClean: () => void;
}

type FlowStore = FlowState & FlowActions;

export const useFlowStore = create<FlowStore>()((set, get) => ({
  nodes: [],
  edges: [],
  highlightedNodeId: null,
  isRunning: false,
  currentNodeIds: [],
  _abortController: null,
  _undoStack: [],
  _redoStack: [],
  _clipboard: [],
  hasUnsavedChanges: false,
  lastSavedAt: null,
  isSaving: false,

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      hasUnsavedChanges: true,
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      hasUnsavedChanges: true,
    }));
  },

  addNode: (node) => {
    set((state) => ({
      nodes: [...state.nodes, node],
      hasUnsavedChanges: true,
    }));
  },

  addNodes: (nodes) => {
    set((state) => ({
      nodes: [...state.nodes, ...nodes],
      hasUnsavedChanges: true,
    }));
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      hasUnsavedChanges: true,
    }));
  },

  updateNodeData: (id, patch) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
      ),
      hasUnsavedChanges: true,
    }));
  },

  addEdge: (edge) => {
    set((state) => {
      // 防止重复添加相同ID的边
      if (state.edges.some((e) => e.id === edge.id)) {
        return state;
      }
      return {
        edges: [...state.edges, edge],
        hasUnsavedChanges: true,
      };
    });
  },

  removeEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
      hasUnsavedChanges: true,
    }));
  },

  setHighlightedNode: (id) => {
    set({ highlightedNodeId: id });
  },

  setNodes: (nodes) => {
    set({ nodes, hasUnsavedChanges: true });
  },

  setEdges: (edges) => {
    set({ edges, hasUnsavedChanges: true });
  },

  clearCanvas: () => {
    set({ nodes: [], edges: [], highlightedNodeId: null, hasUnsavedChanges: true });
  },

  // ==================== 撤销/重做 ====================

  /** 将当前状态压入撤销栈 */
  pushUndo: () => {
    const { nodes, edges } = get();
    set((s) => ({
      _undoStack: [...s._undoStack, { nodes: deepClone(nodes), edges: deepClone(edges) }].slice(-50),
      _redoStack: [], // 新操作清空重做栈
    }));
  },

  /** 撤销 */
  undo: () => {
    const { _undoStack, nodes, edges } = get();
    if (_undoStack.length === 0) return;
    const prev = _undoStack[_undoStack.length - 1]!;
    set({
      nodes: prev.nodes,
      edges: prev.edges,
      _undoStack: _undoStack.slice(0, -1),
      _redoStack: [...get()._redoStack, { nodes: deepClone(nodes), edges: deepClone(edges) }].slice(-50),
      hasUnsavedChanges: true,
    });
  },

  /** 重做 */
  redo: () => {
    const { _redoStack, nodes, edges } = get();
    if (_redoStack.length === 0) return;
    const next = _redoStack[_redoStack.length - 1]!;
    set({
      nodes: next.nodes,
      edges: next.edges,
      _redoStack: _redoStack.slice(0, -1),
      _undoStack: [...get()._undoStack, { nodes: deepClone(nodes), edges: deepClone(edges) }].slice(-50),
      hasUnsavedChanges: true,
    });
  },

  // ==================== 复制/粘贴 ====================

  /** 复制选中节点及其边 */
  copySelectedNodes: (selectedNodeIds) => {
    const { nodes, edges } = get();
    const clonedNodes = nodes
      .filter((n) => selectedNodeIds.includes(n.id))
      .map((n) => deepClone(n));
    const nodeIdSet = new Set(selectedNodeIds);
    const clonedEdges = edges
      .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map((e) => deepClone(e));
    set({ _clipboard: [{ nodes: clonedNodes, edges: clonedEdges }] });
  },

  /** 粘贴剪贴板节点（带偏移） */
  pasteNodes: () => {
    const { _clipboard, nodes, edges } = get();
    if (_clipboard.length === 0) return;
    const latest = _clipboard[_clipboard.length - 1]!;
    if (latest.nodes.length === 0) return;

    const offset = 50;
    const idMap = new Map<string, string>();
    const newNodes = latest.nodes.map((n) => {
      const newId = `${n.type ?? 'node'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      idMap.set(n.id, newId);
      return { ...deepClone(n), id: newId, position: { x: n.position.x + offset, y: n.position.y + offset } };
    });
    const newEdges = latest.edges.map((e) => {
      const newSource = idMap.get(e.source) ?? e.source;
      const newTarget = idMap.get(e.target) ?? e.target;
      return { ...deepClone(e), id: `${newSource}-${newTarget}-${Date.now()}`, source: newSource, target: newTarget };
    });
    set({
      nodes: [...nodes, ...newNodes],
      edges: [...edges, ...newEdges],
      hasUnsavedChanges: true,
    });
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

        // 节点被跳过（fail-fast 上游失败）
        onNodeSkipped: (nodeId, reason) => {
          console.warn(`[executeWorkflow] 节点 ${nodeId} 被跳过:`, reason);
          get().updateNodeData(nodeId, { loading: false });
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

  // 项目保存：保存到文件系统项目目录
  saveProject: async (projectId, projectName, embedBase64) => {
    const { nodes, edges } = get();
    set({ isSaving: true });
    try {
      // 保存到文件系统
      if (fsManager.hasProjectDirectory()) {
        const success = await saveProjectWithPatch(projectId, projectName, nodes as AppNode[], edges, embedBase64);
        if (success) {
          set({ hasUnsavedChanges: false, lastSavedAt: Date.now() });
        }
        return success;
      } else {
        // 没有设置目录时，使用浏览器下载
        const downloadSuccess = await exportProjectFile(
          projectId,
          projectName,
          nodes as AppNode[],
          edges,
          embedBase64,
        );
        if (downloadSuccess) {
          set({ hasUnsavedChanges: false, lastSavedAt: Date.now() });
        }
        return downloadSuccess;
      }
    } finally {
      set({ isSaving: false });
    }
  },

  // 项目加载：替换当前画布数据
  loadProject: (nodes, edges, lastSavedAt) => {
    set({
      nodes,
      edges,
      hasUnsavedChanges: false,
      lastSavedAt: lastSavedAt ?? null,
    });
  },

  // 标记为有未保存更改
  markDirty: () => {
    set({ hasUnsavedChanges: true });
  },

  // 标记为已保存
  markClean: () => {
    set({ hasUnsavedChanges: false, lastSavedAt: Date.now() });
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