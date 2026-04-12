// Ref: node-banana Conditional Switch Node
import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ConditionalSwitchNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';

function ConditionalSwitchNode({ data, selected }: NodeProps<ConditionalSwitchNodeType>) {
  const [rules, setRules] = useState(data.rules ?? [
    { id: '1', name: 'Rule 1', operator: 'contains' as const, value: '', outputIndex: 0 },
  ]);

  const addRule = () => {
    setRules([...rules, { id: Date.now().toString(), name: `Rule ${rules.length + 1}`, operator: 'contains', value: '', outputIndex: rules.length }]);
  };

  const removeRule = (id: string) => {
    if (rules.length <= 1) return;
    setRules(rules.filter((r) => r.id !== id));
  };

  const updateRule = (id: string, patch: Partial<typeof rules[number]>) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  return (
    <BaseNodeWrapper selected={!!selected} title="条件">
      <Handle type="target" position={Position.Left} id="input" style={{ top: '50%' }} data-handletype="any" />
      <div className="flex flex-col gap-2 p-2 min-w-[220px]">
        <span className="text-[10px] text-text-secondary font-medium">Conditional Switch</span>
        {rules.map((rule) => (
          <div key={rule.id} className="bg-surface rounded p-1.5 border border-border space-y-1">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={rule.name}
                onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                className="flex-1 bg-surface text-text text-[10px] px-1 py-0.5 rounded border border-border outline-none"
              />
              <button onClick={() => removeRule(rule.id)} className="text-red-500 text-[10px]">×</button>
            </div>
            <select
              value={rule.operator}
              onChange={(e) => updateRule(rule.id, { operator: e.target.value as typeof rule.operator })}
              className="w-full bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border outline-none"
            >
              <option value="contains">contains</option>
              <option value="exact">exact</option>
              <option value="startsWith">starts-with</option>
              <option value="endsWith">ends-with</option>
              <option value="regex">regex</option>
            </select>
            <input
              type="text"
              value={rule.value}
              onChange={(e) => updateRule(rule.id, { value: e.target.value })}
              placeholder="匹配值"
              className="w-full bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border outline-none"
            />
          </div>
        ))}
        <button onClick={addRule} className="text-[10px] text-primary hover:text-primary-hover text-left">+ 添加规则</button>
      </div>
      {rules.map((rule, i) => (
        <Handle key={rule.id} type="source" position={Position.Right} id={`rule-${i}`} style={{ top: `${20 + (i * 60 / Math.max(rules.length, 1))}%` }} data-handletype="any" />
      ))}
      <Handle type="source" position={Position.Right} id="default" style={{ top: '85%' }} data-handletype="any" />
    </BaseNodeWrapper>
  );
}

export default memo(ConditionalSwitchNode);
