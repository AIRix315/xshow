// Ref: @xyflow/react DnD 文档 + node-banana WorkflowCanvas.tsx + 原型 NodeSidebar
// Ref: 原型 — fixed overlay 模式，由外部按钮控制开合
import { memo, useCallback } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import {
  Image, FileText, Video, Mic, Box,
  Sparkles, Layers,
  Wand2, Film, Volume2, Bot,
  PenTool, Grid3x3, Scissors, Clock, Frame, GitCompare,
  GitBranch, ToggleLeft, GitMerge,
  Download, GalleryHorizontal,
  Settings, X,
} from 'lucide-react';

// 按 node-banana 分类组织
const NODE_CATEGORIES = [
  {
    title: 'Input 输入',
    items: [
      { type: 'imageInputNode', label: '图片', icon: Image },
      { type: 'audioNode', label: '音频', icon: Mic },
      { type: 'videoInputNode', label: '视频', icon: Video },
      { type: 'viewer3DNode', label: '3D', icon: Box },
      { type: 'textInputNode', label: '文本', icon: FileText },
    ],
  },
  {
    title: 'Text 文本',
    items: [
      { type: 'promptNode', label: '提示词', icon: Sparkles },
      { type: 'promptConstructorNode', label: '提示词构造', icon: Layers },
    ],
  },
  {
    title: 'Generate 生成',
    items: [
      { type: 'imageNode', label: '生成图片', icon: Wand2 },
      { type: 'videoNode', label: '生成视频', icon: Film },
      { type: 'generate3DNode', label: '生成3D', icon: Box },
      { type: 'generateAudioNode', label: '生成音频', icon: Volume2 },
      { type: 'textNode', label: '生成文本', icon: Bot },
    ],
  },
  {
    title: 'Process 处理',
    items: [
      { type: 'annotateNode', label: '标注', icon: PenTool },
      { type: 'gridSplitNode', label: '九宫格', icon: Grid3x3 },
      { type: 'videoStitchNode', label: '视频拼接', icon: Film },
      { type: 'videoTrimNode', label: '视频裁剪', icon: Scissors },
      { type: 'easeCurveNode', label: '缓动曲线', icon: Clock },
      { type: 'frameGrabNode', label: '帧提取', icon: Frame },
      { type: 'imageCompareNode', label: '图片对比', icon: GitCompare },
      { type: 'cropNode', label: '裁剪', icon: Scissors },
    ],
  },
  {
    title: 'Route 路由',
    items: [
      { type: 'routerNode', label: '路由', icon: GitBranch },
      { type: 'switchNode', label: '开关', icon: ToggleLeft },
      { type: 'conditionalSwitchNode', label: '条件路由', icon: GitMerge },
    ],
  },
  {
    title: 'Output 输出',
    items: [
      { type: 'outputNode', label: '输出', icon: Download },
      { type: 'outputGalleryNode', label: '图集', icon: GalleryHorizontal },
    ],
  },
  {
    title: 'Custom 自定义',
    items: [
      { type: 'customNode', label: '万能节点', icon: Settings },
    ],
  },
] as const;

interface NodeSidebarProps {
  reactFlowInstance?: ReactFlowInstance | null;
  open: boolean;
  onClose: () => void;
}

function NodeSidebar({ open, onClose }: NodeSidebarProps) {
  const onDragStart = useCallback(
    (event: React.DragEvent<HTMLDivElement>, nodeType: string) => {
      // 使用 nativeEvent 获取原生的 DataTransfer 对象
      const nativeEvent = event.nativeEvent as DragEvent;
      nativeEvent.dataTransfer?.setData('application/reactflow', nodeType);
      nativeEvent.dataTransfer && (nativeEvent.dataTransfer.effectAllowed = 'move');
    },
    [],
  );

  return (
    <>
      {/* 遮罩层 - 点击关闭（不覆盖顶部栏） */}
      {open && (
        <div
          className="fixed top-11 left-0 right-0 bottom-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* 侧边栏面板 - fixed overlay，top: 44px 不覆盖顶部栏，对标原型 */}
      <div
        data-testid="node-sidebar"
        className={`fixed top-11 left-0 bottom-0 w-[200px] z-50 bg-surface border-r border-border flex flex-col transition-transform duration-250 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
          <span className="text-xs font-medium text-text">节点</span>
          <button onClick={onClose} className="text-text-muted hover:text-text transition-colors" title="收起">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 分类列表 - 统一暗色滚动条 */}
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent hover:scrollbar-thumb-neutral-500">
          {NODE_CATEGORIES.map((category) => (
            <div key={category.title} className="mb-3">
              <div className="text-[10px] uppercase text-text-muted mb-1.5 px-1 tracking-wide">{category.title}</div>
              {category.items.map(({ type, label, icon: Icon }) => (
                <div
                  key={`${type}-${label}`}
                  data-testid={`add-node-${type}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, type)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-text bg-transparent hover:bg-surface-hover border border-transparent hover:border-border rounded-md cursor-grab active:cursor-grabbing transition-colors mb-0.5"
                  title={label}
                >
                  <Icon className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default memo(NodeSidebar);
