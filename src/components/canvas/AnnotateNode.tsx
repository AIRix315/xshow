// Ref: node-banana Annotate Node + 本地 Canvas 实现
// 使用 Canvas API 在图片上绘制标注（文字、框、箭头等）
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AnnotateNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

type ToolType = 'text' | 'rect' | 'arrow' | 'circle';

interface Annotation {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
  text?: string;
  fontSize: number;
  color: string;
}

function AnnotateNode({ id, data, selected }: NodeProps<AnnotateNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  
  // 从上游获取图片
  const incomingEdge = edges.find((e) => e.target === id);
  const sourceNode = incomingEdge ? nodes.find((n) => n.id === incomingEdge.source) : undefined;
  const sourceImageUrl = data.inputImageUrl ?? (sourceNode?.data?.imageUrl as string | undefined);
  
  // Store-only: 业务数据从 data 读取
  const annotations = data.annotations ?? [];
  const fontSize = data.fontSize ?? 16;
  const color = data.color ?? '#ef4444';
  const annotationText = data.annotationText ?? '';
  
  // UI 状态：保持 local useState
  const [currentTool, setCurrentTool] = useState<ToolType>('text');
  const [errorMessage, setErrorMessage] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [currentDraw, setCurrentDraw] = useState<Annotation | null>(null);

  // 加载图片
  useEffect(() => {
    if (!sourceImageUrl) {
      setImageLoaded(false);
      return;
    }
    
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      setErrorMessage('图片加载失败');
      setImageLoaded(false);
    };
    img.src = sourceImageUrl;
  }, [sourceImageUrl]);

  // 绘制 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸
    const maxWidth = 280;
    const scale = maxWidth / img.width;
    canvas.width = maxWidth;
    canvas.height = img.height * scale;

    // 绘制图片
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 绘制所有标注
    annotations.forEach((ann) => {
      ctx.font = `${ann.fontSize}px sans-serif`;
      ctx.fillStyle = ann.color;
      ctx.strokeStyle = ann.color;
      ctx.lineWidth = 2;

      switch (ann.type) {
        case 'text':
          ctx.fillText(ann.text || '', ann.x, ann.y);
          break;
        case 'rect':
          if (ann.width && ann.height) {
            ctx.strokeRect(ann.x, ann.y, ann.width, ann.height);
          }
          break;
        case 'arrow':
          if (ann.endX !== undefined && ann.endY !== undefined) {
            // 绘制箭头
            ctx.beginPath();
            ctx.moveTo(ann.x, ann.y);
            ctx.lineTo(ann.endX, ann.endY);
            ctx.stroke();
            // 箭头头部
            const angle = Math.atan2(ann.endY - ann.y, ann.endX - ann.x);
            const headLen = 15;
            ctx.beginPath();
            ctx.moveTo(ann.endX, ann.endY);
            ctx.lineTo(
              ann.endX - headLen * Math.cos(angle - Math.PI / 6),
              ann.endY - headLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(ann.endX, ann.endY);
            ctx.lineTo(
              ann.endX - headLen * Math.cos(angle + Math.PI / 6),
              ann.endY - headLen * Math.sin(angle + Math.PI / 6)
            );
            ctx.stroke();
          }
          break;
        case 'circle':
          if (ann.width && ann.height) {
            ctx.beginPath();
            ctx.ellipse(
              ann.x + ann.width / 2,
              ann.y + ann.height / 2,
              Math.abs(ann.width / 2),
              Math.abs(ann.height / 2),
              0, 0, 2 * Math.PI
            );
            ctx.stroke();
          }
          break;
      }
    });

    // 绘制当前正在绘制的标注
    if (currentDraw) {
      ctx.font = `${currentDraw.fontSize}px sans-serif`;
      ctx.fillStyle = currentDraw.color;
      ctx.strokeStyle = currentDraw.color;
      ctx.lineWidth = 2;

      switch (currentDraw.type) {
        case 'text':
          ctx.fillText(currentDraw.text || '', currentDraw.x, currentDraw.y);
          break;
        case 'rect':
          if (currentDraw.width && currentDraw.height) {
            ctx.strokeRect(currentDraw.x, currentDraw.y, currentDraw.width, currentDraw.height);
          }
          break;
        case 'arrow':
          if (currentDraw.endX !== undefined && currentDraw.endY !== undefined) {
            ctx.beginPath();
            ctx.moveTo(currentDraw.x, currentDraw.y);
            ctx.lineTo(currentDraw.endX, currentDraw.endY);
            ctx.stroke();
          }
          break;
        case 'circle':
          if (currentDraw.width && currentDraw.height) {
            ctx.beginPath();
            ctx.ellipse(
              currentDraw.x + currentDraw.width / 2,
              currentDraw.y + currentDraw.height / 2,
              Math.abs(currentDraw.width / 2),
              Math.abs(currentDraw.height / 2),
              0, 0, 2 * Math.PI
            );
            ctx.stroke();
          }
          break;
      }
    }
  }, [annotations, imageLoaded, currentDraw]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!imageLoaded) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (currentTool === 'text') {
      // 添加文字标注
      const newAnnotation: Annotation = {
        id: Date.now().toString(),
        type: 'text',
        x,
        y,
        text: annotationText || '标注',
        fontSize,
        color,
      };
      const newAnnotations = [...annotations, newAnnotation];
      updateNodeData(id, { annotations: newAnnotations });
    } else {
      // 开始绘制形状
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentDraw({
        id: 'temp',
        type: currentTool,
        x,
        y,
        fontSize,
        color,
        width: 0,
        height: 0,
        endX: x,
        endY: y,
      });
    }
  }, [imageLoaded, currentTool, annotationText, fontSize, color, annotations, updateNodeData, id]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentDraw) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentDraw({
      ...currentDraw,
      width: x - drawStart.x,
      height: y - drawStart.y,
      endX: x,
      endY: y,
    });
  }, [isDrawing, currentDraw, drawStart]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentDraw) return;
    
    // 只有当绘制区域足够大时才添加
    if (Math.abs(currentDraw.width || 0) > 5 || Math.abs(currentDraw.height || 0) > 5) {
      const newAnnotation: Annotation = {
        ...currentDraw,
        id: Date.now().toString(),
      };
      const newAnnotations = [...annotations, newAnnotation];
      updateNodeData(id, { annotations: newAnnotations });
    }
    
    setIsDrawing(false);
    setCurrentDraw(null);
  }, [isDrawing, currentDraw, annotations, updateNodeData, id]);

  const handleClearAll = useCallback(() => {
    updateNodeData(id, { annotations: [] });
  }, [updateNodeData, id]);

  const handleUndo = useCallback(() => {
    if (annotations.length === 0) return;
    const newAnnotations = annotations.slice(0, -1);
    updateNodeData(id, { annotations: newAnnotations });
  }, [annotations, updateNodeData, id]);

  // minimalContent - 最小预览模式，无边距
  const minimalContent = (
    <>
      {/* 输入 Handle (50%) */}
      <Handle type="target" position={Position.Left} id="image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
      
      {/* 标注预览 - 全屏无间隙 */}
      <div className="flex-1 flex items-center justify-center min-h-[80px]">
        {annotations.length > 0 ? (
          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
            <span className="text-[10px] text-text">{annotations.length} 个标注</span>
          </div>
        ) : sourceImageUrl ? (
          <span className="text-neutral-500 text-[10px]">待添加标注</span>
        ) : (
          <span className="text-neutral-500 text-[10px]">未连接图片</span>
        )}
      </div>
      
      {/* 输出 Handle (50%) */}
      <Handle type="source" position={Position.Right} id="image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
    </>
  );

  // hoverContent - 悬停时显示完整参数，参数在底部
  const hoverContent = (
    <>
      {/* 输入 Handle (50%) */}
      <Handle type="target" position={Position.Left} id="image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
      
      {/* 内容区域：预览在上，参数在底部 */}
      <div className="flex flex-col h-full">
        {/* 预览区域 */}
        <div className="flex-1 min-h-0">
          {sourceImageUrl && (
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              className="w-full border border-border rounded cursor-crosshair"
              style={{ maxHeight: '150px' }}
            />
          )}
        </div>
        
        {/* 参数区域 - 在底部 */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
          {/* 工具栏 */}
          <div className="flex gap-1">
            {([
              { value: 'text', label: '文字' },
              { value: 'rect', label: '框' },
              { value: 'arrow', label: '箭头' },
              { value: 'circle', label: '圆' },
            ] as { value: ToolType; label: string }[]).map((tool) => (
              <button
                key={tool.value}
                onClick={() => setCurrentTool(tool.value)}
                className={`px-2 py-0.5 text-[10px] rounded border ${
                  currentTool === tool.value 
                    ? 'border-primary bg-primary/20 text-primary' 
                    : 'border-border text-text-secondary bg-surface hover:bg-surface-hover'
                }`}
              >
                {tool.label}
              </button>
            ))}
          </div>

          {/* 文字输入（仅文字工具时显示） */}
          {currentTool === 'text' && (
            <input
              type="text"
              value={annotationText}
              onChange={(e) => updateNodeData(id, { annotationText: e.target.value })}
              placeholder="标注文字..."
              className="w-full bg-surface text-text text-xs rounded px-2 py-1 border border-border focus:border-primary outline-none"
            />
          )}

          {/* 样式选项 */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-text-secondary">字号</label>
            <input
              type="number"
              value={fontSize}
              onChange={(e) => updateNodeData(id, { fontSize: Number(e.target.value) })}
              min={8}
              max={72}
              className="w-14 bg-surface text-text text-[10px] rounded px-1.5 py-0.5 border border-border outline-none"
            />
            <label className="text-[10px] text-text-secondary">颜色</label>
            <input
              type="color"
              value={color}
              onChange={(e) => updateNodeData(id, { color: e.target.value })}
              className="w-6 h-5 rounded border border-border cursor-pointer bg-transparent"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-1">
            <button
              onClick={handleUndo}
              disabled={annotations.length === 0}
              className="flex-1 bg-surface hover:bg-surface-hover disabled:opacity-50 text-text text-xs py-1 rounded"
            >
              撤销
            </button>
            <button
              onClick={handleClearAll}
              disabled={annotations.length === 0}
              className="flex-1 bg-surface hover:bg-surface-hover disabled:opacity-50 text-text text-xs py-1 rounded"
            >
              清除全部
            </button>
          </div>

          <div className="text-[9px] text-text-muted">
            在画布上点击或拖动来添加标注
          </div>
        </div>
      </div>
      
      {/* 输出 Handle (50%) */}
      <Handle type="source" position={Position.Right} id="image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
    </>
  );

  return (
    <BaseNodeWrapper selected={!!selected} loading={false} errorMessage={errorMessage}
      title="标注"
      hoverContent={hoverContent}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(AnnotateNode);