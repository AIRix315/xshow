// Ref: node-banana BaseNode.tsx + @xyflow/react NodeResizer
// Ref: 对标 node-banana 样式 — 背景 #262626, 边框 #333, 圆角 8px
// Ref: 悬停展开模式 - 默认精简内容，hover 显示完整参数
import { memo, type ReactNode, useEffect, useState } from 'react';
import { NodeResizer, useNodeId, useUpdateNodeInternals } from '@xyflow/react';
import { Loader2, Check, XCircle, Settings, Play } from 'lucide-react';
import { useSettingsStore } from '@/stores/useSettingsStore';

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
  /** 调试信息（仅在 debugMode 下显示） */
  debugInfo?: string;
  /** 默认精简内容（始终显示）- 如图片预览 */
  children: ReactNode;
  /** 悬停时显示的完整参数内容（替代 children） */
  hoverContent?: ReactNode;
  /**
   * Handle 元素（与 children/hoverContent 平级渲染）。
   * 使用 hoverContent 的节点必须将 Handle 放在此处，
   * 而非 children 或 hoverContent 内部，避免 Handle 重复渲染导致连线漂移。
   */
  handles?: ReactNode;
  /** 点击设置按钮后显示的扩展面板（外部展开） */
  settingsPanel?: ReactNode;
  /** 最小宽度 */
  minWidth?: number;
  /** 最小高度 */
  minHeight?: number;
  /** 节点主题色（影响标题栏底边和选中态边框高亮） */
  accentColor?: string;
  /** 是否显示悬停标题栏（带切换和运行按钮） */
  showHoverHeader?: boolean;
  /** 悬停标题栏右侧的操作按钮 */
  headerActions?: ReactNode;
  /** 运行按钮点击回调 */
  onRun?: () => void;
  /** 切换展开/收起回调（用于无 hoverContent 的节点） */
  onToggle?: () => void;
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
  debugInfo,
  children,
  hoverContent,
  handles,
  settingsPanel,
  minWidth = 180,
  minHeight = 100,
  accentColor,
  showHoverHeader = false,
  headerActions,
  onRun,
  onToggle,
}: BaseNodeWrapperProps) {
  // 状态优先：如果传入 status 则使用 status，否则用 loading 推断
  const nodeStatus: NodeStatus = status ?? (loading ? 'loading' : 'idle');

  // 调试模式开关
  const debugMode = useSettingsStore((s) => s.systemSettings.debugMode);

  // 悬停展开状态（按钮切换，不依赖 CSS hover）
  // 生成类节点默认展开，处理类节点默认收起
  const [expanded, setExpanded] = useState(true);
  const toggleExpanded = () => setExpanded(!expanded);

  // 当 expanded 状态切换时，节点渲染高度变化，
  // 必须通知 React Flow 重新计算 Handle 位置，否则连线端点漂移
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    if (nodeId) {
      updateNodeInternals(nodeId);
    }
  }, [expanded, nodeId, updateNodeInternals]);

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

      {/* 错误消息提示 - 显示在节点上方 */}
      {errorMessage && (
        <div className="absolute -top-7 left-0 right-0 z-30">
          <div className="bg-red-500/95 text-white text-[10px] px-2 py-1 rounded truncate max-w-full shadow-lg">
            {errorMessage}
          </div>
        </div>
      )}

      {/* 调试信息 - 显示在节点上方（紧贴错误信息下方） */}
      {debugMode && debugInfo && (
        <div className={`absolute ${errorMessage ? '-top-14' : '-top-7'} left-0 right-0 z-20`}>
          <div className="bg-yellow-500/90 text-black text-[9px] px-2 py-0.5 rounded truncate max-w-full shadow-lg font-mono">
            {debugInfo}
          </div>
        </div>
      )}

      {/* 节点容器 - 对标 node-banana 样式: bg=#262626, border=#333, rounded=8px */}
      <div
        className={`
          w-full h-full flex flex-col overflow-visible relative
          bg-[#262626] rounded-lg shadow-lg border
          ${
            nodeStatus === 'loading'
              ? 'border-blue-500 ring-1 ring-blue-500/20'
              : nodeStatus === 'error'
              ? 'border-red-500'
              : selected
              ? `border-blue-500 ring-2 ring-blue-500/40 shadow-lg shadow-blue-500/25`
              : 'border-[#333]'
          }
        `}
        style={{
          transition: 'var(--reduce-anim, inherit)',
          ...(accentColor && selected ? {
            borderColor: accentColor,
            boxShadow: `0 0 0 2px ${accentColor}40, 0 4px 12px ${accentColor}25`,
          } : {}),
        }}
      >
        {/* 标题栏 - 始终显示在节点上方，左对齐 */}
        {title && (
          <div
            className="absolute -top-5 left-0 right-0 z-10 flex items-center px-2 pt-0.5 font-sans pointer-events-none"
          >
            <span className="text-[0.625rem] text-neutral-400 truncate">{title}</span>
          </div>
        )}

        {/* 悬停操作栏 - 显示在节点上方，右侧，仅悬停时显示 */}
        {showHoverHeader && (
          <div className="absolute -top-5 left-0 right-0 z-20 flex items-center justify-end px-2 pt-0.5 font-sans opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-1">
              {/* 切换按钮 - 有 hoverContent 用 expanded，无 hoverContent 但有 onToggle 也显示 */}
              {(hoverContent || onToggle) && (
                <button
                  onClick={() => hoverContent ? toggleExpanded() : onToggle?.()}
                  className="p-0.5 hover:bg-neutral-700 rounded"
                  title={hoverContent ? (expanded ? '收起' : '展开') : '切换'}
                >
                  <Settings className={`w-3 h-3 text-neutral-400 hover:text-white transition-transform ${(hoverContent && expanded) || (!hoverContent && onToggle) ? 'rotate-180' : ''}`} />
                </button>
              )}
              {/* 运行按钮 - 有 onRun 时显示 */}
              {onRun && (
                <button
                  onClick={onRun}
                  disabled={loading}
                  className="p-0.5 hover:bg-neutral-700 rounded disabled:opacity-50"
                  title="运行"
                >
                  <Play className="w-3 h-3 text-neutral-400 hover:text-white" />
                </button>
              )}
              {headerActions}
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

        {/* 精简内容 - 默认显示（图片预览等）- 无边距填充 */}
        {hoverContent ? (
          <div className={`flex-1 min-h-0 overflow-hidden rounded-lg ${expanded ? 'hidden' : ''}`}>
            {children}
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-hidden rounded-lg">
            {children}
          </div>
        )}

        {/* 悬停完整内容 - 仅展开时显示，参数在底部 */}
        {hoverContent && (
          <div className={`flex-1 min-h-0 overflow-hidden rounded-lg flex-col ${expanded ? '' : 'hidden'}`}>
            {hoverContent}
          </div>
        )}

        {/* Handle 容器 - 与 children/hoverContent 平级，避免重复渲染导致连线漂移 */}
        {handles && (
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
            {handles}
          </div>
        )}
      </div>

      {/* 设置面板 - 外部展开（对标 node-banana settingsPanel） */}
      {settingsPanel && (
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