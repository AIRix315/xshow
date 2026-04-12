// Ref: node-banana Output Node
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OutputNodeType } from '@/types';
import BaseNodeWrapper from './BaseNode';

function OutputNode({ data, selected }: NodeProps<OutputNodeType>) {
  const hasImage = !!data.inputImageUrl;
  const hasVideo = !!data.inputVideoUrl;
  const hasAudio = !!data.inputAudioUrl;
  const hasText = !!data.inputValue;

  return (
    <BaseNodeWrapper selected={!!selected} title="输出">
      <Handle type="target" position={Position.Left} id="any" style={{ top: '50%' }} data-handletype="any" />
      <div className="flex flex-col gap-2 p-2 min-w-[180px]">
        <span className="text-[10px] text-text-secondary font-medium">Output</span>
        <div className="h-16 bg-surface rounded border border-dashed border-border flex items-center justify-center text-[10px] text-text-muted">
          {hasImage && '图片输出'}
          {hasVideo && '视频输出'}
          {hasAudio && '音频输出'}
          {hasText && <span className="truncate max-w-[140px]">{String(data.inputValue).slice(0, 50)}</span>}
          {!hasImage && !hasVideo && !hasAudio && !hasText && '等待输出'}
        </div>
        {data.label && (
          <span className="text-[10px] text-text-muted text-center">{data.label}</span>
        )}
      </div>
    </BaseNodeWrapper>
  );
}

export default memo(OutputNode);
