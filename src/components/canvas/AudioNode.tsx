// Ref: §6.6 — AudioNode 占位，Phase 3 实现
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AudioNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';

function AudioNodeComponent({ data, selected }: NodeProps<AudioNodeType>) {
  return (
    <BaseNodeWrapper selected={!!selected}>
      <Handle type="target" position={Position.Left} id="audio" style={{ top: '50%' }} className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
      <div className="flex flex-col items-center justify-center p-4 text-gray-500 text-xs gap-1">
        <span className="text-lg">🎙️</span>
        <span>语音节点（Phase 3）</span>
        {data.audioUrl && <span className="text-[10px] text-gray-600 truncate max-w-[150px]">{data.audioUrl}</span>}
      </div>
      <Handle type="source" position={Position.Right} id="audio" className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
    </BaseNodeWrapper>
  );
}

export default memo(AudioNodeComponent);