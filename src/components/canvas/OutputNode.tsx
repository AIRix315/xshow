// Ref: node-banana Output Node
// 输出节点：从上游节点读取数据并显示结果
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
    // 首次运行，记录基线
    if (prevUpstreamRef.current === null) {
      prevUpstreamRef.current = upstreamData;
      return;
    }

    // 上游数据变化时，更新本地 data
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
      <Handle type="target" position={Position.Left} id="any" style={{ top: '50%' }} data-handletype="any" />
      <div className="flex flex-col gap-2 p-2 min-w-[180px]">
        <span className="text-[10px] text-text-secondary font-medium">Output</span>
        
        {/* 显示内容 */}
        <div className="h-16 bg-surface rounded border border-dashed border-border flex items-center justify-center text-[10px] text-text-muted overflow-hidden">
          {hasImage && (
            <img
              src={inputImageUrl!}
              alt="输出图片"
              className="w-full h-full object-cover"
            />
          )}
          {hasVideo && <span className="text-blue-400">🎬 视频输出</span>}
          {hasAudio && <span className="text-purple-400">🔊 音频输出</span>}
          {hasText && (
            <span className="truncate max-w-[140px] text-text">
              {String(inputValue).slice(0, 50)}
            </span>
          )}
          {!hasImage && !hasVideo && !hasAudio && !hasText && '等待输出'}
        </div>

        {/* 标签 */}
        {data.label && (
          <span className="text-[10px] text-text-muted text-center">{data.label}</span>
        )}

        {/* 下载按钮 */}
        {(hasImage || hasVideo || hasAudio) && (
          <button
            onClick={handleDownload}
            className="w-full text-[9px] text-text-secondary hover:text-text py-1 bg-surface-hover rounded"
          >
            ⬇ 下载
          </button>
        )}
      </div>
    </BaseNodeWrapper>
  );
}

export default memo(OutputNode);