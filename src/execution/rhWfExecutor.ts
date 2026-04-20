/**
 * RunningHub Workflow Node Executor
 *
 * 专门处理 RunningHub Workflow 的执行
 * 用于画布级执行（通过 nodeExecutors 注册表调用）
 */

import type { NodeExecutionContext } from './types';
import type { RhWfNodeConfig, ComfyUINodeInfo } from '@/types';
import { getConnectedInputs, getInputsByHandle } from '@/utils/connectedInputs';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { executeRhWorkflowApi, fetchRhWorkflowJson, uploadFileToRunningHub, parseRhWorkflowNodes } from '@/api/rhApi';
import type { RhWorkflowNode } from '@/api/rhApi';
import { revokeMediaUrls } from '@/utils/zipExtractor';

/**
 * 执行 RhWfNode（画布级执行）
 */
export async function executeRhWfNode(ctx: NodeExecutionContext): Promise<void> {
  const { node, nodes, edges, updateNodeData, signal } = ctx;

  const freshNode = ctx.getFreshNode(node.id);
  const nodeData = freshNode?.data ?? node.data;
  const config = nodeData.config as RhWfNodeConfig;

  if (!config) {
    throw new Error('RH Workflow 节点配置缺失');
  }

  const workflowId = config.workflowId;
  if (!workflowId) {
    throw new Error('请选择 RunningHub Workflow');
  }

  // 清理之前的 blob URLs（防止内存泄漏）
  const prevOutputUrls = nodeData.outputUrls as string[] | undefined;
  const prevOutputUrl = nodeData.outputUrl as string | undefined;
  if (prevOutputUrls) revokeMediaUrls(prevOutputUrls);
  if (prevOutputUrl?.startsWith('blob:')) revokeMediaUrls([prevOutputUrl]);

  updateNodeData(node.id, { loading: true, errorMessage: '', progress: 0 });

  try {
    const apiKey = useSettingsStore.getState().comfyuiConfig.runninghubApiKey;
    if (!apiKey) {
      throw new Error('请先在设置中配置 RunningHub API Key');
    }

    // 获取上游输入
    const upstreamData = getConnectedInputs(node.id, nodes, edges);
    const inputsByHandle = getInputsByHandle(node.id, nodes, edges);

    // 解析工作流节点（如果没有缓存的工作流 JSON）
    let parsedNodes: RhWorkflowNode[] = [];
    if (config.workflowJson) {
      parsedNodes = parseRhWorkflowNodes(config.workflowJson);
    } else {
      // 动态获取工作流 JSON
      const jsonStr = await fetchRhWorkflowJson(apiKey, workflowId, signal);
      parsedNodes = parseRhWorkflowNodes(jsonStr);
    }

    // 构建 nodeInfoList
    const nodeInfoList: Array<{ nodeId: string; fieldName: string; fieldValue: string }> = [];

    // 从 nodeValues 构建
    const nodeValues = nodeData.nodeValues as Record<string, Record<string, unknown>> | undefined;
    for (const [nid, fields] of Object.entries(nodeValues ?? {})) {
      for (const [fname, fval] of Object.entries(fields)) {
        const strVal = String(fval ?? '');
        if (strVal.trim()) {
          nodeInfoList.push({ nodeId: nid, fieldName: fname, fieldValue: strVal });
        }
      }
    }

    // 获取所有 IMAGE/VIDEO/AUDIO 字段
    const imageFields = parsedNodes
      .flatMap((n) =>
        Object.entries(n.inputs)
          .filter(([, fi]) => fi?.type === 'IMAGE')
          .map(([field]) => ({ nodeId: n.nodeId, field }))
      );

    const videoFields = parsedNodes
      .flatMap((n) =>
        Object.entries(n.inputs)
          .filter(([, fi]) => fi?.type === 'VIDEO')
          .map(([field]) => ({ nodeId: n.nodeId, field }))
      );

    const audioFields = parsedNodes
      .flatMap((n) =>
        Object.entries(n.inputs)
          .filter(([, fi]) => fi?.type === 'AUDIO')
          .map(([field]) => ({ nodeId: n.nodeId, field }))
      );

    // 处理图片字段 - 通过 image-* handle 精确映射
    for (const [handleId, images] of Object.entries(inputsByHandle)) {
      if (!handleId.startsWith('image-')) continue;
      const handleIndex = parseInt(handleId.replace('image-', ''), 10);
      const targetField = imageFields[handleIndex];
      if (!targetField) continue;

      for (const imageUrl of images) {
        try {
          const fileName = await uploadFileToRunningHub(apiKey, imageUrl, 'input', signal);
          // 查找或添加条目
          const idx = nodeInfoList.findIndex(
            (n) => n.nodeId === targetField.nodeId && n.fieldName === targetField.field
          );
          if (idx >= 0) {
            nodeInfoList[idx]!.fieldValue = fileName;
          } else {
            nodeInfoList.push({ nodeId: targetField.nodeId, fieldName: targetField.field, fieldValue: fileName });
          }
        } catch (uploadErr) {
          throw new Error(`上传图片失败: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
        }
      }
    }

    // ─── any-input 智能映射 ───
    // 上游非 handle 指定的图片 → 第一个未被 handle 占用的 IMAGE 字段
    if (upstreamData.images.length > 0 && imageFields.length > 0) {
      const handleUsedIndices = new Set(
        Object.keys(inputsByHandle)
          .filter(k => k.startsWith('image-'))
          .map(k => parseInt(k.replace('image-', ''), 10))
      );
      // 找到第一个未被 handle 占用的 IMAGE 字段
      let targetField: { nodeId: string; field: string } | undefined;
      for (let i = 0; i < imageFields.length; i++) {
        if (!handleUsedIndices.has(i)) {
          targetField = imageFields[i];
          break;
        }
      }
      // 如果所有 IMAGE 字段都被 handle 占用了，就选第一个
      if (!targetField) targetField = imageFields[0];
      
      const imageUrl = upstreamData.images[0]!;
      try {
        const fileName = await uploadFileToRunningHub(apiKey, imageUrl, 'input', signal);
        const idx = nodeInfoList.findIndex(
          (n) => n.nodeId === targetField!.nodeId && n.fieldName === targetField!.field
        );
        if (idx >= 0) {
          nodeInfoList[idx]!.fieldValue = fileName;
        } else {
          nodeInfoList.push({ nodeId: targetField!.nodeId, fieldName: targetField!.field, fieldValue: fileName });
        }
      } catch (uploadErr) {
        throw new Error(`上传图片失败: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }
    }

    // 上游视频 → 第一个 VIDEO 字段
    if (upstreamData.videos.length > 0 && videoFields.length > 0) {
      const targetField = videoFields[0]!;
      const videoUrl = upstreamData.videos[0]!;
      try {
        const fileName = await uploadFileToRunningHub(apiKey, videoUrl, 'input', signal);
        const idx = nodeInfoList.findIndex(
          (n) => n.nodeId === targetField.nodeId && n.fieldName === targetField.field
        );
        if (idx >= 0) {
          nodeInfoList[idx]!.fieldValue = fileName;
        } else {
          nodeInfoList.push({ nodeId: targetField.nodeId, fieldName: targetField.field, fieldValue: fileName });
        }
      } catch (uploadErr) {
        throw new Error(`上传视频失败: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }
    }

    // 上游音频 → 第一个 AUDIO 字段
    if (upstreamData.audio.length > 0 && audioFields.length > 0) {
      const targetField = audioFields[0]!;
      const audioUrl = upstreamData.audio[0]!;
      try {
        const fileName = await uploadFileToRunningHub(apiKey, audioUrl, 'input', signal);
        const idx = nodeInfoList.findIndex(
          (n) => n.nodeId === targetField.nodeId && n.fieldName === targetField.field
        );
        if (idx >= 0) {
          nodeInfoList[idx]!.fieldValue = fileName;
        } else {
          nodeInfoList.push({ nodeId: targetField.nodeId, fieldName: targetField.field, fieldValue: fileName });
        }
      } catch (uploadErr) {
        throw new Error(`上传音频失败: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }
    }

    // 上游文本 → 第一个 STRING 字段
    if (upstreamData.text) {
      const stringField = parsedNodes
        .flatMap((n) =>
          Object.entries(n.inputs)
            .filter(([, fi]) => fi?.type === 'STRING')
            .map(([field]) => ({ nodeId: n.nodeId, field }))
        )[0];
      if (stringField) {
        const idx = nodeInfoList.findIndex(
          (n) => n.nodeId === stringField.nodeId && n.fieldName === stringField.field
        );
        if (idx >= 0) {
          nodeInfoList[idx]!.fieldValue = upstreamData.text;
        } else {
          nodeInfoList.push({ nodeId: stringField.nodeId, fieldName: stringField.field, fieldValue: upstreamData.text });
        }
      }
    }

    // 执行工作流
    const result = await executeRhWorkflowApi(
      apiKey,
      workflowId,
      nodeInfoList as ComfyUINodeInfo[],
      (p) => updateNodeData(node.id, { progress: p }),
      signal
    );

    // 处理返回结果
    let finalOutputUrl = result.outputUrl;
    let finalOutputUrls = result.outputUrls;

    // 判断是否为 ZIP 结果：URL 后缀 + API fileType 字段
    const isZipResult =
      result.outputUrl.endsWith('.zip') ||
      result.outputUrl.includes('.zip?') ||
      !!(result.fileTypes?.some(t => t === 'zip'));

    // ZIP 结果：直接输出 URL，由下游 rhZipNode 专责解压
    if (isZipResult) {
      updateNodeData(node.id, {
        outputUrl: finalOutputUrl,
        outputUrls: undefined,
        outputUrlTypes: undefined,
        textOutput: finalOutputUrl,
        loading: false,
        progress: 0,
      });
      return;
    }

    // 非 ZIP 结果：推断媒体类型
    const inferTypeSimple = (url: string): string => {
      const lower = url.toLowerCase();
      if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(lower)) return 'video';
      if (/\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(lower)) return 'audio';
      if (lower.includes('/view?')) return 'image';
      if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i.test(lower)) return 'image';
      return 'image';
    };

    let allUrlTypes: string[] = [];
    if (finalOutputUrls.length > 0) {
      if (result.fileTypes && result.fileTypes.length > 0) {
        allUrlTypes = result.fileTypes.map(t => t || 'image');
      } else {
        allUrlTypes = finalOutputUrls.map(url => inferTypeSimple(url));
      }
    }

    // 判断输出类型
    const effectiveOutputType = config.outputType ?? 'auto';
    const isMediaUrl =
      finalOutputUrl.startsWith('blob:') ||
      finalOutputUrl.includes('/view?') ||
      /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav)(\?|$)/i.test(finalOutputUrl);

    if (effectiveOutputType === 'text' || (!isMediaUrl && effectiveOutputType === 'auto')) {
      updateNodeData(node.id, {
        textOutput: finalOutputUrl,
        outputUrl: undefined,
        outputUrls: undefined,
        outputUrlTypes: undefined,
        loading: false,
        progress: 0,
      });
    } else {
      updateNodeData(node.id, {
        outputUrl: finalOutputUrl,
        outputUrls: finalOutputUrls.length > 0 ? finalOutputUrls : undefined,
        outputUrlTypes: allUrlTypes.length > 0 ? allUrlTypes : undefined,
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
