// Ref: node-banana SplitGridSettingsModal.tsx — 子节点自动创建配置
// XShow 简化版：只创建 ImageInput 子节点 + reference 边
import { useState, useCallback } from 'react';
import { useFlowStore } from '@/stores/useFlowStore';
import { createNode } from '@/utils/nodeFactory';

interface SplitGridSettingsModalProps {
  nodeId: string;
  gridCount: number;
  onClose: () => void;
}

/**
 * 九宫格拆分设置弹窗
 * 用户可配置要创建的子节点数量，点击"创建子节点"后自动：
 * 1. 在画布右侧创建 ImageInput 子节点
 * 2. 创建 reference 边连接到子节点
 * 3. 更新 GridSplitNode 的 childNodeIds 和 isConfigured
 */
function SplitGridSettingsModal({ nodeId, gridCount, onClose }: SplitGridSettingsModalProps) {
  const [targetCount, setTargetCount] = useState(gridCount * gridCount);
  const addNode = useFlowStore((s) => s.addNode);
  const addEdge = useFlowStore((s) => s.addEdge);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const nodes = useFlowStore((s) => s.nodes);

  const handleCreate = useCallback(() => {
    const splitNode = nodes.find((n) => n.id === nodeId);
    if (!splitNode) return;

    // 子节点布局参数
    const imageInputWidth = 280;
    const imageInputHeight = 280;
    const verticalGap = 30;
    const horizontalOffset = 380;
    const clusterGap = 20;

    // 计算列数（最多 3 列一排）
    const cols = Math.min(targetCount, 3);
    const rows = Math.ceil(targetCount / cols);

    const startX = splitNode.position.x + horizontalOffset;
    const startY = splitNode.position.y;

    const childNodeIds: Array<{ imageInputId: string }> = [];

    for (let i = 0; i < targetCount; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const clusterX = startX + col * (imageInputWidth + clusterGap);
      const clusterY = startY + row * (imageInputHeight + verticalGap);

      // 创建 ImageInput 子节点
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
        id: `${nodeId}-ref-${imageInputId}`,
        source: nodeId,
        target: imageInputId,
        sourceHandle: 'reference',
        targetHandle: 'reference',
        type: 'reference',
      });

      childNodeIds.push({ imageInputId });
    }

    // 更新 GridSplitNode 配置
    updateNodeData(nodeId, {
      childNodeIds,
      targetCount,
      gridRows: rows,
      gridCols: cols,
      isConfigured: true,
    });

    onClose();
  }, [nodeId, targetCount, nodes, addNode, addEdge, updateNodeData, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-surface border border-border rounded-lg p-4 w-72 shadow-xl">
        <h3 className="text-text text-sm font-medium mb-3">创建拆分子节点</h3>

        <div className="mb-3">
          <label className="text-text-secondary text-[10px] block mb-1">
            子节点数量
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={targetCount}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              if (val) {
                const num = Math.max(1, Math.min(25, parseInt(val, 10)));
                setTargetCount(num);
              }
            }}
            className="w-full bg-background text-text text-xs rounded px-2 py-1.5 border border-border"
          />
          <p className="text-text-muted text-[10px] mt-1">
            默认 {gridCount}×{gridCount} = {gridCount * gridCount} 个
          </p>
        </div>

        <div className="mb-3 p-2 bg-background rounded text-[10px] text-text-secondary">
          <p>将在画布右侧创建 {targetCount} 个 ImageInput 子节点，</p>
          <p>并通过 reference 引用线连接到本节点。</p>
          <p className="mt-1">执行时拆分结果会自动填充到子节点。</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-surface-hover hover:bg-[#333] text-text-secondary text-[10px] py-1.5 rounded"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            className="flex-1 bg-primary hover:bg-primary-hover text-text text-[10px] py-1.5 rounded font-medium"
          >
            创建 {targetCount} 个子节点
          </button>
        </div>
      </div>
    </div>
  );
}

export default SplitGridSettingsModal;