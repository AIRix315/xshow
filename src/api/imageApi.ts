// Ref: 图片生成
// Ref: node-banana /api/generate

import { executeRhModelApi, uploadFileToRunningHubWithUrl } from './rhApi';
import { extensionFetch } from './comfyApi';

const IMAGE_GENERATION_TIMEOUT = 600_000; // 10 分钟超时

export type ImageProtocol = 'openai' | 'gemini' | 'rhapi';

interface GenerateImageParams {
  channelUrl: string;
  channelKey: string;
  protocol?: ImageProtocol;
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  referenceImages?: Array<{ mimeType: string; data: string }>;
  /** rhapi 协议专用：生成模式 */
  imageGenerationMode?: 'text-to-image' | 'image-to-image';
  /** rhapi 协议专用：进度回调 */
  onProgress?: (progress: number) => void;
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
  imageGenerationMode,
  onProgress,
}: GenerateImageParams): Promise<string> {
  if (protocol === 'openai') {
    return generateImageOpenAI({ channelUrl, channelKey, model, prompt, imageSize });
  }
  if (protocol === 'rhapi') {
    return generateImageRhapi({ channelUrl, channelKey, model, prompt, aspectRatio, imageSize, imageGenerationMode, referenceImages, onProgress });
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

// ============================================================================
// RunningHub 标准模型 API（rhapi 协议）
// ============================================================================

interface RhapiImageParams {
  channelUrl: string;
  channelKey: string;
  model: string;
  prompt: string;
  aspectRatio: string;
  imageSize: string;
  imageGenerationMode?: 'text-to-image' | 'image-to-image';
  referenceImages?: Array<{ mimeType: string; data: string }>;
  onProgress?: (progress: number) => void;
}

/**
 * RunningHub 标准模型 API（rhapi 协议）
 * URL 格式：{channelUrl}/{model}/{operation}
 * 例：https://www.runninghub.cn/openapi/v2/rhart-image-g-1.5/text-to-image
 */
async function generateImageRhapi({
  channelUrl,
  channelKey,
  model,
  prompt,
  aspectRatio,
  imageSize,
  imageGenerationMode = 'text-to-image',
  referenceImages,
  onProgress,
}: RhapiImageParams): Promise<string> {
  // 拼接 URL：去掉尾部斜杠 + 模型名 + 操作类型
  const baseUrl = channelUrl.replace(/\/$/, '');
  // 注意：图生图使用 /edit 端点，不是 /image-to-image
  const operation = imageGenerationMode === 'image-to-image' ? 'edit' : imageGenerationMode;
  const submitUrl = `${baseUrl}/${model}/${operation}`;

  // 构建请求参数
  const params: Record<string, unknown> = { prompt };

  // 低价渠道版（模型名不含 official）使用 aspectRatio
  if (model.includes('official')) {
    // 官方稳定版：使用 size 和 quality
    params.size = imageSize || '1024*1024';
    params.quality = 'medium';
  } else {
    // 低价渠道版：使用 aspectRatio
    params.aspectRatio = aspectRatio || 'auto';
  }

  // 图生图模式：需要上传参考图片
  if (imageGenerationMode === 'image-to-image' && referenceImages?.length) {
    // 上传参考图片到 RunningHub，获取 downloadUrl
    const uploadResult = await uploadFileToRunningHubWithUrl(
      channelKey,
      referenceImages[0]!.data,
      'input'
    );
    params.imageUrls = [uploadResult.downloadUrl];
  }

  // 调用 RH 标准模型 API
  const result = await executeRhModelApi(channelKey, submitUrl, params, onProgress);

  // 下载图片并转换为 base64（使用 extensionFetch 避免 CORS 问题）
  const imageResponse = await extensionFetch(result.outputUrl);
  const blob = await imageResponse.blob();
  const base64 = await blobToBase64(blob);
  return `data:${blob.type};base64,${base64}`;
}