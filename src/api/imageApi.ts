// Ref: §5.1 — Gemini 图片生成
// Ref: node-banana /api/generate

const IMAGE_GENERATION_TIMEOUT = 600_000; // 10 分钟超时

export type ImageProtocol = 'openai' | 'gemini';

interface GenerateImageParams {
  channelUrl: string;
  channelKey: string;
  protocol?: ImageProtocol;
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  referenceImages?: Array<{ mimeType: string; data: string }>;
}

export async function generateImage({
  channelUrl,
  channelKey,
  protocol = 'gemini',
  model,
  prompt,
  aspectRatio,
  imageSize,
  referenceImages,
}: GenerateImageParams): Promise<string> {
  if (protocol === 'openai') {
    return generateImageOpenAI({ channelUrl, channelKey, model, prompt, imageSize });
  }
  return generateImageGemini({
    channelUrl,
    channelKey,
    model,
    prompt,
    aspectRatio,
    imageSize,
    referenceImages,
  });
}

// OpenAI 兼容格式：/v1/images/generations
interface OpenAIImageParams {
  channelUrl: string;
  channelKey: string;
  model: string;
  prompt: string;
  imageSize: string;
}

async function generateImageOpenAI({
  channelUrl,
  channelKey,
  model,
  prompt,
  imageSize,
}: OpenAIImageParams): Promise<string> {
  const url = `${channelUrl.replace(/\/$/, '')}/v1/images/generations`;

  const size = imageSize === '1K' ? '1024x1024' : '1792x1024';
  const body = {
    model: model || 'dall-e-3',
    prompt,
    size,
    quality: 'standard',
    n: 1,
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
    throw new Error(`图片生成失败: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const json = await response.json();
  const imageUrl = json?.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error('图片生成失败: 无有效响应数据');
  }

  // 下载并转换为 base64
  const imageResponse = await fetch(imageUrl);
  const blob = await imageResponse.blob();
  const base64 = await blobToBase64(blob);
  return `data:${blob.type};base64,${base64}`;
}

// Gemini 格式：/v1beta/models/{model}:generateContent
async function generateImageGemini({
  channelUrl,
  channelKey,
  model,
  prompt,
  aspectRatio,
  imageSize,
  referenceImages,
}: Omit<GenerateImageParams, 'protocol'>): Promise<string> {
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

// 辅助函数：Blob 转 base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64 ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}