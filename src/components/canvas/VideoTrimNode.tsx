// Ref: node-banana Video Trim Node + 本地实现
// Store-only 模式：对标 node-banana
// 视频裁剪使用浏览器 MediaSource API 或提示需要后端处理
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { VideoTrimNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

function VideoTrimNode({ id, data, selected }: NodeProps<VideoTrimNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  
  // 从上游获取视频
  const incomingEdge = edges.find((e) => e.target === id);
  const sourceNode = incomingEdge ? nodes.find((n) => n.id === incomingEdge.source) : undefined;
  const sourceVideoUrl = data.inputVideoUrl ?? (sourceNode?.data?.videoUrl as string | undefined);
  
  // Store-only：直接读 data，不使用 useState
  const startTime = data.startTime ?? 0;
  const endTime = data.endTime ?? 10;
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const resultUrl = data.resultUrl ?? '';
  
  // 保留：从视频元数据计算，不是节点数据
  const [duration, setDuration] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // 获取视频时长
  useEffect(() => {
    if (!sourceVideoUrl || !videoRef.current) return;
    
    const video = videoRef.current;
    video.onloadedmetadata = () => {
      setDuration(video.duration);
      if (endTime > video.duration) {
        updateNodeData(id, { endTime: Math.min(10, video.duration) });
      }
    };
    video.src = sourceVideoUrl;
  }, [sourceVideoUrl, endTime, id, updateNodeData]);

  const handleTrim = useCallback(async () => {
    if (!sourceVideoUrl) {
      updateNodeData(id, { errorMessage: '请先连接视频' });
      return;
    }
    
    if (startTime >= endTime) {
      updateNodeData(id, { errorMessage: '开始时间必须小于结束时间' });
      return;
    }
    
    updateNodeData(id, { loading: true, errorMessage: '' });
    
    try {
      // 模拟处理过程
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // 实际视频裁剪需要：
      // 1. ffmpeg.wasm 库
      // 2. 或后端 API 处理
      // 3. 或使用 MediaRecorder 重新录制指定时间段
      
      // 临时方案：设置结果为原视频（实际需要后端处理）
      updateNodeData(id, { 
        resultUrl: sourceVideoUrl, 
        loading: false,
        startTime,
        endTime,
      });
      
    } catch (err) {
      updateNodeData(id, { loading: false, errorMessage: '视频裁剪失败' });
    }
  }, [sourceVideoUrl, startTime, endTime, updateNodeData, id]);

  const handlePreviewStart = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = startTime;
      videoRef.current.play();
    }
  }, [startTime]);
  
  const handleStartTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    updateNodeData(id, { startTime: val });
  }, [id, updateNodeData]);
  
  const handleEndTimeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    updateNodeData(id, { endTime: val });
  }, [id, updateNodeData]);

  // minimalContent - 最小预览模式，无边距
  const minimalContent = (
    <>
      {/* 输入 Handle (50%) */}
      <Handle type="target" position={Position.Left} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="video" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Video</div>
      
      {/* 视频状态 - 全屏无间隙 */}
      <div className="flex-1 flex items-center justify-center min-h-[80px]">
        {resultUrl ? (
          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
            <span className="text-[10px] text-text">{startTime.toFixed(1)}-{endTime.toFixed(1)}s</span>
          </div>
        ) : sourceVideoUrl ? (
          <span className="text-neutral-500 text-[10px]">待裁剪</span>
        ) : (
          <span className="text-neutral-500 text-[10px]">运行生成</span>
        )}
      </div>
      
      {/* 输出 Handle (50%) */}
      <Handle type="source" position={Position.Right} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="video" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Video</div>
    </>
  );

  // hoverContent - 悬停时显示完整参数，参数在底部
  const hoverContent = (
    <>
      {/* 输入 Handle (50%) */}
      <Handle type="target" position={Position.Left} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="video" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Video</div>
      
      {/* 内容区域：预览在上，参数在底部 */}
      <div className="flex flex-col h-full">
        {/* 预览区域 */}
        <div className="flex-1 min-h-0">
          {sourceVideoUrl && (
            <video
              ref={videoRef}
              className="w-full rounded border border-border"
              style={{ maxHeight: '100px' }}
            />
          )}
        </div>
        
        {/* 参数区域 - 在底部 */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
          {/* 时间范围设置 */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-text-secondary w-8 shrink-0">开始</label>
            <input
              type="number"
              value={startTime}
              onChange={handleStartTimeChange}
              min={0}
              max={duration}
              step={0.1}
              className="flex-1 bg-surface text-text text-xs rounded px-2 py-1 border border-border focus:border-primary outline-none"
            />
            <span className="text-[10px] text-text-muted">秒</span>
          </div>
          
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-text-secondary w-8 shrink-0">结束</label>
            <input
              type="number"
              value={endTime}
              onChange={handleEndTimeChange}
              min={0}
              max={duration || 999}
              step={0.1}
              className="flex-1 bg-surface text-text text-xs rounded px-2 py-1 border border-border focus:border-primary outline-none"
            />
            <span className="text-[10px] text-text-muted">秒</span>
          </div>

          {/* 时长信息 */}
          {duration > 0 && (
            <div className="text-[9px] text-text-muted">
              视频总时长: {duration.toFixed(1)}秒 | 裁剪: {(endTime - startTime).toFixed(1)}秒
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-1">
            <button
              onClick={handlePreviewStart}
              disabled={!sourceVideoUrl}
              className="flex-1 px-2 py-1 text-[10px] bg-surface hover:bg-surface-hover disabled:opacity-50 rounded"
            >
              预览
            </button>
            <button
              onClick={handleTrim}
              disabled={loading || !sourceVideoUrl || startTime >= endTime}
              className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1 rounded font-medium"
            >
              {loading ? '裁剪中...' : '裁剪'}
            </button>
          </div>

          {/* 提示 */}
          <div className="text-[9px] text-text-muted">
            浏览器本地裁剪需 ffmpeg.wasm。当前使用原始视频。
          </div>
        </div>
      </div>
      
      {/* 输出 Handle (50%) */}
      <Handle type="source" position={Position.Right} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="video" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Video</div>
    </>
  );

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage}
      title="裁剪"
      hoverContent={hoverContent}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(VideoTrimNode);