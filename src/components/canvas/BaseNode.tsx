// Ref: node-banana BaseNode.tsx + @xyflow/react NodeResizer
import { memo, type ReactNode } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';

// Ref: §6.2 — NodeResizer (#3b82f6) + 执行状态 + 展开/折叠
interface BaseNodeWrapperProps {
  selected: boolean;
  loading?: boolean;
  errorMessage?: string;
  children: ReactNode;
  minHeight?: number;
  minWidth?: number;
}

function BaseNodeWrapper({ selected, loading, errorMessage, children, minHeight = 80, minWidth = 160 }: BaseNodeWrapperProps) {
  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
        lineStyle={{ borderColor: '#3b82f6' }}
        handleStyle={{ borderColor: '#3b82f6', backgroundColor: '#1c1c1c', width: 8, height: 8 }}
      />
      <Handle type="target" position={Position.Left} className="!bg-[#555] !w-5 !h-5 !border-[3px] !border-[#222] hover:!bg-blue-500 hover:!w-6 hover:!h-6 hover:!border-white transition-all duration-200 z-20 shadow-lg cursor-crosshair" />
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 bg-[#1a1a1a]/80 backdrop-blur-sm z-10">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs">处理中...</span>
        </div>
      )}
      {errorMessage && !loading && (
        <div className="text-red-400 text-[10px] p-2 border border-red-500/30 rounded bg-red-500/10 flex items-start gap-1.5 mb-1">
          <span className="break-all leading-tight">{errorMessage}</span>
        </div>
      )}
      {children}
      <Handle type="source" position={Position.Right} className="!bg-[#555] !w-5 !h-5 !border-[3px] !border-[#222] hover:!bg-blue-500 hover:!w-6 hover:!h-6 hover:!border-white transition-all duration-200 z-20 shadow-lg cursor-crosshair" />
    </>
  );
}

export default memo(BaseNodeWrapper);