// Ref: node-banana Output Gallery Node
// 图集输出节点：从上游节点读取多个数据并显示
import { memo, useMemo, useEffect, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { OutputGalleryNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';
import { getConnectedInputs } from '@/utils/connectedInputs';

function OutputGalleryNode({ id, data, selected }: NodeProps<OutputGalleryNodeType>) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  // 从上游节点读取数据
  const upstreamData = useMemo(() => {
    return getConnectedInputs(id, nodes, edges);
  }, [id, nodes, edges]);

  // 合并上游数据与本地数据
  const inputImages = data.inputImages ?? upstreamData.images ?? [];
  const inputVideos = data.inputVideos ?? upstreamData.videos ?? [];
  const inputAudio = data.inputAudio ?? upstreamData.audio ?? [];
  const inputText = data.inputText ?? upstreamData.text ?? null;

  // 构建显示项列表
  const displayItems = useMemo(() => {
    const items: Array<{ type: 'image' | 'video' | 'audio' | 'text'; url?: string; content?: string }> = [];

    // 添加图片
    inputImages.forEach((url) => {
      if (url) items.push({ type: 'image', url });
    });

    // 添加视频
    inputVideos.forEach((url) => {
      if (url) items.push({ type: 'video', url });
    });

    // 添加音频
    inputAudio.forEach((url) => {
      if (url) items.push({ type: 'audio', url });
    });

    // 添加文本
    if (inputText) {
      items.push({ type: 'text', content: inputText });
    }

    return items;
  }, [inputImages, inputVideos, inputAudio, inputText]);

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
    const imagesChanged =
      prev.images.length !== upstreamData.images.length ||
      prev.images.some((img, i) => img !== upstreamData.images[i]);
    const videosChanged =
      prev.videos.length !== upstreamData.videos.length ||
      prev.videos.some((vid, i) => vid !== upstreamData.videos[i]);
    const audioChanged =
      prev.audio.length !== upstreamData.audio.length ||
      prev.audio.some((aud, i) => aud !== upstreamData.audio[i]);
    const textChanged = prev.text !== upstreamData.text;

    if (imagesChanged || videosChanged || audioChanged || textChanged) {
      updateNodeData(id, {
        inputImages: upstreamData.images,
        inputVideos: upstreamData.videos,
        inputAudio: upstreamData.audio,
        inputText: upstreamData.text,
      });
    }
    prevUpstreamRef.current = upstreamData;
  }, [id, upstreamData, updateNodeData]);

  const columns = data.columns ?? 3;
  const items = data.items ?? displayItems;

  // 下载功能
  const handleDownloadAll = () => {
    items.forEach((item, index) => {
      if (item.url) {
        const link = document.createElement('a');
        link.href = item.url;
        link.download = `output-${index + 1}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  return (
    <BaseNodeWrapper selected={!!selected} title="图集">
      <Handle type="target" position={Position.Left} id="any" style={{ top: '50%' }} data-handletype="any" />
      <div className="flex flex-col gap-2 p-2 min-w-[220px]">
        <span className="text-[10px] text-text-secondary font-medium">Output Gallery</span>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {items.length > 0 ? (
            items.map((item, i) => (
              <div
                key={i}
                className="h-12 bg-surface rounded border border-border flex items-center justify-center text-[9px] text-text-muted overflow-hidden"
              >
                {item.type === 'image' && item.url && (
                  <img src={item.url} alt={`输出 ${i + 1}`} className="w-full h-full object-cover" />
                )}
                {item.type === 'video' && '🎬'}
                {item.type === 'audio' && '🔊'}
                {item.type === 'text' && '📝'}
              </div>
            ))
          ) : (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-surface rounded border border-border" />
            ))
          )}
        </div>
        {items.length > 0 && (
          <>
            <span className="text-[9px] text-text-muted text-center">{items.length} 项</span>
            <button
              onClick={handleDownloadAll}
              className="w-full text-[9px] text-text-secondary hover:text-text py-1 bg-surface-hover rounded"
            >
              ⬇ 全部下载
            </button>
          </>
        )}
      </div>
    </BaseNodeWrapper>
  );
}

export default memo(OutputGalleryNode);