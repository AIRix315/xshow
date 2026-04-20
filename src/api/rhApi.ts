/**
 * RunningHub API
 *
 * 封装 RunningHub API 调用
 * 使用 extensionFetch 代理（修复 Chrome 扩展 SidePanel CORS/网络限制）
 * 动态轮询策略：5分钟内3秒间隔，5分钟后10秒间隔，支持20分钟长任务
 * 504 容错：网关超时时尝试恢复 taskId 或重试提交
 */

import type { ComfyUINodeInfo } from '@/types';
import { extensionFetch } from '@/api/comfyApi';

export interface RhApiResult {
  outputUrl: string;
  outputUrls: string[];
  /** 原始文件类型标识（如 "zip"），用于判断是否需要解压 */
  fileTypes?: string[];
}

/**
 * RunningHub AI App 节点信息
 * 用于快捷创作（rhAppNode）
 * fieldData 为 LIST 类型的选项数据（JSON 字符串）
 */
export interface RhNodeInfo {
  nodeId: string;
  nodeName: string;
  fieldName: string;
  fieldValue: string;
  fieldType: string;
  description: string;
  fieldData?: string;       // LIST 类型的选项数据（JSON 字符串，如 [{name, index, description}]）
  descriptionEn?: string;   // 英文描述
}

// ============================================================================
// 动态轮询策略
// ============================================================================

import { RH_BASE_URL } from '@/config';

/** 前5分钟轮询间隔（毫秒）— 快速响应，适合3分钟内生图 */
const POLL_INTERVAL_FAST = 3000;
/** 5分钟后轮询间隔（毫秒）— 降频等待，覆盖长视频任务 */
const POLL_INTERVAL_SLOW = 10000;
/** 排队中轮询间隔（毫秒）— 还没开始执行，无需高频查 */
const POLL_INTERVAL_QUEUED = 10000;
/** 快速/慢速分界时间（毫秒）= 5分钟 */
const PHASE_BOUNDARY_MS = 5 * 60 * 1000;
/** 总超时（毫秒）= 20分钟，覆盖15-20分钟长视频特例 */
const MAX_ELAPSED_MS = 20 * 60 * 1000;

/**
 * 根据已用时间和任务状态码返回轮询间隔
 * @param elapsedMs 从任务提交开始经过的毫秒数
 * @param lastCode 上一次轮询返回的业务状态码（804=运行中，813=排队中）
 */
function getPollInterval(elapsedMs: number, lastCode?: number): number {
  // 排队中 → 10秒
  if (lastCode === 813) return POLL_INTERVAL_QUEUED;
  // 前5分钟 → 3秒
  if (elapsedMs < PHASE_BOUNDARY_MS) return POLL_INTERVAL_FAST;
  // 5分钟后 → 10秒
  return POLL_INTERVAL_SLOW;
}

// ============================================================================
// 通用轮询逻辑（rhApp 和 rhWorkflow 共用）
// ============================================================================

/**
 * 检查 promptTips 中的节点错误，有则抛出
 */
function checkPromptTips(promptTips: string | undefined): void {
  if (!promptTips) return;
  try {
    const tips = JSON.parse(promptTips);
    if (tips.node_errors && Object.keys(tips.node_errors).length > 0) {
      throw new Error(`工作流错误: ${JSON.stringify(tips.node_errors)}`);
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('工作流错误')) throw e;
  }
}

/**
 * 通用轮询 RunningHub 任务结果
 * @param taskId 已提交的任务 ID
 * @param onProgress 进度回调 (0~0.9)
 * @param signal 取消信号
 */
