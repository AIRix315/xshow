/**
 * RunningHub API
 *
 * 封装 RunningHub API 调用
 */

import type { ComfyUINodeInfo } from '@/types';

export interface RhApiResult {
  outputUrl: string;
  outputUrls: string[];
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
  const rhBaseUrl = 'https://www.runninghub.cn';

  const response = await fetch(
    `${rhBaseUrl}/api/webapp/apiCallDemo?apiKey=${encodeURIComponent(apiKey)}&webappId=${encodeURIComponent(webappId)}`,
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
  const rhBaseUrl = 'https://www.runninghub.cn';

  const response = await fetch(`${rhBaseUrl}/api/openapi/getJsonApiFormat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': 'www.runninghub.cn',
    },
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
 * POST /task/openapi/upload
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
  const rhBaseUrl = 'https://www.runninghub.cn';

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
  formData.append('apiKey', apiKey);
  formData.append('fileType', fileType);
  formData.append('file', blob, filename);

  const response = await fetch(`${rhBaseUrl}/task/openapi/upload`, {
    method: 'POST',
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
  if (!fileName) {
    throw new Error('上传文件失败: 未返回 fileName');
  }

  return fileName;
}

/**
 * 执行 RunningHub APP（快捷创作）
 * 使用 /task/openapi/ai-app/run 接口
 */
export async function executeRhAppApi(
  apiKey: string,
  webappId: string,
  nodeInfoList: RhNodeInfo[],
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<RhApiResult> {
  const rhBaseUrl = 'https://www.runninghub.cn';

  // 1. 提交 APP 任务
  const submitResponse = await fetch(`${rhBaseUrl}/task/openapi/ai-app/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': 'www.runninghub.cn',
    },
    body: JSON.stringify({
      webappId,
      apiKey,
      nodeInfoList,
    }),
    signal,
  });

  if (!submitResponse.ok) {
    throw new Error(`提交任务失败: ${submitResponse.status}`);
  }

  const submitJson = await submitResponse.json();
  if (submitJson.code !== 0) {
    throw new Error(`提交任务失败: ${submitJson.msg}`);
  }

  const { taskId } = submitJson.data;
  const promptTips = submitJson.data.promptTips;

  // 检查节点错误
  if (promptTips) {
    try {
      const tips = JSON.parse(promptTips);
      if (tips.node_errors && Object.keys(tips.node_errors).length > 0) {
        throw new Error(`工作流错误: ${JSON.stringify(tips.node_errors)}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('工作流错误')) throw e;
    }
  }

  // 2. 轮询任务结果
  const pollInterval = 3000;
  const maxAttempts = 200;

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error('任务已取消');

    if (onProgress) {
      onProgress((i / maxAttempts) * 0.9);
    }

    await new Promise((r) => setTimeout(r, pollInterval));

    const resultResponse = await fetch(`${rhBaseUrl}/task/openapi/outputs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'www.runninghub.cn',
      },
      body: JSON.stringify({ apiKey, taskId }),
      signal,
    });

    if (resultResponse.ok) {
      const resultJson = await resultResponse.json();

      // AI App 成功响应: code: 0, data: [{ fileUrl: "..." }]
      if (resultJson.code === 0 && resultJson.data && Array.isArray(resultJson.data)) {
        const allUrls: string[] = resultJson.data
          .map((o: { fileUrl?: string }) => o.fileUrl)
          .filter((url: string | undefined): url is string => !!url);
        if (allUrls.length > 0) {
          return { outputUrl: allUrls[0]!, outputUrls: allUrls };
        }
        const jsonStr = JSON.stringify(resultJson.data);
        return { outputUrl: jsonStr, outputUrls: [jsonStr] };
      }

      // AI App 失败响应: code: 805
      if (resultJson.code === 805) {
        const failedReason = resultJson.data?.failedReason;
        if (failedReason) {
          throw new Error(`任务失败: ${failedReason.exception_message ?? JSON.stringify(failedReason)}`);
        }
        throw new Error(`任务失败: ${resultJson.msg ?? '未知错误'}`);
      }

      // 其他错误码（非成功非运行中）
      if (resultJson.code !== 804 && resultJson.code !== 813) {
        throw new Error(`任务异常: ${resultJson.msg ?? `code: ${resultJson.code}`}`);
      }
    }
  }

  throw new Error('任务超时: 轮询次数达到上限');
}

/**
 * 执行 RunningHub Workflow (ComfyUI)
 * 使用 /task/openapi/create 提交任务
 * 使用 /task/openapi/outputs 查询结果
 */
export async function executeRhWorkflowApi(
  apiKey: string,
  workflowId: string,
  nodeInfoList: ComfyUINodeInfo[],
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<RhApiResult> {
  const rhBaseUrl = 'https://www.runninghub.cn';

  // 1. 提交 Workflow 任务
  const submitResponse = await fetch(`${rhBaseUrl}/task/openapi/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': 'www.runninghub.cn',
    },
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
  });

  if (!submitResponse.ok) {
    throw new Error(`提交任务失败: ${submitResponse.status}`);
  }

  const submitJson = await submitResponse.json();
  if (submitJson.code !== 0) {
    throw new Error(`提交任务失败: ${submitJson.msg}`);
  }

  const { taskId } = submitJson.data;
  const promptTips = submitJson.data.promptTips;

  // 检查节点错误
  if (promptTips) {
    try {
      const tips = JSON.parse(promptTips);
      if (tips.node_errors && Object.keys(tips.node_errors).length > 0) {
        throw new Error(`工作流错误: ${JSON.stringify(tips.node_errors)}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('工作流错误')) throw e;
    }
  }

  // 2. 轮询任务结果
  // 注意: ComfyUI Workflow 和 AI App 共用同一个查询接口 /task/openapi/outputs
  const pollInterval = 3000;
  const maxAttempts = 200;

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error('任务已取消');

    if (onProgress) {
      onProgress((i / maxAttempts) * 0.9);
    }

    await new Promise((r) => setTimeout(r, pollInterval));

    const resultResponse = await fetch(`${rhBaseUrl}/task/openapi/outputs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'www.runninghub.cn',
      },
      body: JSON.stringify({ apiKey, taskId }),
      signal,
    });

    if (resultResponse.ok) {
      const resultJson = await resultResponse.json();

      // ComfyUI Workflow 成功响应: code: 0, data: [{ fileUrl: "..." }]
      if (resultJson.code === 0 && resultJson.data && Array.isArray(resultJson.data)) {
        const allUrls: string[] = resultJson.data
          .map((o: { fileUrl?: string }) => o.fileUrl)
          .filter((url: string | undefined): url is string => !!url);
        if (allUrls.length > 0) {
          return { outputUrl: allUrls[0]!, outputUrls: allUrls };
        }
        const jsonStr = JSON.stringify(resultJson.data);
        return { outputUrl: jsonStr, outputUrls: [jsonStr] };
      }

      // ComfyUI Workflow 失败响应: code: 805
      if (resultJson.code === 805) {
        const failedReason = resultJson.data?.failedReason;
        if (failedReason) {
          throw new Error(`任务失败: ${failedReason.exception_message ?? JSON.stringify(failedReason)}`);
        }
        throw new Error(`任务失败: ${resultJson.msg ?? '未知错误'}`);
      }

      // 其他错误码（非成功非运行中）
      if (resultJson.code !== 804 && resultJson.code !== 813) {
        throw new Error(`任务异常: ${resultJson.msg ?? `code: ${resultJson.code}`}`);
      }
    }
  }

  throw new Error('任务超时: 轮询次数达到上限');
}
