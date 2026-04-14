// Ref: §3.16 + node-banana workflowStore.ts saveToFile/loadWorkflow
// 项目文件导出/导入核心模块
// 使用 chrome.downloads API 导出 + 隐藏 <input type="file"> 导入

import type { XShowWorkflowFile, AppNode } from '@/types';
import { externalizeMedia, validateImportedNodes } from '@/utils/mediaExternalizer';
import type { Edge } from '@xyflow/react';



/** 生成新的节点 ID（避免与现有节点冲突） */
function generateNewNodeIds(nodes: AppNode[], startCounter: number): {
  nodes: AppNode[];
  newCounter: number;
} {
  let counter = startCounter;
  const idMap = new Map<string, string>();
  const newNodes = nodes.map((node) => {
    const newId = `${node.type ?? 'node'}-${++counter}`;
    idMap.set(node.id, newId);
    return { ...node, id: newId } as AppNode;
  });

  // 更新边的 source/target 引用
  return { nodes: newNodes, newCounter: counter };
}

// ============================================================================
// 导出
// ============================================================================

/**
 * 导出项目为 .xshow 文件并下载
 * @param projectId 项目 ID
 * @param projectName 项目名称
 * @param nodes 节点数据
 * @param edges 边数据
 * @param embedBase64 是否嵌入 Base64 媒体
 * @param onProgress 进度回调（用于 UI 反馈）
 * @returns 是否成功
 */
export async function exportProjectFile(
  projectId: string,
  projectName: string,
  nodes: AppNode[],
  edges: Edge[],
  embedBase64: boolean,
  onProgress?: (step: string) => void,
): Promise<boolean> {
  try {
    onProgress?.('正在处理媒体数据...');

    // Step 1: 序列化媒体（blob→base64）
    const processedNodes = await externalizeMedia(nodes, embedBase64);
    onProgress?.('正在生成文件...');

    // Step 2: 构建文件对象
    const file: XShowWorkflowFile = {
      version: 1,
      id: projectId,
      name: projectName,
      embedBase64,
      nodes: processedNodes,
      edges,
      savedAt: Date.now(),
      xshowVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.2',
    };

    const json = JSON.stringify(file, null, 2);
    const blob = new Blob([json], { type: 'application/json' });

    // Step 3: 生成安全文件名
    const safeName = projectName.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_\-\s]/g, '_').trim() || 'xshow-project';
    const filename = `${safeName}.xshow`;

    // Step 4: 使用 chrome.downloads 下载（manifest.json 已有 downloads 权限）
    if (typeof chrome !== 'undefined' && chrome.downloads) {
      const blobUrl = URL.createObjectURL(blob);
      try {
        await chrome.downloads.download({
          url: blobUrl,
          filename,
          saveAs: true,
          conflictAction: 'uniquify',
        });
      } finally {
        // 延迟释放 blob URL，避免下载开始前被回收
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      }
    } else {
      // Fallback: 直接触发 <a download>（popup/options 上下文）
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    }

    onProgress?.('导出完成');
    return true;
  } catch (err) {
    console.error('[exportProjectFile] 导出失败:', err);
    onProgress?.('导出失败');
    return false;
  }
}

// ============================================================================
// 导入
// ============================================================================

/**
 * 从用户选择的 .xshow/.json 文件导入项目
 * @param onProgress 进度回调
 * @returns 解析后的项目数据，或 null（用户取消）
 */
export async function importProjectFile(
  onProgress?: (step: string) => void,
): Promise<{
  file: XShowWorkflowFile;
  warnings: string[];
} | null> {
  return new Promise<{
    file: XShowWorkflowFile;
    warnings: string[];
  } | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xshow,.json,application/json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        onProgress?.('正在读取文件...');
        const text = await file.text();
        onProgress?.('正在解析...');

        const parsed = JSON.parse(text) as unknown;

        // 基础结构验证
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          !('version' in parsed) ||
          !('nodes' in parsed) ||
          !('edges' in parsed)
        ) {
          throw new Error('无效的项目文件格式');
        }

        const wf = parsed as XShowWorkflowFile;

        // 版本兼容性处理
        if (typeof wf.version !== 'number' || wf.version > 1) {
          throw new Error(`不支持的项目文件版本: ${wf.version}`);
        }

        // 生成新节点 ID（避免与当前画布冲突）
        onProgress?.('正在处理节点...');
        const { nodes: remappedNodes } = generateNewNodeIds(wf.nodes, 10000);

        // 验证导入数据
        const { warnings } = validateImportedNodes(remappedNodes);

        const finalFile: XShowWorkflowFile = {
          ...wf,
          nodes: remappedNodes as AppNode[],
        };

        onProgress?.('导入完成');
        resolve({ file: finalFile, warnings });
      } catch (err) {
        console.error('[importProjectFile] 导入失败:', err);
        onProgress?.(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`);
        resolve(null);
      } finally {
        input.remove();
      }
    };

    // 用户取消
    input.oncancel = () => {
      input.remove();
      resolve(null);
    };

    input.click();
  });
}

// ============================================================================
// 项目文件导入（Service Worker 专用，通过 chrome.runtime.sendMessage 调用）
// ============================================================================

/**
 * Service Worker 中使用的导入方法（通过消息传递触发前端）
 * 返回序列化后的项目数据字符串（避免跨上下文传递大数据）
 */
export async function importProjectFileForSW(): Promise<string | null> {
  return new Promise<string | null>((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xshow,.json,application/json';

    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        resolve(null);
        return;
      }

      try {
        const text = await file.text();
        // 验证格式
        const parsed = JSON.parse(text) as Record<string, unknown>;
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          !('version' in parsed) ||
          !('nodes' in parsed)
        ) {
          throw new Error('Invalid project file');
        }
        resolve(text);
      } catch {
        resolve(null);
      } finally {
        input.remove();
      }
    };

    input.oncancel = () => {
      input.remove();
      resolve(null);
    };

    input.click();
  });
}
