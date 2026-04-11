// Ref: node-banana BaseNode.tsx + @xyflow/react NodeResizer + Context7 best practices
// Ref: §6.2 — NodeResizer + 执行状态 + 展开/折叠
import { memo, useState, type ReactNode, type MouseEvent } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';
import { MoreHorizontal, Play, Loader2, Check, XCircle, Trash2, Copy, Settings } from 'lucide-react';

// =============================================================================
// 类型定义
// =============================================================================

/** 节点状态枚举 */
export type NodeStatus = 'idle' | 'loading' | 'complete' | 'error';

/** Handle 配置 */
export interface HandleConfig {
  type: 'target' | 'source';
  position: Position;
  id?: string;
  className?: string;
}

/** 节点标题配置 */
export interface NodeHeaderConfig {
  icon?: ReactNode;
  title: string;
  status?: NodeStatus;
}

/** BaseNode 包装器 Props */
export interface BaseNodeWrapperProps {
  selected: boolean;
  /** @deprecated 使用 status 替代 */
  loading?: boolean;
  /** 节点状态 */
  status?: NodeStatus;
  /** 错误消息 */
  errorMessage?: string;
  /** 子内容 */
  children: ReactNode;
  /** 节点标题配置 */
  header?: NodeHeaderConfig;
  /** 最小高度 */
  minHeight?: number;
  /** 最小宽度 */
  minWidth?: number;
  /** 是否显示运行按钮 */
  showRunButton?: boolean;
  /** 是否显示菜单按钮 */
  showMenuButton?: boolean;
  /** 自定义 Handle 配置 */
  handles?: HandleConfig[];
  /** 运行按钮回调 */
  onRun?: (e: MouseEvent) => void;
  /** 设置按钮回调 */
  onSettings?: (e: MouseEvent) => void;
  /** 删除按钮回调 */
  onDelete?: (e: MouseEvent) => void;
  /** 复制按钮回调 */
  onDuplicate?: (e: MouseEvent) => void;
}

// =============================================================================
// 状态颜色映射
// =============================================================================

const STATUS_CONFIG: Record<NodeStatus, { border: string; bg: string; icon: ReactNode }> = {
  idle: {
    border: 'border-border',
    bg: '',
    icon: null,
  },
  loading: {
    border: 'border-primary animate-pulse',
    bg: 'bg-surface/80',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
  },
  complete: {
    border: 'border-green-500',
    bg: '',
    icon: <Check className="w-4 h-4 text-green-500" />,
  },
  error: {
    border: 'border-error',
    bg: 'bg-error/10',
    icon: <XCircle className="w-4 h-4 text-error" />,
  },
};

// =============================================================================
// 默认 Handle 配置
// =============================================================================

const DEFAULT_HANDLES: HandleConfig[] = [
  { type: 'target', position: Position.Left, id: 'input' },
  { type: 'source', position: Position.Right, id: 'output' },
];

// =============================================================================
// NodeHeader 组件 - 可拖拽标题栏
// =============================================================================

interface NodeHeaderProps {
  config: NodeHeaderConfig;
  showRunButton?: boolean;
  showMenuButton?: boolean;
  onRun?: (e: MouseEvent) => void;
  onSettings?: (e: MouseEvent) => void;
  onDelete?: (e: MouseEvent) => void;
  onDuplicate?: (e: MouseEvent) => void;
}

