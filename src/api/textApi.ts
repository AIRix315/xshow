// Ref: §5.2 — OpenAI 文本生成 + autoSplit

interface GenerateTextParams {
  channelUrl: string;
  channelKey: string;
  model: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  autoSplit?: boolean;
}

interface AutoSplitResult {
  title: string;
  content: string;
}

const AUTO_SPLIT_SYSTEM_PROMPT = `你是一个内容拆分专家。请将用户的内容拆分为多个独立的部分。
返回JSON格式: { "items": [{ "title": "部分标题", "content": "部分内容" }] }
只返回JSON，不要其他文字。`;

export async function generateText({
  channelUrl,
  channelKey,
  model,
  messages,
  autoSplit = false,
}: GenerateTextParams): Promise<{ text: string; splitItems?: AutoSplitResult[] }> {
  const url = `${channelUrl.replace(/\/$/, '')}/v1/chat/completions`;

  const requestMessages = autoSplit
    ? [{ role: 'system' as const, content: AUTO_SPLIT_SYSTEM_PROMPT }, ...messages]
    : messages;

  const body = {
    model,
    messages: requestMessages,
    temperature: 0.7,
    ...(autoSplit ? { response_format: { type: 'json_object' } } : {}),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${channelKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`文本生成失败: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const json = await response.json();
  const text = json?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('文本生成失败: 无有效响应数据');
  }

  if (autoSplit) {
    try {
      const parsed = JSON.parse(text);
      if (parsed.items && Array.isArray(parsed.items)) {
        return { text, splitItems: parsed.items as AutoSplitResult[] };
      }
    } catch (e) {
      const parseError = e instanceof Error ? e.message : 'JSON parse failed';
      console.warn(`[textApi] autoSplit parse failed: ${parseError}`);
    }
  }

  return { text };
}