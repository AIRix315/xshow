// Ref: node-banana Switch Node
// Store-only 模式：对标 node-banana
import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { SwitchNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

function SwitchNode({ id, data, selected }: NodeProps<SwitchNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  
  // Store-only：直接读 data，不使用 useState
  const enabled = data.enabled ?? true;
  
  const handleToggle = useCallback(() => {
    updateNodeData(id, { enabled: !enabled });
  }, [id, enabled, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} title="开关">
      <Handle type="target" position={Position.Left} id="input" style={{ top: '50%' }} data-handletype="any" />
      <div className="flex flex-col gap-2 p-2 min-w-[160px]">
        <span className="text-[10px] text-text-secondary font-medium">Switch</span>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text">{enabled ? '已启用' : '已禁用'}</span>
          <button
            onClick={handleToggle}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-border'}`}
          >
            <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${enabled ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="on" style={{ top: '35%' }} data-handletype="any" />
      <Handle type="source" position={Position.Right} id="off" style={{ top: '65%' }} data-handletype="any" />
    </BaseNodeWrapper>
  );
}

export default memo(SwitchNode);
