// Ref: §3.5.1 — 文本输入节点（上传文件 + 手动输入）
// Store-only 模式：对标 node-banana
import { memo, useCallback, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TextInputNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';
import { FileText, Type } from 'lucide-react';

function TextInputNode({ id, data, selected }: NodeProps<TextInputNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 输入模式：'upload' 或 'manual'
  const [mode, setMode] = useState<'upload' | 'manual'>('upload');
  
  // Store-only：直接读 data，不使用 useState
  const text = data.text ?? '';
  const filename = data.filename ?? '';

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

  // 手动输入处理
  const handleManualInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      updateNodeData(id, { text: textarea.value, filename: undefined });
    }
  }, [id, updateNodeData]);

  // 显示内容（有文本时）
  if (text) {
    return (
      <BaseNodeWrapper selected={!!selected} title="文本">
        <div className="relative w-full h-full overflow-hidden group rounded-lg">
          <div className="w-full h-full p-2 bg-[#1a1a1a] rounded-lg overflow-auto">
            {filename && (
              <div className="text-[10px] text-text-secondary mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" />
                <span className="truncate">{filename}</span>
              </div>
            )}
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
        <Handle type="source" position={Position.Right} id="text" style={{ top: '50%', zIndex: 10 }} data-handletype="text" />
        <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="text" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Text</div>
      </BaseNodeWrapper>
    );
  }

  // 空状态：选择输入模式
  return (
    <BaseNodeWrapper selected={!!selected} title="文本">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.json,.js,.ts,.html,.css"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 模式切换 */}
      <div className="flex gap-1 p-2">
        <button
          onClick={() => setMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
            mode === 'upload' ? 'bg-primary/20 text-primary' : 'bg-surface-hover text-text-secondary hover:bg-surface'
          }`}
        >
          <FileText className="w-3 h-3" />
          上传
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
            mode === 'manual' ? 'bg-primary/20 text-primary' : 'bg-surface-hover text-text-secondary hover:bg-surface'
          }`}
        >
          <Type className="w-3 h-3" />
          输入
        </button>
      </div>

      {/* 上传模式 */}
      {mode === 'upload' && (
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
          className="w-full h-24 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition-colors bg-[#1a1a1a] rounded-lg"
        >
          <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs text-text-muted mt-2">点击或拖拽上传</span>
        </div>
      )}

      {/* 手动输入模式 */}
      {mode === 'manual' && (
        <textarea
          ref={textareaRef}
          placeholder="输入文本内容..."
          className="w-full h-24 p-2 text-xs bg-[#1a1a1a] text-text border border-border rounded-lg resize-none focus:outline-none focus:border-primary"
          onBlur={handleManualInput}
        />
      )}

      <Handle type="source" position={Position.Right} id="text" style={{ top: '50%', zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="text" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Text</div>
    </BaseNodeWrapper>
  );
}

export default memo(TextInputNode);