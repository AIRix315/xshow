// Ref: node-banana GenerateVideoNode.tsx + 悬停展开模式
// 功能：通过 API 生成视频
import { memo, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { VideoNodeType } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { executeVideoNode } from '@/store/execution/generateNodeExecutors';
import type { NodeExecutionContext } from '@/store/execution/types';
import { getConnectedInputs } from '@/utils/connectedInputs';
import { useAdaptiveHeight } from '@/hooks/useAdaptiveHeight';
import type { Node, Edge } from '@xyflow/react';
import BaseNodeWrapper from './BaseNode';
import ProviderModelSelector from './ProviderModelSelector';

function VideoNodeComponent({ id, data, selected }: NodeProps<VideoNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);

  // 查找连入的 text Handle
  const incomingTextEdge = edges.find((e) => e.target === id && e.targetHandle === 'text');
  const textSourceNode = incomingTextEdge ? nodes.find((n) => n.id === incomingTextEdge.source) : undefined;
  const textFromHandle = textSourceNode?.data?.text as string | undefined;

  // Store-only: read directly from data
  const prompt = data.prompt ?? '';
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const progress = data.progress ?? 0;
  const videoUrl = data.videoUrl ?? '';
  const thumbnailUrl = data.thumbnailUrl ?? '';
  const aspectRatio = data.aspectRatio ?? '16:9';
  const imageSize = data.imageSize ?? '1k';
  const selectedModel = data.selectedModel ?? '';
  const selectedSeconds = data.selectedSeconds ?? '';
  const customDuration = data.customDuration ?? '';
  const customWidth = data.customWidth ?? '';
  const customHeight = data.customHeight ?? '';
  const selectedChannelId = (data as { selectedChannelId?: string }).selectedChannelId;
  const videoGenerationMode = data.videoGenerationMode ?? 'text-to-video';

  // History data reads
  const videoHistory = (data.videoHistory as Array<{ videoUrl: string; thumbnailUrl: string; prompt: string; timestamp: number }>) ?? [];
  const selectedVideoHistoryIndex = data.selectedVideoHistoryIndex ?? (videoHistory.length > 0 ? videoHistory.length - 1 : undefined);

  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const videoChannelId = useSettingsStore((s) => s.apiConfig.videoChannelId);
  const videoModel = useSettingsStore((s) => s.apiConfig.videoModel);
  const showNodeModelSettings = useSettingsStore((s) => s.systemSettings.showNodeModelSettings);

  const models = videoModel.split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || models[0] || '';

  // 使用节点选择的 channel（如果有）否则用默认的
  const currentChannelId = selectedChannelId || videoChannelId;
  const currentChannel = useMemo(() => channels.find((c) => c.id === currentChannelId), [channels, currentChannelId]);

  const goToPrevVideo = useCallback(() => {
    const currentIndex = selectedVideoHistoryIndex ?? videoHistory.length - 1;
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const item = videoHistory[newIndex];
      if (item) {
        updateNodeData(id, { selectedVideoHistoryIndex: newIndex, videoUrl: item.videoUrl, thumbnailUrl: item.thumbnailUrl });
      }
    }
  }, [selectedVideoHistoryIndex, videoHistory, id, updateNodeData]);

  const goToNextVideo = useCallback(() => {
    const currentIndex = selectedVideoHistoryIndex ?? videoHistory.length - 1;
    if (currentIndex < videoHistory.length - 1) {
      const newIndex = currentIndex + 1;
      const item = videoHistory[newIndex];
      if (item) {
        updateNodeData(id, { selectedVideoHistoryIndex: newIndex, videoUrl: item.videoUrl, thumbnailUrl: item.thumbnailUrl });
      }
    }
  }, [selectedVideoHistoryIndex, videoHistory, id, updateNodeData]);

  // 优先使用连线数据，其次用 textarea
  const effectivePrompt = textFromHandle || prompt;

  // 自适应高度 hook
  const { containerRef, handleMediaLoad, containerStyle } = useAdaptiveHeight(400);

  const handleGenerate = useCallback(async () => {
    if (!effectivePrompt?.trim() || loading) return;
    if (!currentChannel) {
      updateNodeData(id, { errorMessage: '未选择视频供应商' });
      return;
    }
    const abortController = new AbortController();
    updateNodeData(id, { loading: true, errorMessage: '', progress: 0, selectedChannelId: currentChannelId, selectedModel: currentModel });
    try {
      const ctx: NodeExecutionContext = {
        node: { id, type: 'videoNode', position: { x: 0, y: 0 }, data } as Node,
        nodes: nodes as Node[],
        edges: edges as Edge[],
        getConnectedInputs: (nodeId: string) => getConnectedInputs(nodeId, nodes as Node[], edges as Edge[]),
        updateNodeData: (nodeId: string, patch: Record<string, unknown>) => {
          useFlowStore.getState().updateNodeData(nodeId, patch);
        },
        getFreshNode: (nodeId: string) => useFlowStore.getState().nodes.find((n) => n.id === nodeId),
        signal: abortController.signal,
      };
      await executeVideoNode(ctx);
    } catch (err) {
      // Safety catch — executeVideoNode already updated error state
      const msg = err instanceof Error ? err.message : '视频生成失败';
      updateNodeData(id, { loading: false, errorMessage: msg, progress: 0 });
    }
  }, [effectivePrompt, loading, currentChannel, currentChannelId, currentModel, id, updateNodeData, nodes, edges, videoGenerationMode, data]);

  // ---- Handles: 渲染在内容区域之外，避免重复导致连线漂移 ----
  const handles = (
    <>
      {/* 输入 Handle (33%) */}
      <Handle type="target" position={Position.Left} id="video" style={{ top: '33%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="video" style={{ right: 'calc(100% + 8px)', top: 'calc(33% - 8px)', zIndex: 10 }}>Video</div>
      
      {/* 输入 Handle - Text (67%) */}
      <Handle type="target" position={Position.Left} id="text" style={{ top: '67%', zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="text" style={{ right: 'calc(100% + 8px)', top: 'calc(67% - 8px)', zIndex: 10 }}>Text</div>
      
      {/* 输出 Handle (67%) */}
      <Handle type="source" position={Position.Right} id="video" style={{ top: '67%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="video" style={{ left: 'calc(100% + 8px)', top: 'calc(67% - 8px)', zIndex: 10 }}>Video</div>
    </>
  );

  // 精简内容
  const minimalContent = (
    <>
      {/* 视频预览区域 */}
      {videoUrl && !loading ? (
        <div className="flex flex-col">
          <div
            ref={containerRef}
            style={{ ...containerStyle, backgroundColor: '#1a1a1a' }}
          >
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="缩略图" onLoad={handleMediaLoad} className="w-full h-full object-cover" />
            ) : (
              <video src={videoUrl} onLoadedMetadata={handleMediaLoad} className="w-full h-full object-contain" />
            )}
          </div>
          {videoHistory && videoHistory.length > 1 && (
            <div className="history-nav flex items-center gap-1 justify-center py-1">
              <button onClick={goToPrevVideo} disabled={(selectedVideoHistoryIndex ?? videoHistory.length - 1) === 0} className="px-2 py-1 text-neutral-400 hover:text-white disabled:opacity-30">◀</button>
              <span className="text-[10px] text-neutral-500">{(selectedVideoHistoryIndex ?? videoHistory.length - 1) + 1}/{videoHistory.length}</span>
              <button onClick={goToNextVideo} disabled={(selectedVideoHistoryIndex ?? videoHistory.length - 1) >= videoHistory.length - 1} className="px-2 py-1 text-neutral-400 hover:text-white disabled:opacity-30">▶</button>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="w-full h-full min-h-[120px] flex items-center justify-center bg-[#1a1a1a]">
          <div className="flex flex-col items-center gap-2">
            <svg className="w-5 h-5 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-neutral-500 text-[10px]">{Math.round(progress * 100)}%</span>
          </div>
        </div>
      ) : (
        <div className="w-full h-full min-h-[120px] flex items-center justify-center bg-[#1a1a1a]">
          <span className="text-neutral-500 text-[10px]">运行生成</span>
        </div>
      )}
    </>
  );

  // 悬停完整参数内容
  const fullContent = (
    <div className="flex flex-col h-full">
      {/* 预览区域 */}
      <div className="flex-1 min-h-0">
        {videoUrl && !loading && (
          <div className="flex flex-col">
            <div
              ref={containerRef}
              style={{ ...containerStyle, backgroundColor: '#1a1a1a', borderRadius: '8px' }}
            >
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="视频缩略图" onLoad={handleMediaLoad} className="w-full h-full object-cover" />
              ) : (
                <video src={videoUrl} controls onLoadedMetadata={handleMediaLoad} className="w-full h-full object-contain" />
              )}
            </div>
            {videoHistory && videoHistory.length > 1 && (
              <div className="history-nav flex items-center gap-1 justify-center py-1">
                <button onClick={goToPrevVideo} disabled={(selectedVideoHistoryIndex ?? videoHistory.length - 1) === 0} className="px-2 py-1 text-neutral-400 hover:text-white disabled:opacity-30">◀</button>
                <span className="text-[10px] text-neutral-500">{(selectedVideoHistoryIndex ?? videoHistory.length - 1) + 1}/{videoHistory.length}</span>
                <button onClick={goToNextVideo} disabled={(selectedVideoHistoryIndex ?? videoHistory.length - 1) >= videoHistory.length - 1} className="px-2 py-1 text-neutral-400 hover:text-white disabled:opacity-30">▶</button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 参数区域 */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
        {/* 提示词 */}
        <textarea
          value={prompt}
          onChange={(e) => {
            updateNodeData(id, { prompt: e.target.value });
          }}
          placeholder="输入视频描述..."
          className="w-full bg-[#1a1a1a] text-white text-xs rounded p-1.5 resize-none border border-[#333] focus:border-blue-500 outline-none"
          rows={2}
        />

        <div className="flex flex-col gap-1">
          {showNodeModelSettings && (
            <ProviderModelSelector
              type="video"
              selectedChannelId={selectedChannelId}
              selectedModel={selectedModel}
              onChannelChange={(channelId) => {
                updateNodeData(id, { selectedChannelId: channelId });
              }}
              onModelChange={(model) => {
                updateNodeData(id, { selectedModel: model });
              }}
            />
          )}

          {/* 文生视频/图生视频切换 - runninghub 供应商时显示 */}
          {currentChannel?.url?.includes('runninghub.cn') && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-neutral-400 whitespace-nowrap">模式：</span>
              <select
                value={videoGenerationMode}
                onChange={(e) => updateNodeData(id, { videoGenerationMode: e.target.value as 'text-to-video' | 'image-to-video' })}
                className="flex-1 min-w-0 text-[10px] py-1 px-2 bg-surface-hover text-text rounded border border-border focus:outline-none focus:border-primary"
              >
                <option value="text-to-video">文生视频</option>
                <option value="image-to-video">图生视频</option>
              </select>
            </div>
          )}

          {/* 画面比例选项 - 下拉框 */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-neutral-400 whitespace-nowrap">画面比例：</span>
            <select
              value={aspectRatio}
              onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value })}
              className="flex-1 min-w-0 text-[10px] py-1 px-2 bg-surface-hover text-text rounded border border-border focus:outline-none focus:border-primary"
            >
              {['1:1', '16:9', '9:16', '4:3', '3:4'].map((ar) => (
                <option key={ar} value={ar}>{ar}</option>
              ))}
            </select>
          </div>

          {/* 清晰度选项 - 下拉框 */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-neutral-400 whitespace-nowrap">清晰度：</span>
            <select
              value={imageSize}
              onChange={(e) => updateNodeData(id, { imageSize: e.target.value })}
              className="flex-1 min-w-0 text-[10px] py-1 px-2 bg-surface-hover text-text rounded border border-border focus:outline-none focus:border-primary"
            >
              {['1k', '2k', '4k'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* 自定义尺寸 - 默认隐藏 */}
          {(customWidth || customHeight) && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-neutral-400 whitespace-nowrap">自定义尺寸：</span>
              <span className="text-[10px] text-neutral-500">W:</span>
              <input
                type="text"
                value={customWidth}
                onChange={(e) => updateNodeData(id, { customWidth: e.target.value, imageSize: '' })}
                placeholder="__"
                className="w-12 bg-[#1a1a1a] text-white text-[10px] rounded p-0.5 border border-[#333] focus:border-blue-500 outline-none"
              />
              <span className="text-[10px] text-neutral-500">H:</span>
              <input
                type="text"
                value={customHeight}
                onChange={(e) => updateNodeData(id, { customHeight: e.target.value, imageSize: '' })}
                placeholder="__"
                className="w-12 bg-[#1a1a1a] text-white text-[10px] rounded p-0.5 border border-[#333] focus:border-blue-500 outline-none"
              />
            </div>
          )}

          {/* 时长选项 - 预设值 */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-neutral-400 whitespace-nowrap">时长：</span>
            {['5', '10', '15'].map((d) => (
              <button
                key={d}
                onClick={() => updateNodeData(id, { selectedSeconds: d })}
                className={`px-1.5 py-0.5 text-[10px] rounded border ${
                  selectedSeconds === d ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-[#333] text-neutral-400 bg-[#1a1a1a] hover:bg-[#262626]'
                }`}
              >
                {d}s
              </button>
            ))}
          </div>

          {/* 自定义时长 - 默认隐藏 */}
          {customDuration && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-neutral-400 whitespace-nowrap">自定义时长：</span>
              <input
                type="text"
                value={customDuration}
                onChange={(e) => updateNodeData(id, { customDuration: e.target.value, selectedSeconds: '' })}
                placeholder="__s"
                className="w-14 bg-[#1a1a1a] text-white text-[10px] rounded p-0.5 border border-[#333] focus:border-blue-500 outline-none"
              />
            </div>
          )}
        </div>

        {/* 进度条 */}
        {loading && progress > 0 && (
          <div className="w-full bg-[#333] rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <BaseNodeWrapper
      selected={!!selected}
      loading={loading}
      errorMessage={errorMessage}
      title="生成视频"
      minWidth={280}
      minHeight={140}
      showHoverHeader
      onRun={handleGenerate}
      hoverContent={fullContent}
      handles={handles}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(VideoNodeComponent);