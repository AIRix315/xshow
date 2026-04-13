// Ref: node-banana PromptConstructor Node
// Store-only 模式：对标 node-banana
import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { PromptConstructorNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

interface PromptPart {
  id: string;
  text: string;
  enabled: boolean;
}

function PromptConstructorNode({ id, data, selected }: NodeProps<PromptConstructorNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  
  // Store-only：直接读 data，不使用 useState
  const parts = (data.parts ?? [{ id: '1', text: '', enabled: true }]) as PromptPart[];
  const combined = parts.filter((p) => p.enabled && p.text.trim()).map((p) => p.text).join('\n');

  const addPart = useCallback(() => {
    updateNodeData(id, { parts: [...parts, { id: Date.now().toString(), text: '', enabled: true }] });
  }, [id, parts, updateNodeData]);

  const removePart = useCallback((partId: string) => {
    if (parts.length <= 1) return;
    updateNodeData(id, { parts: parts.filter((p) => p.id !== partId) });
  }, [id, parts, updateNodeData]);

  const updatePart = useCallback((partId: string, patch: Partial<PromptPart>) => {
    updateNodeData(id, { parts: parts.map((p) => (p.id === partId ? { ...p, ...patch } : p)) });
  }, [id, parts, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} title="构造">
      <Handle type="target" position={Position.Left} id="text" style={{ top: '50%' }} data-handletype="text" />
      <div className="flex flex-col gap-2 p-2 min-w-[220px]">
        <span className="text-[10px] text-text-secondary font-medium">提示词构造器</span>
        {parts.map((part) => (
          <div key={part.id} className="flex items-start gap-1">
            <input
              type="checkbox"
              checked={part.enabled}
              onChange={(e) => updatePart(part.id, { enabled: e.target.checked })}
              className="accent-primary mt-1.5 shrink-0"
            />
            <textarea
              value={part.text}
              onChange={(e) => updatePart(part.id, { text: e.target.value })}
              placeholder="片段..."
              className="flex-1 bg-surface text-text text-[11px] rounded p-1.5 resize-none border border-border focus:border-primary outline-none"
              rows={2}
            />
            <button onClick={() => removePart(part.id)} className="text-red-500 text-[10px] mt-1 shrink-0">×</button>
          </div>
        ))}
        <button onClick={addPart} className="text-[10px] text-primary hover:text-primary-hover text-left">+ 添加片段</button>
        {combined && (
          <div className="bg-surface rounded p-1.5 border border-border">
            <span className="text-[9px] text-text-muted">预览</span>
            <p className="text-[10px] text-text whitespace-pre-wrap break-all max-h-[60px] overflow-y-auto">{combined}</p>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="text" style={{ top: '50%' }} data-handletype="text" />
    </BaseNodeWrapper>
  );
}

export default memo(PromptConstructorNode);
