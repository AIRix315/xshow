// Ref: node-banana LLMGenerateNode.tsx provider/model selector
// 供应商+模型选择器：可复用到所有生成节点
import { memo, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { ModelEntry } from '@/types';

interface ProviderModelSelectorProps {
  type: 'image' | 'video' | 'audio' | 'text' | '3d'; // 对应 channels 中的类型
  selectedChannelId: string | undefined;
  selectedModel: string | undefined;
  onChannelChange: (channelId: string) => void;
  onModelChange: (model: string) => void;
}

/** map type prop to modelEntries key */
function typeToKey(type: ProviderModelSelectorProps['type']): string {
  return type === '3d' ? '3d' : type;
}

function ProviderModelSelector({
  type,
  selectedChannelId,
  selectedModel,
  onChannelChange,
  onModelChange,
}: ProviderModelSelectorProps) {
  const channels = useSettingsStore((s) => s.apiConfig.channels);

  // 获取对应类型的默认 channel ID
  const getDefaultChannelId = useCallback(() => {
    switch (type) {
      case 'image': return useSettingsStore.getState().apiConfig.imageChannelId;
      case 'video': return useSettingsStore.getState().apiConfig.videoChannelId;
      case 'audio': return useSettingsStore.getState().apiConfig.audioChannelId;
      case 'text': return useSettingsStore.getState().apiConfig.textChannelId;
      case '3d': return useSettingsStore.getState().apiConfig.model3DChannelId;
      default: return '';
    }
  }, [type]);

  // 旧版：换行分隔字符串 fallback
  const getDefaultModelsStr = useCallback(() => {
    switch (type) {
      case 'image': return useSettingsStore.getState().apiConfig.drawingModel;
      case 'video': return useSettingsStore.getState().apiConfig.videoModel;
      case 'audio': return useSettingsStore.getState().apiConfig.audioModel;
      case 'text': return useSettingsStore.getState().apiConfig.textModel;
      case '3d': return useSettingsStore.getState().apiConfig.model3D;
      default: return '';
    }
  }, [type]);

  // 新版：从 modelEntries 获取
  const getDefaultModelEntries = useCallback((): ModelEntry[] => {
    const entries = useSettingsStore.getState().apiConfig.modelEntries[typeToKey(type)];
    return Array.isArray(entries) ? entries : [];
  }, [type]);

  // 当前使用的 channel（优先用节点选择的，否则用默认的）
  const currentChannelId = selectedChannelId || getDefaultChannelId();

  // 根据 protocol 返回模型列表（优先 modelEntries，fallback 旧版字符串 + 硬编码协议列表）
  const getModelsForChannel = useCallback((channelId: string): string[] => {
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return [];

    const entries = getDefaultModelEntries();

    // 新版：从 modelEntries 按 provider 过滤
    if (entries.length > 0) {
      const filtered = entries
        .filter((e) => e.provider === channel.protocol || e.provider === channel.id)
        .map((e) => e.name);
      // 如果当前 channel 有匹配的模型，返回过滤结果；否则返回全部（兜底）
      return filtered.length > 0 ? filtered : entries.map((e) => e.name);
    }

    // 旧版 fallback：换行分隔字符串 + 协议硬编码
    const fallbackModels = getDefaultModelsStr().split('\n').filter((m) => m.trim());
    switch (type) {
      case 'image':
        if (channel.protocol === 'gemini') {
          return ['imagen-3-generate', 'imagen-3', 'imagen-2'];
        }
        return fallbackModels;
      case 'video':
        return fallbackModels;
      case 'audio':
        return fallbackModels;
      case 'text':
        if (channel.protocol === 'gemini') {
          return ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash', 'gemini-3-pro'];
        }
        if (channel.protocol === 'openai') {
          return ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'];
        }
        if (channel.protocol === 'anthropic') {
          return ['claude-sonnet-4', 'claude-haiku-4', 'claude-opus-4'];
        }
        return fallbackModels;
      case '3d':
        return fallbackModels;
      default:
        return [];
    }
  }, [channels, type, getDefaultModelEntries, getDefaultModelsStr]);

  const modelsForCurrentChannel = getModelsForChannel(currentChannelId);

  // currentModel: 优先 selectedModel → modelEntries 中 isDefault=true → 列表首项
  const getDefaultModelName = useCallback((): string | undefined => {
    const entries = getDefaultModelEntries();
    const defaultEntry = entries.find((e) => e.isDefault);
    return defaultEntry?.name;
  }, [getDefaultModelEntries]);

  const currentModel = selectedModel || getDefaultModelName() || modelsForCurrentChannel[0] || '';

  const handleChannelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const newChannelId = e.target.value;
    const newModels = getModelsForChannel(newChannelId);
    onChannelChange(newChannelId);
    // 切换 channel 时重置 model 为新 channel 的默认模型或第一个模型
    const defaultModel = getDefaultModelName();
    const firstModel = defaultModel && newModels.includes(defaultModel)
      ? defaultModel
      : newModels.find((m) => m);
    if (firstModel) {
      onModelChange(firstModel);
    }
  }, [getModelsForChannel, getDefaultModelName, onChannelChange, onModelChange]);

  // 初始化同步：当 selectedModel 为空但 currentModel 有值时，自动同步到 selectedModel
  // 这样确保执行器能读取到正确的模型名
  useEffect(() => {
    if (!selectedModel && currentModel) {
      onModelChange(currentModel);
    }
  }, [selectedModel, currentModel, onModelChange]);

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
