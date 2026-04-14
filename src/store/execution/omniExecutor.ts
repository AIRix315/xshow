/**
 * OmniNode Executor
 *
 * 万能节点执行器，支持两种模式：
 * 1. HTTP 模式：自定义 API 调用
 * 2. ComfyUI 模式：本地/Cloud/RunningHub 工作流执行
 */

import type { Node, Edge } from '@xyflow/react';
import type { NodeExecutionContext } from './types';
import type { OmniNodeConfig, ComfyUISubType, ComfyUINodeInfo } from '@/types';
import {
  executeComfyWorkflow,
  parseWorkflowNodes,
  uploadImageToComfyUI,
  type ComfyWorkflowResult,
  type WorkflowNodeField,
} from '@/api/comfyApi';
import { getConnectedInputs, getInputsByHandle } from '@/utils/connectedInputs';
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

    const completedValue = config.pollingCompletedValue ?? 'completed';
    if (status === completedValue || status === 'success' || status === 'done') {
      const resultPath = config.pollingResultDataPath ?? config.resultPath;
      const result = resultPath ? extractByPath(pollJson, resultPath) : pollJson;
      if (result === undefined || result === null) {
        throw new Error(`异步任务完成但未找到结果数据 (路径: "${resultPath}")`);
      }
      return typeof result === 'string' ? result : JSON.stringify(result);
    }

    const failedValue = config.pollingFailedValue ?? 'failed';
    if (status === failedValue || status === 'error') {
      const errorMsg = config.pollingErrorPath
        ? String(extractByPath(pollJson, config.pollingErrorPath) ?? '异步任务失败')
        : '异步任务失败';
      throw new Error(errorMsg);
    }

    if (config.pollingProgressPath && onProgress) {
      const progress = extractByPath(pollJson, config.pollingProgressPath);
      if (typeof progress === 'number') onProgress(progress);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('异步任务超时: 轮询次数达到上限');
}

// =============================================================================
// ComfyUI 模式：智能资源 → 字段映射
// =============================================================================

function isTextField(fieldInfo: WorkflowNodeField): boolean {
  return fieldInfo.type === 'STRING';
}

function buildNodeInfoListFromNodeValues(
  nodeValues: Record<string, Record<string, unknown>> | undefined
): ComfyUINodeInfo[] {
  if (!nodeValues || Object.keys(nodeValues).length === 0) {
    return [];
  }

  const list: ComfyUINodeInfo[] = [];
  for (const [nodeId, fields] of Object.entries(nodeValues)) {
    for (const [field, value] of Object.entries(fields)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) continue;
      if (typeof value === 'object') continue;

      list.push({
        nodeId,
        fieldName: field,
        defaultValue: String(value),
      });
    }
  }
  return list;
}

