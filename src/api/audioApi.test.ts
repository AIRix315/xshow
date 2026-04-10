// Ref: §5.4 — 语音处理 API 测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcribeAudio, generateTTS, mergeWordsToChunks } from './audioApi';
import type { WhisperWord } from './audioApi';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('audioApi — transcribeAudio', () => {
  it('sends FormData POST to /v1/audio/transcriptions with correct headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ words: [{ word: '你好', start: 0, end: 0.5 }] }),
    });

    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
    await transcribeAudio({
      channelUrl: 'https://api.example.com',
      channelKey: 'test-key',
      model: 'whisper-1',
      audioFile: file,
    });

    const callUrl = mockFetch.mock.calls[0]![0] as string;
    expect(callUrl).toBe('https://api.example.com/v1/audio/transcriptions');

    const options = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(options.method).toBe('POST');
    expect(options.headers).toHaveProperty('Authorization', 'Bearer test-key');
    expect(options.body).toBeInstanceOf(FormData);
  });

  it('returns merged chunks from words', async () => {
    const words = [
      { word: '你好', start: 0, end: 0.5 },
      { word: '世界', start: 0.5, end: 1.0 },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ words }),
    });

    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
    const result = await transcribeAudio({
      channelUrl: 'https://api.example.com',
      channelKey: 'key',
      model: 'whisper-1',
      audioFile: file,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe('你好世界');
  });

  it('falls back to segments when words is empty', async () => {
    const segments = [
      { start: 0, end: 2, text: ' 第一段 ' },
      { start: 2.5, end: 4, text: ' 第二段 ' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ words: [], segments }),
    });

    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
    const result = await transcribeAudio({
      channelUrl: 'https://api.example.com',
      channelKey: 'key',
      model: 'whisper-1',
      audioFile: file,
    });

    expect(result).toHaveLength(2);
    expect(result[0]!.text).toBe('第一段');
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
    await expect(transcribeAudio({
      channelUrl: 'https://api.example.com',
      channelKey: 'bad-key',
      model: 'whisper-1',
      audioFile: file,
    })).rejects.toThrow('语音断句失败: 401');
  });

  it('throws when no words or segments', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
    await expect(transcribeAudio({
      channelUrl: 'https://api.example.com',
      channelKey: 'key',
      model: 'whisper-1',
      audioFile: file,
    })).rejects.toThrow('无 words 或 segments');
  });
});

describe('audioApi — mergeWordsToChunks', () => {
  it('merges consecutive words into single chunk', () => {
    const words: WhisperWord[] = [
      { word: '你好', start: 0, end: 0.5 },
      { word: '世界', start: 0.6, end: 1.0 },
    ];
    const chunks = mergeWordsToChunks(words);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.text).toBe('你好世界');
  });

  it('splits on sentence-ending punctuation', () => {
    const words: WhisperWord[] = [
      { word: '你好。', start: 0, end: 0.5 },
      { word: '世界', start: 0.6, end: 1.0 },
    ];
    const chunks = mergeWordsToChunks(words);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]!.text).toBe('你好。');
    expect(chunks[1]!.text).toBe('世界');
  });

  it('splits on long gap (>2s)', () => {
    const words: WhisperWord[] = [
      { word: '第一段', start: 0, end: 1 },
      { word: '第二段', start: 5, end: 6 },
    ];
    const chunks = mergeWordsToChunks(words);
    expect(chunks).toHaveLength(2);
  });

  it('returns empty for empty input', () => {
    expect(mergeWordsToChunks([])).toEqual([]);
  });
});

describe('audioApi — generateTTS', () => {
  it('sends POST to /v1/audio/speech and returns Object URL', async () => {
    const mockBlob = new Blob(['audio-data'], { type: 'audio/mpeg' });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    // Mock URL.createObjectURL
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://audio-123');

    const result = await generateTTS({
      channelUrl: 'https://api.example.com',
      channelKey: 'test-key',
      model: 'tts-1',
      input: '你好世界',
      voice: 'alloy',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0]![0] as string;
    expect(callUrl).toBe('https://api.example.com/v1/audio/speech');

    const options = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(options.method).toBe('POST');
    expect(options.headers).toHaveProperty('Authorization', 'Bearer test-key');
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe('tts-1');
    expect(body.input).toBe('你好世界');
    expect(body.voice).toBe('alloy');

    expect(result).toBe('blob://audio-123');
    createObjectURLSpy.mockRestore();
  });

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Server Error'),
    });

    await expect(generateTTS({
      channelUrl: 'https://api.example.com',
      channelKey: 'key',
      model: 'm',
      input: 'test',
      voice: 'alloy',
    })).rejects.toThrow('TTS 生成失败: 500');
  });
});