/**
 * Generate Node Executors
 *
 * 调用外部 API 生成内容的节点执行器：
 * - imageNode：图片生成
 * - textNode (promptNode)：文本生成
 * - videoNode：视频生成
 * - audioNode：音频生成 (TTS)
 *
 * 特点：供应商和模型由用户在设置中配置，支持任意 OpenAI 兼容 API
 */

import type { NodeExecutionContext } from './types';
import { generateImage } from '@/api/imageApi';
import { generateText } from '@/api/textApi';
import { submitVideoTask, pollVideoTask, generateVideoRhapi } from '@/api/videoApi';
import { generateTTS } from '@/api/audioApi';
import { getInputsByHandle } from '@/utils/connectedInputs';
import { useSettingsStore } from '@/stores/useSettingsStore';

/**
 * 将 Promise 与 AbortSignal 关联，信号触发时 reject
 */
function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new DOMException('The operation was aborted', 'AbortError'));

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('The operation was aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}

/**
 * ImageNode 执行器
 * 调用 Gemini/OpenAI/RH API 图片生成
 */
export async function executeImageNode(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const nodeData = node.data as Record<string, unknown>;

  // 获取配置（用户可配置任意供应商）
  const channels = useSettingsStore.getState().apiConfig.channels;
  const imageChannelId = useSettingsStore.getState().apiConfig.imageChannelId;
  const drawingModel = useSettingsStore.getState().apiConfig.drawingModel;

  const selectedChannelId = (nodeData.selectedChannelId as string) || imageChannelId;
  const channel = channels.find((c) => c.id === selectedChannelId);

  if (!channel) {
    throw new Error('未选择图片供应商');
  }

  // 获取上游输入
  const { images, text } = getConnectedInputs(node.id);
  const prompt = (text as string) || (nodeData.prompt as string) || '';

  if (!prompt.trim()) {
    throw new Error('图片提示词为空');
  }

  // 模型列表
  const models = drawingModel.split('\n').filter((m) => m.trim());
  const selectedModel = (nodeData.selectedModel as string) || models[0] || '';

  // 参考图片（图生图）- 直接使用完整的 data URL
  const referenceImages = images[0] ? [{ mimeType: 'image/png', data: images[0] }] : undefined;

  updateNodeData(node.id, { loading: true, errorMessage: '' });

  try {
    const imageUrl = await raceWithAbort(
      generateImage({
        channelUrl: channel.url,
        channelKey: channel.key,
        protocol: channel.protocol as 'openai' | 'gemini' | 'rhapi',
        model: selectedModel,
        prompt: prompt.trim(),
        aspectRatio: (nodeData.aspectRatio as string) || '1:1',
        imageSize: (nodeData.imageSize as string) || '1K',
        referenceImages,
        imageGenerationMode: (nodeData.imageGenerationMode as 'text-to-image' | 'image-to-image') || 'text-to-image',
      }),
      ctx.signal,
    );

    // 历史轮播：生成成功后写入历史
    const MAX_HISTORY = 10;
    const prevHistory = (nodeData.imageHistory as Array<{ imageUrl: string; prompt: string; timestamp: number }>) || [];
    const history = [...prevHistory, { imageUrl, prompt, timestamp: Date.now() }];
    const sliced = history.slice(-MAX_HISTORY);
    updateNodeData(node.id, {
      imageUrl,
      loading: false,
      imageHistory: sliced,
      selectedHistoryIndex: sliced.length - 1,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '图片生成失败';
    updateNodeData(node.id, { loading: false, errorMessage: msg });
    throw err;
  }
}

/**
 * TextNode / PromptNode 执行器
 * 调用 OpenAI/Gemini 文本生成 API
 */
export async function executeTextNode(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const nodeData = node.data as Record<string, unknown>;

  // 获取配置
  const channels = useSettingsStore.getState().apiConfig.channels;
  const textChannelId = useSettingsStore.getState().apiConfig.textChannelId;
  const textModel = useSettingsStore.getState().apiConfig.textModel;

  const selectedChannelId = (nodeData.selectedChannelId as string) || textChannelId;
  const channel = channels.find((c) => c.id === selectedChannelId);

  if (!channel) {
    throw new Error('未选择文本供应商');
  }

  // 获取上游输入
  const { text } = getConnectedInputs(node.id);
  const prompt = (text as string) || (nodeData.prompt as string) || '';

  if (!prompt.trim()) {
    throw new Error('文本提示词为空');
  }

  const models = textModel.split('\n').filter((m) => m.trim());
  const selectedModel = (nodeData.selectedModel as string) || models[0] || 'gpt-3.5-turbo';

  updateNodeData(node.id, { loading: true, errorMessage: '' });

  try {
    const result = await generateText({
      channelUrl: channel.url,
      channelKey: channel.key,
      protocol: channel.protocol as 'openai' | 'gemini',
      model: selectedModel,
      messages: [{ role: 'user', content: prompt.trim() }],
      autoSplit: (nodeData.autoSplit as boolean) || false,
    });

    updateNodeData(node.id, {
      text: result.text,
      loading: false,
      ...(result.splitItems ? { splitItems: result.splitItems } : {}),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '文本生成失败';
    updateNodeData(node.id, { loading: false, errorMessage: msg });
    throw err;
  }
}

/**
 * VideoNode 执行器
 * 提交视频生成任务并轮询结果
 */
export async function executeVideoNode(ctx: NodeExecutionContext): Promise<void> {
  const { node, nodes, edges, getConnectedInputs, updateNodeData } = ctx;
  const nodeData = node.data as Record<string, unknown>;

  // 获取配置
  const channels = useSettingsStore.getState().apiConfig.channels;
  const videoChannelId = useSettingsStore.getState().apiConfig.videoChannelId;

  const selectedChannelId = (nodeData.selectedChannelId as string) || videoChannelId;
  const channel = channels.find((c) => c.id === selectedChannelId);

  if (!channel) {
    throw new Error('未选择视频供应商');
  }

  // 获取上游输入
  const { videos, text } = getConnectedInputs(node.id);
  const prompt = (text as string) || (nodeData.prompt as string) || '';

  if (!prompt.trim()) {
    throw new Error('视频提示词为空');
  }

  updateNodeData(node.id, { loading: true, errorMessage: '', progress: 0 });

  try {
    // 根据协议选择 API
    if (channel.protocol === 'rhapi') {
      // RunningHub 标准模型 API
      const videoGenerationMode = (nodeData.videoGenerationMode as 'text-to-video' | 'image-to-video' | 'start-end-to-video') || 'text-to-video';

      // 按 handle ID 精确读取图片数据
      const handleInputs = getInputsByHandle(node.id, nodes, edges);
      let referenceImages: Array<{ mimeType: string; data: string }> | undefined;
      let lastFrameImage: { mimeType: string; data: string } | undefined;

      if (videoGenerationMode === 'image-to-video') {
        const imageData = handleInputs['image']?.[0];
        if (imageData) referenceImages = [{ mimeType: 'image/png', data: imageData }];
        // 可选尾帧
        const lastData = handleInputs['last-frame']?.[0];
        if (lastData) lastFrameImage = { mimeType: 'image/png', data: lastData };
      } else if (videoGenerationMode === 'start-end-to-video') {
        const firstData = handleInputs['first-frame']?.[0];
        if (firstData) referenceImages = [{ mimeType: 'image/png', data: firstData }];
        const lastData = handleInputs['last-frame']?.[0];
        if (lastData) lastFrameImage = { mimeType: 'image/png', data: lastData };
      }

      // 读取自定义输入 Handle 的数据作为额外参考资源
      const customInputHandles = (nodeData.customInputHandles as Array<{ id: string; type: string }> | undefined) ?? [];
      for (const ch of customInputHandles) {
        const chData = handleInputs[ch.id]?.[0];
        if (!chData) continue;
        if (ch.type === 'image') {
          referenceImages = referenceImages || [];
          referenceImages.push({ mimeType: 'image/png', data: chData });
        } else if (ch.type === 'audio') {
          // 参考音频暂不直接传给视频 API（预留）
        }
      }

      const result = await generateVideoRhapi({
        channelUrl: channel.url,
        channelKey: channel.key,
        model: (nodeData.selectedModel as string) || 'rhart-video-v3.1-fast',
        prompt: prompt.trim(),
        aspectRatio: (nodeData.aspectRatio as string) || '16:9',
        resolution: (nodeData.resolution as string) || '720p',
        duration: (nodeData.duration as string) || '8',
        videoGenerationMode,
        referenceImages,
        lastFrameImage,
        onProgress: (progress) => {
          updateNodeData(node.id, { progress });
        },
      });

      // 历史轮播
      const MAX_HISTORY = 10;
      const prevHistory = (nodeData.videoHistory as Array<{ videoUrl: string; thumbnailUrl: string; prompt: string; timestamp: number }>) || [];
      const history = [...prevHistory, { videoUrl: result.videoUrl, thumbnailUrl: result.thumbnailUrl, prompt, timestamp: Date.now() }];
      const sliced = history.slice(-MAX_HISTORY);
      updateNodeData(node.id, {
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        loading: false,
        progress: 0,
        videoHistory: sliced,
        selectedVideoHistoryIndex: sliced.length - 1,
      });
    } else {
      // 旧版 FormData API
      const taskId = await submitVideoTask({
        channelUrl: channel.url,
        channelKey: channel.key,
        model: (nodeData.selectedModel as string) || 'default',
        prompt: prompt.trim(),
        size: (nodeData.size as string) || '1280x720',
        seconds: (nodeData.seconds as string) || '5',
        inputReference: videos[0],
      });

      const result = await pollVideoTask(
        channel.url,
        channel.key,
        taskId,
        (progress) => {
          updateNodeData(node.id, { progress });
        }
      );

      // 历史轮播
      const MAX_HISTORY = 10;
      const prevHistory = (nodeData.videoHistory as Array<{ videoUrl: string; thumbnailUrl: string; prompt: string; timestamp: number }>) || [];
      const history = [...prevHistory, { videoUrl: result.videoUrl, thumbnailUrl: result.thumbnailUrl, prompt, timestamp: Date.now() }];
      const sliced = history.slice(-MAX_HISTORY);
      updateNodeData(node.id, {
        videoUrl: result.videoUrl,
        thumbnailUrl: result.thumbnailUrl,
        loading: false,
        progress: 0,
        videoHistory: sliced,
        selectedVideoHistoryIndex: sliced.length - 1,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '视频生成失败';
    updateNodeData(node.id, { loading: false, errorMessage: msg, progress: 0 });
    throw err;
  }
}

/**
 * AudioNode 执行器
 * TTS 语音合成
 */
export async function executeAudioNode(ctx: NodeExecutionContext): Promise<void> {
  const { node, nodes, edges, getConnectedInputs, updateNodeData } = ctx;
  const nodeData = node.data as Record<string, unknown>;

  // 获取配置
  const channels = useSettingsStore.getState().apiConfig.channels;
  const audioChannelId = useSettingsStore.getState().apiConfig.audioChannelId;

  const selectedChannelId = (nodeData.selectedChannelId as string) || audioChannelId;
  const channel = channels.find((c) => c.id === selectedChannelId);

  if (!channel) {
    throw new Error('未选择音频供应商');
  }

  // 获取上游输入
  const { text } = getConnectedInputs(node.id);
  const inputText = (text as string) || (nodeData.text as string) || '';

  if (!inputText.trim()) {
    throw new Error('音频文本为空');
  }

  // 读取自定义输入 Handle 的数据作为额外参考资源
  const handleInputs = getInputsByHandle(node.id, nodes, edges);
  const customInputHandles = (nodeData.customInputHandles as Array<{ id: string; type: string }> | undefined) ?? [];
  const referenceAudios: string[] = [];
  for (const ch of customInputHandles) {
    const chData = handleInputs[ch.id]?.[0];
    if (!chData) continue;
    if (ch.type === 'audio') {
      referenceAudios.push(chData);
    }
    // 其他类型（image/video/text）预留扩展
  }

  updateNodeData(node.id, { loading: true, errorMessage: '' });

  try {
    const audioUrl = await generateTTS({
      channelUrl: channel.url,
      channelKey: channel.key,
      protocol: channel.protocol as 'openai' | 'gemini',
      model: (nodeData.selectedModel as string) || 'tts-1',
      input: inputText.trim(),
      voice: (nodeData.voice as string) || 'alloy',
    });

    updateNodeData(node.id, {
      audioUrl,
      loading: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '音频生成失败';
    updateNodeData(node.id, { loading: false, errorMessage: msg });
    throw err;
  }
}