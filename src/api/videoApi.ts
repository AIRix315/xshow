// Ref: 视频生成 (FormData 提交 + 轮询 + 进度)
// Ref: node-banana GenerateVideoNode.tsx + generateVideoExecutor.ts

import { uploadFileToRunningHubWithUrl } from './rhApi';

export interface VideoSubmitParams {
  channelUrl: string;
  channelKey: string;
  model: string;
  prompt: string;
  size: string;
  seconds: string;
  inputReference?: string;
}

export interface VideoPollResult {
  videoUrl: string;
  thumbnailUrl: string;
}

// ============================================================================
// RunningHub 标准模型 API（rhapi 协议）
// ============================================================================

export type VideoGenerationMode = 'text-to-video' | 'image-to-video' | 'start-end-to-video';

export interface RhapiVideoParams {
  channelUrl: string;
  channelKey: string;
  model: string;
  prompt: string;
  aspectRatio: string;
  resolution: string;
  duration: string;
  /** 视频生成模式 */
  videoGenerationMode?: VideoGenerationMode;
  /** 参考图片（图生视频/首尾帧） */
  referenceImages?: Array<{ mimeType: string; data: string }>;
  /** 首尾帧模式的尾图 */
  lastFrameImage?: { mimeType: string; data: string };
  /** rhapi 协议专用：进度回调 */
  onProgress?: (progress: number) => void;
}

/**
 * RunningHub 标准模型 API 轮询间隔（5秒）
 */
const RH_VIDEO_POLL_INTERVAL = 5000;

/**
 * RunningHub 标准模型 API 总超时（60分钟）
 */
const RH_VIDEO_MAX_ELAPSED_MS = 60 * 60 * 1000;

// ============================================================================
// RunningHub 标准模型 API（rhapi 协议）- 视频生成
// ============================================================================

/**
 * 提交 RunningHub 标准模型视频任务
 * POST /openapi/v2/{model}/{operation}
 */
