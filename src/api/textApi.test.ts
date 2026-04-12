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

  // Gemini 协议测试
  describe('Gemini protocol', () => {
    const geminiParams = {
      channelUrl: 'https://generativelanguage.googleapis.com',
      channelKey: 'gemini-key',
      protocol: 'gemini' as const,
      model: 'gemini-2.0-flash',
      messages: [{ role: 'user' as const, content: '你好' }],
    };

    it('sends POST to Gemini generateContent endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: '你好，我是 Gemini' }] } }],
        }),
      });

      await generateText(geminiParams);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callUrl = mockFetch.mock.calls[0]![0] as string;
      expect(callUrl).toContain('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
      expect(callUrl).toContain('key=gemini-key');
    });

    it('does not use Authorization header for Gemini (uses URL query param)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'response' }] } }],
        }),
      });

      await generateText(geminiParams);

      const callOptions = mockFetch.mock.calls[0]![1] as RequestInit;
      expect(callOptions.headers).not.toHaveProperty('Authorization');
    });

    it('sends correct body format for Gemini protocol', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'response' }] } }],
        }),
      });

      await generateText(geminiParams);

      const callOptions = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callOptions.body as string);
      expect(body.contents).toHaveLength(1);
      expect(body.contents[0].role).toBe('user');
      expect(body.contents[0].parts[0].text).toBe('你好');
      expect(body.generationConfig.temperature).toBe(0.7);
    });

    it('converts message roles correctly for Gemini', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'response' }] } }],
        }),
      });

      await generateText({
        ...geminiParams,
        messages: [
          { role: 'system', content: '你是一个助手' },
          { role: 'user', content: '你好' },
        ],
      });

      const callOptions = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callOptions.body as string);
      expect(body.contents).toHaveLength(2);
      // 第一条system消息转为user
      expect(body.contents[0].role).toBe('user');
      // 第二条user消息保持user
      expect(body.contents[1].role).toBe('user');
    });

    it('adds system prompt at beginning when autoSplit is true in Gemini', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [{ title: 'A', content: 'B' }] }) }] } }],
        }),
      });

      await generateText({ ...geminiParams, autoSplit: true });

      const callOptions = mockFetch.mock.calls[0]![1] as RequestInit;
      const body = JSON.parse(callOptions.body as string);
      // 第一条消息应该是 system prompt
      expect(body.contents[0].parts[0].text).toContain('内容拆分专家');
      expect(body.generationConfig.responseMimeType).toBe('application/json');
    });

    it('returns text on successful Gemini response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Gemini 生成的回答' }] } }],
        }),
      });

      const result = await generateText(geminiParams);
      expect(result.text).toBe('Gemini 生成的回答');
    });

    it('parses splitItems from Gemini response when autoSplit is true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [{ title: 'Part1', content: 'Content1' }, { title: 'Part2', content: 'Content2' }] }) }] } }],
        }),
      });

      const result = await generateText({ ...geminiParams, autoSplit: true });
      expect(result.splitItems).toHaveLength(2);
      expect(result.splitItems![0]!.title).toBe('Part1');
      expect(result.splitItems![1]!.content).toBe('Content2');
    });

    it('throws on Gemini HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: () => Promise.resolve('Forbidden'),
      });

      await expect(generateText(geminiParams)).rejects.toThrow('文本生成失败: 403');
    });

    it('throws when Gemini response has no content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ candidates: [] }),
      });

      await expect(generateText(geminiParams)).rejects.toThrow('文本生成失败: 无有效响应数据');
    });
  });
});