async function executeComfyMode(
  config: OmniNodeConfig,
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  nodeValues: Record<string, Record<string, unknown>> | undefined,
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void,
  signal?: AbortSignal
): Promise<ComfyWorkflowResult> {
  const subType = config.comfyuiSubType ?? 'local';
  const comfyuiConfig = useSettingsStore.getState().comfyuiConfig;

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

  if ((subType === 'local' || subType === 'cloud') && !config.workflowJson) {
    throw new Error('请先选择工作流');
  }
  if ((subType === 'runninghub' || subType === 'runninghubApp') && !config.workflowId) {
    throw new Error('请输入工作流 ID');
  }

  // Step 1: 解析工作流节点
  const parsedNodes = parseWorkflowNodes(config.workflowJson ?? '{}');

  // Step 2: 收集上游数据（按 image-* handle 分组）
  const inputsByHandle = getInputsByHandle(nodeId, nodes, edges);

  // Step 3: 从 nodeValues 生成 nodeInfoList（保留用户界面编辑值）
  const baseNodeInfoList = buildNodeInfoListFromNodeValues(nodeValues);
  const existingKeys = new Set(
    baseNodeInfoList.map((n) => `${n.nodeId}::${n.fieldName}`)
  );
  const defaultEntries: ComfyUINodeInfo[] = [];
  for (const nodeInfo of config.nodeInfoList ?? []) {
    const k = `${nodeInfo.nodeId}::${nodeInfo.fieldName}`;
    if (!existingKeys.has(k) && nodeInfo.defaultValue) {
      defaultEntries.push(nodeInfo);
    }
  }
  const mergedNodeInfoList = [...baseNodeInfoList, ...defaultEntries];

  // Step 4: Any→STRING 映射（上游文本 → 工作流 STRING 字段）
  const stringFields: Array<{ nodeId: string; field: string; priority: number }> = [];
  const stringKeywords = ['prompt', 'text', 'caption', 'description', 'instruction', 'input', 'content', 'message'];

  for (const pNode of parsedNodes) {
    for (const [field, fieldInfo] of Object.entries(pNode.inputs)) {
      if (!isTextField(fieldInfo)) continue;
      const lowerField = field.toLowerCase();
      let priority = 0;
      for (const kw of stringKeywords) {
        if (lowerField.includes(kw)) priority++;
      }
      stringFields.push({ nodeId: pNode.nodeId, field, priority });
    }
  }
  stringFields.sort((a, b) => b.priority - a.priority);

  const connectedInputs = getConnectedInputs(nodeId, nodes, edges);
  if (connectedInputs.text && stringFields.length > 0) {
    const topField = stringFields[0]!;
    const existingIdx = mergedNodeInfoList.findIndex(
      (n) => n.nodeId === topField.nodeId && n.fieldName === topField.field
    );
    if (existingIdx >= 0) {
      mergedNodeInfoList[existingIdx] = { ...mergedNodeInfoList[existingIdx]!, defaultValue: connectedInputs.text };
    } else {
      mergedNodeInfoList.push({ nodeId: topField.nodeId, fieldName: topField.field, defaultValue: connectedInputs.text });
    }
  }

  // Step 5: image-* → IMAGE 字段映射 + 图片上传（仅 local/cloud）
  if ((subType === 'local' || subType === 'cloud') && url) {
    const imageFields: Array<{ nodeId: string; field: string }> = [];
    for (const pNode of parsedNodes) {
      if (pNode.classType === 'LoadImage') {
        for (const [field, fieldInfo] of Object.entries(pNode.inputs)) {
          if (fieldInfo?.type === 'IMAGE') {
            imageFields.push({ nodeId: pNode.nodeId, field });
          }
        }
      }
    }

    for (const [handleId, handleImages] of Object.entries(inputsByHandle)) {
      const handleIndex = parseInt(handleId.replace('image-', ''), 10);
      const targetField = imageFields[handleIndex];
      if (!targetField) continue;

      for (const imageUrl of handleImages) {
        if (signal?.aborted) throw new Error('任务已取消');

        let comfyFilename: string;
        try {
          comfyFilename = await uploadImageToComfyUI(url, imageUrl, signal);
        } catch (err) {
          throw new Error(
            `上传图片到 ComfyUI 失败: ${err instanceof Error ? err.message : String(err)}`
          );
        }

        const fieldIdx = mergedNodeInfoList.findIndex(
          (n) => n.nodeId === targetField.nodeId && n.fieldName === targetField.field
        );
        if (fieldIdx >= 0) {
          mergedNodeInfoList[fieldIdx] = {
            ...mergedNodeInfoList[fieldIdx]!,
            defaultValue: comfyFilename,
          };
        } else {
          mergedNodeInfoList.push({
            nodeId: targetField.nodeId,
            fieldName: targetField.field,
            defaultValue: comfyFilename,
          });
        }
      }
    }
  }

  // Step 6: 提交执行
  return await executeComfyWorkflow({
    channelUrl: url,
    channelKey: key,
    subType: subType as ComfyUISubType,
    workflowId: config.workflowId,
    workflowJson: config.workflowJson,
    nodeInfoList: mergedNodeInfoList,
    onProgress: (p) => {
      updateNodeData(nodeId, { progress: p });
    },
    signal,
  });
}

export async function executeOmniNode(ctx: NodeExecutionContext): Promise<void> {
  const { node, nodes, edges, getConnectedInputs, updateNodeData, signal, getFreshNode } = ctx;

  const freshNode = getFreshNode(node.id);
  const nodeData = freshNode?.data ?? node.data;
  const config = nodeData.config as OmniNodeConfig;

  if (!config) {
    throw new Error('万能节点配置缺失');
  }

  // nodeValues 存储在 nodeData 上，不在 config 中
  const nodeValues = nodeData.nodeValues as Record<string, Record<string, unknown>> | undefined;

  const { images, videos, audio, text } = getConnectedInputs(node.id);

  const variables: Record<string, string> = {
    ...(config.variables ?? {}),
    ...(text && { text }),
    ...(images[0] && { image: images[0] }),
    ...(videos[0] && { video: videos[0] }),
    ...(audio[0] && { audio: audio[0] }),
  };

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

    if (config.executionType === 'comfyui') {
      const comfyResult = await executeComfyMode(
        config,
        node.id,
        nodes,
        edges,
        nodeValues,
        updateNodeData,
        signal
      );
      outputUrl = comfyResult.outputUrl;
      outputUrls = comfyResult.outputUrls.length > 1 ? comfyResult.outputUrls : undefined;
    } else {
      outputUrl = await executeHttpMode(config, variables, updateNodeData, node.id, signal);
      try {
        const parsed = JSON.parse(outputUrl);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
          outputUrls = parsed as string[];
          outputUrl = outputUrls[0]!;
        }
      } catch {
        // non-JSON array
      }
    }

    const effectiveOutputType =
      config.executionType === 'comfyui'
        ? config.comfyuiOutputType ?? 'image'
        : config.outputType ?? 'text';

    const isMediaUrl =
      outputUrl.includes('/view?') ||
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
