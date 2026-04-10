// Ref: §5.2 — OpenAI 文本生成 + autoSplit 测试
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from './textApi';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('textApi — generateText', () => {
  const baseParams = {
    channelUrl: 'https://api.example.com',
    channelKey: 'test-key',
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user' as const, content: '写一首诗' }],
  };

  it('sends POST to chat/completions endpoint with correct URL and headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '春风拂面' } }],
      }),
    });

    await generateText(baseParams);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callUrl = mockFetch.mock.calls[0]![0] as string;
    expect(callUrl).toBe('https://api.example.com/v1/chat/completions');

    const callOptions = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(callOptions.method).toBe('POST');
    expect(callOptions.headers).toHaveProperty('Authorization', 'Bearer test-key');
  });

  it('sends correct body structure for normal generation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'result text' } }],
      }),
    });

    await generateText(baseParams);

    const callOptions = mockFetch.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callOptions.body as string);
    expect(body.model).toBe('gpt-3.5-turbo');
    expect(body.messages).toEqual([{ role: 'user', content: '写一首诗' }]);
    expect(body.temperature).toBe(0.7);
    expect(body.response_format).toBeUndefined();
  });

  it('returns text on successful response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: '生成的文本内容' } }],
      }),
    });

    const result = await generateText(baseParams);
    expect(result.text).toBe('生成的文本内容');
    expect(result.splitItems).toBeUndefined();
  });

  it('adds autoSplit system prompt and json_object format when autoSplit is true', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ items: [{ title: '标题1', content: '内容1' }] }) } }],
      }),
    });

    await generateText({ ...baseParams, autoSplit: true });

    const callOptions = mockFetch.mock.calls[0]![1] as RequestInit;
    const body = JSON.parse(callOptions.body as string);
    expect(body.messages[0].role).toBe('system');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toHaveLength(2);
  });

  it('parses autoSplit items and returns splitItems', async () => {
    const items = [
      { title: '第一部分', content: '内容一' },
      { title: '第二部分', content: '内容二' },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ items }) } }],
      }),
    });

    const result = await generateText({ ...baseParams, autoSplit: true });
    expect(result.splitItems).toHaveLength(2);
    expect(result.splitItems![0]!.title).toBe('第一部分');
    expect(result.splitItems![1]!.content).toBe('内容二');
  });

  it('returns raw text when autoSplit JSON parse fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'not valid json' } }],
      }),
    });

    const result = await generateText({ ...baseParams, autoSplit: true });
    expect(result.text).toBe('not valid json');
    expect(result.splitItems).toBeUndefined();
  });

  it('throws on HTTP error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    await expect(generateText(baseParams)).rejects.toThrow('文本生成失败: 401');
  });

  it('throws when response has no content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: null } }],
      }),
    });

    await expect(generateText(baseParams)).rejects.toThrow('文本生成失败: 无有效响应数据');
  });

  it('strips trailing slash from channelUrl', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'test' } }],
      }),
    });

    await generateText({ ...baseParams, channelUrl: 'https://api.example.com/' });
    const callUrl = mockFetch.mock.calls[0]![0] as string;
    expect(callUrl).toBe('https://api.example.com/v1/chat/completions');
  });
});