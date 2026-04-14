/**
 * OmniNode Executor
 *
 * 万能节点执行器，支持两种模式：
 * 1. HTTP 模式：自定义 API 调用
 * 2. ComfyUI 模式：本地/Cloud/RunningHub 工作流执行
 */

import type { NodeExecutionContext } from './types';
import type { OmniNodeConfig, ComfyUISubType, ComfyUINodeInfo } from '@/types';
import { executeComfyWorkflow, type ComfyWorkflowResult } from '@/api/comfyApi';
import { useSettingsStore } from '@/stores/useSettingsStore';

/**
 * 变量替换：{{变量名}} → 从变量映射中取值
 */
function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}

/**
 * 从 JSON 对象中按路径提取值 (e.g. "data.results.0.url")
 */
function extractByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const idx = parseInt(part, 10);
      current = current[idx];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

/**
 * 同步执行万能节点 HTTP 请求
 */
async function executeSync(
  config: OmniNodeConfig,
  variables: Record<string, string>,
  signal?: AbortSignal
): Promise<string> {
  const url = replaceVariables(config.apiUrl, variables);
  const headers = JSON.parse(replaceVariables(config.headers, variables));
  const body = replaceVariables(config.body, variables);

  const response = await fetch(url, {
    method: config.method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: config.method !== 'GET' ? body : undefined,
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`万能节点请求失败: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  if (config.rawTextOutput) {
    return await response.text();
  }

  const json = await response.json();
  const result = extractByPath(json, config.resultPath);
  if (result === undefined || result === null) {
    throw new Error(`万能节点: resultPath "${config.resultPath}" 未找到数据`);
  }
  return typeof result === 'string' ? result : JSON.stringify(result);
}

/**
 * 异步执行万能节点（提交任务 -> 轮询状态 -> 返回结果）
 */
async function executeAsync(
  config: OmniNodeConfig,
  variables: Record<string, string>,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal
): Promise<string> {
  const url = replaceVariables(config.apiUrl, variables);
  const headers = JSON.parse(replaceVariables(config.headers, variables));
  const body = config.method !== 'GET' ? replaceVariables(config.body, variables) : undefined;

  // 1. 提交异步任务
  const submitResponse = await fetch(url, {
    method: config.method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
    signal,
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`异步任务提交失败: ${submitResponse.status} - ${errorText.substring(0, 200)}`);
  }

  const submitJson = await submitResponse.json();
  const taskId = String(extractByPath(submitJson, config.taskIdPath ?? 'id') ?? '');
  if (!taskId) {
    throw new Error('异步任务提交失败: 未获取到 taskId');
  }

  // 2. 轮询任务状态
  const pollInterval = 3000;
  const maxAttempts = 600;
  const pollHeaders = config.pollingHeaders
    ? JSON.parse(replaceVariables(config.pollingHeaders, variables))
    : {};

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error('任务已取消');

    const pollUrl = replaceVariables(config.pollingUrl ?? `${url}/${taskId}`, {
      ...variables,
      taskId,
    });
    const pollMethod = config.pollingMethod ?? 'GET';

    const pollResponse = await fetch(pollUrl, {
      method: pollMethod,
      headers: { 'Content-Type': 'application/json', ...pollHeaders },
      signal,
    });

    if (!pollResponse.ok) {
      throw new Error(`轮询请求失败: ${pollResponse.status}`);
    }

    const pollJson = await pollResponse.json();
    const status = String(
      extractByPath(pollJson, config.pollingResultPath ?? 'status') ?? ''
    );

    // 完成状态
    const completedValue = config.pollingCompletedValue ?? 'completed';
    if (status === completedValue || status === 'success' || status === 'done') {
      const resultPath = config.pollingResultDataPath ?? config.resultPath;
      const result = resultPath ? extractByPath(pollJson, resultPath) : pollJson;
      if (result === undefined || result === null) {
        throw new Error(`异步任务完成但未找到结果数据 (路径: "${resultPath}")`);
      }
      return typeof result === 'string' ? result : JSON.stringify(result);
    }

    // 失败状态
    const failedValue = config.pollingFailedValue ?? 'failed';
    if (status === failedValue || status === 'error') {
      const errorMsg = config.pollingErrorPath
        ? String(extractByPath(pollJson, config.pollingErrorPath) ?? '异步任务失败')
        : '异步任务失败';
      throw new Error(errorMsg);
    }

    // 进度
    if (config.pollingProgressPath && onProgress) {
      const progress = extractByPath(pollJson, config.pollingProgressPath);
      if (typeof progress === 'number') onProgress(progress);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('异步任务超时: 轮询次数达到上限');
}

/**
 * OmniNode 执行器
 */
export async function executeOmniNode(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData, signal, getFreshNode } = ctx;

  // 获取最新节点数据
  const freshNode = getFreshNode(node.id);
  const nodeData = freshNode?.data ?? node.data;
  const config = nodeData.config as OmniNodeConfig;

  if (!config) {
    throw new Error('万能节点配置缺失');
  }

  // 获取上游输入数据
  const { images, videos, audio, text } = getConnectedInputs(node.id);

  // 构建变量映射
  const variables: Record<string, string> = {
    ...(config.variables ?? {}),
    ...(text && { text }),
    ...(images[0] && { image: images[0] }),
    ...(videos[0] && { video: videos[0] }),
    ...(audio[0] && { audio: audio[0] }),
  };

  // 从节点字段映射中提取变量
  if (config.nodeInfoList && config.nodeInfoList.length > 0) {
    for (const nodeInfo of config.nodeInfoList) {
      if (nodeInfo.defaultValue) {
        variables[nodeInfo.fieldName] = nodeInfo.defaultValue;
      }
    }
  }

  updateNodeData(node.id, { loading: true, errorMessage: '', progress: 0 });

  try {
    let outputUrl: string;
    let outputUrls: string[] | undefined;

    // ComfyUI 执行模式
    if (config.executionType === 'comfyui') {
      const comfyResult = await executeComfyMode(config, variables, updateNodeData, node.id, signal);
      outputUrl = comfyResult.outputUrl;
      outputUrls = comfyResult.outputUrls.length > 1 ? comfyResult.outputUrls : undefined;
    } else {
      // HTTP 执行模式
      outputUrl = await executeHttpMode(config, variables, updateNodeData, node.id, signal);
      // HTTP 模式检测是否返回了 JSON 数组（多输出场景）
      try {
        const parsed = JSON.parse(outputUrl);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
          outputUrls = parsed as string[];
          outputUrl = outputUrls[0]!;
        }
      } catch {
        // 非 JSON 数组，保持单值
      }
    }

    // 根据 executionType 和配置写入正确的输出字段
    // ComfyUI 模式使用独立配置 comfyuiOutputType，HTTP 模式使用 outputType
    const effectiveOutputType = config.executionType === 'comfyui'
      ? (config.comfyuiOutputType ?? 'image')
      : (config.outputType ?? 'text');
    
    // 智能判断：如果是媒体 URL，强制使用 outputUrl
    const isMediaUrl = outputUrl.includes('/view?') || 
      /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav)(\?|$)/i.test(outputUrl);
    
    if (effectiveOutputType === 'text' && !isMediaUrl) {
      updateNodeData(node.id, {
        textOutput: outputUrl,
        outputUrl: undefined,
        outputUrls: undefined,
        loading: false,
        progress: 0,
      });
    } else {
      // image/video/audio
      updateNodeData(node.id, {
        outputUrl,
        outputUrls,
        textOutput: undefined,
        loading: false,
        progress: 0,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '执行失败';
    updateNodeData(node.id, { loading: false, errorMessage: msg, progress: 0 });
    throw err;
  }
}

/**
 * ComfyUI 模式执行
 */
async function executeComfyMode(
  config: OmniNodeConfig,
  variables: Record<string, string>,
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void,
  nodeId: string,
  signal?: AbortSignal
): Promise<ComfyWorkflowResult> {
  const subType = config.comfyuiSubType ?? 'local';
  const comfyuiConfig = useSettingsStore.getState().comfyuiConfig;

  // 获取 URL 和 Key
  const getChannelConfig = (): { url: string; key: string } => {
    switch (subType) {
      case 'local':
        return { url: comfyuiConfig.localUrl, key: '' };
      case 'cloud':
        return { url: comfyuiConfig.cloudUrl, key: '' };
      case 'runninghub':
      case 'runninghubApp':
        return { url: '', key: comfyuiConfig.runninghubApiKey };
      default:
        return { url: '', key: '' };
    }
  };

  const { url, key } = getChannelConfig();

  // 验证配置
  if ((subType === 'local' || subType === 'cloud') && !config.workflowJson) {
    throw new Error('请先选择工作流');
  }
  if ((subType === 'runninghub' || subType === 'runninghubApp') && !config.workflowId) {
    throw new Error('请输入工作流 ID');
  }

  // 构建 nodeInfoList（从变量列表）
  const nodeInfoList: ComfyUINodeInfo[] = [];
  for (const [fieldName, value] of Object.entries(variables)) {
    nodeInfoList.push({
      nodeId: '', // 将在运行时填充
      fieldName,
      defaultValue: value,
    });
  }

  return await executeComfyWorkflow({
    channelUrl: url,
    channelKey: key,
    subType: subType as ComfyUISubType,
    workflowId: config.workflowId,
    workflowJson: config.workflowJson,
    nodeInfoList: config.nodeInfoList ?? nodeInfoList,
    onProgress: (p) => {
      updateNodeData(nodeId, { progress: p });
    },
    signal,
  });
}

/**
 * HTTP 模式执行
 */
async function executeHttpMode(
  config: OmniNodeConfig,
  variables: Record<string, string>,
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void,
  nodeId: string,
  signal?: AbortSignal
): Promise<string> {
  if (config.executionMode === 'async') {
    return await executeAsync(config, variables, (p) => {
      updateNodeData(nodeId, { progress: p });
    }, signal);
  }

  return await executeSync(config, variables, signal);
}