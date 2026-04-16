// 项目文件管理模块
// 项目存储在 {设置目录}/projects/{项目名}/ 下

import { fsManager } from './fileSystemAccess';
import type { XShowWorkflowFile } from '@/types';
import type { AppNode } from '@/types';
import type { Edge } from '@xyflow/react';

// ============================================================================
// 工具
// ============================================================================

/** 生成安全的文件夹名（去除不合法字符） */
function safeFolderName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'project';
}

/** 根据 blob 内容生成稳定文件名（内容相同则文件名相同，自然去重） */
async function generateMediaFilenameFromBlob(blob: Blob, url: string): Promise<string> {
  // 从 URL 或 MIME 提取扩展名
  const mimeMatch = url.match(/^data:([^;]+);/);
  const mime = (mimeMatch?.[1] ?? blob.type) || 'application/octet-stream';
  const ext = (mime.split('/')[1]?.toLowerCase()) ?? 'bin';
  // 用内容哈希作为文件名，同一内容永远生成相同文件名
  const hashBuffer = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
  return `media_${hashHex}.${ext}`;
}

/** data:base64 或 blob: URL → Blob（用于保存到文件） */
async function urlToBlob(url: string): Promise<Blob | null> {
  try {
    if (url.startsWith('data:')) {
      // data:image/jpeg;base64,... → fetch 不支持，需要手动解析
      const match = url.match(/^data:([^;]+);base64,(.+)$/);
      if (!match || !match[1] || !match[2]) return null;
      const mimeType = match[1];
      const base64 = match[2];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mimeType });
    } else if (url.startsWith('blob:')) {
      const response = await fetch(url);
      return response.blob();
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// 媒体文件保存与恢复
// ============================================================================

/**
 * 递归扫描节点数据，将 blob URL 保存为文件，替换为相对路径
 * 返回新的节点数据（不修改原数据）
 */
async function saveMediaAndReplaceUrls(
  nodes: AppNode[],
  projectName: string,
): Promise<{ nodes: AppNode[]; savedCount: number }> {
  let savedCount = 0;

  const newNodes = await Promise.all(
    nodes.map(async (node) => {
      const newData = await replaceBlobUrlsRecursive(node.data, projectName, () => {
        savedCount++;
      });
      return { ...node, data: newData };
    }),
  ) as AppNode[];

  return { nodes: newNodes, savedCount };
}

/**
 * 递归遍历对象，将 blob: URL 或 data:base64 URL 保存为文件，替换为相对路径
 */
async function replaceBlobUrlsRecursive(
  obj: unknown,
  projectName: string,
  onSave: () => void,
): Promise<unknown> {
  if (typeof obj !== 'object' || obj === null) return obj;

  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => replaceBlobUrlsRecursive(item, projectName, onSave)));
  }

  const newObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'string') {
      if (value.startsWith('blob:') || value.startsWith('data:')) {
        // blob: 或 data:base64 → 保存为文件
        try {
          const blob = await urlToBlob(value);
          if (blob) {
            const filename = await generateMediaFilenameFromBlob(blob, value);
            const savedPath = await fsManager.saveMediaToProject(projectName, blob, filename);
            if (savedPath) {
              newObj[key] = savedPath; // 替换为相对路径
              onSave();
              continue;
            }
          }
          newObj[key] = value; // 保存失败，保留原值
        } catch {
          newObj[key] = value; // 出错，保留原值
        }
      } else {
        // 普通字符串直接保留
        newObj[key] = value;
      }
    } else {
      newObj[key] = await replaceBlobUrlsRecursive(value, projectName, onSave);
    }
  }
  return newObj;
}

/**
 * 递归遍历节点数据，将相对路径文件名还原为 blob URL
 */
async function restoreBlobUrlsRecursive(
  obj: unknown,
  projectName: string,
): Promise<unknown> {
  if (typeof obj !== 'object' || obj === null) return obj;

  if (Array.isArray(obj)) {
    return Promise.all(obj.map((item) => restoreBlobUrlsRecursive(item, projectName)));
  }

  const newObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof value === 'string') {
      // 值是字符串且不是 URL 协议开头 → 认为是相对路径，尝试还原为 blob URL
      if (
        !value.startsWith('data:') &&
        !value.startsWith('http:') &&
        !value.startsWith('https:') &&
        !value.startsWith('blob:')
      ) {
        const blobUrl = await fsManager.loadMediaAsBlobUrl(projectName, value);
        newObj[key] = blobUrl ?? value; // 还原失败则保留原值
      } else {
        newObj[key] = value;
      }
    } else {
      newObj[key] = await restoreBlobUrlsRecursive(value, projectName);
    }
  }
  return newObj;
}

