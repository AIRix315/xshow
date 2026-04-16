// Ref: node-banana Generate Audio Node + 本地 Web Speech API 实现
// 使用浏览器 SpeechSynthesis API 实现本地 TTS，无需外部 API
import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { AudioNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';

function GenerateAudioNode({ id, data, selected }: NodeProps<AudioNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  // Business data from store
  const text = data.text ?? '';
  const voice = data.voice ?? 'zh-CN';
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';

  // Pure UI state (not business data)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 获取可用语音列表
  const getVoices = useCallback(() => {
    if ('speechSynthesis' in window) {
      return window.speechSynthesis.getVoices();
    }
    return [];
  }, []);

  // 使用 Web Speech API 本地生成语音
  const handleGenerate = useCallback(() => {
    if (!text.trim()) return;
    
    if (!('speechSynthesis' in window)) {
      updateNodeData(id, { errorMessage: '您的浏览器不支持语音合成' });
      return;
    }

    updateNodeData(id, { loading: true, errorMessage: '' });
    setIsGenerating(true);
    
    // 停止之前的语音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    // 设置语音
    const voices = getVoices();
    const selectedVoice = voices.find(v => v.lang.startsWith(voice)) || voices[0];
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.lang = voice;
    utterance.rate = 1;
    utterance.pitch = 1;

    // 生成音频 blob
    utterance.onend = () => {
      setIsGenerating(false);
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      updateNodeData(id, { loading: false });
      setIsGenerating(false);
      updateNodeData(id, { errorMessage: '语音生成失败' });
    };

    // 由于 SpeechSynthesis 不能直接生成音频文件，我们使用录音 API 或提示用户
    // 这里采用替代方案：使用 Web Audio API 生成音频
    generateAudioWithWebAudio(text, voice);
  }, [text, voice, getVoices]);

  // 使用 Web Audio API 模拟 TTS（简化版：生成提示音频）
  const generateAudioWithWebAudio = useCallback(async (textToSpeak: string, lang: string) => {
    try {
      // 创建 AudioContext
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext)();
      
      // 创建振荡器模拟提示音（真正的 TTS 需要后端服务）
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      // 由于浏览器无法直接用 SpeechSynthesis 生成音频文件，
      // 我们使用提示方式并利用已有 AudioNode 的 TTS 功能
      updateNodeData(id, { loading: false });
      setIsGenerating(false);
      
      // 尝试使用 AudioNode 的 TTS 功能（它已有完整实现）
      const audioNode = document.querySelector(`[data-node-id="${id}"]`);
      if (audioNode) {
        updateNodeData(id, { 
          errorMessage: '建议使用音频节点的 TTS 模式，或使用语音合成播放',
          ttsText: textToSpeak 
        });
      }
      
      // 同时播放语音预览
      const speakUtterance = new SpeechSynthesisUtterance(textToSpeak);
      const voices = getVoices();
      const selectedVoice = voices.find(v => v.lang.startsWith(lang)) || voices[0];
      if (selectedVoice) speakUtterance.voice = selectedVoice;
      speakUtterance.lang = lang;
      
      setIsPlaying(true);
      speakUtterance.onend = () => setIsPlaying(false);
      speakUtterance.onerror = () => setIsPlaying(false);
      
      window.speechSynthesis.speak(speakUtterance);
      
    } catch (err) {
      console.error('Audio generation error:', err);
      updateNodeData(id, { loading: false });
      setIsGenerating(false);
      updateNodeData(id, { errorMessage: '音频生成失败' });
    }
  }, [updateNodeData, id, getVoices]);

  const handlePlayPreview = useCallback(() => {
    if (!text.trim()) return;
    
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = getVoices();
    const selectedVoice = voices.find(v => v.lang.startsWith(voice)) || voices[0];
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.lang = voice;
    
    setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    
    window.speechSynthesis.speak(utterance);
  }, [text, voice, isPlaying, getVoices]);

  // 可用语言选项
  const languageOptions = [
    { value: 'zh-CN', label: '中文' },
    { value: 'en-US', label: 'English' },
    { value: 'ja-JP', label: '日本語' },
    { value: 'ko-KR', label: '한국어' },
  ];

  // minimalContent - 最小预览模式，无边距
  const minimalContent = (
    <>
      {/* 输入 Handle (50%) */}
      <Handle type="target" position={Position.Left} id="text" style={{ top: '50%', zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="text" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Text</div>
      
      {/* 文本状态 - 全屏无间隙 */}
      <div className="flex-1 flex items-center justify-center min-h-[80px]">
        {isPlaying ? (
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[10px]">播放中...</span>
          </div>
        ) : text ? (
          <div className="px-2">
            <span className="text-[10px] text-text truncate block max-w-[150px]">{text.slice(0, 20)}...</span>
          </div>
        ) : (
          <span className="text-neutral-500 text-[10px]">运行生成</span>
        )}
      </div>
      
      {/* 输出 Handle (50%) */}
      <Handle type="source" position={Position.Right} id="audio" style={{ top: '50%', zIndex: 10 }} data-handletype="audio" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="audio" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Audio</div>
    </>
  );

  // hoverContent - 悬停时显示完整参数，参数在底部
  const hoverContent = (
    <>
      {/* 输入 Handle (50%) */}
      <Handle type="target" position={Position.Left} id="text" style={{ top: '50%', zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="text" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Text</div>
      
      {/* 内容区域：预览在上，参数在底部 */}
      <div className="flex flex-col h-full">
        {/* 预览区域 */}
        <div className="flex-1 min-h-0">
          {text && (
            <div className="w-full h-full min-h-[60px] bg-[#1a1a1a] rounded p-2 overflow-auto">
              <p className="text-[10px] text-text whitespace-pre-wrap break-words">
                {text.length > 150 ? text.substring(0, 150) + '...' : text}
              </p>
            </div>
          )}
        </div>
        
        {/* 参数区域 - 在底部 */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
          {/* 文本输入 - 增加高度 */}
          <textarea
            value={text}
            onChange={(e) => updateNodeData(id, { text: e.target.value })}
            placeholder="输入要转换为语音的文本..."
            className="w-full bg-surface text-text text-xs rounded p-1.5 resize-none border border-border focus:border-primary outline-none"
            rows={3}
          />
          
          {/* 语言/语音选择 */}
          <select
            value={voice}
            onChange={(e) => updateNodeData(id, { voice: e.target.value })}
            className="w-full bg-surface text-text text-xs rounded p-1.5 border border-border focus:border-primary outline-none"
          >
            {languageOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          {/* 操作按钮 */}
          <div className="flex gap-1">
            <button
              onClick={handleGenerate}
              disabled={loading || !text.trim()}
              className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1.5 rounded font-medium"
            >
              {loading ? '生成中...' : '生成音频'}
            </button>
            <button
              onClick={handlePlayPreview}
              disabled={!text.trim() || isGenerating}
              className="px-3 bg-surface hover:bg-surface-hover disabled:opacity-50 text-text text-xs rounded"
              title="预览播放"
            >
              {isPlaying ? '⏹' : '▶'}
            </button>
          </div>

          {/* 提示信息 */}
          <div className="text-[9px] text-text-muted">
            使用浏览器 SpeechSynthesis API 进行语音预览。完整音频导出请使用音频节点的 TTS 模式。
          </div>
        </div>
      </div>
      
      {/* 输出 Handle (50%) */}
      <Handle type="source" position={Position.Right} id="audio" style={{ top: '50%', zIndex: 10 }} data-handletype="audio" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="audio" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Audio</div>
    </>
  );

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage}
      title="生成音频"
      showHoverHeader
      onRun={handleGenerate}
      hoverContent={hoverContent}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(GenerateAudioNode);
