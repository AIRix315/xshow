// Ref: §6.5 + node-banana GenerateVideoNode.tsx — 视频+轮询+进度
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { VideoNode } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { generateVideo } from '@/api/videoApi';
import BaseNodeWrapper from './BaseNode';

function VideoNodeComponent({ id, data, selected }: NodeProps<VideoNode>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const [prompt, setPrompt] = useState(data.prompt ?? '');
  const [loading, setLoading] = useState(data.loading ?? false);
  const [errorMessage, setErrorMessage] = useState(data.errorMessage ?? '');
  const [progress, setProgress] = useState(data.progress ?? 0);
  const [videoUrl, setVideoUrl] = useState(data.videoUrl ?? '');
  const [thumbnailUrl, setThumbnailUrl] = useState(data.thumbnailUrl ?? '');
  const [selectedModel, setSelectedModel] = useState(data.selectedModel ?? '');
  const [selectedSeconds, setSelectedSeconds] = useState(data.selectedSeconds ?? '');

  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const videoChannelId = useSettingsStore((s) => s.apiConfig.videoChannelId);
  const videoModel = useSettingsStore((s) => s.apiConfig.videoModel);
  const videoDurations = useSettingsStore((s) => s.apiConfig.videoDurations);

  const models = videoModel.split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || models[0] || '';
  const durations = videoDurations.split('\n').filter((d) => d.trim());

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    const channel = channels.find((c) => c.id === videoChannelId);
    if (!channel) {
      setErrorMessage('未选择视频供应商');
      updateNodeData(id, { errorMessage: '未选择视频供应商' });
      return;
    }
    setLoading(true);
    setErrorMessage('');
    setProgress(0);
    updateNodeData(id, { loading: true, errorMessage: '', progress: 0 });
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
          setProgress(p);
          updateNodeData(id, { progress: p });
        },
      );
      setVideoUrl(result.videoUrl);
      setThumbnailUrl(result.thumbnailUrl);
      updateNodeData(id, { videoUrl: result.videoUrl, thumbnailUrl: result.thumbnailUrl, loading: false, progress: 0 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '视频生成失败';
      setErrorMessage(msg);
      updateNodeData(id, { loading: false, errorMessage: msg, progress: 0 });
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }, [prompt, loading, channels, videoChannelId, currentModel, data.size, selectedSeconds, durations, id, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage}>
      <Handle type="target" position={Position.Left} id="video" style={{ top: '35%' }} className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222]" />
      <div className="flex flex-col gap-2 p-2 min-w-[240px]">
        {/* 提示词 */}
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            updateNodeData(id, { prompt: e.target.value });
          }}
          placeholder="输入视频描述..."
          className="w-full bg-surface text-text text-xs rounded p-1.5 resize-none border border-border focus:border-primary outline-none"
          rows={2}
        />

        {/* 模型 + 时长 */}
        <div className="flex gap-1">
          {models.length > 1 && (
            <select
              value={currentModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="flex-1 bg-surface text-text text-[10px] rounded p-0.5 border border-border"
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          {durations.length > 0 && (
            <select
              value={selectedSeconds || durations[0] || '10'}
              onChange={(e) => setSelectedSeconds(e.target.value)}
              className="bg-surface text-text text-[10px] rounded p-0.5 border border-border"
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
          className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1.5 rounded font-medium"
        >
          {loading ? `生成中 ${progress > 0 ? `${Math.round(progress * 100)}%` : '...'}` : '生成视频'}
        </button>

        {/* 进度条 */}
        {loading && progress > 0 && (
          <div className="w-full bg-surface-hover rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}

        {/* 视频预览 */}
        {videoUrl && !loading && (
          <div className="relative">
            {thumbnailUrl && (
              <img src={thumbnailUrl} alt="视频缩略图" className="w-full rounded border border-border" />
            )}
            <video
              src={videoUrl}
              controls
              className="w-full rounded border border-border"
              style={{ maxHeight: '180px' }}
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="video" className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222]" />
    </BaseNodeWrapper>
  );
}

export default memo(VideoNodeComponent);