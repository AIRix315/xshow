// Ref: §5.4 — 语音处理双模式 (Whisper 断句 + TTS)

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
  model: string;
  audioFile: File;
}): Promise<TranscriptChunk[]> {
  const url = `${params.channelUrl.replace(/\/$/, '')}/v1/audio/transcriptions`;

  const formData = new FormData();
  formData.append('model', params.model);
  formData.append('file', params.audioFile);
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${params.channelKey}` },
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
  model: string;
  input: string;
  voice: string;
}): Promise<string> {
  const url = `${params.channelUrl.replace(/\/$/, '')}/v1/audio/speech`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.channelKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      input: params.input,
      voice: params.voice,
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