// ============================================================================
// 项目保存
// ============================================================================

/**
 * 保存项目到文件系统
 * - 收集节点中的 blob URL，复制到项目目录，节点数据中替换为相对路径
 * - 写入 workflow.xshow（含相对路径）
 * - 如 embedBase64=true，额外写入一份含 base64 的导出文件
 * @returns 是否成功
 */
export async function saveProjectWithPatch(
  projectId: string,
  projectName: string,
  nodes: AppNode[],
  edges: Edge[],
  embedBase64: boolean,
): Promise<boolean> {
  const safeName = safeFolderName(projectName);

  // 1. 保存媒体文件到项目目录，节点数据中 blob URL → 相对路径
  const { nodes: processedNodes } = await saveMediaAndReplaceUrls(nodes, projectName);

  // 2. 构建项目文件
  const file: XShowWorkflowFile = {
    version: 1,
    id: projectId,
    name: projectName,
    embedBase64,
    nodes: processedNodes,
    edges,
    savedAt: Date.now(),
    xshowVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.8',
  };

  const json = JSON.stringify(file, null, 2);

  // 3. 保存 workflow.xshow（含相对路径媒体引用）
  const result = await fsManager.saveProject(safeName, json, false);
  if (!result.success) {
    console.error(`[projectManager] 保存项目失败: ${result.error}`);
    return false;
  }

  // 4. 如开启 base64，额外写入一份含 base64 的导出文件
  if (embedBase64) {
    // 构建含 base64 媒体的项目文件（不重新处理，直接用原 nodes）
    const base64File: XShowWorkflowFile = {
      ...file,
      nodes, // 用原始 nodes（含 blob URL，导出工具会处理 base64 转换）
      embedBase64: true,
    };
    const base64Json = JSON.stringify(base64File, null, 2);
    await fsManager.saveProject(safeName, base64Json, true);
  }

  console.log(`[projectManager] 保存项目成功: ${safeName}`);
  return true;
}

/**
 * 重置项目的基准状态（手动保存后调用）
 */
export function resetBaseState(_projectId: string): void {
  // 现在每次保存都是完整保存，不需要重置基准
}

// ============================================================================
// 项目加载
// ============================================================================

/**
 * 从文件系统加载项目
 * @returns 项目数据或 null
 */
export async function loadProjectFromFs(
  projectName: string,
): Promise<{ file: XShowWorkflowFile; warnings: string[] } | null> {
  const safeName = safeFolderName(projectName);
  const result = await fsManager.loadProject(safeName);

  if (!result.success || !result.data) {
    return null;
  }

  try {
    const file = JSON.parse(result.data.json) as XShowWorkflowFile;

    // hasMedia=false：说明媒体文件在项目目录，需要还原 blob URL
    if (!result.data.hasMedia) {
      const restoredNodes = await Promise.all(
        file.nodes.map((node) =>
          restoreBlobUrlsRecursive(node.data, safeName),
        ),
      );
      return { file: { ...file, nodes: restoredNodes as AppNode[] }, warnings: [] };
    }

    return { file, warnings: [] };
  } catch (err) {
    console.error('[projectManager] 解析项目文件失败:', err);
    return null;
  }
}

// ============================================================================
// 项目列表
// ============================================================================

/**
 * 获取所有项目列表
 * @returns 项目名称列表
 */
export async function listProjectsFromFs(): Promise<string[]> {
  return fsManager.listProjects();
}

// ============================================================================
// 项目删除
// ============================================================================

/**
 * 删除项目
 * @param projectName 项目名称
 * @returns 是否成功
 */
export async function deleteProjectFromFs(projectName: string): Promise<boolean> {
  const safeName = safeFolderName(projectName);
  const result = await fsManager.deleteProject(safeName);
  return result.success;
}

// ============================================================================
// 项目是否存在
// ============================================================================

/**
 * 检查项目是否存在
 * @param projectName 项目名称
 */
export async function projectExistsInFs(projectName: string): Promise<boolean> {
  const safeName = safeFolderName(projectName);
  return fsManager.projectExists(safeName);
}
