// Ref: @xyflow/react ^12.10 + node-banana WorkflowCanvas.tsx + §6.1 + §6.12 + §6.15
// Ref: §4.2 — 画布状态持久化（保存/加载）
import { useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
} from '@xyflow/react';
import { nodeTypes } from '@/utils/nodeFactory';
import { createNode } from '@/utils/nodeFactory';
import { useFlowStore } from '@/stores/useFlowStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { saveCanvasState, loadCanvasState } from '@/utils/canvasState';
import NodeSidebar from './NodeSidebar';
import '@xyflow/react/dist/style.css';

function FlowCanvasInner() {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const highlightedNodeId = useFlowStore((s) => s.highlightedNodeId);
  const onNodesChange = useFlowStore((s) => s.onNodesChange);
  const onEdgesChange = useFlowStore((s) => s.onEdgesChange);
  const flowAddNode = useFlowStore((s) => s.addNode);
  const addEdge = useFlowStore((s) => s.addEdge);
  const setHighlightedNode = useFlowStore((s) => s.setHighlightedNode);
  const setNodes = useFlowStore((s) => s.setNodes);
  const setEdges = useFlowStore((s) => s.setEdges);
  const currentProjectId = useSettingsStore((s) => s.currentProjectId);
  const reactFlowInstance = useRef<ReturnType<typeof Object> | null>(null);

  // 启动时加载画布状态
  useEffect(() => {
    let cancelled = false;
    loadCanvasState(currentProjectId).then((state) => {
      if (cancelled || !state) return;
      setNodes(state.nodes);
      setEdges(state.edges);
    });
    return () => { cancelled = true; };
  }, [currentProjectId, setNodes, setEdges]);

  // 节点/边变化时自动保存
  useEffect(() => {
    saveCanvasState(currentProjectId, nodes, edges);
  }, [currentProjectId, nodes, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      addEdge({
        id: `${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      });
    },
    [addEdge],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance.current) return;

      const instance = reactFlowInstance.current as { screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number } };
      const position = instance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = createNode(type, position);
      flowAddNode(newNode);
    },
    [flowAddNode],
  );

  const onPaneClick = useCallback(() => {
    setHighlightedNode(null);
  }, [setHighlightedNode]);

  // Ref: §6.12 — 高亮节点样式：应用到 node style 中
  const styledNodes = nodes.map((n) => ({
    ...n,
    style: {
      ...n.style,
      ...(n.id === highlightedNodeId
        ? { outline: '2px solid #3b82f6', outlineOffset: '2px' }
        : {}),
    },
  }));

  return (
    <div className="flex h-full w-full">
      <NodeSidebar reactFlowInstance={null} />
      <div className="flex-1 h-full">
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(instance: unknown) => {
            reactFlowInstance.current = instance;
          }}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-background"
        >
          <Background color="#333" gap={16} />
          <Controls className="bg-surface border-border [&>button]:bg-surface [&>button]:border-border [&>button]:text-text [&>button]:hover:bg-surface-hover" />
          <MiniMap
            nodeColor="#3b82f6"
            maskColor="rgba(0, 0, 0, 0.7)"
            className="bg-surface border-border"
          />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function FlowCanvas() {
  return <FlowCanvasInner />;
}