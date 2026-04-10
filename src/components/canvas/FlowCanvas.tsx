// Ref: @xyflow/react ^12.10 + node-banana WorkflowCanvas.tsx + §6.1
import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type ReactFlowInstance,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '@/utils/nodeFactory';
import { createNode } from '@/utils/nodeFactory';
import NodeSidebar from './NodeSidebar';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Ref: §6.1 — 空画布初始状态 + DnD 创建节点
function FlowCanvasInner() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => [
      ...eds,
      {
        id: `${connection.source}-${connection.target}`,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      },
    ]);
  }, []);

  // Ref: @xyflow/react DnD — 拖拽创建节点
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowInstance.current) return;

      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = createNode(type, position);
      setNodes((nds) => [...nds, newNode]);
    },
    [],
  );

  return (
    <div className="flex h-full w-full">
      <NodeSidebar reactFlowInstance={reactFlowInstance.current} />
      <div ref={reactFlowWrapper} className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={(instance) => {
            reactFlowInstance.current = instance;
          }}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          className="bg-[#121212]"
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