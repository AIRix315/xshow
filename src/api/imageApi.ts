// Ref: §5.1 — Gemini 图片生成
// Ref: node-banana /api/generate

const IMAGE_GENERATION_TIMEOUT = 600_000; // 10 分钟超时

interface GenerateImageParams {
  channelUrl: string;
  channelKey: string;
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  referenceImages?: Array<{ mimeType: string; data: string }>;
}

export async function generateImage({
  channelUrl,
  channelKey,
  model,
  prompt,
  aspectRatio,
  imageSize,
  referenceImages,
}: GenerateImageParams): Promise<string> {
  const url = `${channelUrl.replace(/\/$/, '')}/v1beta/models/${model}:generateContent?key=${channelKey}`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];

  if (referenceImages) {
    for (const img of referenceImages) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.data } });
    }
  }

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio, imageSize },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IMAGE_GENERATION_TIMEOUT);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`图片生成失败: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const json = await response.json();
    const parts_arr = json?.candidates?.[0]?.content?.parts;
    if (!parts_arr || !Array.isArray(parts_arr)) {
      throw new Error('图片生成失败: 无有效响应数据');
    }

    for (const part of parts_arr) {
      if (part.inlineData?.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }

    throw new Error('图片生成失败: 响应中无图片数据');
  } finally {
    clearTimeout(timeoutId);
  }
}