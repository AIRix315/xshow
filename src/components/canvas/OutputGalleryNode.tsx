// Ref: node-banana Output Gallery Node
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OutputGalleryNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';

function OutputGalleryNode({ data, selected }: NodeProps<OutputGalleryNodeType>) {
  const items = data.items ?? [];
  const columns = data.columns ?? 3;

  return (
    <BaseNodeWrapper selected={!!selected} title="图集">
      <Handle type="target" position={Position.Left} id="any" style={{ top: '50%' }} data-handletype="any" />
      <div className="flex flex-col gap-2 p-2 min-w-[220px]">
        <span className="text-[10px] text-text-secondary font-medium">Output Gallery</span>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {items.length > 0 ? (
            items.map((item, i) => (
              <div key={i} className="h-12 bg-surface rounded border border-border flex items-center justify-center text-[9px] text-text-muted">
                {item.type === 'image' ? '🖼' : item.type === 'video' ? '🎬' : item.type === 'audio' ? '🔊' : '📝'}
              </div>
            ))
          ) : (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-surface rounded border border-border" />
            ))
          )}
        </div>
        {items.length > 0 && (
          <span className="text-[9px] text-text-muted text-center">{items.length} 项</span>
        )}
      </div>
    </BaseNodeWrapper>
  );
}

export default memo(OutputGalleryNode);