async function pollRhTaskResult(
  apiKey: string,
  taskId: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<RhApiResult> {
  const startTime = Date.now();
  let lastCode: number | undefined;

  while (true) {
    if (signal?.aborted) throw new Error('任务已取消');

    const elapsed = Date.now() - startTime;
    if (elapsed >= MAX_ELAPSED_MS) {
      throw new Error(`任务超时: 超过${Math.round(MAX_ELAPSED_MS / 60000)}分钟`);
    }

    // 动态间隔
    const interval = getPollInterval(elapsed, lastCode);
    await new Promise(r => setTimeout(r, interval));

    // 进度：基于时间比例 0-90%
    if (onProgress) {
      onProgress(Math.min(elapsed / MAX_ELAPSED_MS, 0.9));
    }

    const resultResponse = await extensionFetch(`${RH_BASE_URL}/task/openapi/outputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, taskId }),
      signal,
    });

    if (resultResponse.ok) {
      const resultJson = await resultResponse.json();
      lastCode = resultJson.code;

      // 成功: code: 0, data: [{ fileUrl: "..." }]
      if (resultJson.code === 0 && resultJson.data && Array.isArray(resultJson.data)) {
        const allUrls: string[] = resultJson.data
          .map((o: { fileUrl?: string }) => o.fileUrl)
          .filter((url: string | undefined): url is string => !!url);
        const fileTypes: string[] = resultJson.data
          .map((o: { fileType?: string }) => o.fileType ?? '')
          .filter((t: string): t is string => !!t);
        if (allUrls.length > 0) {
          return { outputUrl: allUrls[0]!, outputUrls: allUrls, fileTypes };
        }
        const jsonStr = JSON.stringify(resultJson.data);
        return { outputUrl: jsonStr, outputUrls: [jsonStr], fileTypes: [] };
      }

      // 失败: code: 805
      if (resultJson.code === 805) {
        const failedReason = resultJson.data?.failedReason;
        if (failedReason) {
          throw new Error(`任务失败: ${failedReason.exception_message ?? JSON.stringify(failedReason)}`);
        }
        throw new Error(`任务失败: ${resultJson.msg ?? '未知错误'}`);
      }

      // 其他错误码（非成功非运行中非排队中）
      if (resultJson.code !== 804 && resultJson.code !== 813) {
        throw new Error(`任务异常: ${resultJson.msg ?? `code: ${resultJson.code}`}`);
      }

      // 804=运行中, 813=排队中 → 继续轮询
    } else if ([502, 503, 504].includes(resultResponse.status)) {
      // 轮询时网关偶发超时 → 容错继续（任务在服务器端可能仍在运行）
      console.warn(`[rhApi] 轮询收到 ${resultResponse.status}，容错继续等待`);
    }
  }
}

/**
 * 504 容错提交：尝试从响应体提取 taskId，或重试1次
 * @param submitFn 执行提交请求的函数
 * @param url 提交 URL（用于日志和重试）
 * @param fetchOptions fetch 请求选项
 * @param signal 取消信号
 * @returns 解析后的提交响应 JSON
 */
async function submitWithGatewayTimeoutRecovery<T extends { data: { taskId: string; promptTips?: string } }>(
  submitFn: () => Promise<Response>,
  _signal?: AbortSignal,
): Promise<T> {
  const submitResponse = await submitFn();

  if (submitResponse.ok) {
    const json = await submitResponse.json();
    if (json.code !== 0) {
      throw new Error(`提交任务失败: ${json.msg}`);
    }
    return json as T;
  }

  // 502/503/504 → 网关偶发超时，尝试恢复
  if ([502, 503, 504].includes(submitResponse.status)) {
    let errorBody = '';
    try { errorBody = await submitResponse.text(); } catch { /* ignore */ }

    // 尝试从响应体提取 taskId（网关可能在超时前转发了部分数据）
    const taskIdMatch = errorBody.match(/"taskId"\s*:\s*"(\d+)"/);
    if (taskIdMatch) {
      const taskId = taskIdMatch[1]!;
      console.warn(`[rhApi] 提交收到 ${submitResponse.status}，但响应体含 taskId=${taskId}，继续轮询`);
      // 构造一个最小化的提交响应，让调用方跳到轮询
      return { data: { taskId } } as unknown as T;
    }

    // 无法提取 taskId → 重试1次
    console.warn(`[rhApi] 提交收到 ${submitResponse.status} 且无 taskId，重试1次`);
    const retryResponse = await submitFn();
    if (!retryResponse.ok) {
      throw new Error(`提交任务失败: ${submitResponse.status}（重试后仍失败: ${retryResponse.status}）`);
    }
    const retryJson = await retryResponse.json();
    if (retryJson.code !== 0) {
      throw new Error(`提交任务失败: ${retryJson.msg}`);
    }
    return retryJson as T;
  }

  throw new Error(`提交任务失败: ${submitResponse.status}`);
}

// ============================================================================
// 获取 RunningHub APP 节点信息
// ============================================================================

/**
 * 获取 RunningHub APP 的节点信息列表（nodeInfoList + covers）
 * GET /api/webapp/apiCallDemo?apiKey=...&webappId=...
 */
export async function fetchRhAppNodeInfo(
  apiKey: string,
  webappId: string,
  signal?: AbortSignal,
): Promise<{ nodeInfoList: RhNodeInfo[]; covers?: Array<{ thumbnailUri: string }> }> {
  const response = await extensionFetch(
    `${RH_BASE_URL}/api/webapp/apiCallDemo?apiKey=${encodeURIComponent(apiKey)}&webappId=${encodeURIComponent(webappId)}`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(`获取APP信息失败: ${response.status}`);
  }

  const json = await response.json();
  if (json.code !== 0) {
    throw new Error(`获取APP信息失败: ${json.msg ?? '未知错误'}`);
  }

  const nodeInfoList: RhNodeInfo[] = (json.data?.nodeInfoList ?? []).map(
    (n: Record<string, unknown>) => ({
      nodeId: String(n.nodeId ?? ''),
      nodeName: String(n.nodeName ?? ''),
      fieldName: String(n.fieldName ?? ''),
      fieldValue: String(n.fieldValue ?? ''),
      fieldType: String(n.fieldType ?? ''),
      description: String(n.description ?? ''),
      fieldData: n.fieldData ? String(n.fieldData) : undefined,
      descriptionEn: n.descriptionEn ? String(n.descriptionEn) : undefined,
    }),
  );

  const covers = json.data?.covers as Array<{ thumbnailUri: string }> | undefined;

  return { nodeInfoList, covers };
}

// ============================================================================
// RunningHub Workflow 节点解析
// ============================================================================

/** RunningHub Workflow 节点字段 */
export interface RhWorkflowNodeField {
  name: string;           // 字段名，如 "text", "width", "image_path"
  value: unknown;         // 当前值
  type: 'STRING' | 'NUMBER' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'MODEL' | 'FLOAT' | 'INT' | 'BOOLEAN' | 'UNKNOWN';
  label: string;          // 中文标签（从 _meta.title 提取）
  options?: string[];     // 可选值（如果有）
}

/** RunningHub Workflow 节点 */
export interface RhWorkflowNode {
  nodeId: string;
  classType: string;       // 节点类型，如 "CLIPTextEncode"
  inputs: Record<string, RhWorkflowNodeField>;
}

/**
 * 解析 RunningHub workflow JSON，提取所有可编辑节点和字段
 * @param workflowJson 工作流 JSON 字符串（从 getJsonApiFormat 获取）
 */
export function parseRhWorkflowNodes(workflowJson: string): RhWorkflowNode[] {
  let workflow: Record<string, unknown>;
  try {
    workflow = JSON.parse(workflowJson);
  } catch {
    return [];
  }

  const nodes: RhWorkflowNode[] = [];

  for (const [nodeId, nodeData] of Object.entries(workflow)) {
    if (!/^\d+$/.test(nodeId)) continue;
    if (typeof nodeData !== 'object' || nodeData === null) continue;

    const node = nodeData as Record<string, unknown>;
    const classType = node['class_type'] as string | undefined;
    if (!classType) continue;

    const inputsRaw = node['inputs'] as Record<string, unknown> | undefined;
    if (!inputsRaw) continue;

    const inputs: Record<string, RhWorkflowNodeField> = {};

    for (const [fieldName, fieldValue] of Object.entries(inputsRaw)) {
      inputs[fieldName] = {
        name: fieldName,
        value: fieldValue,
        type: guessRhFieldType(fieldName, fieldValue),
        label: fieldName,
      };
    }

    nodes.push({ nodeId, classType, inputs });
  }

  return nodes;
}

/**
 * 根据字段名和值推断 RunningHub 字段类型
 */
function guessRhFieldType(fieldName: string, value: unknown): RhWorkflowNodeField['type'] {
  // 图片类
  if (/\b(image|img|picture|photo|photo_path|image_path)\b/i.test(fieldName)) return 'IMAGE';
  // 视频类
  if (/\b(video|clip|movie|video_path)\b/i.test(fieldName)) return 'VIDEO';
  // 音频类
  if (/\b(audio|sound|voice|audio_path)\b/i.test(fieldName)) return 'AUDIO';
  // 模型类
  if (/\b(model|ckpt|lora|vae|checkpoint|model_name|ckpt_name)\b/i.test(fieldName)) return 'MODEL';
  // 整数类
  if (/\b(width|height|size|fps|frames|steps|seed|batch|count|rows|columns|latent_)\b/i.test(fieldName) && typeof value === 'number') return 'INT';
  // 浮点类
  if (/\b(density|scale|ratio|strength|guidance|weight|latent_)\b/i.test(fieldName) && typeof value === 'number') return 'FLOAT';
  // 布尔类
  if (typeof value === 'boolean') return 'BOOLEAN';
  // 字符串类
  return 'STRING';
}

// ============================================================================
// 获取 RunningHub Workflow JSON
// ============================================================================

/**
 * 获取 RunningHub Workflow JSON
 * POST /api/openapi/getJsonApiFormat
 */
export async function fetchRhWorkflowJson(
  apiKey: string,
  workflowId: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await extensionFetch(`${RH_BASE_URL}/api/openapi/getJsonApiFormat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, workflowId }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`获取工作流失败: ${response.status}`);
  }

  const json = await response.json();
  if (json.code !== 0) {
    throw new Error(`获取工作流失败: ${json.msg}`);
  }

  const prompt = json.data?.prompt;
  if (!prompt) {
    throw new Error('获取工作流失败: 未找到 prompt 字段');
  }

  return prompt;
}

