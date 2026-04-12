// Ref: node-banana BaseNode.tsx + @xyflow/react NodeResizer
// Ref: 对标 node-banana 样式 — 背景 #262626, 边框 #333, 圆角 8px
// Ref: 悬停展开模式 - 默认精简内容，hover 显示完整参数
import { memo, type ReactNode, useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import { Loader2, Check, XCircle, Settings, ChevronDown, ChevronRight } from 'lucide-react';

// =============================================================================
// 类型定义
// =============================================================================

/** 节点状态枚举 */
export type NodeStatus = 'idle' | 'loading' | 'complete' | 'error';

/** BaseNode 包装器 Props */
export interface BaseNodeWrapperProps {
  selected: boolean;
  /** 节点标题（显示在头部） */
  title?: string;
  /** 是否正在加载 */
  loading?: boolean;
  /** 节点状态 */
  status?: NodeStatus;
  /** 错误消息 */
  errorMessage?: string;
  /** 默认精简内容（始终显示）- 如图片预览 */
  children: ReactNode;
  /** 悬停时显示的完整参数内容（替代 children） */
  hoverContent?: ReactNode;
  /** 点击设置按钮后显示的扩展面板（外部展开） */
  settingsPanel?: ReactNode;
  /** 设置按钮点击回调 */
  onSettings?: () => void;
  /** 最小宽度 */
  minWidth?: number;
  /** 最小高度 */
  minHeight?: number;
}

// =============================================================================
// BaseNodeWrapper 包装器 - 统一处理状态 + 错误显示 + 悬停展开 + 设置面板
// =============================================================================

function BaseNodeWrapper({
  selected,
  title,
  loading = false,
  status,
  errorMessage,
  children,
  hoverContent,
  settingsPanel,
  onSettings,
  minWidth = 180,
  minHeight = 100,
}: BaseNodeWrapperProps) {
  // 状态优先：如果传入 status 则使用 status，否则用 loading 推断
  const nodeStatus: NodeStatus = status ?? (loading ? 'loading' : 'idle');
  
  // 设置面板展开状态
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  return (
    <div className="relative w-full h-full group">
      {/* NodeResizer - 选中时显示调整大小手柄 */}
      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
        lineClassName="!border-transparent"
        handleClassName="!w-5 !h-5 !bg-transparent !border-none"
      />

      {/* 节点容器 - 对标 node-banana 样式: bg=#262626, border=#333, rounded=8px */}
      <div
        className={`
          w-full h-full flex flex-col overflow-visible relative
          bg-[#262626] rounded-lg shadow-lg border
          ${settingsExpanded ? 'rounded-b-none' : ''}
          ${
            nodeStatus === 'loading'
              ? 'border-blue-500 ring-1 ring-blue-500/20'
              : nodeStatus === 'error'
              ? 'border-red-500'
              : selected
              ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/25'
              : 'border-[#333]'
          }
        `}
      >
        {/* 标题栏 - 对标: bg=#262626, border-bottom=#333 */}
        {title && (
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#333] bg-[#262626] rounded-t-lg">
            <span className="text-[10px] font-semibold uppercase text-[#9ca3af] truncate">{title}</span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {settingsPanel && (
                <button 
                  onClick={() => setSettingsExpanded(!settingsExpanded)}
                  className="text-[10px] text-neutral-500 hover:text-white p-0.5"
                  title="展开设置"
                >
                  {settingsExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </button>
              )}
              {onSettings && (
                <button onClick={onSettings} className="text-[10px] text-neutral-500 hover:text-white p-0.5">
                  <Settings className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* 状态指示器 */}
        {nodeStatus !== 'idle' && (
          <div className="absolute top-2 right-2 z-10">
            {nodeStatus === 'loading' && (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            )}
            {nodeStatus === 'complete' && (
              <Check className="w-4 h-4 text-green-500" />
            )}
            {nodeStatus === 'error' && (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
        )}

        {/* 错误消息提示 */}
        {errorMessage && (
          <div className="absolute top-2 left-2 right-8 z-10">
            <div className="bg-red-500/90 text-white text-[10px] px-2 py-1 rounded truncate max-w-full">
              {errorMessage}
            </div>
          </div>
        )}

        {/* 精简内容 - 默认显示（图片预览等）- 无边距填充 */}
        {hoverContent ? (
          <div className="flex-1 min-h-0 overflow-hidden group-hover:hidden">
            {children}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
        )}

        {/* 悬停完整内容 - 仅 hover 时显示，参数在底部 */}
        {hoverContent && (
          <div className="hidden group-hover:flex flex-1 min-h-0 overflow-hidden flex-col">
            {hoverContent}
          </div>
        )}
      </div>

      {/* 设置面板 - 外部展开（对标 node-banana settingsPanel） */}
      {settingsPanel && settingsExpanded && (
        <div className="w-full bg-[#1c1c1c] border border-t-0 border-[#333] rounded-b-lg shadow-lg">
          {settingsPanel}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 导出
// =============================================================================

export default memo(BaseNodeWrapper);