// Ref: §6.7 + node-banana SplitGridNode.tsx — 九宫格分拆
import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GridSplitNode } from '@/types';
import BaseNodeWrapper from './BaseNode';

function GridSplitNodeComponent({ data, selected }: NodeProps<GridSplitNode>) {
  const [gridCount, setGridCount] = useState(data.gridCount ?? 3);
  const [cellSize, setCellSize] = useState(data.cellSize ?? 512);

  const handleGridCountChange = useCallback((val: number) => {
    setGridCount(Math.max(2, Math.min(5, val)));
  }, []);

  return (
    <BaseNodeWrapper selected={!!selected} minHeight={220} minWidth={260}>
      <Handle type="target" position={Position.Left} id="source-image" style={{ top: '30%' }} className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
      {/* 辅助 target handles（接收多输入图片） */}
      <Handle type="target" position={Position.Top} id="grid-top" className="!bg-[#555] !w-2 !h-2 !border !border-[#222]" />
      <Handle type="target" position={Position.Bottom} id="grid-bottom" className="!bg-[#555] !w-2 !h-2 !border !border-[#222]" />

      <div className="flex flex-col gap-2 p-2 min-w-[220px]">
        <span className="text-[10px] text-gray-400 font-medium">🔲 九宫格分拆</span>

        {/* 参数配置 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-[10px] text-gray-300">
            <label className="w-12">格数:</label>
            <input
              type="number"
              value={gridCount}
              onChange={(e) => handleGridCountChange(Number(e.target.value))}
              min={2}
              max={5}
              className="flex-1 bg-[#2a2a2a] text-white text-[10px] rounded px-1 py-0.5 border border-[#444] w-12"
            />
            <span className="text-gray-500">{gridCount}×{gridCount}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-gray-300">
            <label className="w-12">单元尺寸:</label>
            <select
              value={cellSize}
              onChange={(e) => setCellSize(Number(e.target.value))}
              className="bg-[#2a2a2a] text-white text-[10px] rounded px-1 py-0.5 border border-[#444]"
            >
              <option value={256}>256px</option>
              <option value={512}>512px</option>
              <option value={1024}>1024px</option>
            </select>
          </div>
        </div>

        {/* 网格预览 */}
        <div
          className="border border-[#444] rounded p-1 bg-[#1a1a1a]"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCount}, 1fr)`,
            gap: '2px',
            aspectRatio: '1',
          }}
        >
          {Array.from({ length: gridCount * gridCount }, (_, i) => (
            <div
              key={i}
              className="bg-[#333] rounded flex items-center justify-center text-[8px] text-gray-500"
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* 源图连接提示 */}
        <div className="text-center text-[10px] text-gray-500 py-1">
          连线图片到此节点即可分拆
        </div>
      </div>

      {/* 输出 handles — N×N 网格 */}
      {Array.from({ length: gridCount * gridCount }, (_, idx) => {
        const row = Math.floor(idx / gridCount);
        const col = idx % gridCount;
        const offset = (idx + 0.5) / (gridCount * gridCount);
        return (
          <Handle
            key={`cell-${row}-${col}`}
            type="source"
            position={Position.Right}
            id={`cell-${row}-${col}`}
            style={{ top: `${10 + offset * 80}%` }}
            className="!bg-blue-500 !w-2 !h-2 !border !border-[#333]"
          />
        );
      })}
    </BaseNodeWrapper>
  );
}

export default memo(GridSplitNodeComponent);