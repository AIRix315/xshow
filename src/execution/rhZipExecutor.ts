/**
 * ZIP Extract Node Executor
 *
 * 专门处理 ZIP 解压节点的执行
 * 支持三种输入来源：
 * - 上游节点连线传入（通过 any-input，自动检测 URL 和 text 中的 ZIP 地址）
 * - 手动粘贴 ZIP URL
 * - 本地上传 ZIP 文件
 *
 * 解压后输出标准化的媒体数据（outputUrl / outputUrls / outputUrlTypes），
 * 下游节点（图集、路由等）可直接消费。
 * 分类逻辑由专门的路由节点负责，此节点仅做解压。
 */

import type { NodeExecutionContext } from './types';
import type { RhZipNodeData } from '@/types';
import { getConnectedInputs } from '@/utils/connectedInputs';
import { extractZipContents, extractZipFromFile, revokeMediaUrls } from '@/utils/zipExtractor';

/**
 * 从上游数据中提取 ZIP URL
 * 优先级：text > images（ZIP URL 是文本链接，优先从 text 字段取）
 */
function extractZipUrlFromUpstream(
  upstreamData: ReturnType<typeof getConnectedInputs>,
): string | undefined {
  // text 字段最可能包含 ZIP URL（RH 节点 any-output 传出文本链接）
  if (upstreamData.text && typeof upstreamData.text === 'string' && upstreamData.text.trim()) {
    return upstreamData.text.trim();
  }
  // 兜底：images 中可能包含 URL
  if (upstreamData.images.length > 0 && upstreamData.images[0]) {
    return upstreamData.images[0];
  }
  return undefined;
}

/**
 * 执行 RhZipNode（画布级执行）
 */
export async function executeRhZipNode(ctx: NodeExecutionContext): Promise<void> {
  const { node, nodes, edges, updateNodeData, signal } = ctx;

  const freshNode = ctx.getFreshNode(node.id);
  const nodeData = (freshNode?.data ?? node.data) as RhZipNodeData;

  // 清理之前的 blob URLs（防止内存泄漏）
  const prevOutputUrls = nodeData.outputUrls as string[] | undefined;
  const prevOutputUrl = nodeData.outputUrl as string | undefined;
  if (prevOutputUrls) revokeMediaUrls(prevOutputUrls);
  if (prevOutputUrl?.startsWith('blob:')) revokeMediaUrls([prevOutputUrl]);

  updateNodeData(node.id, { loading: true, errorMessage: '', progress: 0 });

  try {
    // 获取上游输入 — any-input 会自动把 text/URL 汇聚到 text 和 images
    const upstreamData = getConnectedInputs(node.id, nodes, edges);

    // 确定输入来源：上游 URL 优先于本地上传
    const zipUrl = extractZipUrlFromUpstream(upstreamData) || nodeData.zipUrl;

    if (!zipUrl) {
      throw new Error('请提供 ZIP 文件（上传本地文件、粘贴 URL 或连接上游节点）');
    }

    // 执行解压
    const mediaFiles = await extractZipContents(zipUrl, signal);

    if (mediaFiles.length === 0) {
      throw new Error('ZIP 文件中未找到可识别的媒体文件');
    }

    // 输出所有媒体文件，不做分类（分类由路由节点负责）
    const allUrls = mediaFiles.map(f => f.url);
    const allUrlTypes = mediaFiles.map(f => f.type === 'unknown' ? 'image' : f.type);
    const finalOutputUrl = allUrls[0]!;
    const extractedInfo = `已提取 ${mediaFiles.length} 个文件`;

    updateNodeData(node.id, {
      outputUrl: finalOutputUrl,
      outputUrls: allUrls.length > 1 ? allUrls : undefined,
      outputUrlTypes: allUrlTypes.length > 0 ? allUrlTypes : undefined,
      textOutput: undefined,
      extractedInfo,
      loading: false,
      progress: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '解压失败';
    updateNodeData(node.id, { loading: false, errorMessage: msg, progress: 0 });
    throw err;
  }
}

/**
 * 执行 RhZipNode 本地上传解压（非画布级，由 UI 组件直接调用）
 */
export async function executeRhZipLocal(
  nodeId: string,
  file: File,
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void,
): Promise<void> {
  const { useFlowStore } = await import('@/stores/useFlowStore');
  const currentNode = useFlowStore.getState().nodes.find(n => n.id === nodeId);
  const prevData = currentNode?.data as RhZipNodeData | undefined;
  if (prevData?.outputUrls) revokeMediaUrls(prevData.outputUrls);
  if (prevData?.outputUrl?.startsWith('blob:')) revokeMediaUrls([prevData.outputUrl]);

  updateNodeData(nodeId, { loading: true, errorMessage: '', progress: 0, zipFileName: file.name });

  try {
    const mediaFiles = await extractZipFromFile(file);

    if (mediaFiles.length === 0) {
      throw new Error('ZIP 文件中未找到可识别的媒体文件');
    }

    const allUrls = mediaFiles.map(f => f.url);
    const allUrlTypes = mediaFiles.map(f => f.type === 'unknown' ? 'image' : f.type);
    const finalOutputUrl = allUrls[0]!;
    const extractedInfo = `已提取 ${mediaFiles.length} 个文件`;

    updateNodeData(nodeId, {
      outputUrl: finalOutputUrl,
      outputUrls: allUrls.length > 1 ? allUrls : undefined,
      outputUrlTypes: allUrlTypes.length > 0 ? allUrlTypes : undefined,
      textOutput: undefined,
      extractedInfo,
      loading: false,
      progress: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '解压失败';
    updateNodeData(nodeId, { loading: false, errorMessage: msg, progress: 0 });
    throw err;
  }
}