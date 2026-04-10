// Ref: @xyflow/react DnD 文档 + node-banana WorkflowCanvas.tsx
import { useCallback } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';

const NODE_TYPES = [
  { type: 'imageNode', label: '图片', icon: '🖼️' },
  { type: 'promptNode', label: '提示词', icon: '✨' },
  { type: 'textNode', label: '文本', icon: '📝' },
  { type: 'videoNode', label: '视频', icon: '🎬' },
  { type: 'audioNode', label: '语音', icon: '🎙️' },
  { type: 'gridSplitNode', label: '九宫格拆', icon: '🔲' },
  { type: 'gridMergeNode', label: '九宫格拼', icon: '🧩' },
  { type: 'cropNode', label: '裁剪', icon: '✂️' },
  { type: 'customNode', label: '万能', icon: '⚙️' },
] as const;

interface NodeSidebarProps {
  reactFlowInstance: ReactFlowInstance | null;
}

export default function NodeSidebar(_props: NodeSidebarProps) {
  const onDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, nodeType: string) => {
      event.dataTransfer.setData('application/reactflow', nodeType);
      event.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  return (
    <div className="w-[72px] bg-[#1a1a1a] border-r border-[#333] flex flex-col items-center py-2 gap-1 overflow-y-auto">
      <span className="text-[10px] text-gray-500 mb-1">节点</span>
      {NODE_TYPES.map(({ type, label, icon }) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          className="flex flex-col items-center justify-center w-[58px] h-[54px] bg-[#252525] hover:bg-[#333] border border-[#444] rounded cursor-grab active:cursor-grabbing transition-colors"
          title={label}
        >
          <span className="text-lg">{icon}</span>
          <span className="text-[9px] text-gray-400 mt-0.5">{label}</span>
        </div>
      ))}
    </div>
  );
}