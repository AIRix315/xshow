// Ref: §6.8 — GridMergeNode 占位，Phase 3 实现
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GridMergeNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';

function GridMergeNodeComponent({ data, selected }: NodeProps<GridMergeNodeType>) {
  return (
    <BaseNodeWrapper selected={!!selected}>
      <Handle type="target" position={Position.Left} id="merge-input" style={{ top: '50%' }} className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
      <div className="flex flex-col items-center justify-center p-4 text-gray-500 text-xs gap-1">
        <span className="text-lg">🧩</span>
        <span>九宫格拼（Phase 3）</span>
        <span className="text-[10px] text-gray-600">{data.gridCount}×{data.gridCount}</span>
      </div>
      <Handle type="source" position={Position.Right} id="merge-output" className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
    </BaseNodeWrapper>
  );
}

export default memo(GridMergeNodeComponent);