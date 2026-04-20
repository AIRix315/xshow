// Ref: node-banana Generate 3D Node + 本地实现
// 3D 生成需要后端服务，此处使用本地 Canvas 3D 预览占位
import { memo, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import type { D3NodeType, CustomInputHandle } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import React from 'react';
import BaseNodeWrapper from './BaseNode';

function Generate3DNode({ id, data, selected }: NodeProps<D3NodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  const updateNodeInternals = useUpdateNodeInternals();
  const customInputHandles = (data.customInputHandles as CustomInputHandle[] | undefined) ?? [];

  useEffect(() => {
    updateNodeInternals(id);
  }, [customInputHandles?.length, id, updateNodeInternals]);

  // Business data from store
  const prompt = data.prompt ?? '';
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const progress = data.progress ?? 0;
  const modelUrl = data.modelUrl ?? '';

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  // 简单的 3D 旋转预览（使用 Canvas 2D 模拟）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !modelUrl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let angle = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // 绘制简单的 3D 立方体旋转效果
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const size = 40;
      
      // 正面
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(centerX - size + Math.sin(angle) * 10, centerY - size, size * 2, size * 2);
      ctx.stroke();
      
      // 侧面（模拟深度）
      ctx.strokeStyle = '#1d4ed8';
      ctx.beginPath();
      ctx.moveTo(centerX + size + Math.sin(angle) * 10, centerY - size);
      ctx.lineTo(centerX + size + Math.sin(angle) * 15, centerY - size - 10);
      ctx.lineTo(centerX + size + Math.sin(angle) * 15, centerY + size - 10);
      ctx.lineTo(centerX + size + Math.sin(angle) * 10, centerY + size);
      ctx.stroke();
      
      angle += 0.02;
      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [modelUrl]);

  const handleGenerate = useCallback(() => {
    if (!prompt.trim()) return;
    updateNodeData(id, { loading: true, errorMessage: '', progress: 0 });

    // 模拟生成过程（实际需要后端 3D API）
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      updateNodeData(id, { progress: currentProgress });
      
      if (currentProgress >= 100) {
        clearInterval(interval);
        // 生成虚拟 3D 模型 URL（实际需要后端返回）
        const newModelUrl = `data:model/gltf-binary;base64,placeholder`;
        updateNodeData(id, { 
          modelUrl: newModelUrl, 
          loading: false, 
          progress: 0 
        });
      }
    }, 200);
  }, [prompt, updateNodeData, id]);

  const handleClear = useCallback(() => {
    updateNodeData(id, { modelUrl: '', progress: 0 });
  }, [updateNodeData, id]);

  // ---- Handles: 渲染在内容区域之外，避免重复导致连线漂移 ----
  const handles = (
    <>
      {/* 自定义输入 Handle */}
      {customInputHandles.map((ch, idx) => {
        const totalCustomHandles = customInputHandles.length;
        const position = ((idx + 1) / (totalCustomHandles + 1)) * 100;
        return (
          <React.Fragment key={ch.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={ch.id}
              style={{ top: `${position}%`, zIndex: 10 }}
              data-handletype={ch.type}
            />
            <div
              className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right"
              data-type={ch.type}
              style={{ right: 'calc(100% + 8px)', top: `calc(${position}% - 8px)`, zIndex: 10 }}
            >
              {ch.label || ch.type}
            </div>
          </React.Fragment>
        );
      })}

      {/* 输入 Handle (50%) */}
      <Handle type="target" position={Position.Left} id="text" style={{ top: '50%', zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="text" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Text</div>
      
      {/* 输出 Handle (50%) */}
      <Handle type="source" position={Position.Right} id="model" style={{ top: '50%', zIndex: 10 }} data-handletype="model" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="model" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Model</div>
    </>
  );

  // minimalContent - 最小预览模式，无边距
  const minimalContent = (
    <>
      {/* 3D 预览 - 全屏无间隙 */}
      <div className="flex-1 flex items-center justify-center min-h-[80px]">
        {modelUrl ? (
          <div className="relative w-full h-full flex items-center justify-center bg-[#1a1a1a] rounded">
            <canvas 
              ref={canvasRef} 
              width={80} 
              height={60} 
            />
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[10px]">生成中 {progress}%</span>
          </div>
        ) : (
          <span className="text-neutral-500 text-[10px]">运行生成</span>
        )}
      </div>
    </>
  );

  // hoverContent - 悬停时显示完整参数，参数在底部
  const hoverContent = (
    <div className="flex flex-col h-full">
      {/* 预览区域 */}
      <div className="flex-1 min-h-0">
        {modelUrl && !loading && (
          <div className="relative w-full h-full min-h-[80px] bg-[#1a1a1a] rounded flex items-center justify-center">
            <canvas 
              ref={canvasRef} 
              width={160} 
              height={100} 
              className="max-w-full"
            />
            <button
              onClick={handleClear}
              className="absolute top-1 right-1 w-5 h-5 bg-surface-hover hover:bg-red-500/80 rounded flex items-center justify-center text-text-muted hover:text-white text-xs"
            >
              ×
            </button>
          </div>
        )}
      </div>
      
      {/* 参数区域 - 在底部 */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
        {/* 提示词输入 - 增加高度 */}
        <textarea
          value={prompt}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="输入 3D 模型描述..."
          className="w-full bg-surface text-text text-xs rounded p-1.5 resize-none border border-border focus:border-primary outline-none"
          rows={3}
        />
        
        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1.5 rounded font-medium"
        >
          {loading ? `生成中 ${progress}%` : '生成 3D'}
        </button>

        {/* 进度条 */}
        {loading && progress > 0 && (
          <div className="w-full bg-surface-hover rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

         {/* 提示 */}
         <div className="text-[9px] text-text-muted">
           当前为本地预览模式。实际 3D 模型生成需连接 Meshy/Tripo3D 等 API。
         </div>

         {/* 自定义输入管理 */}
         <div className="flex items-center gap-1 pt-1">
           <select
             value=""
             onChange={(e) => {
               if (!e.target.value) return;
               const type = e.target.value as CustomInputHandle['type'];
               const handles = [...customInputHandles];
               const handleId = `custom-${type}-${Date.now()}`;
               handles.push({ id: handleId, type, label: type === 'image' ? '图片' : type === 'audio' ? '音频' : type === 'video' ? '视频' : '文本' });
               updateNodeData(id, { customInputHandles: handles });
               e.target.value = '';
             }}
             className="bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border"
           >
             <option value="">+ 添加输入</option>
             <option value="image">图片</option>
             <option value="audio">音频</option>
             <option value="video">视频</option>
             <option value="text">文本</option>
           </select>
           {customInputHandles.length > 0 && (
             <button
               onClick={() => updateNodeData(id, { customInputHandles: [] })}
               className="text-text-muted hover:text-error text-[10px] px-1"
               title="清除所有自定义输入"
             >
               ✕
             </button>
           )}
         </div>
       </div>
     </div>
   );

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage}
      title="生成3D"
      showHoverHeader
      onRun={handleGenerate}
      hoverContent={hoverContent}
      handles={handles}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(Generate3DNode);