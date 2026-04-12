// Ref: node-banana Frame Grab Node + 本地实现
// 帧提取使用浏览器 Canvas API 从视频中捕获指定时间的帧
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FrameGrabNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

function FrameGrabNode({ id, data, selected }: NodeProps<FrameGrabNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  
  // 从上游获取视频
  const incomingEdge = edges.find((e) => e.target === id);
  const sourceNode = incomingEdge ? nodes.find((n) => n.id === incomingEdge.source) : undefined;
  const sourceVideoUrl = data.inputVideoUrl ?? (sourceNode?.data?.videoUrl as string | undefined);
  
  const [framePosition, setFramePosition] = useState(data.framePosition ?? 50);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resultImageUrl, setResultImageUrl] = useState(data.resultImageUrl ?? '');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 获取视频时长
  useEffect(() => {
    if (!sourceVideoUrl || !videoRef.current) return;
    
    const video = videoRef.current;
    video.onloadedmetadata = () => {
      setDuration(video.duration);
    };
    video.src = sourceVideoUrl;
  }, [sourceVideoUrl]);

  // 计算实际时间
  const actualTime = duration > 0 ? (framePosition / 100) * duration : 0;

  // 捕获帧
  const handleGrab = useCallback(async () => {
    if (!sourceVideoUrl) {
      setErrorMessage('请先连接视频');
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      // 等待视频加载
      await new Promise<void>((resolve, reject) => {
        const video = videoRef.current;
        if (!video) {
          reject(new Error('No video element'));
          return;
        }
        
        if (video.readyState >= 2) {
          resolve();
        } else {
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error('Video load error'));
        }
      });
      
      const video = videoRef.current!;
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('No canvas element');
      }
      
      // 跳转到指定时间
      video.currentTime = actualTime;
      
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        // 超时保护
        setTimeout(resolve, 2000);
      });
      
      // 捕获帧
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Cannot get canvas context');
      }
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      
      // 转换为图片
      const dataUrl = canvas.toDataURL('image/png');
      setResultImageUrl(dataUrl);
      updateNodeData(id, { resultImageUrl: dataUrl });
      
    } catch (err) {
      console.error('Frame grab error:', err);
      setErrorMessage('帧提取失败');
      updateNodeData(id, { errorMessage: '帧提取失败' });
    } finally {
      setLoading(false);
    }
  }, [sourceVideoUrl, actualTime, updateNodeData, id]);

  const handlePositionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setFramePosition(val);
    updateNodeData(id, { framePosition: val });
  }, [updateNodeData, id]);

  // minimalContent - 最小预览模式，无边距
  const minimalContent = (
    <>
      {/* 输入 Handle (50%) */}
      <Handle type="target" position={Position.Left} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
      
      {/* 帧预览 - 全屏无间隙 */}
      <div className="flex-1 flex items-center justify-center min-h-[80px]">
        {resultImageUrl ? (
          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
            <img src={resultImageUrl} alt="提取的帧" className="max-w-full max-h-full object-contain" />
          </div>
        ) : sourceVideoUrl ? (
          <span className="text-neutral-500 text-[10px]">{framePosition}% 位置</span>
        ) : (
          <span className="text-neutral-500 text-[10px]">运行生成</span>
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
      <Handle type="target" position={Position.Left} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
      
      {/* 内容区域：预览在上，参数在底部 */}
      <div className="flex flex-col h-full">
        {/* 预览区域 */}
        <div className="flex-1 min-h-0">
          {sourceVideoUrl && (
            <video
              src={sourceVideoUrl}
              controls
              className="w-full rounded border border-border"
              style={{ maxHeight: '80px' }}
            />
          )}
        </div>
        
        {/* 参数区域 - 在底部 */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
          {/* 隐藏的视频元素用于捕获帧 */}
          <video
            ref={videoRef}
            className="hidden"
            crossOrigin="anonymous"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* 位置滑块 */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-text-secondary w-8 shrink-0">位置</label>
            <input
              type="range"
              value={framePosition}
              onChange={handlePositionChange}
              min={0}
              max={100}
              className="flex-1"
            />
            <span className="text-[10px] text-text-muted w-12 text-right">{framePosition}%</span>
          </div>

          {/* 时间信息 */}
          {duration > 0 && (
            <div className="text-[9px] text-text-muted">
              视频时长: {duration.toFixed(1)}秒 | 提取位置: {actualTime.toFixed(1)}秒
            </div>
          )}

          {/* 提取按钮 */}
          <button
            onClick={handleGrab}
            disabled={loading || !sourceVideoUrl}
            className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1.5 rounded font-medium"
          >
            {loading ? '提取中...' : '提取帧'}
          </button>

          {/* 提示 */}
          <div className="text-[9px] text-text-muted">
            从视频中提取指定时间的帧作为图片输出
          </div>
        </div>
      </div>
      
      {/* 输出 Handle (50%) */}
      <Handle type="source" position={Position.Right} id="image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
    </>
  );

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage}
      title="帧提取"
      hoverContent={hoverContent}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(FrameGrabNode);