// Ref: node-banana LLMGenerateNode.tsx provider/model selector
// 供应商+模型选择器：可复用到所有生成节点
import { memo, useCallback } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface ProviderModelSelectorProps {
  type: 'image' | 'video' | 'audio' | 'text'; // 对应 channels 中的类型
  selectedChannelId: string | undefined;
  selectedModel: string | undefined;
  onChannelChange: (channelId: string) => void;
  onModelChange: (model: string) => void;
}

function ProviderModelSelector({
  type,
  selectedChannelId,
  selectedModel,
  onChannelChange,
  onModelChange,
}: ProviderModelSelectorProps) {
  const channels = useSettingsStore((s) => s.apiConfig.channels);

  // 获取对应类型的默认 channel ID 和模型
  const getDefaultChannelId = useCallback(() => {
    switch (type) {
      case 'image': return useSettingsStore.getState().apiConfig.imageChannelId;
      case 'video': return useSettingsStore.getState().apiConfig.videoChannelId;
      case 'audio': return useSettingsStore.getState().apiConfig.audioChannelId;
      case 'text': return useSettingsStore.getState().apiConfig.textChannelId;
      default: return '';
    }
  }, [type]);

  const getDefaultModels = useCallback(() => {
    switch (type) {
      case 'image': return useSettingsStore.getState().apiConfig.drawingModel;
      case 'video': return useSettingsStore.getState().apiConfig.videoModel;
      case 'audio': return useSettingsStore.getState().apiConfig.audioModel;
      case 'text': return useSettingsStore.getState().apiConfig.textModel;
      default: return '';
    }
  }, [type]);

  // 当前使用的 channel（优先用节点选择的，否则用默认的）
  const currentChannelId = selectedChannelId || getDefaultChannelId();

  // 模型列表（换行分隔）
  const availableModels = getDefaultModels().split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || availableModels[0] || '';

  // 根据 protocol 获取模型列表
  const getModelsForChannel = useCallback((channelId: string) => {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return [];
    
    // 根据 protocol 返回不同的模型列表
    switch (type) {
      case 'image':
        // 图片生成模型
        if (channel.protocol === 'gemini') {
          return ['imagen-3-generate', 'imagen-3', 'imagen-2'].filter(Boolean);
        }
        return getDefaultModels().split('\n').filter((m) => m.trim());
      case 'video':
        // 视频生成模型
        return getDefaultModels().split('\n').filter((m) => m.trim());
      case 'audio':
        // 音频模型
        return getDefaultModels().split('\n').filter((m) => m.trim());
      case 'text':
        // LLM 模型
        if (channel.protocol === 'gemini') {
          return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash', 'gemini-3-pro'].filter(Boolean);
        }
        if (channel.protocol === 'openai') {
          return ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'].filter(Boolean);
        }
        if (channel.protocol === 'anthropic') {
          return ['claude-sonnet-4', 'claude-haiku-4', 'claude-opus-4'].filter(Boolean);
        }
        return getDefaultModels().split('\n').filter((m) => m.trim());
      default:
        return [];
    }
  }, [channels, type, getDefaultModels]);

  const modelsForCurrentChannel = getModelsForChannel(currentChannelId);

  const handleChannelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newChannelId = e.target.value;
    const newModels = getModelsForChannel(newChannelId);
    onChannelChange(newChannelId);
    // 切换 channel 时重置 model 为新 channel 的第一个模型
    const firstModel = newModels.find((m) => m);
    if (firstModel) {
      onModelChange(firstModel);
    }
  }, [getModelsForChannel, onChannelChange, onModelChange]);

  return (
    <div className="flex items-center gap-2">
      {/* 供应商选择 */}
      <select
        value={currentChannelId}
        onChange={handleChannelChange}
        className="flex-1 min-w-0 text-[10px] py-1 px-2 bg-surface-hover text-text rounded border border-border focus:outline-none focus:border-primary"
      >
        {channels.length === 0 && (
          <option value="">无供应商</option>
        )}
        {channels.map((channel) => (
          <option key={channel.id} value={channel.id}>
            {channel.name}
          </option>
        ))}
      </select>

      {/* 模型选择 */}
      <select
        value={currentModel}
        onChange={(e) => onModelChange(e.target.value)}
        className="flex-1 min-w-0 text-[10px] py-1 px-2 bg-surface-hover text-text rounded border border-border focus:outline-none focus:border-primary"
      >
        {modelsForCurrentChannel.length === 0 && (
          <option value="">无模型</option>
        )}
        {modelsForCurrentChannel.map((model) => (
          <option key={model} value={model}>
            {model}
          </option>
        ))}
      </select>
    </div>
  );
}

export default memo(ProviderModelSelector);