// ============================================================================
// 上传文件到 RunningHub
// ============================================================================

/**
 * 上传文件到 RunningHub
 * POST /openapi/v2/media/upload/binary
 *
 * 注意：FormData 无法通过 extensionFetch（chrome.runtime.sendMessage）序列化，
 * 因此保持原生 fetch 直连（RunningHub 启用了 CORS）。
 *
 * @param apiKey RunningHub API Key
 * @param file 文件数据（Blob 或 data URL）
 * @param fileType 文件类型 'input' | 'output'
 * @returns 上传后的 fileName（用于 nodeInfoList）
 */
export async function uploadFileToRunningHub(
  apiKey: string,
  file: Blob | string,
  fileType: 'input' | 'output' = 'input',
  signal?: AbortSignal,
): Promise<string> {
  const result = await uploadFileToRunningHubWithUrl(apiKey, file, fileType, signal);
  return result.fileName;
}

  /**
   * 上传文件到 RunningHub（返回完整信息）
   * POST /openapi/v2/media/upload/binary
   * 使用 Bearer token 认证
   */
  export async function uploadFileToRunningHubWithUrl(
    apiKey: string,
    file: Blob | string,
    fileType: 'input' | 'output' = 'input',
    signal?: AbortSignal,
  ): Promise<{ fileName: string; downloadUrl: string }> {
    let blob: Blob;
    let filename: string;

    if (typeof file === 'string') {
      // data URL，需要先下载
      if (file.startsWith('data:')) {
        const response = await fetch(file, { signal });
        blob = await response.blob();
        // 从 data URL 提取扩展名
        const extMatch = file.match(/data:image\/(\w+);/);
        const ext = extMatch?.[1] === 'jpeg' ? 'jpg' : extMatch?.[1] ?? 'png';
        filename = `upload_${Date.now()}.${ext}`;
      } else {
        // 远程 URL
        const response = await fetch(file, { signal });
        blob = await response.blob();
        // 从 URL 提取扩展名
        const urlExt = file.split('?')[0]?.split('.').pop()?.toLowerCase() ?? 'png';
        filename = `upload_${Date.now()}.${urlExt}`;
      }
    } else {
      blob = file;
      filename = `upload_${Date.now()}.bin`;
    }

    const formData = new FormData();
    formData.append('fileType', fileType);
    formData.append('file', blob, filename);

    // /openapi/v2/media/upload/binary 使用 Bearer token 认证
    const response = await fetch(`${RH_BASE_URL}/openapi/v2/media/upload/binary`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
      signal,
    });

    if (!response.ok) {
      throw new Error(`上传文件失败: ${response.status}`);
    }

    const json = await response.json();
    if (json.code !== 0) {
      throw new Error(`上传文件失败: ${json.msg}`);
    }

    const fileName = json.data?.fileName;
    const downloadUrl = json.data?.download_url;
    if (!fileName) {
      throw new Error('上传文件失败: 未返回 fileName');
    }

    return { fileName, downloadUrl: downloadUrl || '' };
  }