export async function submitRhVideoTask(
  channelKey: string,
  submitUrl: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ taskId: string }> {
  const response = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${channelKey}`,
    },
    body: JSON.stringify(params),
    signal,
  });

  const json = await response.json();

  // RH 标准模型 API 返回 taskId 表示提交成功
  if (!json.taskId) {
    throw new Error(`提交任务失败: ${json.errorMessage || json.errorCode || json.msg || '无 taskId'}`);
  }

  return { taskId: json.taskId };
}

/**
 * 轮询 RunningHub 标准模型视频任务结果
 * POST /openapi/v2/query
 */
export async function pollRhVideoTaskResult(
  channelKey: string,
  taskId: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<VideoPollResult> {
  const RH_BASE_URL = 'https://www.runninghub.cn';
  const startTime = Date.now();

  while (true) {
    if (signal?.aborted) throw new Error('任务已取消');

    const elapsed = Date.now() - startTime;
    if (elapsed >= RH_VIDEO_MAX_ELAPSED_MS) {
      throw new Error(`任务超时: 超过${Math.round(RH_VIDEO_MAX_ELAPSED_MS / 60000)}分钟`);
    }

    // 5秒间隔
    await new Promise(r => setTimeout(r, RH_VIDEO_POLL_INTERVAL));

    // 进度：基于时间比例 0-90%
    if (onProgress) {
      onProgress(Math.min(elapsed / RH_VIDEO_MAX_ELAPSED_MS, 0.9));
    }

    const resultResponse = await fetch(`${RH_BASE_URL}/openapi/v2/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${channelKey}`,
      },
      body: JSON.stringify({ taskId }),
      signal,
    });

    if (resultResponse.ok) {
      const resultJson = await resultResponse.json();

      // 成功
      if (resultJson.status === 'SUCCESS') {
        const results = resultJson.results || [];
        const videoResult = results.find((r: { url?: string }) => r.url);
        const videoUrl = videoResult?.url || results[0]?.url || '';
        const thumbnailUrl = '';

        if (!videoUrl) {
          throw new Error('任务成功但无返回结果');
        }
        return { videoUrl, thumbnailUrl };
      }

      // 失败
      if (resultJson.status === 'FAILED') {
        throw new Error(`任务失败: ${resultJson.errorMessage || resultJson.failedReason?.exception_message || '未知错误'}`);
      }

      // RUNNING / QUEUED → 继续轮询
      if (resultJson.status === 'RUNNING' || resultJson.status === 'QUEUED') {
        continue;
      }

      // 其他状态
      throw new Error(`任务异常: status=${resultJson.status}`);
    } else {
      // 网络错误，继续等待
      console.warn(`[videoApi] 轮询网络错误 ${resultResponse.status}，继续等待`);
    }
  }
}

/**
 * RunningHub 标准模型 API（rhapi 协议）- 视频生成
 * 支持文生视频、图生视频、首尾帧生视频
 */
export async function generateVideoRhapi(
  params: RhapiVideoParams,
): Promise<VideoPollResult> {
  const { channelUrl, channelKey, model, prompt, aspectRatio, resolution, duration, videoGenerationMode = 'text-to-image', referenceImages, lastFrameImage } = params;

  // 拼接 URL：去掉尾部斜杠 + 模型名 + 操作类型
  const baseUrl = channelUrl.replace(/\/$/, '');

  // 根据模式确定端点
  let operation: string;
  let actualModel = model;

  if (videoGenerationMode === 'image-to-video') {
    // 图生视频使用官方稳定版模型
    operation = 'image-to-video';
    actualModel = model.includes('official') ? model : model + '-official';
  } else if (videoGenerationMode === 'start-end-to-video') {
    // 首尾帧生视频
    operation = 'start-end-to-video';
  } else {
    // 文生视频
    operation = 'text-to-video';
  }

  const submitUrl = `${baseUrl}/${actualModel}/${operation}`;

  // 构建请求参数
  const requestParams: Record<string, unknown> = {
    prompt,
    aspectRatio: aspectRatio || '16:9',
    resolution: resolution || '720p',
    duration: duration || '8',
  };

  // 图生视频模式：需要上传参考图片
  if (videoGenerationMode === 'image-to-video' && referenceImages?.length) {
    const uploadResult = await uploadFileToRunningHubWithUrl(
      channelKey,
      referenceImages[0]!.data,
      'input'
    );
    requestParams.imageUrl = uploadResult.downloadUrl;
  }

  // 首尾帧模式：需要上传首尾两张图片
  if (videoGenerationMode === 'start-end-to-video' && referenceImages?.length) {
    const firstUpload = await uploadFileToRunningHubWithUrl(
      channelKey,
      referenceImages[0]!.data,
      'input'
    );
    requestParams.firstFrameUrl = firstUpload.downloadUrl;

    if (lastFrameImage) {
      const lastUpload = await uploadFileToRunningHubWithUrl(
        channelKey,
        lastFrameImage.data,
        'input'
      );
      requestParams.lastFrameUrl = lastUpload.downloadUrl;
    }
  }

  // 提交任务
  const { taskId } = await submitRhVideoTask(channelKey, submitUrl, requestParams);

  // 轮询结果
  return pollRhVideoTaskResult(channelKey, taskId, params.onProgress);
}

// 提交视频生成任务，返回 taskId
export async function submitVideoTask(params: VideoSubmitParams): Promise<string> {
  const url = `${params.channelUrl.replace(/\/$/, '')}`;

  const formData = new FormData();
  formData.append('model', params.model);
  formData.append('prompt', params.prompt);
  formData.append('size', params.size);
  formData.append('seconds', params.seconds);
  if (params.inputReference) {
    formData.append('input_reference', params.inputReference);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.channelKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`视频任务提交失败: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const json = await response.json();
  const taskId = json.id ?? json.task_id ?? json.taskId;
  if (!taskId) {
    throw new Error('视频任务提交失败: 无 taskId 返回');
  }
  return taskId;
}

// 轮询视频任务状态
export async function pollVideoTask(
  channelUrl: string,
  channelKey: string,
  taskId: string,
  onProgress?: (progress: number) => void,
): Promise<VideoPollResult> {
  const pollUrl = `${channelUrl.replace(/\/$/, '')}/v1/videos/${taskId}`;
  const headers = { Authorization: `Bearer ${channelKey}` };

  for (let attempt = 0; attempt < 720; attempt++) {
    const response = await fetch(pollUrl, { headers });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`视频状态查询失败: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    const json = await response.json();
    const status = json.status ?? json.state;

    if (status === 'completed' || status === 'success' || status === 'done') {
      const videoUrl = json.video_url ?? json.output?.video_url ?? json.result?.video_url;
      const thumbnailUrl = json.thumbnail_url ?? json.output?.thumbnail_url ?? json.result?.thumbnail_url ?? '';
      if (!videoUrl) {
        throw new Error('视频完成但无 video_url');
      }
      return { videoUrl, thumbnailUrl };
    }

    if (status === 'failed' || status === 'error') {
      const errorMsg = json.error ?? json.message ?? '视频生成失败';
      throw new Error(`视频生成失败: ${errorMsg}`);
    }

    // 更新进度
    const progress = typeof json.progress === 'number' ? json.progress : -1;
    if (onProgress && progress >= 0) {
      onProgress(progress);
    }

    // 等待轮询间隔
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  throw new Error('视频生成超时: 轮询次数达到上限');
}

// 完整流程：提交 + 轮询
export async function generateVideo(
  params: VideoSubmitParams,
  onProgress?: (progress: number) => void,
): Promise<VideoPollResult> {
  const taskId = await submitVideoTask(params);
  return pollVideoTask(params.channelUrl, params.channelKey, taskId, onProgress);
}
