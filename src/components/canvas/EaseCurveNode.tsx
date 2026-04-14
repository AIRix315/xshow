// Ref: node-banana Ease Curve Node
// Store-only 模式：对标 node-banana
import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EaseCurveNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

const CURVE_PATHS: Record<string, string> = {
  'ease-in': 'M0 40 C0 40 20 40 40 0',
  'ease-out': 'M0 40 C20 0 40 0 40 0',
  'ease-in-out': 'M0 40 C0 0 40 0 40 0',
  linear: 'M0 40 L40 0',
  custom: 'M0 40 Q20 40 40 0',
};

type CurveType = 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear' | 'custom';

function EaseCurveNode({ id, data, selected }: NodeProps<EaseCurveNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  
  // Store-only：直接读 data，不使用 useState
  const curveType = data.curveType ?? 'ease-in-out';
  const path = CURVE_PATHS[curveType] ?? CURVE_PATHS['ease-in-out'];
  
  const handleCurveTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    updateNodeData(id, { curveType: e.target.value as CurveType });
  }, [id, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} title="缓动">
      <Handle type="target" position={Position.Left} id="value" style={{ top: '50%' }} data-handletype="value" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="value" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Value</div>
      <div className="flex flex-col gap-2 p-2 min-w-[180px]">
        <span className="text-[10px] text-text-secondary font-medium">Ease Curve</span>
        <div className="h-16 bg-surface rounded border border-border flex items-center justify-center p-2">
          <svg width="80" height="40" viewBox="0 0 40 40" className="w-full max-w-[80px]">
            <line x1="0" y1="0" x2="0" y2="40" stroke="#444" strokeWidth="0.5" />
            <line x1="0" y1="40" x2="40" y2="40" stroke="#444" strokeWidth="0.5" />
            <path d={path} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
          </svg>
        </div>
        <select
          value={curveType}
          onChange={handleCurveTypeChange}
          className="w-full bg-surface text-text text-xs rounded px-2 py-1 border border-border outline-none"
        >
          <option value="ease-in">ease-in</option>
          <option value="ease-out">ease-out</option>
          <option value="ease-in-out">ease-in-out</option>
          <option value="linear">linear</option>
          <option value="custom">custom</option>
        </select>
      </div>
      <Handle type="source" position={Position.Right} id="value" style={{ top: '50%' }} data-handletype="value" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="value" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Value</div>
    </BaseNodeWrapper>
  );
}

export default memo(EaseCurveNode);
