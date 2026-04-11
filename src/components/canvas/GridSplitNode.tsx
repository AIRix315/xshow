// Ref: §6.7 + node-banana SplitGridNode.tsx — 九宫格分拆（含 Canvas 图像处理）
// Ref: §4.2 — 节点数据回写 Store + 上游数据读取
import { memo, useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GridSplitNode } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import { getUpstreamNodes } from '@/stores/useFlowStore';
import { splitImageToGrid, loadImage } from '@/utils/imageProcessing';
import BaseNodeWrapper from './BaseNode';

function GridSplitNodeComponent({ id, data, selected }: NodeProps<GridSplitNode>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const [gridCount, setGridCount] = useState(data.gridCount ?? 3);
  const [cellSize, setCellSize] = useState(data.cellSize ?? 512);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [splitResults, setSplitResults] = useState<string[]>([]);

  // 从 Store 读取上游图片节点的 imageUrl
  const upstream = getUpstreamNodes(id);
  const sourceImageUrl = upstream.length > 0
    ? (upstream[0]!.node.data as Record<string, unknown>).imageUrl as string | undefined
    : undefined;

  const handleGridCountChange = useCallback((val: number) => {
    const clamped = Math.max(2, Math.min(5, val));
    setGridCount(clamped);
    updateNodeData(id, { gridCount: clamped });
  }, [id, updateNodeData]);

  const handleCellSizeChange = useCallback((val: number) => {
    setCellSize(val);
    updateNodeData(id, { cellSize: val });
  }, [id, updateNodeData]);

  // 自动执行拆图：当源图变化时
  useEffect(() => {
    if (!sourceImageUrl) {
      setSplitResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMessage('');
    loadImage(sourceImageUrl)
      .then((img) => {
        if (cancelled) return;
        const results = splitImageToGrid(img, gridCount, cellSize);
        setSplitResults(results);
        updateNodeData(id, { splitResults: results });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : '图片分拆失败');
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sourceImageUrl, gridCount, cellSize, id, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage} minHeight={220} minWidth={260}>
      <Handle type="target" position={Position.Left} id="source-image" style={{ top: '30%' }} className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222]" />
      {/* 辅助 target handles（接收多输入图片） */}
      <Handle type="target" position={Position.Top} id="grid-top" className="!bg-handle-default !w-2 !h-2 !border !border-[#222]" />
      <Handle type="target" position={Position.Bottom} id="grid-bottom" className="!bg-handle-default !w-2 !h-2 !border !border-[#222]" />

      <div className="flex flex-col gap-2 p-2 min-w-[220px]">
        <span className="text-[10px] text-text-secondary font-medium">九宫格分拆</span>

        {/* 参数配置 */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-[10px] text-text">
            <label className="w-12">格数:</label>
            <input
              type="number"
              value={gridCount}
              onChange={(e) => handleGridCountChange(Number(e.target.value))}
              min={2}
              max={5}
              className="flex-1 bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border w-12"
            />
            <span className="text-text-muted">{gridCount}×{gridCount}</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-text">
            <label className="w-12">单元尺寸:</label>
            <select
              value={cellSize}
              onChange={(e) => handleCellSizeChange(Number(e.target.value))}
              className="bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border"
            >
              <option value={256}>256px</option>
              <option value={512}>512px</option>
              <option value={1024}>1024px</option>
            </select>
          </div>
        </div>

        {/* 网格预览（显示拆图结果或占位格） */}
        <div
          className="border border-border rounded p-1 bg-background"
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
              className="bg-surface-hover rounded flex items-center justify-center text-[8px] text-text-muted overflow-hidden"
            >
              {splitResults[i] ? (
                <img src={splitResults[i]} alt={`cell-${i + 1}`} className="w-full h-full object-cover rounded" />
              ) : (
                i + 1
              )}
            </div>
          ))}
        </div>

        {/* 源图连接提示 */}
        {!sourceImageUrl && (
          <div className="text-center text-[10px] text-text-muted py-1">
            连线图片到此节点即可分拆
          </div>
        )}
        {splitResults.length > 0 && (
          <div className="text-center text-[10px] text-green-500 py-1">
            ✓ 已拆分为 {splitResults.length} 格
          </div>
        )}
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
            className="!bg-primary !w-2 !h-2 !border !border-[#333]"
          />
        );
      })}
    </BaseNodeWrapper>
  );
}

export default memo(GridSplitNodeComponent);