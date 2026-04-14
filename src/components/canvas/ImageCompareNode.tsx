// Ref: node-banana Image Compare Node
// Store-only 模式：对标 node-banana
import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ImageCompareNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

type CompareMode = 'side-by-side' | 'slider' | 'overlay';

function ImageCompareNode({ id, data, selected }: NodeProps<ImageCompareNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  
  // Store-only：直接读 data，不使用 useState
  const mode = (data.mode ?? 'side-by-side') as CompareMode;
  
  const handleModeChange = useCallback((newMode: CompareMode) => {
    updateNodeData(id, { mode: newMode });
  }, [id, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} title="对比">
      <Handle type="target" position={Position.Left} id="image-left" style={{ top: '35%' }} data-handletype="image" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="image" style={{ right: 'calc(100% + 8px)', top: 'calc(35% - 8px)', zIndex: 10 }}>Image</div>
      <Handle type="target" position={Position.Left} id="image-right" style={{ top: '65%' }} data-handletype="image" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="image" style={{ right: 'calc(100% + 8px)', top: 'calc(65% - 8px)', zIndex: 10 }}>Image</div>
      <div className="flex flex-col gap-2 p-2 min-w-[220px]">
        <span className="text-[10px] text-text-secondary font-medium">Image Compare</span>
        <div className="flex gap-1">
          <button onClick={() => handleModeChange('side-by-side')} className={`flex-1 px-1.5 py-0.5 text-[10px] rounded border ${mode === 'side-by-side' ? 'border-primary bg-primary/20 text-primary' : 'border-border text-text-secondary bg-surface'}`}>并排</button>
          <button onClick={() => handleModeChange('slider')} className={`flex-1 px-1.5 py-0.5 text-[10px] rounded border ${mode === 'slider' ? 'border-primary bg-primary/20 text-primary' : 'border-border text-text-secondary bg-surface'}`}>滑块</button>
          <button onClick={() => handleModeChange('overlay')} className={`flex-1 px-1.5 py-0.5 text-[10px] rounded border ${mode === 'overlay' ? 'border-primary bg-primary/20 text-primary' : 'border-border text-text-secondary bg-surface'}`}>叠加</button>
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
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="image" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Image</div>
    </BaseNodeWrapper>
  );
}

export default memo(ImageCompareNode);
