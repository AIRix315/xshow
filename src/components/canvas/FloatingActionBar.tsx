// Ref: node-banana FloatingActionBar.tsx + XShow node types
// Ref: XShow 全局执行引擎集成
import { useState, useRef, useCallback, useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useFlowStore } from '@/stores/useFlowStore';
import { createNode } from '@/utils/nodeFactory';
import {
  Image,
  FileText,
  Video,
  Mic,
  Grid3X3,
  LayoutGrid,
  Scissors,
  Settings,
  Play,
  Square,
  ChevronDown,
  Loader2,
} from 'lucide-react';

// 节点类型定义
type NodeType =
  | 'imageNode'
  | 'textNode'
  | 'videoNode'
  | 'audioNode'
  | 'gridSplitNode'
  | 'gridMergeNode'
  | 'cropNode'
  | 'customNode';

// 节点分类
const NODE_CATEGORIES: { label: string; nodes: { type: NodeType; label: string; icon: string }[] }[] = [
  {
    label: 'Input',
    nodes: [
      { type: 'imageNode', label: 'Image', icon: 'image' },
      { type: 'videoNode', label: 'Video', icon: 'video' },
      { type: 'audioNode', label: 'Audio', icon: 'audio' },
    ],
  },
  {
    label: 'Text',
    nodes: [
      { type: 'textNode', label: 'Prompt', icon: 'text' },
    ],
  },
  {
    label: 'Process',
    nodes: [
      { type: 'cropNode', label: 'Crop', icon: 'crop' },
      { type: 'gridSplitNode', label: 'Split Grid', icon: 'split' },
      { type: 'gridMergeNode', label: 'Merge Grid', icon: 'merge' },
    ],
  },
  {
    label: 'Custom',
    nodes: [
      { type: 'customNode', label: '万能节点', icon: 'custom' },
    ],
  },
];

// 图标映射 - 使用字符串 key 获取图标组件
const getIcon = (iconName: string) => {
  switch (iconName) {
    case 'image':
      return Image;
    case 'text':
      return FileText;
    case 'video':
      return Video;
    case 'audio':
      return Mic;
    case 'crop':
      return Scissors;
    case 'split':
      return Grid3X3;
    case 'merge':
      return LayoutGrid;
    case 'custom':
      return Settings;
    default:
      return Settings;
  }
};

