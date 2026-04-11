// Ref: §6.6 — 音频节点双模式 (听音断句 + TTS)
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
import { memo, useState, useCallback, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AudioNodeType } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { transcribeAudio, generateTTS } from '@/api/audioApi';
import type { TranscriptChunk } from '@/api/audioApi';
import BaseNodeWrapper from './BaseNode';
import { Headphones, Volume2, FileAudio } from 'lucide-react';

function AudioNodeComponent({ id, data, selected }: NodeProps<AudioNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const [mode, setMode] = useState<'transcription' | 'tts'>(
    data.ttsText ? 'tts' : 'transcription'
  );
  const [loading, setLoading] = useState(data.loading ?? false);
  const [errorMessage, setErrorMessage] = useState(data.errorMessage ?? '');
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [audioUrl, setAudioUrl] = useState(data.audioUrl ?? '');
  const [ttsText, setTtsText] = useState(data.ttsText ?? '');
  const [selectedModel, setSelectedModel] = useState(data.selectedModel ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const audioChannelId = useSettingsStore((s) => s.apiConfig.audioChannelId);
  const audioModel = useSettingsStore((s) => s.apiConfig.audioModel);
  const ttsVoice = useSettingsStore((s) => s.apiConfig.ttsVoice);

  const models = audioModel.split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || models[0] || 'whisper-1';

  // 模式1: 听音断句
  const handleTranscribe = useCallback(async (file: File) => {
    const channel = channels.find((c) => c.id === audioChannelId);
    if (!channel) {
      setErrorMessage('未选择语音供应商');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    updateNodeData(id, { loading: true, errorMessage: '' });
    try {
      const result = await transcribeAudio({
        channelUrl: channel.url,
        channelKey: channel.key,
        model: currentModel,
        audioFile: file,
      });
      setChunks(result);
      updateNodeData(id, { loading: false, chunks: result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '语音断句失败';
      setErrorMessage(msg);
      updateNodeData(id, { loading: false, errorMessage: msg });
    } finally {
      setLoading(false);
    }
  }, [channels, audioChannelId, currentModel]);

  // 模式2: TTS
  const handleGenerateTTS = useCallback(async () => {
    if (!ttsText.trim() || loading) return;
    const channel = channels.find((c) => c.id === audioChannelId);
    if (!channel) {
      setErrorMessage('未选择语音供应商');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    updateNodeData(id, { loading: true, errorMessage: '' });
    try {
      const url = await generateTTS({
        channelUrl: channel.url,
        channelKey: channel.key,
        model: currentModel,
        input: ttsText.trim(),
        voice: ttsVoice,
      });
      setAudioUrl(url);
      updateNodeData(id, { audioUrl: url, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'TTS 生成失败';
      setErrorMessage(msg);
      updateNodeData(id, { loading: false, errorMessage: msg });
    } finally {
      setLoading(false);
    }
  }, [ttsText, loading, channels, audioChannelId, currentModel, ttsVoice]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleTranscribe(file);
    }
  }, [handleTranscribe]);

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage} minHeight={200} minWidth={320}>
      <Handle type="target" position={Position.Left} id="audio" style={{ top: '50%' }} className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222]" />
      <div className="flex flex-col gap-2 p-2 min-w-[280px]">
        {/* 模式切换 */}
        <div className="flex gap-1">
          <button
            onClick={() => setMode('transcription')}
            className={`flex-1 text-[10px] py-1 rounded font-medium flex items-center justify-center gap-1 ${
              mode === 'transcription' ? 'bg-primary text-text' : 'bg-surface text-text-secondary'
            }`}
          >
            <Headphones className="w-3 h-3" />
            听音断句
          </button>
          <button
            onClick={() => setMode('tts')}
            className={`flex-1 text-[10px] py-1 rounded font-medium flex items-center justify-center gap-1 ${
              mode === 'tts' ? 'bg-primary text-text' : 'bg-surface text-text-secondary'
            }`}
          >
            <Volume2 className="w-3 h-3" />
            文本转语音
          </button>
        </div>

        {/* 模型选择 */}
        {models.length > 1 && (
          <select
            value={currentModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-surface text-text text-[10px] rounded p-0.5 border border-border"
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}

        {/* 听音断句模式 */}
        {mode === 'transcription' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full bg-surface hover:bg-surface-hover disabled:opacity-50 text-text-secondary text-xs py-1.5 rounded border border-border border-dashed flex items-center justify-center gap-1"
            >
              <FileAudio className="w-3 h-3" />
              选择音频文件
            </button>

            {/* 断句结果 */}
            {chunks.length > 0 && (
              <div className="bg-surface rounded p-1.5 border border-border max-h-[120px] overflow-y-auto space-y-1">
                {chunks.map((chunk, i) => (
                  <div key={i} className="text-[10px] text-text">
                    <span className="text-primary mr-1">{chunk.start.toFixed(1)}s–{chunk.end.toFixed(1)}s</span>
                    {chunk.text}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* TTS 模式 */}
        {mode === 'tts' && (
          <>
            <textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="输入要转语音的文本..."
              className="w-full bg-surface text-text text-xs rounded p-1.5 resize-none border border-border focus:border-primary outline-none"
              rows={3}
            />
            <button
              onClick={handleGenerateTTS}
              disabled={loading || !ttsText.trim()}
              className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1.5 rounded font-medium"
            >
              {loading ? '生成中...' : '生成语音'}
            </button>
          </>
        )}

        {/* 音频播放 */}
        {audioUrl && !loading && (
          <audio controls src={audioUrl} className="w-full h-8" />
        )}
      </div>
      <Handle type="source" position={Position.Right} id="audio" className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222]" />
    </BaseNodeWrapper>
  );
}

export default memo(AudioNodeComponent);