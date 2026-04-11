// Ref: §6.8 + 产物反推 — 九宫格合拼（含 Canvas 图像处理）
// Ref: §4.2 — 节点数据回写 Store + 上游数据读取
import { memo, useState, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GridMergeNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import { getUpstreamNodes } from '@/stores/useFlowStore';
import { mergeImagesFromGrid } from '@/utils/imageProcessing';
import BaseNodeWrapper from './BaseNode';

function GridMergeNodeComponent({ id, data, selected }: NodeProps<GridMergeNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const [gridCount, setGridCount] = useState(data.gridCount ?? 3);
  const [cellSize, setCellSize] = useState(data.cellSize ?? 512);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [mergedUrl, setMergedUrl] = useState<string | undefined>(undefined);

  // 从 Store 读取所有上游节点的图片数据
  const upstream = getUpstreamNodes(id);

  const handleGridCountChange = useCallback((val: number) => {
    const clamped = Math.max(2, Math.min(5, val));
    setGridCount(clamped);
    updateNodeData(id, { gridCount: clamped });
  }, [id, updateNodeData]);

  const handleCellSizeChange = useCallback((val: number) => {
    setCellSize(val);
    updateNodeData(id, { cellSize: val });
  }, [id, updateNodeData]);

  // 收集上游数据，构造 cellImages 数组用于合拼
  const cellImages: Array<string | undefined> = Array.from(
    { length: gridCount * gridCount },
    () => undefined,
  );
  for (const { edge, node } of upstream) {
    const nodeData = node.data as Record<string, unknown>;
    // 尝试多种图片来源：imageUrl、sourceImageUrl、splitResults 数组
    const imageUrl = nodeData.imageUrl as string | undefined
      ?? nodeData.sourceImageUrl as string | undefined;
    if (imageUrl) {
      // 根据 sourceHandle 分配到对应格子位置
      const handleId = edge.sourceHandle;
      if (handleId?.startsWith('cell-')) {
        const match = handleId.match(/cell-(\d+)-(\d+)/);
        if (match) {
          const row = parseInt(match[1]!, 10);
          const col = parseInt(match[2]!, 10);
          const idx = row * gridCount + col;
          if (idx < cellImages.length) {
            cellImages[idx] = imageUrl;
          }
        }
      } else {
        // 没有 handle 信息，按连接顺序填入空位
        const emptyIdx = cellImages.findIndex((v) => v === undefined);
        if (emptyIdx >= 0) {
          cellImages[emptyIdx] = imageUrl;
        }
      }
    }
    // 如果上游是 splitResults 数组（来自 GridSplitNode），展开
    const splitResults = nodeData.splitResults as string[] | undefined;
    if (splitResults && Array.isArray(splitResults)) {
      for (let i = 0; i < Math.min(splitResults.length, cellImages.length); i++) {
        if (!cellImages[i]) {
          cellImages[i] = splitResults[i];
        }
      }
    }
  }

  // 自动合拼：当上游数据变化时
  const hasImages = cellImages.some((url) => url !== undefined);

  useEffect(() => {
    if (!hasImages) {
      setMergedUrl(undefined);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMessage('');
    mergeImagesFromGrid(cellImages, gridCount, cellSize)
      .then((url) => {
        if (cancelled) return;
        setMergedUrl(url);
        updateNodeData(id, { mergedImageUrl: url });
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : '合拼失败');
        setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cellImages 深比较需要用 hasImages 替代
  }, [hasImages, gridCount, cellSize, id, updateNodeData]);

  const inputCount = gridCount * gridCount;

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage} minHeight={260} minWidth={280}>
      <Handle type="target" position={Position.Left} id="merge-main" style={{ top: '50%' }} className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222]" />

      <div className="flex flex-col gap-2 p-2 min-w-[240px]">
        <span className="text-[10px] text-text-secondary font-medium">九宫格合拼</span>

        {/* 参数 */}
        <div className="flex gap-1 items-center text-[10px] text-text">
          <label className="text-text-secondary">格数:</label>
          <input
            type="number"
            value={gridCount}
            onChange={(e) => handleGridCountChange(Number(e.target.value))}
            min={2}
            max={5}
            className="w-10 bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border"
          />
          <span className="text-text-muted">{gridCount}×{gridCount}</span>
          <label className="text-text-secondary ml-2">尺寸:</label>
          <select
            value={cellSize}
            onChange={(e) => handleCellSizeChange(Number(e.target.value))}
            className="bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border"
          >
            <option value={256}>256</option>
            <option value={512}>512</option>
            <option value={1024}>1024</option>
          </select>
        </div>

        {/* 网格输入槽位 */}
        <div
          className="border border-border rounded p-1 bg-background"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCount}, 1fr)`,
            gap: '2px',
          }}
        >
          {Array.from({ length: inputCount }, (_, i) => (
            <div
              key={i}
              className={`rounded flex items-center justify-center text-[8px] aspect-square overflow-hidden ${
                cellImages[i] ? 'border border-primary/50' : 'bg-surface-hover border border-border'
              }`}
              style={{ minHeight: '24px' }}
            >
              {cellImages[i] ? (
                <img src={cellImages[i]} alt={`cell-${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                i + 1
              )}
            </div>
          ))}
        </div>

        {/* 合拼结果预览 */}
        {mergedUrl && !loading && (
          <div className="relative">
            <img src={mergedUrl} alt="合拼结果" className="w-full rounded border border-border" style={{ maxHeight: '200px', objectFit: 'contain' }} />
          </div>
        )}

        <div className="text-center text-[10px] text-text-muted">
          {hasImages ? `已连接 ${cellImages.filter(Boolean).length}/${inputCount} 格` : `从左侧连线 ${inputCount} 张子图到此节点`}
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="merge-output" className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222]" />
    </BaseNodeWrapper>
  );
}

export default memo(GridMergeNodeComponent);