// ============================================================================
// 执行 RunningHub APP（快捷创作）
// ============================================================================

/**
 * 执行 RunningHub APP（快捷创作）
 * 使用 /task/openapi/ai-app/run 接口
 *
 * 轮询策略：
 * - 前5分钟：3秒间隔（适合3分钟内生图）
 * - 5分钟后：10秒间隔（覆盖长视频任务）
 * - 排队中：10秒间隔
 * - 总超时：20分钟
 * - 502/503/504 容错：尝试恢复 taskId 或重试1次
 */
export async function executeRhAppApi(
  apiKey: string,
  webappId: string,
  nodeInfoList: RhNodeInfo[],
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<RhApiResult> {
  // 1. 提交 APP 任务（含 504 容错）
  const submitJson = await submitWithGatewayTimeoutRecovery<{
    code: number;
    msg: string;
    data: { taskId: string; promptTips?: string };
  }>(() => extensionFetch(`${RH_BASE_URL}/task/openapi/ai-app/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ webappId, apiKey, nodeInfoList }),
    signal,
  }), signal);

  const { taskId } = submitJson.data;
  checkPromptTips(submitJson.data.promptTips);

  // 2. 轮询任务结果
  return pollRhTaskResult(apiKey, taskId, onProgress, signal);
}

// ============================================================================
// 执行 RunningHub Workflow (ComfyUI)
// ============================================================================

/**
 * 执行 RunningHub Workflow (ComfyUI)
 * 使用 /task/openapi/create 提交任务
 * 使用 /task/openapi/outputs 查询结果
 *
 * 轮询策略同 executeRhAppApi
 */
export async function executeRhWorkflowApi(
  apiKey: string,
  workflowId: string,
  nodeInfoList: ComfyUINodeInfo[],
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<RhApiResult> {
  // 1. 提交 Workflow 任务（含 504 容错）
  const submitJson = await submitWithGatewayTimeoutRecovery<{
    code: number;
    msg: string;
    data: { taskId: string; promptTips?: string };
  }>(() => extensionFetch(`${RH_BASE_URL}/task/openapi/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      workflowId,
      nodeInfoList: nodeInfoList.map((n) => ({
        nodeId: n.nodeId,
        fieldName: n.fieldName,
        fieldValue: n.defaultValue ?? '',
      })),
    }),
    signal,
  }), signal);

  const { taskId } = submitJson.data;
  checkPromptTips(submitJson.data.promptTips);

  // 2. 轮询任务结果
  return pollRhTaskResult(apiKey, taskId, onProgress, signal);
}

