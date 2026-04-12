// Ref: node-banana Ease Curve Node
import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { EaseCurveNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';

const CURVE_PATHS: Record<string, string> = {
  'ease-in': 'M0 40 C0 40 20 40 40 0',
  'ease-out': 'M0 40 C20 0 40 0 40 0',
  'ease-in-out': 'M0 40 C0 0 40 0 40 0',
  linear: 'M0 40 L40 0',
  custom: 'M0 40 Q20 40 40 0',
};

function EaseCurveNode({ data, selected }: NodeProps<EaseCurveNodeType>) {
  const [curveType, setCurveType] = useState(data.curveType ?? 'ease-in-out');
  const path = CURVE_PATHS[curveType] ?? CURVE_PATHS['ease-in-out'];

  return (
    <BaseNodeWrapper selected={!!selected} title="缓动">
      <Handle type="target" position={Position.Left} id="value" style={{ top: '50%' }} data-handletype="value" />
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
          onChange={(e) => setCurveType(e.target.value as 'ease-in' | 'ease-out' | 'ease-in-out' | 'linear' | 'custom')}
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
    </BaseNodeWrapper>
  );
}

export default memo(EaseCurveNode);
