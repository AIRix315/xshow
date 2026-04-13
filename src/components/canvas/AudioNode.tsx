// Ref: §6.6 — 音频节点 Input 模式（仅上传加载）
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
import { memo, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AudioNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

function AudioNodeComponent({ id, data, selected }: NodeProps<AudioNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  // Store-only: read directly from data
  const audioUrl = data.audioUrl ?? '';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 仅上传本地音频文件（Blob URL）
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 使用 Blob URL 加载本地文件
      const url = URL.createObjectURL(file);
      updateNodeData(id, { audioUrl: url });
    }
  }, [id, updateNodeData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('audio/')) return;

    const url = URL.createObjectURL(file);
    updateNodeData(id, { audioUrl: url });
  }, [id, updateNodeData]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(() => {
    updateNodeData(id, { audioUrl: undefined });
  }, [id, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} title="音频">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {audioUrl ? (
        <div className="relative w-full h-full overflow-hidden group rounded-lg">
          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a] rounded-lg">
            <audio controls src={audioUrl} className="w-full h-8" />
          </div>
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-600/80 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
            title="移除音频"
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
          aria-label="上传音频"
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.5v8m-9-9l-10.5 3m10.5 3v-8m0 8l10.5-3M9 15l10.5-3" />
          </svg>
          <span className="text-xs text-text-muted mt-2">点击或拖拽上传音频</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} id="audio" style={{ top: '50%', zIndex: 10 }} data-handletype="audio" />
    </BaseNodeWrapper>
  );
}

export default memo(AudioNodeComponent);