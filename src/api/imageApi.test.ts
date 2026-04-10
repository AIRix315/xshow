// Ref: §5.1 — Gemini 图片生成 API 测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateImage } from './imageApi';

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('imageApi — generateImage', () => {
  const baseParams = {
    channelUrl: 'https://api.example.com',
    channelKey: 'test-key',
    model: 'gemini-3.1-flash-image-preview',
    prompt: '一只猫',
    aspectRatio: '1:1',
    imageSize: '1K',
  };

  it('sends POST to Gemini generateContent endpoint with correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'base64data' } }] } }],
      }),
    });

    await generateImage(baseParams);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0]![0] as string;
    expect(callUrl).toContain('https://api.example.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent');
    expect(callUrl).toContain('key=test-key');
  });

  it('sends POST with correct body structure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'base64data' } }] } }],
      }),
    });

    await generateImage(baseParams);

    const callOptions = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(callOptions.method).toBe('POST');
    const body = JSON.parse(callOptions.body as string);
    expect(body.contents[0].role).toBe('user');
    expect(body.contents[0].parts[0].text).toBe('一只猫');
    expect(body.generationConfig.responseModalities).toEqual(['IMAGE']);
    expect(body.generationConfig.imageConfig.aspectRatio).toBe('1:1');
  });

  it('includes reference images as inlineData when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'resultdata' } }] } }],
      }),
    });

    await generateImage({
      ...baseParams,
      referenceImages: [{ mimeType: 'image/jpeg', data: 'refbase64' }],
    });

    const callOptions = mockFetch.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callOptions.body as string);
    expect(body.contents[0].parts).toHaveLength(2);
    expect(body.contents[0].parts[1].inlineData).toEqual({ mimeType: 'image/jpeg', data: 'refbase64' });
  });

  it('returns data URL on successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'abc123' } }] } }],
      }),
    });

    const result = await generateImage(baseParams);
    expect(result).toBe('data:image/png;base64,abc123');
  });

  it('throws on HTTP error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: () => Promise.resolve('Rate limited'),
    });

    await expect(generateImage(baseParams)).rejects.toThrow('图片生成失败: 429');
  });

  it('throws when response has no image data', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ text: 'no image here' }] } }],
      }),
    });

    await expect(generateImage(baseParams)).rejects.toThrow('图片生成失败: 响应中无图片数据');
  });

  it('throws when response has no candidates', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await expect(generateImage(baseParams)).rejects.toThrow('图片生成失败: 无有效响应数据');
  });

  it('strips trailing slash from channelUrl', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'x' } }] } }],
      }),
    });

    await generateImage({ ...baseParams, channelUrl: 'https://api.example.com/' });
    const callUrl = mockFetch.mock.calls[0]![0] as string;
    expect(callUrl).not.toContain('//v1beta');
    expect(callUrl).toContain('/v1beta');
  });
});