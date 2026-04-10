// Ref: §6.8 + 产物反推 — 九宫格合拼
import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GridMergeNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';

function GridMergeNodeComponent({ data, selected }: NodeProps<GridMergeNodeType>) {
  const [gridCount, setGridCount] = useState(data.gridCount ?? 3);
  const [cellSize, setCellSize] = useState(data.cellSize ?? 512);

  // 网格布局输入
  const inputCount = gridCount * gridCount;
  const cellSlots = Array.from({ length: inputCount }, (_, i) => i);

  return (
    <BaseNodeWrapper selected={!!selected} minHeight={260} minWidth={280}>
      <Handle type="target" position={Position.Left} id="merge-main" style={{ top: '50%' }} className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />

      <div className="flex flex-col gap-2 p-2 min-w-[240px]">
        <span className="text-[10px] text-gray-400 font-medium">🧩 九宫格合拼</span>

        {/* 参数 */}
        <div className="flex gap-1 items-center text-[10px] text-gray-300">
          <label className="text-gray-400">格数:</label>
          <input
            type="number"
            value={gridCount}
            onChange={(e) => setGridCount(Math.max(2, Math.min(5, Number(e.target.value))))}
            min={2}
            max={5}
            className="w-10 bg-[#2a2a2a] text-white text-[10px] rounded px-1 py-0.5 border border-[#444]"
          />
          <span className="text-gray-500">{gridCount}×{gridCount}</span>
          <label className="text-gray-400 ml-2">尺寸:</label>
          <select
            value={cellSize}
            onChange={(e) => setCellSize(Number(e.target.value))}
            className="bg-[#2a2a2a] text-white text-[10px] rounded px-1 py-0.5 border border-[#444]"
          >
            <option value={256}>256</option>
            <option value={512}>512</option>
            <option value={1024}>1024</option>
          </select>
        </div>

        {/* 网格输入槽位 */}
        <div
          className="border border-[#444] rounded p-1 bg-[#1a1a1a]"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCount}, 1fr)`,
            gap: '2px',
          }}
        >
          {cellSlots.map((i) => (
            <div
              key={i}
              className="bg-[#333] rounded flex items-center justify-center text-[8px] text-gray-500 aspect-square"
              style={{ minHeight: '24px' }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <div className="text-center text-[10px] text-gray-500">
          从左侧连线 {inputCount} 张子图到此节点
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="merge-output" className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
    </BaseNodeWrapper>
  );
}

export default memo(GridMergeNodeComponent);