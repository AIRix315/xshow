// Ref: node-banana Router Node
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { RouterNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';

function RouterNode({ data, selected }: NodeProps<RouterNodeType>) {
  const outputCount = data.outputCount ?? 3;

  return (
    <BaseNodeWrapper selected={!!selected} title="路由">
      <Handle type="target" position={Position.Left} id="input" style={{ top: '50%' }} data-handletype="any" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="any" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Any</div>
      <div className="flex flex-col gap-2 p-2 min-w-[160px]">
        <span className="text-[10px] text-text-secondary font-medium">Router</span>
        <div className="text-[10px] text-text-muted text-center">分发到 {outputCount} 个输出</div>
        <div className="h-8 bg-surface rounded border border-border flex items-center justify-center text-[10px] text-text-muted">
          {data.inputValue ? String(data.inputValue).slice(0, 30) : '等待输入'}
        </div>
      </div>
      {Array.from({ length: outputCount }).map((_, i) => (
        <Handle
          key={`output-${i}`}
          type="source"
          position={Position.Right}
          id={`output-${i}`}
          style={{ top: `${((i + 1) / (outputCount + 1)) * 100}%` }}
          data-handletype="any"
        />
      ))}
    </BaseNodeWrapper>
  );
}

export default memo(RouterNode);
