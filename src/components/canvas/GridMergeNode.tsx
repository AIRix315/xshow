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
  // mergedUrl 用于存储合拼结果（默认状态不显示，仅 hover 参数面板显示）
  const [mergedUrl, setMergedUrl] = useState<string | undefined>(data.mergedImageUrl);

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

  const minimalContent = (
    <>
      <Handle type="target" position={Position.Left} id="merge-main" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
      
      <div className="w-full h-full p-2">
        <div
          className="w-full h-full grid"
          style={{
            gridTemplateColumns: `repeat(${gridCount}, 1fr)`,
            gridTemplateRows: `repeat(${gridCount}, 1fr)`,
            gap: '2px',
          }}
        >
          {Array.from({ length: inputCount }, (_, i) => (
            <div
              key={i}
              className={`flex items-center justify-center ${cellImages[i] ? '' : 'bg-surface-hover'}`}
            >
              {cellImages[i] ? (
                <img src={cellImages[i]} alt={`cell-${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px] text-text-muted">{i + 1}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <Handle type="source" position={Position.Right} id="merge-output" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
    </>
  );

  const hoverContent = (
    <>
      <Handle type="target" position={Position.Left} id="merge-main" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
      
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-0 p-2">
          {mergedUrl && !loading ? (
            <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a] rounded">
              <img src={mergedUrl} alt="合拼结果" className="max-w-full max-h-full object-contain" />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px] bg-[#1a1a1a] rounded">
              {loading ? '合拼中...' : '等待合拼'}
            </div>
          )}
        </div>
        
        <div className="p-2 pt-1 border-t border-[#333]">
          <div className="flex items-center gap-2 text-[10px] text-text">
            <label className="w-10 shrink-0">格数:</label>
            <input
              type="text"
              inputMode="numeric"
              value={gridCount}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                if (val) {
                  const num = Math.min(5, Math.max(2, parseInt(val, 10)));
                  handleGridCountChange(num);
                }
              }}
              onBlur={() => {
                if (!gridCount || gridCount < 2) handleGridCountChange(2);
                if (gridCount > 5) handleGridCountChange(5);
              }}
              className="w-14 bg-surface text-text text-[10px] rounded px-2 py-1 border border-border"
            />
            <span className="text-text-muted">{gridCount}×{gridCount}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-text mt-1">
            <label className="w-10 shrink-0">尺寸:</label>
            <input
              type="text"
              inputMode="numeric"
              value={cellSize}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                if (val) {
                  const num = Math.min(2048, Math.max(128, parseInt(val, 10)));
                  handleCellSizeChange(num);
                }
              }}
              onBlur={() => {
                if (!cellSize || cellSize < 128) handleCellSizeChange(256);
                if (cellSize > 2048) handleCellSizeChange(1024);
              }}
              className="w-14 bg-surface text-text text-[10px] rounded px-2 py-1 border border-border"
            />
          </div>

          <div className="text-center text-[10px] text-text-muted mt-2">
            {hasImages ? `已连接 ${cellImages.filter(Boolean).length}/${inputCount} 格` : `从左侧连线 ${inputCount} 张子图到此节点`}
          </div>
        </div>
      </div>
      
      <Handle type="source" position={Position.Right} id="merge-output" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
    </>
  );

  return (
<BaseNodeWrapper
      selected={!!selected} 
      loading={loading} 
      errorMessage={errorMessage}
      title="合并"
      minWidth={260}
      hoverContent={hoverContent}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(GridMergeNodeComponent);