// Ref: §6.7 + node-banana SplitGridNode.tsx — 九宫格分拆（含 Canvas 图像处理）
// Ref: §4.2 — 节点数据回写 Store + 上游数据读取
// Ref: node-banana SplitGridNode.tsx — reference handle + 子节点机制
import { memo, useCallback, useEffect, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { GridSplitNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import { getUpstreamNodes } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';
import SplitGridSettingsModal from './SplitGridSettingsModal';

function GridSplitNodeComponent({ id, data, selected }: NodeProps<GridSplitNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  // Store-only: 业务数据从 data 读取
  const gridCount = data.gridCount ?? 3;
  const cellSize = data.cellSize ?? 512;
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const splitResults = (data.splitResults ?? []) as string[];
  const isConfigured = data.isConfigured ?? false;

  // 子节点创建弹窗状态
  const [showSettings, setShowSettings] = useState(false);

  // 从 Store 读取上游图片节点的 imageUrl
  const upstream = getUpstreamNodes(id);
  const sourceImageUrl = upstream.length > 0
    ? (upstream[0]!.node.data as Record<string, unknown>).imageUrl as string | undefined
    : undefined;

  const handleGridCountChange = useCallback((val: number) => {
    const clamped = Math.max(2, Math.min(5, val));
    updateNodeData(id, { gridCount: clamped });
  }, [id, updateNodeData]);

  const handleCellSizeChange = useCallback((val: number) => {
    updateNodeData(id, { cellSize: val });
  }, [id, updateNodeData]);

  // 拆图由执行器驱动（executeGridSplit），组件不再使用 useEffect 自动拆分
  // 当 sourceImageUrl 变化时仅清空旧结果，等待执行器写入 splitResults
  useEffect(() => {
    if (!sourceImageUrl) {
      updateNodeData(id, { splitResults: [], loading: false, errorMessage: '' });
    }
  }, [sourceImageUrl, id, updateNodeData]);

  // 首次创建且未配置时，弹出设置弹窗
  useEffect(() => {
    if (!isConfigured) {
      setShowSettings(true);
    }
  }, [isConfigured]);

  const totalCells = gridCount * gridCount;

  const minimalContent = (
    <>
      <Handle type="target" position={Position.Left} id="source-image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
      
      <div className="w-full h-full p-2">
        <div
          className="w-full h-full grid"
          style={{
            gridTemplateColumns: `repeat(${gridCount}, 1fr)`,
            gridTemplateRows: `repeat(${gridCount}, 1fr)`,
            gap: '2px',
          }}
        >
          {Array.from({ length: totalCells }, (_, i) => (
            <div
              key={i}
              className="bg-surface-hover flex items-center justify-center text-text-muted"
            >
              {splitResults[i] ? (
                <img src={splitResults[i]} alt={`cell-${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[10px]">{i + 1}</span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* 参考连接线 — 虚线连接到子 ImageInput 节点 */}
      <Handle
        type="source"
        position={Position.Right}
        id="reference"
        data-handletype="reference"
        style={{ top: '50%', zIndex: 10 }}
      />

      {/* 向后兼容：保留 cell handles 供直接连线使用 */}
      {Array.from({ length: totalCells }, (_, idx) => {
        const row = Math.floor(idx / gridCount);
        const col = idx % gridCount;
        return (
          <Handle
            key={`cell-${row}-${col}`}
            type="source"
            position={Position.Right}
            id={`cell-${row}-${col}`}
            style={{ top: `${((idx + 1) / (totalCells + 1)) * 100}%`, zIndex: 10, opacity: 0.3 }}
            data-handletype="image"
          />
        );
      })}
    </>
  );

  const hoverContent = (
    <>
      <Handle type="target" position={Position.Left} id="source-image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
      
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-0 p-2">
          {splitResults.length > 0 ? (
            <div 
              className="w-full h-full grid"
              style={{
                gridTemplateColumns: `repeat(${gridCount}, 1fr)`,
                gridTemplateRows: `repeat(${gridCount}, 1fr)`,
                gap: '2px',
              }}
            >
              {splitResults.map((url, i) => (
                <div key={i} className="bg-surface-hover flex items-center justify-center">
                  <img src={url} alt={`cell-${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px] bg-[#1a1a1a] rounded">
              {loading ? '分拆中...' : '等待分拆'}
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

          {!sourceImageUrl && (
            <div className="text-center text-[10px] text-text-muted mt-2">
              连线图片到此节点即可分拆
            </div>
          )}
          {splitResults.length > 0 && (
            <div className="text-center text-[10px] text-green-500 mt-2">
              ✓ 已拆分为 {splitResults.length} 格
            </div>
          )}

          {/* 子节点管理按钮 */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => setShowSettings(true)}
              className="flex-1 bg-surface-hover hover:bg-[#333] text-text-secondary text-[10px] py-1 rounded"
            >
              {isConfigured ? '重新配置子节点' : '创建子节点'}
            </button>
          </div>
        </div>
      </div>
      
      {/* 参考连接线 — 虚线连接到子 ImageInput 节点 */}
      <Handle
        type="source"
        position={Position.Right}
        id="reference"
        data-handletype="reference"
        style={{ top: '50%', zIndex: 10 }}
      />

      {/* 向后兼容：保留 cell handles */}
      {Array.from({ length: totalCells }, (_, idx) => {
        const row = Math.floor(idx / gridCount);
        const col = idx % gridCount;
        return (
          <Handle
            key={`cell-${row}-${col}`}
            type="source"
            position={Position.Right}
            id={`cell-${row}-${col}`}
            style={{ top: `${((idx + 1) / (totalCells + 1)) * 100}%`, zIndex: 10, opacity: 0.3 }}
            data-handletype="image"
          />
        );
      })}
    </>
  );

  return (
    <>
      <BaseNodeWrapper 
        selected={!!selected} 
        loading={loading} 
        errorMessage={errorMessage}
        title="分割"
        minWidth={260}
        hoverContent={hoverContent}
      >
        {minimalContent}
      </BaseNodeWrapper>
      {showSettings && (
        <SplitGridSettingsModal
          nodeId={id}
          gridCount={gridCount}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}

export default memo(GridSplitNodeComponent);