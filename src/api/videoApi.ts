// Ref: §5.3 — 视频生成 (FormData 提交 + 轮询 + 进度)
// Ref: node-banana GenerateVideoNode.tsx + generateVideoExecutor.ts

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

const POLL_INTERVAL = 5000;   // 5 秒轮询间隔
const POLL_MAX_ATTEMPTS = 720; // 最多 720 次 (≈60分钟)

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

  for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
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
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
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