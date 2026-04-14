// Ref: 模型列表获取 + 连接速度测试
// 支持 OpenAI 兼容 API、Ollama、Anthropic、Gemini
import type { ChannelConfig } from '@/types';

/**
 * 获取模型列表（根据供应商协议）
 * 返回模型名称数组
 */
export async function fetchModelList(channel: ChannelConfig): Promise<string[]> {
  const baseUrl = channel.url.replace(/\/$/, '');

  try {
    if (channel.protocol === 'openai' || channel.protocol === 'custom') {
      // OpenAI 兼容格式：GET /v1/models
      const response = await fetch(`${baseUrl}/v1/models`, {
        headers: channel.key ? { Authorization: `Bearer ${channel.key}` } : {},
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      // OpenAI 格式: { data: [{ id: "gpt-4", ... }] }
      if (Array.isArray(data.data)) {
        return data.data.map((m: { id: string }) => m.id);
      }
      // 其他兼容格式直接返回数组
      if (Array.isArray(data)) return data;
      return [];
    }

    if (channel.protocol === 'anthropic') {
      // Anthropic 目前不提供公开的模型列表 API，预留
      throw new Error('Anthropic 暂不支持自动获取模型列表');
    }

    if (channel.protocol === 'gemini') {
      // Gemini 模型列表需要通过特定端点
      const apiKey = channel.key;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (Array.isArray(data.models)) {
        return data.models.map((m: { name: string }) => m.name.replace('models/', ''));
      }
      return [];
    }

    // 尝试通用的 /api/tags (Ollama、LM Studio 等)
    const tagsResponse = await fetch(`${baseUrl}/api/tags`);
    if (tagsResponse.ok) {
      const data = await tagsResponse.json();
      if (data.models && Array.isArray(data.models)) {
        return data.models.map((m: { name: string }) => m.name);
      }
    }

    throw new Error('不支持的协议或无法获取模型列表');
  } catch (err) {
    console.error('[modelListApi] fetchModelList error:', err);
    throw err;
  }
}

/**
 * 测试单个模型的连接速度
 * 返回响应时间（毫秒）
 */
export async function testModelSpeed(channel: ChannelConfig, model: string): Promise<number> {
  const baseUrl = channel.url.replace(/\/$/, '');
  const start = Date.now();

  try {
    if (channel.protocol === 'gemini') {
      // Gemini 格式
      const url = `${baseUrl}/v1beta/models/${model}:generateContent?key=${channel.key}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hi' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.json();
      return Date.now() - start;
    }

    if (channel.protocol === 'anthropic') {
      // Anthropic 格式
      const response = await fetch(`${baseUrl}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': channel.key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.json();
      return Date.now() - start;
    }

    // OpenAI 兼容格式（默认）
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(channel.key ? { Authorization: `Bearer ${channel.key}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
      }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await response.json();
    return Date.now() - start;
  } catch (err) {
    console.error('[modelListApi] testModelSpeed error:', err);
    throw err;
  }
}
