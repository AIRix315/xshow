// Ref: ComfyUI API + RunningHub API — 工作流执行引擎

import type { ComfyUINodeInfo, ComfyUISubType } from '@/types';

interface ComfyWorkflowParams {
  channelUrl: string;
  channelKey: string;
  subType: ComfyUISubType;
  workflowId: string;
  nodeInfoList?: ComfyUINodeInfo[];
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

// =============================================================================
// ComfyUI 本地 / Cloud 执行
// =============================================================================

async function executeComfyLocalOrCloud(
  params: ComfyWorkflowParams,
): Promise<string> {
  const { channelUrl, channelKey, workflowId, nodeInfoList, onProgress, signal } = params;
  const baseUrl = channelUrl.replace(/\/$/, '');

  // 1. 获取工作流 JSON
  const getWorkflowUrl = `${baseUrl}/api/openapi/getJsonApiFormat`;
  const workflowResponse = await fetch(getWorkflowUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: channelKey, workflowId }),
    signal,
  });

  if (!workflowResponse.ok) {
    throw new Error(`获取工作流失败: ${workflowResponse.status}`);
  }

  const workflowJson = await workflowResponse.json();
  if (workflowJson.code !== 0) {
    throw new Error(`获取工作流失败: ${workflowJson.msg}`);
  }

  let workflowStr = workflowJson.data?.prompt;
  if (!workflowStr) {
    throw new Error('获取工作流失败: 未找到 prompt 字段');
  }

  // 2. 解析并替换 nodeInfoList 中的字段
  const workflow = JSON.parse(workflowStr);
  if (nodeInfoList && nodeInfoList.length > 0) {
    for (const nodeInfo of nodeInfoList) {
      if (workflow[nodeInfo.nodeId]?.inputs) {
        workflow[nodeInfo.nodeId].inputs[nodeInfo.fieldName] = nodeInfo.defaultValue ?? '';
      }
    }
  }

  // 3. 提交任务
  const promptId = `${Date.now()}`;
  const submitResponse = await fetch(`${baseUrl}/v1.0/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: workflow, prompt_id: promptId }),
    signal,
  });

  if (!submitResponse.ok) {
    throw new Error(`提交任务失败: ${submitResponse.status}`);
  }

  // 4. 轮询结果
  const pollInterval = 3000;
  const maxAttempts = 200; // 最多 10 分钟

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error('任务已取消');

    if (onProgress) {
      onProgress((i / maxAttempts) * 0.9); // 0-90% 是提交到完成之间
    }

    await new Promise((r) => setTimeout(r, pollInterval));

    const historyResponse = await fetch(`${baseUrl}/v1.0/history/${promptId}`, {
      signal,
    });

    if (historyResponse.ok) {
      const historyJson = await historyResponse.json();
      if (historyJson[promptId]) {
        // 任务完成
        const result = historyJson[promptId];
        const outputs = result.outputs ?? {};
        
        // 查找第一个图片输出
        for (const nodeId of Object.keys(outputs)) {
          const output = outputs[nodeId];
          if (output?.images) {
            const img = output.images[0];
            if (img) {
              return `${baseUrl}/view?filename=${img}&type=output`;
            }
          }
          if (output?.audio) {
            const aud = output.audio[0];
            if (aud) {
              return `${baseUrl}/view?filename=${aud}&type=output`;
            }
          }
        }
        
        // 没有找到输出，返回完整结果
        return JSON.stringify(result);
      }
    }
  }

  throw new Error('任务超时: 轮询次数达到上限');
}

// =============================================================================
// RunningHub 执行
// =============================================================================

async function executeComfyRunninghub(
  params: ComfyWorkflowParams,
): Promise<string> {
  const { channelUrl, channelKey, workflowId, nodeInfoList, onProgress, signal } = params;

  // 1. 提交任务
  const submitResponse = await fetch(`${channelUrl}/task/openapi/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Host': 'www.runninghub.cn',
    },
    body: JSON.stringify({
      apiKey: channelKey,
      workflowId,
      nodeInfoList: nodeInfoList?.map((n) => ({
        nodeId: n.nodeId,
        fieldName: n.fieldName,
        fieldValue: n.defaultValue ?? '',
      })) ?? [],
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
  
  // 检查是否有节点错误
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

  // 2. 轮询任务状态
  const pollInterval = 3000;
  const maxAttempts = 200;

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error('任务已取消');

    if (onProgress) {
      onProgress((i / maxAttempts) * 0.9);
    }

    await new Promise((r) => setTimeout(r, pollInterval));

    // 查询任务状态
    const statusResponse = await fetch(`${channelUrl}/task/openapi/getResult`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Host': 'www.runninghub.cn',
      },
      body: JSON.stringify({ apiKey: channelKey, taskId }),
      signal,
    });

    if (statusResponse.ok) {
      const statusJson = await statusResponse.json();
      if (statusJson.data?.status === 'SUCCESS') {
        const outputs = statusJson.data.outputs ?? [];
        if (outputs.length > 0) {
          return outputs[0].fileUrl ?? JSON.stringify(outputs);
        }
        return JSON.stringify(statusJson.data);
      }
      if (statusJson.data?.status === 'FAILED') {
        throw new Error(`任务失败: ${statusJson.msg ?? '未知错误'}`);
      }
    }
  }

  throw new Error('任务超时: 轮询次数达到上限');
}

// =============================================================================
// 统一入口
// =============================================================================

export async function executeComfyWorkflow(
  params: ComfyWorkflowParams,
): Promise<string> {
  const { subType } = params;

  if (subType === 'runninghub') {
    return executeComfyRunninghub(params);
  }

  return executeComfyLocalOrCloud(params);
}
