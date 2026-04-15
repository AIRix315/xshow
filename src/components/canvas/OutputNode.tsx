// Ref: node-banana Output Node
// 输出节点：从上游节点读取数据并显示结果
// 图片/视频/音频填充整个节点区域，仅留顶部标题栏和底部下载按钮
import { memo, useMemo, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OutputNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';
import { getConnectedInputs } from '@/utils/connectedInputs';

function OutputNode({ id, data, selected }: NodeProps<OutputNodeType>) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  // 从上游节点读取数据
  const upstreamData = useMemo(() => {
    return getConnectedInputs(id, nodes, edges);
  }, [id, nodes, edges]);

  // 优先使用从上游获取的数据，否则使用本地 data
  const inputImageUrl = data.inputImageUrl ?? upstreamData.images[0] ?? null;
  const inputVideoUrl = data.inputVideoUrl ?? upstreamData.videos[0] ?? null;
  const inputAudioUrl = data.inputAudioUrl ?? upstreamData.audio[0] ?? null;
  const inputValue = data.inputValue ?? upstreamData.text ?? null;

  // 监测上游数据变化，自动更新
  const prevUpstreamRef = useRef<typeof upstreamData | null>(null);
  
  useEffect(() => {
    if (prevUpstreamRef.current === null) {
      prevUpstreamRef.current = upstreamData;
      return;
    }

    const prev = prevUpstreamRef.current;
    if (
      prev.images[0] !== upstreamData.images[0] ||
      prev.videos[0] !== upstreamData.videos[0] ||
      prev.audio[0] !== upstreamData.audio[0] ||
      prev.text !== upstreamData.text
    ) {
      updateNodeData(id, {
        inputImageUrl: upstreamData.images[0] ?? null,
        inputVideoUrl: upstreamData.videos[0] ?? null,
        inputAudioUrl: upstreamData.audio[0] ?? null,
        inputValue: upstreamData.text ?? null,
      });
    }
    prevUpstreamRef.current = upstreamData;
  }, [id, upstreamData, updateNodeData]);

  const hasImage = !!inputImageUrl;
  const hasVideo = !!inputVideoUrl;
  const hasAudio = !!inputAudioUrl;
  const hasText = !!inputValue;
  const hasMedia = hasImage || hasVideo || hasAudio;

  // 下载功能
  const handleDownload = () => {
    const content = inputImageUrl || inputVideoUrl || inputAudioUrl || inputValue;
    if (!content) return;

    const link = document.createElement('a');
    link.href = content;
    link.download = `output-${Date.now()}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <BaseNodeWrapper selected={!!selected} title="输出">
      {/* 多类型输入 handle — 各类型独立入口 */}
      <Handle type="target" position={Position.Left} id="image" style={{ top: '25%', zIndex: 10 }} data-handletype="image" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="image" style={{ right: 'calc(100% + 8px)', top: 'calc(25% - 8px)', zIndex: 10 }}>Image</div>
      <Handle type="target" position={Position.Left} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="video" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Video</div>
      <Handle type="target" position={Position.Left} id="text" style={{ top: '75%', zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="text" style={{ right: 'calc(100% + 8px)', top: 'calc(75% - 8px)', zIndex: 10 }}>Text</div>

      {/* 内容区域 — flex-1 填满剩余空间 */}
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-0 overflow-hidden">
          {hasImage && (
            <img
              src={inputImageUrl!}
              alt="输出图片"
              className="w-full h-full object-contain"
            />
          )}
          {hasVideo && !hasImage && (
            <video
              controls
              src={inputVideoUrl!}
              className="w-full h-full object-contain"
            />
          )}
          {hasAudio && !hasImage && !hasVideo && (
            <audio
              controls
              src={inputAudioUrl!}
              className="w-full max-w-[200px]"
            />
          )}
          {hasText && !hasMedia && (
            <div className="w-full h-full flex items-center justify-center p-2 overflow-auto">
              <span className="text-text text-[11px] break-words">
                {String(inputValue).slice(0, 200)}
              </span>
            </div>
          )}
          {!hasImage && !hasVideo && !hasAudio && !hasText && (
            <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a] rounded">
              <span className="text-text-muted text-[10px]">等待输出</span>
            </div>
          )}
        </div>

        {/* 下载按钮 — 固定底部 */}
        {hasMedia && (
          <button
            onClick={handleDownload}
            className="w-full text-[9px] text-text-secondary hover:text-text py-1 bg-surface-hover rounded shrink-0"
          >
            ⬇ 下载
          </button>
        )}
      </div>
    </BaseNodeWrapper>
  );
}

export default memo(OutputNode);