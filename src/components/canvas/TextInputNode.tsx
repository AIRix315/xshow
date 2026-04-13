// Ref: §3.5.1 — 文本输入节点（加载本地文本）
// Store-only 模式：对标 node-banana
import { memo, useCallback, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TextInputNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

function TextInputNode({ id, data, selected }: NodeProps<TextInputNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Store-only：直接读 data，不使用 useState
  const text = data.text ?? '';

  // 上传本地文本文件
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        updateNodeData(id, { text: content, filename: file.name });
      };
      reader.readAsText(file);
    }
  }, [id, updateNodeData]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('text/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        updateNodeData(id, { text: content, filename: file.name });
      };
      reader.readAsText(file);
    }
  }, [id, updateNodeData]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(() => {
    updateNodeData(id, { text: undefined, filename: undefined });
  }, [id, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} title="文本">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.json,.js,.ts,.html,.css"
        onChange={handleFileChange}
        className="hidden"
      />

      {text ? (
        <div className="relative w-full h-full overflow-hidden group rounded-lg">
          <div className="w-full h-full p-2 bg-[#1a1a1a] rounded-lg overflow-auto">
            <pre className="text-[10px] text-text whitespace-pre-wrap">{text.slice(0, 500)}{text.length > 500 ? '...' : ''}</pre>
          </div>
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-600/80 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
            title="移除文本"
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
          aria-label="上传文本"
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs text-text-muted mt-2">点击或拖拽上传文本</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} id="text" style={{ top: '50%', zIndex: 10 }} data-handletype="text" />
    </BaseNodeWrapper>
  );
}

export default memo(TextInputNode);