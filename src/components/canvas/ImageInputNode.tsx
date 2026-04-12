// Ref: node-banana ImageInputNode.tsx
// 功能：加载/上传图片文件
import { memo, useCallback, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ImageInputNode as ImageInputNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

function ImageInputNode({ id, data, selected }: NodeProps<ImageInputNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.match(/^image\/(png|jpeg|jpg|webp|gif)$/)) {
        console.error('不支持的格式，仅支持 PNG, JPG, WebP, GIF');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        console.error('图片过大，最大支持 10MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const img = new Image();
        img.onload = () => {
          updateNodeData(id, {
            imageUrl: base64,
            filename: file.name,
            dimensions: { width: img.width, height: img.height },
          });
        };
        img.src = base64;
      };
      reader.readAsDataURL(file);
    },
    [id, updateNodeData]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const file = e.dataTransfer.files?.[0];
      if (!file || !file.type.match(/^image\/(png|jpeg|jpg|webp|gif)$/)) return;

      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileInputRef.current) {
        fileInputRef.current.files = dt.files;
        fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
      }
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleRemove = useCallback(() => {
    updateNodeData(id, {
      imageUrl: undefined,
      filename: undefined,
      dimensions: undefined,
    });
  }, [id, updateNodeData]);

  return (
    <BaseNodeWrapper 
      selected={!!selected} 
      title="图片"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
      />

      {data.imageUrl ? (
        <div className="relative w-full h-full overflow-hidden group rounded-lg">
          <img
            src={data.imageUrl}
            alt={data.filename || '上传的图片'}
            className="w-full h-full object-cover rounded-lg"
          />
          {data.isOptional && (
            <span className="absolute bottom-2 left-2 text-[9px] font-medium text-neutral-300 bg-black/50 px-1.5 py-0.5 rounded">
              Optional
            </span>
          )}
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-red-600/80 text-white rounded text-xs opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
            title="移除图片"
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
          aria-label="上传图片"
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <span className="text-xs text-text-muted mt-2">点击或拖拽上传图片</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} id="image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
    </BaseNodeWrapper>
  );
}

export default memo(ImageInputNode);