// Ref: node-banana ReferenceEdge.tsx — 参考连接线（视觉连接，非数据流）
// 虚线灰色，用于 GridSplitNode → 子节点的参考关联
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

export default function ReferenceEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        stroke: '#6b7280',
        strokeWidth: 2,
        strokeDasharray: '6 4',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }}
    />
  );
}