const NodeHeader = memo(function NodeHeader({
  config,
  showRunButton = true,
  showMenuButton = true,
  onRun,
  onSettings,
  onDelete,
  onDuplicate,
}: NodeHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const status = config.status || 'idle';

  const handleRunClick = (e: MouseEvent) => {
    e.stopPropagation();
    onRun?.(e);
  };

  const handleMenuClick = (e: MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };

  const handleAction = (action: (e: MouseEvent) => void) => (_e: MouseEvent) => {
    action?.(_e);
    setMenuOpen(false);
  };

  const statusConfig = STATUS_CONFIG[status];

  return (
    <div
      className={`flex items-center justify-between px-2 py-1.5 border-b cursor-move select-none ${statusConfig.border} ${statusConfig.bg}`}
    >
      {/* 左侧：图标 + 标题 + 状态图标 */}
      <div className="flex items-center gap-2 overflow-hidden">
        {config.icon && (
          <span className="flex-shrink-0 text-text-secondary">
            {config.icon}
          </span>
        )}
        <span className="text-xs text-text font-medium truncate">
          {config.title}
        </span>
        {statusConfig.icon && (
          <span className="flex-shrink-0">
            {statusConfig.icon}
          </span>
        )}
      </div>

      {/* 右侧：操作按钮 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* 运行按钮 */}
        {showRunButton && onRun && (
          <button
            onClick={handleRunClick}
            className="nodrag p-1 rounded hover:bg-surface-hover transition-colors"
            title="运行"
          >
            <Play className="w-3 h-3 text-primary" />
          </button>
        )}

        {/* 菜单按钮 */}
        {showMenuButton && (
          <div className="relative">
            <button
              onClick={handleMenuClick}
              className="nodrag p-1 rounded hover:bg-surface-hover transition-colors"
              title="更多"
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>

            {/* 下拉菜单 */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-24 bg-surface border border-border rounded shadow-lg z-50">
                {onSettings && (
                  <button
                    onClick={handleAction(onSettings)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-hover transition-colors"
                  >
                    <Settings className="w-3 h-3" />
                    设置
                  </button>
                )}
                {onDuplicate && (
                  <button
                    onClick={handleAction(onDuplicate)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-surface-hover transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    复制
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={handleAction(onDelete)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-error hover:bg-surface-hover transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    删除
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// LoadingOverlay 组件
// =============================================================================

const LoadingOverlay = memo(function LoadingOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-secondary bg-surface/80 backdrop-blur-sm z-10">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <span className="text-xs">处理中...</span>
    </div>
  );
});

// =============================================================================
// ErrorDisplay 组件
// =============================================================================

const ErrorDisplay = memo(function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-1.5 p-2 border border-error/30 rounded bg-error/10 mb-1">
      <XCircle className="w-3 h-3 text-error flex-shrink-0 mt-0.5" />
      <span className="text-[10px] text-error break-all leading-tight">{message}</span>
    </div>
  );
});

// =============================================================================
// BaseNodeWrapper 主组件
// =============================================================================

function BaseNodeWrapper({
  selected,
  loading,
  status = 'idle',
  errorMessage,
  children,
  header,
  minHeight = 80,
  minWidth = 160,
  showRunButton = true,
  showMenuButton = true,
  handles = DEFAULT_HANDLES,
  onRun,
  onSettings,
  onDelete,
  onDuplicate,
}: BaseNodeWrapperProps) {
  // 向后兼容：loading 属性映射到 status
  const finalStatus = loading ? 'loading' : status;
  const statusStyle = STATUS_CONFIG[finalStatus];

  return (
    <div
      className={`relative rounded-lg border-2 transition-all duration-200 ${
        selected
          ? statusStyle.border + ' shadow-lg shadow-primary/20'
          : 'border-border'
      } ${statusStyle.bg}`}
    >
      {/* NodeResizer - 选中时显示调整大小手柄 */}
      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
        lineStyle={{ borderColor: '#3b82f6' }}
        handleStyle={{
          borderColor: '#3b82f6',
          backgroundColor: '#1c1c1c',
          width: 8,
          height: 8,
        }}
      />

      {/* 标题栏 */}
      {header && (
        <NodeHeader
          config={header}
          showRunButton={showRunButton}
          showMenuButton={showMenuButton}
          onRun={onRun}
          onSettings={onSettings}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
        />
      )}

      {/* Handles - 从配置渲染 */}
      {handles.map((handle, idx) => (
        <Handle
          key={`${handle.type}-${handle.position}-${handle.id || idx}`}
          type={handle.type}
          position={handle.position}
          id={handle.id}
          className={handle.className || getDefaultHandleClass(handle.type)}
        />
      ))}

      {/* Loading 状态覆盖层 */}
      {finalStatus === 'loading' && <LoadingOverlay />}

      {/* Error 状态显示 */}
      {finalStatus === 'error' && errorMessage && <ErrorDisplay message={errorMessage} />}

      {/* 内容区域 */}
      <div className="flex-1">{children}</div>
    </div>
  );
}

/** 获取默认 Handle 样式类 */
function getDefaultHandleClass(type: 'target' | 'source'): string {
  return type === 'target'
    ? '!bg-handle-default !w-5 !h-5 !border-[3px] !border-[#222] hover:!bg-primary hover:!w-6 hover:!h-6 hover:!border-white transition-all duration-200 z-20 shadow-lg cursor-crosshair'
    : '!bg-handle-default !w-5 !h-5 !border-[3px] !border-[#222] hover:!bg-primary hover:!w-6 hover:!h-6 hover:!border-white transition-all duration-200 z-20 shadow-lg cursor-crosshair';
}

// =============================================================================
// 导出
// =============================================================================

export default memo(BaseNodeWrapper);