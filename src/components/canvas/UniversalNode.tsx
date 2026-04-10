// Ref: §6.10 — UniversalNode 占位，Phase 5 实现
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { UniversalNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';

function UniversalNodeComponent({ data, selected }: NodeProps<UniversalNodeType>) {
  return (
    <BaseNodeWrapper selected={!!selected}>
      <Handle type="target" position={Position.Left} id="custom-input" style={{ top: '50%' }} className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
      <div className="flex flex-col items-center justify-center p-4 text-gray-500 text-xs gap-1">
        <span className="text-lg">⚙️</span>
        <span>{data.label || '万能节点'}（Phase 5）</span>
        {data.config?.apiUrl && <span className="text-[10px] text-gray-600 truncate max-w-[150px]">{data.config.apiUrl}</span>}
      </div>
      <Handle type="source" position={Position.Right} id="custom-output" className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
    </BaseNodeWrapper>
  );
}

export default memo(UniversalNodeComponent);