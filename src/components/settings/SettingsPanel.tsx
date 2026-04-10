// Ref: §7.2 — SettingsPanel 供应商管理 + 4 类 API 配置
import { useState, useCallback } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { ChannelConfig } from '@/types';

const TTS_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;

type ApiType = 'text' | 'image' | 'video' | 'audio';

interface ApiSectionConfig {
  type: ApiType;
  icon: string;
  label: string;
  channelIdKey: 'textChannelId' | 'imageChannelId' | 'videoChannelId' | 'audioChannelId';
  modelKey: 'textModel' | 'drawingModel' | 'videoModel' | 'audioModel';
  extra?: 'ttsVoice' | 'videoDurations';
}

const API_SECTIONS: ApiSectionConfig[] = [
  { type: 'text', icon: '📝', label: 'LLM 大模型', channelIdKey: 'textChannelId', modelKey: 'textModel' },
  { type: 'image', icon: '🎨', label: '图像大模型', channelIdKey: 'imageChannelId', modelKey: 'drawingModel' },
  { type: 'video', icon: '🎬', label: '视频大模型', channelIdKey: 'videoChannelId', modelKey: 'videoModel', extra: 'videoDurations' },
  { type: 'audio', icon: '🎙️', label: '语音（断句 + TTS）', channelIdKey: 'audioChannelId', modelKey: 'audioModel', extra: 'ttsVoice' },
];

function TestConnectionButton({ channel, model }: { channel: ChannelConfig | undefined; model: string }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<'idle' | 'success' | 'error'>('idle');

  const handleTest = useCallback(async () => {
    if (!channel) {
      setResult('error');
      return;
    }
    const firstModel = model.split('\n')[0]?.trim();
    if (!firstModel) {
      setResult('error');
      return;
    }
    setTesting(true);
    setResult('idle');
    try {
      const url = `${channel.url.replace(/\/$/, '')}/v1/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${channel.key}`,
        },
        body: JSON.stringify({
          model: firstModel,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      });
      setResult(response.ok ? 'success' : 'error');
    } catch {
      setResult('error');
    } finally {
      setTesting(false);
    }
  }, [channel, model]);

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleTest}
        disabled={testing}
        className="text-[9px] px-2 py-0.5 rounded bg-[#333] hover:bg-[#444] disabled:opacity-50 text-gray-300 border border-[#555]"
      >
        {testing ? '测试中...' : '测试连接'}
      </button>
      {result === 'success' && <span className="text-green-400 text-[9px]">✓ 连接成功</span>}
      {result === 'error' && <span className="text-red-400 text-[9px]">✗ 连接失败</span>}
    </div>
  );
}

function ChannelSection() {
  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const addChannel = useSettingsStore((s) => s.addChannel);
  const updateChannel = useSettingsStore((s) => s.updateChannel);
  const removeChannel = useSettingsStore((s) => s.removeChannel);

  const [expanded, setExpanded] = useState(false);

  const handleAdd = useCallback(() => {
    const id = Date.now().toString();
    addChannel({ id, name: '', url: '', key: '' });
  }, [addChannel]);

  return (
    <div className="bg-[#222] rounded-lg border border-[#444] p-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between text-sm font-medium text-white"
      >
        <span>🔌 供应商管理 ({channels.length})</span>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          {channels.map((ch) => (
            <div key={ch.id} className="bg-[#2a2a2a] rounded p-2 border border-[#444] space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  value={ch.name}
                  onChange={(e) => updateChannel(ch.id, { name: e.target.value })}
                  placeholder="名称"
                  className="flex-1 bg-[#333] text-white text-[10px] rounded px-1.5 py-0.5 border border-[#555] focus:border-blue-500 outline-none"
                />
                <button
                  onClick={() => removeChannel(ch.id)}
                  className="text-red-400 hover:text-red-300 text-xs px-1"
                >
                  ✕
                </button>
              </div>
              <input
                value={ch.url}
                onChange={(e) => updateChannel(ch.id, { url: e.target.value })}
                placeholder="API 端点地址"
                className="w-full bg-[#333] text-white text-[10px] rounded px-1.5 py-0.5 border border-[#555] focus:border-blue-500 outline-none"
              />
              <input
                type="password"
                value={ch.key}
                onChange={(e) => updateChannel(ch.id, { key: e.target.value })}
                placeholder="API Key"
                className="w-full bg-[#333] text-white text-[10px] rounded px-1.5 py-0.5 border border-[#555] focus:border-blue-500 outline-none"
              />
            </div>
          ))}
          <button
            onClick={handleAdd}
            className="w-full text-[10px] py-1.5 rounded border border-dashed border-[#555] text-gray-400 hover:text-white hover:border-blue-500 bg-[#2a2a2a]"
          >
            + 添加供应商
          </button>
        </div>
      )}
    </div>
  );
}

function ApiConfigSection({ config }: { config: ApiSectionConfig }) {
  const apiConfig = useSettingsStore((s) => s.apiConfig);
  const setChannelId = useSettingsStore((s) => s.setChannelId);
  const setModel = useSettingsStore((s) => s.setModel);
  const channels = apiConfig.channels;
  const selectedChannelId = apiConfig[config.channelIdKey] as string;
  const modelValue = apiConfig[config.modelKey] as string;
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

  return (
    <div className="bg-[#222] rounded-lg border border-[#444] p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] text-gray-400">供应商</label>
        <select
          value={selectedChannelId}
          onChange={(e) => setChannelId(config.type, e.target.value)}
          className="w-full bg-[#2a2a2a] text-white text-[10px] rounded px-1.5 py-1 border border-[#555]"
        >
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name || ch.url || ch.id}
            </option>
          ))}
        </select>

        <label className="text-[9px] text-gray-400">模型名（每行一个）</label>
        <textarea
          value={modelValue}
          onChange={(e) => setModel(config.modelKey, e.target.value)}
          placeholder="每行一个模型名"
          rows={2}
          className="w-full bg-[#2a2a2a] text-white text-[10px] rounded px-1.5 py-1 border border-[#555] resize-none font-mono focus:border-blue-500 outline-none"
        />

        {config.extra === 'videoDurations' && (
          <>
            <label className="text-[9px] text-gray-400">时长选项（每行一个，单位秒）</label>
            <textarea
              value={apiConfig.videoDurations}
              onChange={(e) => setModel('videoDurations', e.target.value)}
              placeholder="10&#10;15"
              rows={2}
              className="w-full bg-[#2a2a2a] text-white text-[10px] rounded px-1.5 py-1 border border-[#555] resize-none font-mono focus:border-blue-500 outline-none"
            />
          </>
        )}

        {config.extra === 'ttsVoice' && (
          <>
            <label className="text-[9px] text-gray-400">TTS 语音</label>
            <select
              value={apiConfig.ttsVoice}
              onChange={(e) => setModel('ttsVoice', e.target.value)}
              className="w-full bg-[#2a2a2a] text-white text-[10px] rounded px-1.5 py-0.5 border border-[#555]"
            >
              {TTS_VOICES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </>
        )}

        <TestConnectionButton channel={selectedChannel} model={modelValue} />
      </div>
    </div>
  );
}

export default function SettingsPanel() {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-[#1a1a1a]">
      <ChannelSection />
      {API_SECTIONS.map((config) => (
        <ApiConfigSection key={config.type} config={config} />
      ))}
    </div>
  );
}