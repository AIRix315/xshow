// Ref: §3.6.1 — 视频输入节点（加载本地视频）
// Store-only 模式：对标 node-banana
import { memo, useCallback, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { VideoInputNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

function VideoInputNode({ id, data, selected }: NodeProps<VideoInputNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Store-only：直接读 data，不使用 useState
  const videoUrl = data.videoUrl ?? '';

  // 上传本地视频文件
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateNodeData(id, { videoUrl: url, filename: file.name });
    }
  }, [id, updateNodeData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file);
      updateNodeData(id, { videoUrl: url, filename: file.name });
    }
  }, [id, updateNodeData]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(() => {
    updateNodeData(id, { videoUrl: undefined, filename: undefined });
  }, [id, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} title="视频">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {videoUrl ? (
        <div className="relative w-full h-full overflow-hidden group rounded-lg">
          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a] rounded-lg">
            <video controls src={videoUrl} className="w-full h-full object-contain" />
          </div>
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-600/80 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
            title="移除视频"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="上传视频"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition-colors bg-[#1a1a1a] rounded-lg"
        >
          <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-text-muted mt-2">点击或拖拽上传视频</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
    </BaseNodeWrapper>
  );
}

export default memo(VideoInputNode);