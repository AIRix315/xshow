// Ref: @xyflow/react ^12.10 + node-banana WorkflowCanvas.tsx
import { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

// Ref: §6.1 — 空画布初始状态
function FlowCanvasInner() {
  const onNodesChange: OnNodesChange = useCallback(() => {
    // Phase 4: implement with useFlowStore
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback(() => {
    // Phase 4: implement with useFlowStore
  }, []);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={initialNodes}
        edges={initialEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
  );
}

export default function FlowCanvas() {
  return <FlowCanvasInner />;
}