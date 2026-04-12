// Ref: node-banana Image Compare Node
import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ImageCompareNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';

function ImageCompareNode({ data, selected }: NodeProps<ImageCompareNodeType>) {
  const [mode, setMode] = useState<'side-by-side' | 'slider' | 'overlay'>(data.mode ? (data.mode as 'side-by-side' | 'slider' | 'overlay') : 'side-by-side');

  return (
    <BaseNodeWrapper selected={!!selected} title="对比">
      <Handle type="target" position={Position.Left} id="image-left" style={{ top: '35%' }} data-handletype="image" />
      <Handle type="target" position={Position.Left} id="image-right" style={{ top: '65%' }} data-handletype="image" />
      <div className="flex flex-col gap-2 p-2 min-w-[220px]">
        <span className="text-[10px] text-text-secondary font-medium">Image Compare</span>
        <div className="flex gap-1">
          <button onClick={() => setMode('side-by-side')} className={`flex-1 px-1.5 py-0.5 text-[10px] rounded border ${mode === 'side-by-side' ? 'border-primary bg-primary/20 text-primary' : 'border-border text-text-secondary bg-surface'}`}>并排</button>
          <button onClick={() => setMode('slider')} className={`flex-1 px-1.5 py-0.5 text-[10px] rounded border ${mode === 'slider' ? 'border-primary bg-primary/20 text-primary' : 'border-border text-text-secondary bg-surface'}`}>滑块</button>
          <button onClick={() => setMode('overlay')} className={`flex-1 px-1.5 py-0.5 text-[10px] rounded border ${mode === 'overlay' ? 'border-primary bg-primary/20 text-primary' : 'border-border text-text-secondary bg-surface'}`}>叠加</button>
        </div>
        <div className="flex gap-1">
          <div className="h-16 flex-1 bg-surface rounded border border-border flex items-center justify-center text-[10px] text-text-muted">
            {data.imageLeft ? '图片 A' : '等待左图'}
          </div>
          <div className="h-16 flex-1 bg-surface rounded border border-border flex items-center justify-center text-[10px] text-text-muted">
            {data.imageRight ? '图片 B' : '等待右图'}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="image" style={{ top: '50%' }} data-handletype="image" />
    </BaseNodeWrapper>
  );
}

export default memo(ImageCompareNode);
