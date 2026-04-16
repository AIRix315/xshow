// Ref: node-banana SplitGridNode.tsx — 九宫格分拆
// Ref: §4.2 — 节点数据回写 Store + 上游数据读取
// 重构: rows/cols 分离 + 预设选择 + image-01~NN handle + 子节点可选
import { memo, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import type { GridSplitNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import { getUpstreamNodes } from '@/stores/useFlowStore';
import { createNode } from '@/utils/nodeFactory';
import BaseNodeWrapper from './BaseNode';

/** 预设布局选项 */
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

/** 格式化 handle 编号: 1-based, 两位数, 如 01, 02, ..., 10 */
function handleId(index: number): string {
  return `image-${String(index + 1).padStart(2, '0')}`;
}

function GridSplitNodeComponent({ id, data, selected }: NodeProps<GridSplitNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const addNode = useFlowStore((s) => s.addNode);
  const addEdge = useFlowStore((s) => s.addEdge);
  const removeNode = useFlowStore((s) => s.removeNode);
  const removeEdge = useFlowStore((s) => s.removeEdge);
  const nodes = useFlowStore((s) => s.nodes);

  // 预设切换时 Handle 数量变化，必须通知 React Flow 重新计算位置
  const updateNodeInternals = useUpdateNodeInternals();

  // Store-only: 业务数据从 data 读取
  const gridRows = data.gridRows ?? 3;
  const gridCols = data.gridCols ?? 3;
  const presetKey = data.presetKey ?? '3x3';
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const splitResults = (data.splitResults ?? []) as string[];
  const hasChildNodes = data.hasChildNodes ?? false;
  const childNodeIds = data.childNodeIds ?? [];

  // 从 Store 读取上游图片节点的 imageUrl
  const upstream = getUpstreamNodes(id);
  const sourceImageUrl = upstream.length > 0
    ? (upstream[0]!.node.data as Record<string, unknown>).imageUrl as string | undefined
    : undefined;

  // 当 sourceImageUrl 变化时清空旧结果，等待执行器写入
  useEffect(() => {
    if (!sourceImageUrl) {
      updateNodeData(id, { splitResults: [], loading: false, errorMessage: '' });
    }
  }, [sourceImageUrl, id, updateNodeData]);

  const totalCells = gridRows * gridCols;

  // Handle 数量变化时通知 React Flow 重新计算连线位置
  useEffect(() => {
    updateNodeInternals(id);
  }, [totalCells, id, updateNodeInternals]);

  // 选择预设
  const handlePresetChange = useCallback((preset: typeof GRID_PRESETS[number]) => {
    updateNodeData(id, {
      gridRows: preset.rows,
      gridCols: preset.cols,
      presetKey: preset.key,
      splitResults: [], // 布局变更清空结果
    });
  }, [id, updateNodeData]);

  // 创建子 ImageInput 节点
  const handleCreateChildNodes = useCallback(() => {
    const splitNode = nodes.find((n) => n.id === id);
    if (!splitNode) return;

    const imageInputWidth = 280;
    const imageInputHeight = 280;
    const verticalGap = 30;
    const horizontalOffset = 380;
    const clusterGap = 20;

    // 最多 3 列一排
    const childCols = Math.min(totalCells, 3);

    const startX = splitNode.position.x + horizontalOffset;
    const startY = splitNode.position.y;

    const newChildNodeIds: Array<{ imageInputId: string }> = [];

    for (let i = 0; i < totalCells; i++) {
      const row = Math.floor(i / childCols);
      const col = i % childCols;

      const clusterX = startX + col * (imageInputWidth + clusterGap);
      const clusterY = startY + row * (imageInputHeight + verticalGap);

      const newNode = createNode('imageInputNode', {
        x: clusterX,
        y: clusterY,
      }, {
        label: `拆分 ${i + 1}`,
      });
      const imageInputId = newNode.id;

      addNode(newNode);

      // 创建 reference 边
      addEdge({
        id: `${id}-ref-${imageInputId}`,
        source: id,
        target: imageInputId,
        sourceHandle: 'reference',
        targetHandle: 'reference',
        type: 'reference',
      });

      newChildNodeIds.push({ imageInputId });
    }

    updateNodeData(id, {
      childNodeIds: newChildNodeIds,
      hasChildNodes: true,
    });
  }, [id, totalCells, nodes, addNode, addEdge, updateNodeData]);

  // 删除子节点
  const handleRemoveChildNodes = useCallback(() => {
    for (const entry of childNodeIds) {
      // 删除相关 reference 边
      const edgeId = `${id}-ref-${entry.imageInputId}`;
      removeEdge(edgeId);
      removeNode(entry.imageInputId);
    }
    updateNodeData(id, {
      childNodeIds: [],
      hasChildNodes: false,
    });
  }, [id, childNodeIds, removeEdge, removeNode, updateNodeData]);

  // ---- Handles: 渲染在内容区域之外，避免重复导致连线漂移 ----
  const handles = (
    <>
      {/* 输入 handle */}
      <Handle type="target" position={Position.Left} id="source-image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="image" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Image</div>

      {/* reference handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="reference"
        data-handletype="reference"
        style={{ top: '50%', zIndex: 10 }}
      />

      {/* image-01~image-NN output handles */}
      {Array.from({ length: totalCells }, (_, idx) => (
        <Handle
          key={handleId(idx)}
          type="source"
          position={Position.Right}
          id={handleId(idx)}
          style={{ top: `${((idx + 1) / (totalCells + 1)) * 100}%`, zIndex: 10 }}
          data-handletype="image"
        />
      ))}
    </>
  );

  // ---- minimalContent: 预览模式 ----
  const minimalContent = (
    <div className="w-full h-full p-2">
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
            className="bg-surface-hover flex items-center justify-center text-text-muted overflow-hidden"
          >
            {splitResults[i] ? (
              <img src={splitResults[i]} alt={`cell-${i + 1}`} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px]">{String(i + 1).padStart(2, '0')}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // ---- hoverContent: 设置模式 ----
  const hoverContent = (
    <div className="flex flex-col h-full">
      {/* 预览区 */}
      <div className="flex-1 min-h-0 p-2">
        {splitResults.length > 0 ? (
          <div
            className="w-full h-full grid"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
              gridTemplateRows: `repeat(${gridRows}, 1fr)`,
              gap: '2px',
            }}
          >
            {splitResults.map((url, i) => (
              <div key={i} className="bg-surface-hover flex items-center justify-center overflow-hidden">
                <img src={url} alt={`cell-${i + 1}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted text-[10px] bg-[#1a1a1a] rounded">
            {loading ? '分拆中...' : sourceImageUrl ? '等待执行分拆' : '连线图片到此节点即可分拆'}
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
        <div className="flex items-center justify-between mt-2 text-[10px]">
          <span className="text-text-muted">{gridRows}×{gridCols} = {totalCells} 格</span>
          {hasChildNodes && (
            <span className="text-green-500">✓ {childNodeIds.length} 子节点</span>
          )}
        </div>

        {/* 子节点管理 */}
        <div className="flex gap-1 mt-1">
          {!hasChildNodes ? (
            <button
              onClick={handleCreateChildNodes}
              className="flex-1 bg-surface-hover hover:bg-[#333] text-text-secondary text-[10px] py-1 rounded"
            >
              创建子节点
            </button>
          ) : (
            <button
              onClick={handleRemoveChildNodes}
              className="flex-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-[10px] py-1 rounded"
            >
              删除子节点
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <BaseNodeWrapper
      selected={!!selected}
      loading={loading}
      errorMessage={errorMessage}
      title="分割"
      minWidth={260}
      showHoverHeader
      hoverContent={hoverContent}
      handles={handles}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(GridSplitNodeComponent);