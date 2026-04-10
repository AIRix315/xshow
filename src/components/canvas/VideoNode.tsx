// Ref: §6.5 — VideoNode 占位，Phase 3 实现
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { VideoNode } from '@/types';
import BaseNodeWrapper from './BaseNode';

function VideoNodeComponent({ data, selected }: NodeProps<VideoNode>) {
  return (
    <BaseNodeWrapper selected={!!selected}>
      <Handle type="target" position={Position.Left} id="video" style={{ top: '50%' }} className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
      <div className="flex flex-col items-center justify-center p-4 text-gray-500 text-xs gap-1">
        <span className="text-lg">🎬</span>
        <span>视频节点（Phase 3）</span>
        {data.prompt && <span className="text-[10px] text-gray-600 truncate max-w-[150px]">{data.prompt}</span>}
      </div>
      <Handle type="source" position={Position.Right} id="video" className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
    </BaseNodeWrapper>
  );
}

export default memo(VideoNodeComponent);