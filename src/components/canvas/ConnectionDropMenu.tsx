// Ref: node-banana ConnectionDropMenu.tsx
// 拖拽连线未连接到目标时，弹出可连接节点菜单
import { memo, useState, useEffect, useCallback } from 'react';
import type { Node } from '@xyflow/react';

/** 节点类型及其可接受的输入类型 */
const NODE_ACCEPTS: Record<string, string[]> = {
  // Input 节点
  imageInputNode: ['image'],
  audioNode: ['audio'],
  videoInputNode: ['video'],
  viewer3DNode: ['image', 'model'],
  textInputNode: ['text'],
  // Generate 节点
  imageNode: ['image', 'text'],
  promptNode: ['text'],
  textNode: ['text'],
  videoNode: ['video', 'text'],
  gridSplitNode: ['image'],
  gridMergeNode: ['image'],
  cropNode: ['image'],
  customNode: ['any'],
  promptConstructorNode: ['text'],
  generateAudioNode: ['text'],
  generate3DNode: ['text'],
  annotateNode: ['image'],
  videoStitchNode: ['video'],
  videoTrimNode: ['video'],
  easeCurveNode: ['value'],
  frameGrabNode: ['video'],
  imageCompareNode: ['image'],
  routerNode: ['any'],
  switchNode: ['any'],
  conditionalSwitchNode: ['any'],
  outputNode: ['any'],
  outputGalleryNode: ['any'],
};

/** 节点类型显示名 */
const NODE_LABELS: Record<string, string> = {
  // Input 节点
  imageInputNode: '图片输入',
  audioNode: '音频输入',
  videoInputNode: '视频输入',
  viewer3DNode: '3D查看',
  textInputNode: '文本输入',
  // Generate 节点
  imageNode: '生成图片',
  promptNode: '提示词',
  textNode: '生成文本',
  videoNode: '生成视频',
  generateAudioNode: '生成音频',
  generate3DNode: '生成3D',
  // 工具节点
  gridSplitNode: '宫格拆',
  gridMergeNode: '宫格拼',
  cropNode: '裁剪',
  annotateNode: '标注',
  videoStitchNode: '视频拼接',
  videoTrimNode: '视频裁剪',
  frameGrabNode: '帧提取',
  imageCompareNode: '图片对比',
  easeCurveNode: '缓动曲线',
  // 逻辑节点
  routerNode: '路由',
  switchNode: '开关',
  conditionalSwitchNode: '条件路由',
  promptConstructorNode: '提示词构造',
  customNode: '万能节点',
  // 输出节点
  outputNode: '输出',
  outputGalleryNode: '图集',
};

/** 节点分组 */
const NODE_GROUPS: Record<string, string[]> = {
  '输入': ['imageInputNode', 'audioNode', 'videoInputNode', 'textInputNode'],
  '生成': ['imageNode', 'videoNode', 'generateAudioNode', 'generate3DNode', 'promptNode', 'textNode'],
  '工具': ['gridSplitNode', 'gridMergeNode', 'cropNode', 'annotateNode', 'videoStitchNode', 'videoTrimNode', 'frameGrabNode', 'imageCompareNode', 'easeCurveNode'],
  '逻辑': ['routerNode', 'switchNode', 'conditionalSwitchNode', 'promptConstructorNode', 'customNode'],
  '输出': ['outputNode', 'outputGalleryNode', 'viewer3DNode'],
};

interface ConnectionDropMenuProps {
  position: { x: number; y: number } | null;
  sourceHandleType: string | null;
  nodes: Node[];
  onSelect: (nodeType: string) => void;
  onClose: () => void;
}

function ConnectionDropMenu({ position, sourceHandleType, onSelect, onClose }: ConnectionDropMenuProps) {
  const [filter, setFilter] = useState('');

  // 计算兼容节点类型
  const compatibleTypes = Object.entries(NODE_ACCEPTS)
    .filter(([, accepts]) => {
      if (!sourceHandleType || sourceHandleType === 'any') return true;
      return accepts.includes(sourceHandleType) || accepts.includes('any');
    })
    .filter(([type]) => {
      const label = NODE_LABELS[type] ?? type;
      return label.toLowerCase().includes(filter.toLowerCase());
    });

  // 按分组整理兼容节点
  const groupedNodes = compatibleTypes.reduce<Record<string, string[]>>((acc, [type]) => {
    for (const [groupName, nodeTypes] of Object.entries(NODE_GROUPS)) {
      if (nodeTypes.includes(type)) {
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(type);
        break;
      }
    }
    // 未分类的节点放入"其他"
    if (!Object.values(NODE_GROUPS).flat().includes(type)) {
      if (!acc['其他']) acc['其他'] = [];
      acc['其他'].push(type);
    }
    return acc;
  }, {});

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!position) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* 菜单 */}
      <div
        className="fixed z-50 bg-surface border border-border rounded-lg shadow-xl py-1 min-w-[180px] max-h-[320px] overflow-y-auto"
        style={{ left: position.x, top: position.y }}
      >
        <div className="px-2 py-1.5 border-b border-border">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="搜索节点..."
            autoFocus
            className="w-full bg-surface-hover text-text text-[10px] rounded px-2 py-1 border border-border outline-none focus:border-primary"
          />
        </div>
        {compatibleTypes.length === 0 ? (
          <div className="px-3 py-2 text-[10px] text-text-muted">无兼容节点</div>
        ) : (
          Object.entries(groupedNodes).map(([groupName, nodeTypes]) => (
            <div key={groupName}>
              <div className="px-3 py-1 text-[10px] text-text-muted bg-surface-hover">{groupName}</div>
              {nodeTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => onSelect(type)}
                  className="w-full text-left px-3 py-1.5 text-xs text-text hover:bg-surface-hover transition-colors pl-6"
                >
                  {NODE_LABELS[type] ?? type}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default memo(ConnectionDropMenu);
