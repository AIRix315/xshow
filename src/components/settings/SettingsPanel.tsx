// Ref: §7.2 — SettingsPanel 供应商管理 + 4 类 API 配置
import { useState, useCallback } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { ChannelConfig } from '@/types';
import { FileText, Image, Video, Volume2, Plug, ChevronDown, ChevronUp, X, CheckCircle2, XCircle } from 'lucide-react';

type ApiType = 'text' | 'image' | 'video' | 'audio';

interface ApiSectionConfig {
  type: ApiType;
  icon: typeof FileText;
  label: string;
  channelIdKey: 'textChannelId' | 'imageChannelId' | 'videoChannelId' | 'audioChannelId';
  modelKey: 'textModel' | 'drawingModel' | 'videoModel' | 'audioModel';
  extra?: 'ttsVoice' | 'videoDurations';
}

const API_SECTIONS: ApiSectionConfig[] = [
  { type: 'text', icon: FileText, label: 'LLM 大模型', channelIdKey: 'textChannelId', modelKey: 'textModel' },
  { type: 'image', icon: Image, label: '图像大模型', channelIdKey: 'imageChannelId', modelKey: 'drawingModel' },
  { type: 'video', icon: Video, label: '视频大模型', channelIdKey: 'videoChannelId', modelKey: 'videoModel', extra: 'videoDurations' },
  { type: 'audio', icon: Volume2, label: '语音（断句 + TTS）', channelIdKey: 'audioChannelId', modelKey: 'audioModel', extra: 'ttsVoice' },
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
        className="text-[9px] px-2 py-0.5 rounded bg-surface hover:bg-surface-hover disabled:opacity-50 text-text-secondary border border-border"
      >
        {testing ? '测试中...' : '测试连接'}
      </button>
      {result === 'success' && <span className="text-green-500 text-[9px] flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />连接成功</span>}
      {result === 'error' && <span className="text-error text-[9px] flex items-center gap-1"><XCircle className="w-3 h-3" />连接失败</span>}
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
    addChannel({ id, name: '', url: '', key: '', protocol: 'openai' });
  }, [addChannel]);

  return (
    <div className="bg-surface rounded-lg border border-border p-3">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between text-sm font-medium text-text"
      >
        <span className="flex items-center gap-2"><Plug className="w-4 h-4" />供应商管理 ({channels.length})</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          {channels.map((ch) => (
            <div key={ch.id} className="bg-surface-hover rounded p-2 border border-border space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  value={ch.name}
                  onChange={(e) => updateChannel(ch.id, { name: e.target.value })}
                  placeholder="名称"
                  className="flex-1 bg-surface text-text text-[10px] rounded px-1.5 py-0.5 border border-border focus:border-primary outline-none"
                />
                <button
                  onClick={() => removeChannel(ch.id)}
                  className="text-error hover:text-error/80 text-xs px-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <input
                value={ch.url}
                onChange={(e) => updateChannel(ch.id, { url: e.target.value })}
                placeholder="API 端点地址"
                className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-0.5 border border-border focus:border-primary outline-none"
              />
              <input
                type="password"
                value={ch.key}
                onChange={(e) => updateChannel(ch.id, { key: e.target.value })}
                placeholder="API Key"
                className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-0.5 border border-border focus:border-primary outline-none"
              />
              <select
                value={ch.protocol}
                onChange={(e) => updateChannel(ch.id, { protocol: e.target.value as 'openai' | 'gemini' | 'custom' })}
                className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-0.5 border border-border focus:border-primary outline-none"
              >
                <option value="openai">协议: OpenAI 兼容</option>
                <option value="gemini">协议: Gemini</option>
                <option value="custom">协议: 自定义</option>
              </select>
            </div>
          ))}
          <button
            onClick={handleAdd}
            className="w-full text-[10px] py-1.5 rounded border border-dashed border-border text-text-secondary hover:text-text hover:border-primary bg-surface-hover"
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
    <div className="bg-surface rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-text">
        <config.icon className="w-4 h-4" />
        <span>{config.label}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] text-text-secondary">供应商</label>
        <select
          value={selectedChannelId}
          onChange={(e) => setChannelId(config.type, e.target.value)}
          className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border"
        >
          {channels.map((ch) => (
            <option key={ch.id} value={ch.id}>
              {ch.name || ch.url || ch.id}
            </option>
          ))}
        </select>

        <label className="text-[9px] text-text-secondary">模型名（每行一个）</label>
        <textarea
          value={modelValue}
          onChange={(e) => setModel(config.modelKey, e.target.value)}
          placeholder="每行一个模型名"
          rows={2}
          className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border resize-none font-mono focus:border-primary outline-none"
        />

        {config.extra === 'videoDurations' && (
          <>
            <label className="text-[9px] text-text-secondary">时长选项（每行一个，单位秒）</label>
            <textarea
              value={apiConfig.videoDurations}
              onChange={(e) => setModel('videoDurations', e.target.value)}
              placeholder="10&#10;15"
              rows={2}
              className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border resize-none font-mono focus:border-primary outline-none"
            />
          </>
        )}

        {config.extra === 'ttsVoice' && (
          <>
            <label className="text-[9px] text-text-secondary">TTS 语音标识</label>
            <input
              value={apiConfig.ttsVoice}
              onChange={(e) => setModel('ttsVoice', e.target.value)}
              placeholder="如 alloy, echo, nova 等"
              className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-primary outline-none"
            />
          </>
        )}

        <TestConnectionButton channel={selectedChannel} model={modelValue} />
      </div>
    </div>
  );
}

export default function SettingsPanel() {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-background">
      <ChannelSection />
      {API_SECTIONS.map((config) => (
        <ApiConfigSection key={config.type} config={config} />
      ))}
    </div>
  );
}