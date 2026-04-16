// Ref: node-banana + XShow 重构 — 九宫格合拼
// Ref: §4.2 — 节点数据回写 Store
// 重构: rows/cols 分离 + 预设选择 + image-01~NN handle + 执行器驱动
import { memo, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import type { GridMergeNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

/** 预设布局选项（与 GridSplitNode 一致） */
const GRID_PRESETS = [
  { key: '2x2', rows: 2, cols: 2, label: '2×2' },
  { key: '2x3', rows: 2, cols: 3, label: '2×3' },
  { key: '3x2', rows: 3, cols: 2, label: '3×2' },
  { key: '3x3', rows: 3, cols: 3, label: '3×3' },
  { key: '2x4', rows: 2, cols: 4, label: '2×4' },
  { key: '4x2', rows: 4, cols: 2, label: '4×2' },
  { key: '2x5', rows: 2, cols: 5, label: '2×5' },
  { key: '5x2', rows: 5, cols: 2, label: '5×2' },
] as const;

/** 格式化 handle 编号: 1-based, 两位数 */
function handleId(index: number): string {
  return `image-${String(index + 1).padStart(2, '0')}`;
}

function GridMergeNodeComponent({ id, data, selected }: NodeProps<GridMergeNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const updateNodeInternals = useUpdateNodeInternals();

  // Store-only: 业务数据从 data 读取
  const gridRows = data.gridRows ?? 3;
  const gridCols = data.gridCols ?? 3;
  const presetKey = data.presetKey ?? '3x3';
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const mergedUrl = data.mergedImageUrl;

  const totalCells = gridRows * gridCols;

  // 预设切换改变 handle 数量时，必须通知 React Flow 重新计算 Handle 位置
  useEffect(() => {
    updateNodeInternals(id);
  }, [totalCells, id, updateNodeInternals]);

  // 选择预设
  const handlePresetChange = useCallback((preset: typeof GRID_PRESETS[number]) => {
    updateNodeData(id, {
      gridRows: preset.rows,
      gridCols: preset.cols,
      presetKey: preset.key,
      mergedImageUrl: undefined, // 布局变更清空结果
    });
  }, [id, updateNodeData]);

  // ---- Handles: 渲染在内容区域之外，避免重复导致连线漂移 ----
  const handles = (
    <>
      {/* image-01~image-NN input handles */}
      {Array.from({ length: totalCells }, (_, idx) => (
        <Handle
          key={handleId(idx)}
          type="target"
          position={Position.Left}
          id={handleId(idx)}
          style={{ top: `${((idx + 1) / (totalCells + 1)) * 100}%`, zIndex: 10 }}
          data-handletype="image"
        />
      ))}

      {/* 输出 handle */}
      <Handle type="source" position={Position.Right} id="merge-output" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
    </>
  );

  // ---- minimalContent: 预览模式 ----
  const minimalContent = (
    <div className="w-full h-full p-2">
      {mergedUrl && !loading ? (
        <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a] rounded">
          <img src={mergedUrl} alt="合拼结果" className="max-w-full max-h-full object-contain" />
        </div>
      ) : (
        <div
          className="w-full h-full grid"
          style={{
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            gap: '2px',
          }}
        >
          {Array.from({ length: totalCells }, (_, i) => (
            <div
              key={i}
              className="bg-surface-hover flex items-center justify-center text-text-muted"
            >
              <span className="text-[10px]">{String(i + 1).padStart(2, '0')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ---- hoverContent: 设置模式 ----
  const hoverContent = (
    <div className="flex flex-col h-full">
      {/* 预览区 */}
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

      {/* 设置区 */}
      <div className="p-2 pt-1 border-t border-[#333]">
        {/* 预设布局选择 */}
        <div className="text-[10px] text-text-secondary mb-1">布局</div>
        <div className="flex flex-wrap gap-1">
          {GRID_PRESETS.map((preset) => {
            const isActive = presetKey === preset.key;
            const count = preset.rows * preset.cols;
            return (
              <button
                key={preset.key}
                onClick={() => handlePresetChange(preset)}
                className={`p-1.5 rounded border transition-colors ${
                  isActive
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-[#444] hover:border-[#555]'
                }`}
              >
                <div
                  className="mx-auto w-8 grid gap-px"
                  style={{
                    gridTemplateColumns: `repeat(${preset.cols}, 1fr)`,
                    gridTemplateRows: `repeat(${preset.rows}, 1fr)`,
                  }}
                >
                  {Array.from({ length: count }, (_, i) => (
                    <div
                      key={i}
                      className={`rounded-sm aspect-square ${
                        isActive ? 'bg-blue-400' : 'bg-neutral-500'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-[9px] text-text-secondary mt-0.5 text-center">{preset.label}</div>
              </button>
            );
          })}
        </div>

        {/* 状态信息 */}
        <div className="mt-2 text-[10px] text-text-muted text-center">
          {gridRows}×{gridCols} = {totalCells} 格 · 从左侧连线子图到此节点
        </div>
      </div>
    </div>
  );

  return (
    <BaseNodeWrapper
      selected={!!selected}
      loading={loading}
      errorMessage={errorMessage}
      title="合并"
      minWidth={260}
      showHoverHeader
      hoverContent={hoverContent}
      handles={handles}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(GridMergeNodeComponent);