// Ref: node-banana GenerateVideoNode.tsx + 悬停展开模式
// 功能：通过 API 生成视频
import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { VideoNodeType } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { generateVideo } from '@/api/videoApi';
import BaseNodeWrapper from './BaseNode';
import ProviderModelSelector from './ProviderModelSelector';

function VideoNodeComponent({ id, data, selected }: NodeProps<VideoNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  // Store-only: read directly from data
  const prompt = data.prompt ?? '';
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const progress = data.progress ?? 0;
  const videoUrl = data.videoUrl ?? '';
  const thumbnailUrl = data.thumbnailUrl ?? '';
  const selectedModel = data.selectedModel ?? '';
  const selectedSeconds = data.selectedSeconds ?? '';
  const selectedChannelId = (data as { selectedChannelId?: string }).selectedChannelId;

  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const videoChannelId = useSettingsStore((s) => s.apiConfig.videoChannelId);
  const videoModel = useSettingsStore((s) => s.apiConfig.videoModel);
  const videoDurations = useSettingsStore((s) => s.apiConfig.videoDurations);
  const showNodeModelSettings = useSettingsStore((s) => s.systemSettings.showNodeModelSettings);

  const models = videoModel.split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || models[0] || '';
  const durations = videoDurations.split('\n').filter((d) => d.trim());

  // 使用节点选择的 channel（如果有）否则用默认的
  const currentChannelId = selectedChannelId || videoChannelId;

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    const channel = channels.find((c) => c.id === currentChannelId);
    if (!channel) {
      updateNodeData(id, { errorMessage: '未选择视频供应商' });
      return;
    }
    updateNodeData(id, { loading: true, errorMessage: '', progress: 0, selectedChannelId: currentChannelId, selectedModel: currentModel });
    try {
      const result = await generateVideo(
        {
          channelUrl: channel.url,
          channelKey: channel.key,
          model: currentModel,
          prompt: prompt.trim(),
          size: data.size || '1280x720',
          seconds: selectedSeconds || durations[0] || '10',
        },
        (p) => {
          updateNodeData(id, { progress: p });
        },
      );
      updateNodeData(id, { videoUrl: result.videoUrl, thumbnailUrl: result.thumbnailUrl, loading: false, progress: 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '视频生成失败';
      updateNodeData(id, { loading: false, errorMessage: msg, progress: 0 });
    }
  }, [prompt, loading, channels, videoChannelId, currentModel, data.size, selectedSeconds, durations, id, updateNodeData]);

  // 精简内容
  const minimalContent = (
    <>
      {/* 输入 Handle (33%) */}
      <Handle type="target" position={Position.Left} id="video" style={{ top: '33%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="video" style={{ right: 'calc(100% + 8px)', top: 'calc(33% - 8px)', zIndex: 10 }}>Video</div>
      
      {/* 视频预览区域 */}
      {videoUrl && !loading ? (
        <div className="relative w-full h-full min-h-[120px] bg-[#1a1a1a]">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="缩略图" className="w-full h-full object-cover" />
          ) : (
            <video src={videoUrl} className="w-full h-full object-contain" />
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
      
      {/* 输出 Handle (67%) */}
      <Handle type="source" position={Position.Right} id="video" style={{ top: '67%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="video" style={{ left: 'calc(100% + 8px)', top: 'calc(67% - 8px)', zIndex: 10 }}>Video</div>
    </>
  );

  // 悬停完整参数内容
  const fullContent = (
    <>
      {/* 输入 Handle (33%) */}
      <Handle type="target" position={Position.Left} id="video" style={{ top: '33%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="video" style={{ right: 'calc(100% + 8px)', top: 'calc(33% - 8px)', zIndex: 10 }}>Video</div>
      
      {/* 内容区域 */}
      <div className="flex flex-col h-full">
        {/* 预览区域 */}
        <div className="flex-1 min-h-0">
          {videoUrl && !loading && (
            <div className="relative w-full h-full min-h-[80px] bg-[#1a1a1a] rounded">
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="视频缩略图" className="w-full h-full object-cover" />
              ) : (
                <video src={videoUrl} controls className="w-full h-full object-contain" />
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

          <div className="flex gap-1">
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
            {durations.length > 0 && (
              <select
                value={selectedSeconds || durations[0] || '10'}
                onChange={(e) => updateNodeData(id, { selectedSeconds: e.target.value })}
                className="bg-[#1a1a1a] text-white text-[10px] rounded p-0.5 border border-[#333]"
              >
                {durations.map((d) => (
                  <option key={d} value={d}>{d}秒</option>
                ))}
              </select>
            )}
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#333] disabled:cursor-not-allowed text-white text-xs py-1.5 rounded font-medium"
          >
            {loading ? `生成中 ${progress > 0 ? `${Math.round(progress * 100)}%` : '...'}` : '生成视频'}
          </button>

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
      
      {/* 输出 Handle (67%) */}
      <Handle type="source" position={Position.Right} id="video" style={{ top: '67%', zIndex: 10 }} data-handletype="video" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="video" style={{ left: 'calc(100% + 8px)', top: 'calc(67% - 8px)', zIndex: 10 }}>Video</div>
    </>
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
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(VideoNodeComponent);