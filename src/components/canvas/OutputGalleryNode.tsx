// Ref: node-banana Output Gallery Node
// 图集输出节点：从上游节点读取多个数据并显示
// 网格填充整个节点区域，仅留顶部标题和底部信息行
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

    inputImages.forEach((url) => {
      if (url) items.push({ type: 'image', url });
    });
    inputVideos.forEach((url) => {
      if (url) items.push({ type: 'video', url });
    });
    inputAudio.forEach((url) => {
      if (url) items.push({ type: 'audio', url });
    });
    if (inputText) {
      items.push({ type: 'text', content: inputText });
    }

    return items;
  }, [inputImages, inputVideos, inputAudio, inputText]);

  // 监测上游数据变化，自动更新
  const prevUpstreamRef = useRef<typeof upstreamData | null>(null);

  useEffect(() => {
    if (prevUpstreamRef.current === null) {
      prevUpstreamRef.current = upstreamData;
      return;
    }

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
      {/* 多类型输入 handle — 支持同时接收图片、视频、文本 */}
      <Handle type="target" position={Position.Left} id="image" style={{ top: '25%', zIndex: 10 }} data-handletype="image" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="image" style={{ right: 'calc(100% + 8px)', top: 'calc(25% - 8px)', zIndex: 10 }}>Image</div>
      <Handle type="target" position={Position.Left} id="video" style={{ top: '50%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="video" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Video</div>
      <Handle type="target" position={Position.Left} id="text" style={{ top: '75%', zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="text" style={{ right: 'calc(100% + 8px)', top: 'calc(75% - 8px)', zIndex: 10 }}>Text</div>

      {/* 内容区域 — flex-1 填满 */}
      <div className="flex flex-col h-full">
        {/* 网格填充区域 */}
        <div className="flex-1 min-h-0">
          <div className="w-full h-full grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {items.length > 0 ? (
              items.map((item, i) => (
                <div
                  key={i}
                  className="aspect-square bg-surface rounded border border-border flex items-center justify-center text-[9px] text-text-muted overflow-hidden"
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
                <div key={i} className="aspect-square bg-surface rounded border border-border" />
              ))
            )}
          </div>
        </div>

        {/* 底部紧凑信息行 */}
        {items.length > 0 && (
          <div className="flex items-center justify-between py-1 shrink-0">
            <span className="text-[9px] text-text-muted">{items.length} 项</span>
            <button
              onClick={handleDownloadAll}
              className="text-[9px] text-text-secondary hover:text-text"
            >
              ⬇ 全部下载
            </button>
          </div>
        )}
      </div>
    </BaseNodeWrapper>
  );
}

export default memo(OutputGalleryNode);