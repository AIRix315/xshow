// Ref: @xyflow/react DnD 文档 + node-banana WorkflowCanvas.tsx
import { useCallback } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import { Image, Sparkles, FileText, Video, Mic, Grid3x3, LayoutGrid, Scissors, Settings } from 'lucide-react';

const NODE_TYPES = [
  { type: 'imageNode', label: '图片', icon: Image },
  { type: 'promptNode', label: '提示词', icon: Sparkles },
  { type: 'textNode', label: '文本', icon: FileText },
  { type: 'videoNode', label: '视频', icon: Video },
  { type: 'audioNode', label: '语音', icon: Mic },
  { type: 'gridSplitNode', label: '九宫格拆', icon: Grid3x3 },
  { type: 'gridMergeNode', label: '九宫格拼', icon: LayoutGrid },
  { type: 'cropNode', label: '裁剪', icon: Scissors },
  { type: 'customNode', label: '万能', icon: Settings },
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
    <div className="w-[72px] bg-surface border-r border-border flex flex-col items-center py-2 gap-1 overflow-y-auto">
      <span className="text-[10px] text-text-muted mb-1">节点</span>
      {NODE_TYPES.map(({ type, label, icon: Icon }) => (
        <div
          key={type}
          draggable
          onDragStart={(e) => onDragStart(e, type)}
          className="flex flex-col items-center justify-center w-[58px] h-[54px] bg-surface hover:bg-surface-hover border border-border rounded-lg cursor-grab active:cursor-grabbing transition-colors"
          title={label}
        >
          <Icon className="w-5 h-5 text-text-secondary" />
          <span className="text-[9px] text-text-secondary mt-0.5">{label}</span>
        </div>
      ))}
    </div>
  );
}