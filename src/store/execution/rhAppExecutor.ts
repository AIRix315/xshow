/**
 * RunningHub APP Node Executor
 *
 * 专门处理 RunningHub APP（快捷创作）的执行
 * 用于画布级执行（通过 nodeExecutors 注册表调用）
 *
 * 设计规则：
 * - any-input: 智能映射 text→STRING, image→第一个IMAGE, video→第一个VIDEO, audio→第一个AUDIO
 * - image-N handles: 超过2个IMAGE字段时，多出的每个字段单独暴露一个image handle
 * - 上游媒体文件需要通过 uploadFileToRunningHub 上传到 RH 平台
 * - 响应可能是 ZIP 包，需要解压处理
 */

import type { NodeExecutionContext } from './types';
import type { RhAppNodeConfig } from '@/types';
import { getConnectedInputs, getInputsByHandle } from '@/utils/connectedInputs';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { executeRhAppApi, uploadFileToRunningHub } from '@/api/rhApi';
import type { RhNodeInfo } from '@/api/rhApi';
import { extractZipContents, classifyMedia, revokeMediaUrls } from '@/utils/zipExtractor';

/**
 * 执行 RhAppNode（画布级执行）
 */
export async function executeRhAppNode(ctx: NodeExecutionContext): Promise<void> {
  const { node, nodes, edges, updateNodeData, signal } = ctx;

  const freshNode = ctx.getFreshNode(node.id);
  const nodeData = freshNode?.data ?? node.data;
  const config = nodeData.config as RhAppNodeConfig;

  if (!config) {
    throw new Error('RH APP 节点配置缺失');
  }

  const appId = config.appId;
  if (!appId) {
    throw new Error('请选择 RunningHub APP');
  }

  // 清理之前的 blob URLs（防止内存泄漏）
  const prevOutputUrls = nodeData.outputUrls as string[] | undefined;
  const prevOutputUrl = nodeData.outputUrl as string | undefined;
  if (prevOutputUrls) revokeMediaUrls(prevOutputUrls);
  if (prevOutputUrl?.startsWith('blob:')) revokeMediaUrls([prevOutputUrl]);

  // 获取上游输入（any-input 智能映射）
  const upstreamData = getConnectedInputs(node.id, nodes, edges);
  // 获取按 handle 分类的上游数据（image-0, image-1 等）
  const inputsByHandle = getInputsByHandle(node.id, nodes, edges);

  // 构建 nodeInfoList（深拷贝，不修改原始配置）
  const nodeInfoList: RhNodeInfo[] = config.nodeInfoList
    ? config.nodeInfoList.map(n => ({ ...n }))
    : [];

  const apiKey = useSettingsStore.getState().comfyuiConfig.runninghubApiKey;
  if (!apiKey) {
    throw new Error('请先在设置中配置 RunningHub API Key');
  }

  // ─── Step 1: 按 handle 精确映射上游图片到 IMAGE 字段 ───
  const imageFields = nodeInfoList.filter(n => n.fieldType === 'IMAGE');
  for (const [handleId, images] of Object.entries(inputsByHandle)) {
    if (!handleId.startsWith('image-')) continue;
    const handleIndex = parseInt(handleId.replace('image-', ''), 10);
    const targetField = imageFields[handleIndex];
    if (!targetField) continue;

    for (const imageUrl of images) {
      try {
        const fileName = await uploadFileToRunningHub(apiKey, imageUrl, 'input', signal);
        targetField.fieldValue = fileName;
      } catch (uploadErr) {
        throw new Error(`上传图片失败: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }
    }
  }

  // ─── Step 2: any-input 智能映射 ───
  // 文本 → 第一个 STRING 字段
  if (upstreamData.text) {
    const stringField = nodeInfoList.find(n => n.fieldType === 'STRING');
    if (stringField) stringField.fieldValue = upstreamData.text;
  }

  // 上游非 handle 指定的图片 → 第一个未被 handle 占用的 IMAGE 字段
  if (upstreamData.images.length > 0) {
    const handleUsedIndices = new Set(
      Object.keys(inputsByHandle)
        .filter(k => k.startsWith('image-'))
        .map(k => parseInt(k.replace('image-', ''), 10))
    );
    // 找到第一个未被 handle 占用的 IMAGE 字段
    const unusedImageField = imageFields.find((_, idx) => !handleUsedIndices.has(idx));
    if (unusedImageField && !inputsByHandle['image-0']) {
      // 只在没有专门的 image handle 时自动映射
      const imageUrl = upstreamData.images[0]!;
      try {
        const fileName = await uploadFileToRunningHub(apiKey, imageUrl, 'input', signal);
        unusedImageField.fieldValue = fileName;
      } catch (uploadErr) {
        throw new Error(`上传图片失败: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }
    }
  }

  // 上游视频 → 第一个 VIDEO 字段
  if (upstreamData.videos.length > 0) {
    const videoField = nodeInfoList.find(n => n.fieldType === 'VIDEO');
    if (videoField) {
      try {
        const fileName = await uploadFileToRunningHub(apiKey, upstreamData.videos[0]!, 'input', signal);
        videoField.fieldValue = fileName;
      } catch (uploadErr) {
        throw new Error(`上传视频失败: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }
    }
  }

  // 上游音频 → 第一个 AUDIO 字段
  if (upstreamData.audio.length > 0) {
    const audioField = nodeInfoList.find(n => n.fieldType === 'AUDIO');
    if (audioField) {
      try {
        const fileName = await uploadFileToRunningHub(apiKey, upstreamData.audio[0]!, 'input', signal);
        audioField.fieldValue = fileName;
      } catch (uploadErr) {
        throw new Error(`上传音频失败: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
      }
    }
  }

  updateNodeData(node.id, { loading: true, errorMessage: '', progress: 0 });

  try {
    const result = await executeRhAppApi(
      apiKey,
      appId,
      nodeInfoList,
      (p) => updateNodeData(node.id, { progress: p }),
      signal
    );

    // 处理返回结果（可能是 ZIP）
    let finalOutputUrl = result.outputUrl;
    let finalOutputUrls = result.outputUrls;

    // 检查是否是 ZIP 文件
    if (finalOutputUrl.endsWith('.zip') || finalOutputUrl.includes('.zip?')) {
      try {
        const mediaFiles = await extractZipContents(finalOutputUrl, signal);
        const classified = classifyMedia(mediaFiles);
        const allUrls: string[] = [
          ...classified.images.map(f => f.url),
          ...classified.videos.map(f => f.url),
          ...classified.audio.map(f => f.url),
        ];
        if (allUrls.length > 0) {
          finalOutputUrl = allUrls[0]!;
          finalOutputUrls = allUrls;
        }
      } catch (extractErr) {
        console.warn('[RhAppExecutor] ZIP 解压失败，使用原始 URL:', extractErr);
      }
    }

    // 判断输出类型
    const effectiveOutputType = config.outputType ?? 'auto';
    const isMediaUrl =
      finalOutputUrl.includes('/view?') ||
      /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav)(\?|$)/i.test(finalOutputUrl);

    if (effectiveOutputType === 'text' || (!isMediaUrl && effectiveOutputType === 'auto')) {
      updateNodeData(node.id, {
        textOutput: finalOutputUrl,
        outputUrl: undefined,
        outputUrls: undefined,
        loading: false,
        progress: 0,
      });
    } else {
      updateNodeData(node.id, {
        outputUrl: finalOutputUrl,
        outputUrls: finalOutputUrls.length > 1 ? finalOutputUrls : undefined,
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