// Ref: §6.6 — 音频节点双模式 (听音断句 + TTS)
import { memo, useState, useCallback, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AudioNodeType } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { transcribeAudio, generateTTS } from '@/api/audioApi';
import type { TranscriptChunk } from '@/api/audioApi';
import BaseNodeWrapper from './BaseNode';

function AudioNodeComponent({ data, selected }: NodeProps<AudioNodeType>) {
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
    try {
      const result = await transcribeAudio({
        channelUrl: channel.url,
        channelKey: channel.key,
        model: currentModel,
        audioFile: file,
      });
      setChunks(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '语音断句失败';
      setErrorMessage(msg);
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
    try {
      const url = await generateTTS({
        channelUrl: channel.url,
        channelKey: channel.key,
        model: currentModel,
        input: ttsText.trim(),
        voice: ttsVoice,
      });
      setAudioUrl(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'TTS 生成失败';
      setErrorMessage(msg);
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
      <Handle type="target" position={Position.Left} id="audio" style={{ top: '50%' }} className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
      <div className="flex flex-col gap-2 p-2 min-w-[280px]">
        {/* 模式切换 */}
        <div className="flex gap-1">
          <button
            onClick={() => setMode('transcription')}
            className={`flex-1 text-[10px] py-1 rounded font-medium ${
              mode === 'transcription' ? 'bg-blue-600 text-white' : 'bg-[#333] text-gray-400'
            }`}
          >
            🎧 听音断句
          </button>
          <button
            onClick={() => setMode('tts')}
            className={`flex-1 text-[10px] py-1 rounded font-medium ${
              mode === 'tts' ? 'bg-blue-600 text-white' : 'bg-[#333] text-gray-400'
            }`}
          >
            🔊 文本转语音
          </button>
        </div>

        {/* 模型选择 */}
        {models.length > 1 && (
          <select
            value={currentModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-[#2a2a2a] text-white text-[10px] rounded p-0.5 border border-[#444]"
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
              className="w-full bg-[#333] hover:bg-[#444] disabled:opacity-50 text-gray-300 text-xs py-1.5 rounded border border-[#555] border-dashed"
            >
              📁 选择音频文件
            </button>

            {/* 断句结果 */}
            {chunks.length > 0 && (
              <div className="bg-[#2a2a2a] rounded p-1.5 border border-[#444] max-h-[120px] overflow-y-auto space-y-1">
                {chunks.map((chunk, i) => (
                  <div key={i} className="text-[10px] text-gray-300">
                    <span className="text-blue-400 mr-1">{chunk.start.toFixed(1)}s–{chunk.end.toFixed(1)}s</span>
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
              className="w-full bg-[#2a2a2a] text-white text-xs rounded p-1.5 resize-none border border-[#444] focus:border-blue-500 outline-none"
              rows={3}
            />
            <button
              onClick={handleGenerateTTS}
              disabled={loading || !ttsText.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs py-1.5 rounded font-medium"
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
      <Handle type="source" position={Position.Right} id="audio" className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
    </BaseNodeWrapper>
  );
}

export default memo(AudioNodeComponent);