// ============================================================================
// RunningHub 标准模型 API（rhart-* 系列）
// ============================================================================

/**
 * 标准模型 API 轮询间隔（5秒）
 */
const MODEL_POLL_INTERVAL = 5000;

/**
 * 标准模型 API 总超时（3分钟）
 */
const MODEL_MAX_ELAPSED_MS = 3 * 60 * 1000;

/**
 * 提交 RunningHub 标准模型任务
 * POST /openapi/v2/{model}/{operation}
 */
export async function submitRhModelTask(
  apiKey: string,
  submitUrl: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ taskId: string }> {
  const response = await extensionFetch(submitUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(params),
    signal,
  });

  const json = await response.json();

  // RH 标准模型 API 返回 taskId 表示提交成功，不是 code: 0
  if (!json.taskId) {
    throw new Error(`提交任务失败: ${json.errorMessage || json.errorCode || json.msg || '无 taskId'}`);
  }

  return { taskId: json.taskId };
}

/**
 * 轮询 RunningHub 标准模型任务结果
 * POST /openapi/v2/query
 */
export async function pollRhModelTaskResult(
  apiKey: string,
  taskId: string,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<RhApiResult> {
  const startTime = Date.now();

  while (true) {
    if (signal?.aborted) throw new Error('任务已取消');

    const elapsed = Date.now() - startTime;
    if (elapsed >= MODEL_MAX_ELAPSED_MS) {
      throw new Error(`任务超时: 超过${Math.round(MODEL_MAX_ELAPSED_MS / 60000)}分钟`);
    }

    // 5秒间隔
    await new Promise(r => setTimeout(r, MODEL_POLL_INTERVAL));

    // 进度：基于时间比例 0-90%
    if (onProgress) {
      onProgress(Math.min(elapsed / MODEL_MAX_ELAPSED_MS, 0.9));
    }

    const resultResponse = await extensionFetch(`${RH_BASE_URL}/openapi/v2/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ taskId }),
      signal,
    });

    if (resultResponse.ok) {
      const resultJson = await resultResponse.json();

      // 成功
      if (resultJson.status === 'SUCCESS') {
        const results = resultJson.results || [];
        const allUrls: string[] = results
          .map((r: { url?: string }) => r.url)
          .filter((url: string | undefined): url is string => !!url);

        if (allUrls.length > 0) {
          return { outputUrl: allUrls[0]!, outputUrls: allUrls };
        }
        throw new Error('任务成功但无返回结果');
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
      console.warn(`[rhApi] 轮询网络错误 ${resultResponse.status}，继续等待`);
    }
  }
}

/**
 * 执行 RunningHub 标准模型任务（提交 + 轮询）
 */
export async function executeRhModelApi(
  apiKey: string,
  submitUrl: string,
  params: Record<string, unknown>,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<RhApiResult> {
  const { taskId } = await submitRhModelTask(apiKey, submitUrl, params, signal);
  return pollRhModelTaskResult(apiKey, taskId, onProgress, signal);
}