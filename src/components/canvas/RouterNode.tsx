// Ref: node-banana RouterNode — 类型感知路由
// Handle ID 即类型名: "image", "video", "audio", "text"
// 输入输出一一对应: input id="image" ↔ output id="image"
// 动态推导: 从 incoming edges 的 targetHandle 推断连接类型
import { memo, useMemo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import type { RouterNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';
import { useFlowStore } from '@/stores/useFlowStore';

// 所有已知的 handle 类型
const ALL_HANDLE_TYPES = ['image', 'video', 'audio', 'text'] as const;
type HandleType = (typeof ALL_HANDLE_TYPES)[number];

// Handle 颜色映射（与项目其他节点一致）
const HANDLE_COLORS: Record<HandleType, string> = {
  image: '#10b981',   // emerald
  video: '#ffffff',   // white
  audio: 'rgb(167, 139, 250)', // violet
  text: '#3b82f6',   // blue
};

// Handle 标签显示名
const HANDLE_LABELS: Record<HandleType, string> = {
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  text: 'Text',
};

// 泛型 handle 颜色
const GENERIC_COLOR = '#6b7280'; // gray-500

function RouterNode({ id, data, selected }: NodeProps<RouterNodeType>) {
  const edges = useFlowStore((state) => state.edges);
  const updateNodeInternals = useUpdateNodeInternals();

  // 从 incoming edges 推导活跃的输入类型
  const activeInputTypes = useMemo(() => {
    const typeSet = new Set<HandleType>();

    edges
      .filter((edge) => edge.target === id)
      .forEach((edge) => {
        const targetHandle = edge.targetHandle;
        if (!targetHandle) return;

        // 如果连到已知类型 handle（image/video/audio/text），激活该类型
        if (ALL_HANDLE_TYPES.includes(targetHandle as HandleType)) {
          typeSet.add(targetHandle as HandleType);
        }
        // 如果连到泛型 handle（input/any-input/generic-input），
        // 检查 upstream 来推断类型
        if (
          targetHandle === 'input' ||
          targetHandle === 'any-input' ||
          targetHandle === 'generic-input'
        ) {
          // 泛型连接：标记所有类型为激活
          ALL_HANDLE_TYPES.forEach((t) => typeSet.add(t));
        }
      });

    return Array.from(typeSet).sort() as HandleType[];
  }, [edges, id]);

  // 当没有特定类型连接时，显示泛型 handle
  const showGenericHandle = activeInputTypes.length === 0;

  // Handle 布局计算
  const handleSpacing = 24;
  const baseOffset = 38; // 偏移以避开标题栏

  const totalHandleSlots = activeInputTypes.length + (showGenericHandle ? 1 : 0);
  const lastHandleTop = baseOffset + (Math.max(totalHandleSlots, 1) - 1) * handleSpacing;
  const minHeight = lastHandleTop + 28;

  // 当 handle 数量变化时通知 React Flow 重新布局
  useEffect(() => {
    updateNodeInternals(id);
  }, [activeInputTypes.length, id, updateNodeInternals]);

  return (
    <BaseNodeWrapper selected={!!selected} title="路由" minHeight={minHeight}>
      {/* 输入 handles（左侧） */}
      {activeInputTypes.map((type, index) => (
        <Handle
          key={`input-${type}`}
          type="target"
          position={Position.Left}
          id={type}
          data-handletype={type}
          style={{
            top: baseOffset + index * handleSpacing,
            backgroundColor: HANDLE_COLORS[type],
            width: 12,
            height: 12,
            border: '2px solid #1e1e1e',
            zIndex: 10,
          }}
        />
      ))}
      {/* 输入 handle 标签 */}
      {activeInputTypes.map((type, index) => (
        <div
          key={`input-label-${type}`}
          className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right"
          data-type={type}
          style={{
            right: 'calc(100% + 8px)',
            top: baseOffset + index * handleSpacing - 8,
            zIndex: 10,
          }}
        >
          {HANDLE_LABELS[type]}
        </div>
      ))}

      {/* 泛型输入（无特定类型连接时显示） */}
      {showGenericHandle && (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id="generic-input"
            style={{
              top: baseOffset,
              backgroundColor: GENERIC_COLOR,
              width: 12,
              height: 12,
              border: '2px solid #1e1e1e',
              zIndex: 10,
            }}
          />
          <div
            className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right"
            data-type="any"
            style={{
              right: 'calc(100% + 8px)',
              top: baseOffset - 8,
              zIndex: 10,
            }}
          >
            Any
          </div>
        </>
      )}

      {/* 节点主体 */}
      <div className="flex flex-col gap-1 p-2 min-w-[160px]">
        <span className="text-[10px] text-text-secondary font-medium">Router</span>
        <div className="text-[10px] text-text-muted text-center">
          {activeInputTypes.length > 0
            ? `${activeInputTypes.length} 类型路由`
            : '等待连接'}
        </div>
        {data.inputValue != null && (
          <div className="h-6 bg-surface rounded border border-border flex items-center justify-center text-[10px] text-text-muted overflow-hidden px-1">
            {String(data.inputValue as string).slice(0, 30)}
          </div>
        )}
      </div>

      {/* 输出 handles（右侧） — 与输入类型一一对应 */}
      {activeInputTypes.map((type, index) => (
        <Handle
          key={`output-${type}`}
          type="source"
          position={Position.Right}
          id={type}
          data-handletype={type}
          style={{
            top: baseOffset + index * handleSpacing,
            backgroundColor: HANDLE_COLORS[type],
            width: 12,
            height: 12,
            border: '2px solid #1e1e1e',
            zIndex: 10,
          }}
        />
      ))}
      {/* 输出 handle 标签 */}
      {activeInputTypes.map((type, index) => (
        <div
          key={`output-label-${type}`}
          className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none"
          data-type={type}
          style={{
            left: 'calc(100% + 8px)',
            top: baseOffset + index * handleSpacing - 8,
            zIndex: 10,
          }}
        >
          {HANDLE_LABELS[type]}
        </div>
      ))}

      {/* 泛型输出 */}
      {showGenericHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id="generic-output"
          style={{
            top: baseOffset,
            backgroundColor: GENERIC_COLOR,
            width: 12,
            height: 12,
            border: '2px solid #1e1e1e',
            zIndex: 10,
          }}
        />
      )}
    </BaseNodeWrapper>
  );
}

export default memo(RouterNode);