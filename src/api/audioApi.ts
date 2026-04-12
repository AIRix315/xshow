// Ref: §5.4 — 语音处理双模式 (Whisper 断句 + TTS)

export type AudioProtocol = 'openai' | 'gemini';

export interface TranscriptChunk {
  start: number;
  end: number;
  text: string;
}

export interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

// 模式1：听音断句 — Whisper /v1/audio/transcriptions
export async function transcribeAudio(params: {
  channelUrl: string;
  channelKey: string;
  protocol?: AudioProtocol;
  model: string;
  audioFile: File;
}): Promise<TranscriptChunk[]> {
  const protocol = params.protocol ?? 'openai';
  
  if (protocol === 'gemini') {
    return transcribeAudioGemini(params);
  }
  return transcribeAudioOpenAI(params);
}

interface TranscribeOpenAIParams {
  channelUrl: string;
  channelKey: string;
  model: string;
  audioFile: File;
}

async function transcribeAudioOpenAI({
  channelUrl,
  channelKey,
  model,
  audioFile,
}: TranscribeOpenAIParams): Promise<TranscriptChunk[]> {
  const url = `${channelUrl.replace(/\/$/, '')}/v1/audio/transcriptions`;

  const formData = new FormData();
  formData.append('model', model);
  formData.append('file', audioFile);
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${channelKey}` },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`语音断句失败: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const json = await response.json();
  const words: WhisperWord[] = json.words ?? [];
  if (words.length === 0) {
    // 如果没有 words，尝试从 segments 构建
    const segments = json.segments ?? [];
    if (segments.length > 0) {
      return segments.map((seg: { start: number; end: number; text: string }) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }));
    }
    throw new Error('语音断句失败: 返回数据中无 words 或 segments');
  }

  return mergeWordsToChunks(words);
}

interface TranscribeGeminiParams {
  channelUrl: string;
  channelKey: string;
  model: string;
  audioFile: File;
}

async function transcribeAudioGemini({
  channelUrl,
  channelKey,
  model,
  audioFile,
}: TranscribeGeminiParams): Promise<TranscriptChunk[]> {
  // 将音频文件转换为 base64
  const base64 = await fileToBase64(audioFile);
  const mimeType = audioFile.type || 'audio/mpeg';

  const url = `${channelUrl.replace(/\/$/, '')}/v1beta/models/${model}:predict?key=${channelKey}`;

  const body = {
    contents: [{
      role: 'user',
      parts: [{
        inlineData: {
          mimeType,
          data: base64,
        },
      }],
    }],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`语音断句失败: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const json = await response.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('语音断句失败: 无有效响应数据');
  }

  // Gemini 返回纯文本，需要简单分割
  // 按换行和句末标点分割
  const chunks: TranscriptChunk[] = [];
  const sentences = text.split(/[。！？\n]+/).filter((s: string) => s.trim());
  let currentTime = 0;
  const avgDurationPerChar = 0.3; // 估算

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed) {
      chunks.push({
        start: currentTime,
        end: currentTime + trimmed.length * avgDurationPerChar,
        text: trimmed,
      });
      currentTime += trimmed.length * avgDurationPerChar;
    }
  }

  if (chunks.length === 0 && text.trim()) {
    chunks.push({ start: 0, end: text.length * avgDurationPerChar, text: text.trim() });
  }

  return chunks;
}

// 辅助函数：File 转 base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64 ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 将 Whisper words 合并为断句 chunks
// 合并策略：连续短词合并到同一 chunk，遇到句末标点或超过 3 秒间隔则断开
export function mergeWordsToChunks(words: WhisperWord[]): TranscriptChunk[] {
  if (words.length === 0) return [];

  const chunks: TranscriptChunk[] = [];
  let chunkStart = words[0]!.start;
  let chunkEnd = words[0]!.end;
  let chunkText = words[0]!.word;

  for (let i = 1; i < words.length; i++) {
    const word = words[i]!;
    const gap = word.start - chunkEnd;

    // 句末标点或超过 2 秒间隔则断开
    const isSentenceEnd = /[。！？.!?]/.test(chunkText);
    const isLongGap = gap > 2;

    if (isSentenceEnd || isLongGap) {
      chunks.push({ start: chunkStart, end: chunkEnd, text: chunkText.trim() });
      chunkStart = word.start;
      chunkEnd = word.end;
      chunkText = word.word;
    } else {
      chunkEnd = word.end;
      chunkText += word.word;
    }
  }

  // 最后一个 chunk
  if (chunkText.trim()) {
    chunks.push({ start: chunkStart, end: chunkEnd, text: chunkText.trim() });
  }

  return chunks;
}

// 模式2：TTS 文本转语音 — /v1/audio/speech
export async function generateTTS(params: {
  channelUrl: string;
  channelKey: string;
  protocol?: AudioProtocol;
  model: string;
  input: string;
  voice: string;
}): Promise<string> {
  const protocol = params.protocol ?? 'openai';

  if (protocol === 'gemini') {
    return generateTTSGemini(params);
  }
  return generateTTSOpenAI(params);
}

interface TTSOpenAIParams {
  channelUrl: string;
  channelKey: string;
  model: string;
  input: string;
  voice: string;
}

async function generateTTSOpenAI({
  channelUrl,
  channelKey,
  model,
  input,
  voice,
}: TTSOpenAIParams): Promise<string> {
  const url = `${channelUrl.replace(/\/$/, '')}/v1/audio/speech`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${channelKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'tts-1',
      input,
      voice: voice || 'alloy',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS 生成失败: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  // 返回音频二进制流，转为 Object URL
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

// Gemini TTS（Gemini 暂不支持直接 TTS，这里抛出异常提示用户）
interface TTSGeminiParams {
  channelUrl: string;
  channelKey: string;
  model: string;
  input: string;
  voice: string;
}

async function generateTTSGemini(_params: TTSGeminiParams): Promise<string> {
  throw new Error('Gemini 协议暂不支持 TTS 功能，请使用 OpenAI 兼容协议');
}