// 获取画布中心位置
function getPaneCenter() {
  const pane = document.querySelector('.react-flow');
  if (pane) {
    const rect = pane.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

interface NodeButtonProps {
  type: NodeType;
  label: string;
}

function NodeButton({ type, label }: NodeButtonProps) {
  const addNode = useFlowStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();

  const handleClick = useCallback(() => {
    const center = getPaneCenter();
    const position = screenToFlowPosition({
      x: center.x + Math.random() * 100 - 50,
      y: center.y + Math.random() * 100 - 50,
    });
    const node = createNode(type, position);
    addNode(node);
  }, [type, addNode, screenToFlowPosition]);

  return (
    <button
      onClick={handleClick}
      className="px-2.5 py-1.5 text-[11px] font-medium text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 rounded transition-colors cursor-grab"
    >
      {label}
    </button>
  );
}

function GenerateDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const addNode = useFlowStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAddNode = useCallback(
    (nodeType: NodeType) => {
      const center = getPaneCenter();
      const position = screenToFlowPosition({
        x: center.x + Math.random() * 100 - 50,
        y: center.y + Math.random() * 100 - 50,
      });
      const node = createNode(nodeType, position);
      addNode(node);
      setIsOpen(false);
    },
    [addNode, screenToFlowPosition],
  );

  const generationNodes: { type: NodeType; label: string; icon: string }[] = [
    { type: 'imageNode', label: 'Image', icon: 'image' },
    { type: 'textNode', label: 'LLM/Text', icon: 'text' },
    { type: 'videoNode', label: 'Video', icon: 'video' },
    { type: 'audioNode', label: 'Audio', icon: 'audio' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-2.5 py-1.5 text-[11px] font-medium text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 rounded transition-colors flex items-center gap-1"
      >
        Generate
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
          {generationNodes.map((node) => {
            const IconComponent = getIcon(node.icon);
            return (
              <button
                key={node.type}
                onClick={() => handleAddNode(node.type)}
                className="w-full px-3 py-2 text-left text-[11px] font-medium text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors flex items-center gap-2 cursor-grab"
              >
                <IconComponent className="w-4 h-4" />
                {node.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AllNodesMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const addNode = useFlowStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleAddNode = useCallback(
    (nodeType: NodeType) => {
      const center = getPaneCenter();
      const position = screenToFlowPosition({
        x: center.x + Math.random() * 100 - 50,
        y: center.y + Math.random() * 100 - 50,
      });
      const node = createNode(nodeType, position);
      addNode(node);
      setIsOpen(false);
    },
    [addNode, screenToFlowPosition],
  );

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-2.5 py-1.5 text-[11px] font-medium text-neutral-400 hover:text-neutral-100 hover:bg-neutral-700 rounded transition-colors flex items-center gap-1"
      >
        All nodes
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl overflow-hidden min-w-[180px] max-h-[400px] overflow-y-auto">
          {NODE_CATEGORIES.map((category, catIndex) => (
            <div key={category.label}>
              <div
                className={`px-3 py-1 text-[10px] text-neutral-500 uppercase tracking-wide${
                  catIndex > 0 ? ' border-t border-neutral-700' : ''
                }`}
              >
                {category.label}
              </div>
              {category.nodes.map((node) => {
                const IconComponent = getIcon(node.icon);
                return (
                  <button
                    key={node.type}
                    onClick={() => handleAddNode(node.type)}
                    className="w-full px-3 py-2 text-left text-[11px] font-medium text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors flex items-center gap-2 cursor-grab"
                  >
                    <IconComponent className="w-4 h-4" />
                    {node.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FloatingActionBar() {
  const isRunning = useFlowStore((s) => s.isRunning);
  const currentNodeIds = useFlowStore((s) => s.currentNodeIds);
  const executeWorkflow = useFlowStore((s) => s.executeWorkflow);
  const stopWorkflow = useFlowStore((s) => s.stopWorkflow);

  // 获取正在执行的节点数量
  const runningNodeCount = currentNodeIds.length;

  const handleRunClick = useCallback(() => {
    if (isRunning) {
      stopWorkflow();
    } else {
      executeWorkflow();
    }
  }, [isRunning, executeWorkflow, stopWorkflow]);

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50">
      <div className="flex items-center gap-0.5 bg-neutral-800/95 rounded-lg shadow-lg border border-neutral-700/80 px-1.5 py-1">
        {/* 基础节点按钮 */}
        <NodeButton type="imageNode" label="Image" />
        <NodeButton type="videoNode" label="Video" />
        <NodeButton type="textNode" label="Prompt" />
        <NodeButton type="audioNode" label="Audio" />

        {/* 分隔线 */}
        <div className="w-px h-5 bg-neutral-600 mx-1.5" />

        {/* Generate 下拉菜单 */}
        <GenerateDropdown />

        {/* All nodes 下拉菜单 */}
        <AllNodesMenu />

        {/* 分隔线 */}
        <div className="w-px h-5 bg-neutral-600 mx-1.5" />

        {/* 执行按钮 */}
        <button
          onClick={handleRunClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded transition-colors ${
            isRunning
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-white text-neutral-900 hover:bg-neutral-200'
          }`}
        >
          {isRunning ? (
            <>
              {runningNodeCount > 1 ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>{runningNodeCount} nodes</span>
                </>
              ) : (
                <>
                  <Square className="w-3 h-3" />
                  <span>Stop</span>
                </>
              )}
            </>
          ) : (
            <>
              <Play className="w-3 h-3" />
              <span>Run</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}