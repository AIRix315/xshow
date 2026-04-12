// Ref: node-banana Video Stitch Node + 本地实现
// 视频拼接使用 Web MediaRecorder API 或 ffmpeg.wasm（需要外部库）
// 此处实现为收集多个视频输入并提示用户
import { memo, useState, useCallback, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { VideoStitchNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

function VideoStitchNode({ id, data, selected }: NodeProps<VideoStitchNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  
  // 收集所有输入视频
  const incomingEdges = edges.filter((e) => e.target === id);
  const inputVideos = incomingEdges.map((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    return {
      handleId: edge.sourceHandle,
      url: sourceNode?.data?.videoUrl as string | undefined,
    };
  }).filter((v) => v.url);
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [resultUrl, setResultUrl] = useState(data.resultUrl ?? '');
  const [videoCount, setVideoCount] = useState(2);

  // 视频元素引用（用于预览）
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const addVideoSlot = useCallback(() => {
    if (videoCount < 6) {
      setVideoCount(videoCount + 1);
    }
  }, [videoCount]);

  const removeVideoSlot = useCallback(() => {
    if (videoCount > 2) {
      setVideoCount(videoCount - 1);
    }
  }, [videoCount]);

  // 模拟视频拼接（实际需要 ffmpeg.wasm 或类似库）
  const handleStitch = useCallback(async () => {
    if (inputVideos.length < 2) {
      setErrorMessage('需要至少2个视频才能拼接');
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      // 模拟处理过程
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // 实际视频拼接需要：
      // 1. ffmpeg.wasm 库
      // 2. 或后端 API 处理
      // 此处设置占位结果
      setResultUrl(inputVideos[0]?.url || '');
      updateNodeData(id, { resultUrl: inputVideos[0]?.url, loading: false });
      
    } catch (err) {
      setErrorMessage('视频拼接失败');
      updateNodeData(id, { loading: false, errorMessage: '视频拼接失败' });
    } finally {
      setLoading(false);
    }
  }, [inputVideos, updateNodeData, id]);

  // minimalContent - 最小预览模式，无边距
  const minimalContent = (
    <>
      {/* 多个输入 Handle - 均匀分布 */}
      {Array.from({ length: videoCount }).map((_, i) => (
        <Handle
          key={`video-${i}`}
          type="target"
          position={Position.Left}
          id={`video-${i}`}
          style={{ top: `${((i + 1) / (videoCount + 1)) * 100}%`, zIndex: 10 }}
          data-handletype="video"
        />
      ))}
      
      {/* 视频状态 - 全屏无间隙 */}
      <div className="flex-1 flex items-center justify-center min-h-[80px]">
        {resultUrl ? (
          <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
            <span className="text-[10px] text-text">已拼接</span>
          </div>
        ) : inputVideos.length > 0 ? (
          <span className="text-[10px] text-text">{inputVideos.length} 个视频</span>
        ) : (
          <span className="text-neutral-500 text-[10px]">运行生成</span>
        )}
      </div>
      
      {/* 输出 Handle (均匀位置) */}
      <Handle type="source" position={Position.Right} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
    </>
  );

  // hoverContent - 悬停时显示完整参数，参数在底部
  const hoverContent = (
    <>
      {/* 多个输入 Handle - 均匀分布 */}
      {Array.from({ length: videoCount }).map((_, i) => (
        <Handle
          key={`video-${i}`}
          type="target"
          position={Position.Left}
          id={`video-${i}`}
          style={{ top: `${((i + 1) / (videoCount + 1)) * 100}%`, zIndex: 10 }}
          data-handletype="video"
        />
      ))}
      
      {/* 内容区域：预览在上，参数在底部 */}
      <div className="flex flex-col h-full">
        {/* 预览区域 */}
        <div className="flex-1 min-h-0">
          {resultUrl && !loading && (
            <div className="relative w-full h-full min-h-[80px] bg-[#1a1a1a] rounded">
              <video
                ref={(el) => { videoRefs.current[0] = el; }}
                src={resultUrl}
                controls
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </div>
        
        {/* 参数区域 - 在底部 */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
          {/* 视频输入槽位 */}
          <div className="space-y-1">
            {Array.from({ length: videoCount }).map((_, i) => (
              <div 
                key={i} 
                className={`h-8 rounded border flex items-center justify-center text-[10px] ${
                  inputVideos[i]?.url 
                    ? 'bg-surface border-primary/50' 
                    : 'bg-surface border-dashed border-border text-text-muted'
                }`}
              >
                {inputVideos[i]?.url ? (
                  <span className="text-green-500">视频 {i + 1} 已连接</span>
                ) : (
                  <span>视频 {i + 1}</span>
                )}
              </div>
            ))}
          </div>

          {/* 调整视频数量 */}
          <div className="flex gap-1">
            <button
              onClick={removeVideoSlot}
              disabled={videoCount <= 2}
              className="px-2 py-0.5 text-[10px] bg-surface hover:bg-surface-hover disabled:opacity-50 rounded"
            >
              -1
            </button>
            <button
              onClick={addVideoSlot}
              disabled={videoCount >= 6}
              className="px-2 py-0.5 text-[10px] bg-surface hover:bg-surface-hover disabled:opacity-50 rounded"
            >
              +1
            </button>
            <span className="text-[10px] text-text-muted flex-1 text-center">
              {inputVideos.length}/{videoCount} 个已连接
            </span>
          </div>

          {/* 拼接按钮 */}
          <button
            onClick={handleStitch}
            disabled={loading || inputVideos.length < 2}
            className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1.5 rounded font-medium"
          >
            {loading ? '拼接中...' : '拼接视频'}
          </button>

          {/* 提示 */}
          <div className="text-[9px] text-text-muted">
            浏览器本地拼接需 ffmpeg.wasm。暂使用第一个输入作为输出。
          </div>
        </div>
      </div>
      
      {/* 输出 Handle (50%) */}
      <Handle type="source" position={Position.Right} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
    </>
  );

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage}
      title="拼接"
      hoverContent={hoverContent}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(VideoStitchNode);