// Ref: §3.12 + §6.9 — 独立裁剪节点，canvas 框选
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CropNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

interface CropRect {
  startX: number;
  startY: number;
  width: number;
  height: number;
}

function CropNode({ id, data, selected }: NodeProps<CropNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  // 从 Store 读取上游节点传入的源图 URL
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const incomingEdge = edges.find((e) => e.target === id);
  const sourceNode = incomingEdge ? nodes.find((n) => n.id === incomingEdge.source) : undefined;
  const sourceImageUrl = data.sourceImageUrl ?? (sourceNode?.data?.imageUrl as string | undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [errorMessage, setErrorMessage] = useState('');

  // 加载源图
  useEffect(() => {
    if (!sourceImageUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setSourceImage(img);
      setImageLoaded(true);
    };
    img.onerror = () => {
      setErrorMessage('图片来源加载失败');
    };
    img.src = sourceImageUrl;
  }, [sourceImageUrl]);

  // 绘制画布 + 裁剪框
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !sourceImage) return;

    const displayWidth = 260;
    const displayHeight = Math.round((sourceImage.height / sourceImage.width) * displayWidth);
    canvas.width = displayWidth;
    canvas.height = displayHeight;

    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(sourceImage, 0, 0, displayWidth, displayHeight);

    if (cropRect) {
      // 暗化非选中区域
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, displayWidth, displayHeight);
      // 还原选中区域
      ctx.drawImage(
        sourceImage,
        (cropRect.startX / displayWidth) * sourceImage.width,
        (cropRect.startY / displayHeight) * sourceImage.height,
        (cropRect.width / displayWidth) * sourceImage.width,
        (cropRect.height / displayHeight) * sourceImage.height,
        cropRect.startX,
        cropRect.startY,
        cropRect.width,
        cropRect.height,
      );
      // 裁剪框边框
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(cropRect.startX, cropRect.startY, cropRect.width, cropRect.height);
    }
  }, [sourceImage, cropRect]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageLoaded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setIsDragging(true);
    setDragStart({ x, y });
    setCropRect({ startX: x, startY: y, width: 0, height: 0 });
  }, [imageLoaded]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCropRect((prev) => {
      if (!prev) return null;
      return {
        startX: Math.min(dragStart.x, x),
        startY: Math.min(dragStart.y, y),
        width: Math.abs(x - dragStart.x),
        height: Math.abs(y - dragStart.y),
      };
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCropComplete = useCallback(() => {
    if (!cropRect || !sourceImage || !canvasRef.current) return;
    if (cropRect.width < 5 || cropRect.height < 5) {
      setErrorMessage('裁剪区域太小');
      return;
    }

    const canvas = canvasRef.current;
    const scaleX = sourceImage.width / canvas.width;
    const scaleY = sourceImage.height / canvas.height;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.round(cropRect.width * scaleX);
    cropCanvas.height = Math.round(cropRect.height * scaleY);
    const cropCtx = cropCanvas.getContext('2d');
    if (!cropCtx) {
      setErrorMessage('裁剪失败：无法创建画布');
      return;
    }

    cropCtx.drawImage(
      sourceImage,
      Math.round(cropRect.startX * scaleX),
      Math.round(cropRect.startY * scaleY),
      Math.round(cropRect.width * scaleX),
      Math.round(cropRect.height * scaleY),
      0,
      0,
      cropCanvas.width,
      cropCanvas.height,
    );

    const croppedDataUrl = cropCanvas.toDataURL('image/png');
    data.onCropComplete?.(id, croppedDataUrl);
    updateNodeData(id, { sourceImageUrl: croppedDataUrl });
  }, [cropRect, sourceImage, id, data, updateNodeData]);

  const handleCancel = useCallback(() => {
    data.onCancel?.(id);
  }, [id, data]);

  return (
    <BaseNodeWrapper selected={!!selected} errorMessage={errorMessage} 
      title="裁剪"
      minHeight={200} minWidth={280}
    >
      <Handle type="target" position={Position.Left} id="source-image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
      <div className="flex flex-col gap-2 p-2 min-w-[280px]">
        <span className="text-[10px] text-text-secondary font-medium">图片裁剪</span>

        {!sourceImageUrl && (
          <div className="text-center text-text-muted text-xs py-4">
            请从图片节点连接到此节点
          </div>
        )}

        {sourceImageUrl && !imageLoaded && (
          <div className="text-center text-text-muted text-xs py-4">
            加载图片中...
          </div>
        )}

        {imageLoaded && (
          <>
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="w-full border border-border rounded cursor-crosshair"
              style={{ maxHeight: '250px', objectFit: 'contain' }}
            />
            <div className="flex gap-1">
              <button
                onClick={handleCropComplete}
                disabled={!cropRect || cropRect.width < 5 || cropRect.height < 5}
                className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1 rounded font-medium"
              >
                确认裁剪
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 bg-surface hover:bg-surface-hover text-text-secondary text-xs py-1 rounded"
              >
                取消
              </button>
            </div>
          </>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="cropped-image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
    </BaseNodeWrapper>
  );
}

export default memo(CropNode);