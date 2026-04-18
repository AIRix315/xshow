// Ref: node-banana mediaStorage.ts — 媒体数据序列化
// Ref: 节点媒体字段规范
// 负责将节点数据中的 blob/http URL 转换为可序列化的 base64 data URL
// 以及在导出前移除不可 JSON 序列化的回调函数

import type { AppNode } from '@/types';

// ============================================================================
// 工具函数
// ============================================================================

/** 将 URL 转换为 base64 data URL（支持 blob: 和 http(s):） */
async function urlToBase64(url: string): Promise<string> {
  if (!url || url.startsWith('data:')) return url;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error(`Failed to read blob for URL: ${url}`));
      reader.readAsDataURL(blob);
    });
  } catch {
    // 无法转换时保留原 URL（导出后链接会断开，用户需知悉）
    return url;
  }
}

/** 节点中可能含媒体 URL 的字段路径（字段名 → 是否为数组） */
type MediaField = { path: string; isArray: boolean };
const MEDIA_FIELDS: MediaField[] = [
  { path: 'imageUrl', isArray: false },
  { path: 'videoUrl', isArray: false },
  { path: 'thumbnailUrl', isArray: false },
  { path: 'audioUrl', isArray: false },
  { path: 'audioName', isArray: false },
  { path: 'mergedImageUrl', isArray: false },
  { path: 'sourceImageUrl', isArray: false },
  { path: 'outputUrl', isArray: false },
  { path: 'modelUrl', isArray: false },
  { path: 'inputImageUrl', isArray: false },
  { path: 'inputVideoUrl', isArray: false },
  { path: 'inputAudioUrl', isArray: false },
  { path: 'resultImageUrl', isArray: false },
  { path: 'outputUrls', isArray: true },
  { path: 'videoUrls', isArray: true },
  { path: 'items', isArray: true },        // OutputGalleryNode items[].url
];

/** 深度获取对象属性 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/** 深度设置对象属性 */
function setNestedValue(obj: unknown, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]!;
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]!] = value;
}

/** 移除节点数据中的回调函数（onGenerate、onCrop 等不可序列化） */
function stripCallbacks(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'function') continue;
    // 移除生成历史数据（纯内存，不跨会话保留）
    if (key === 'imageHistory' || key === 'videoHistory' || key === 'selectedHistoryIndex' || key === 'selectedVideoHistoryIndex') continue;
    if (value && typeof value === 'object') {
      // 递归清理嵌套对象
      result[key] = stripCallbacks(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ============================================================================
// 主函数
// ============================================================================

/**
 * 导出前处理节点：将媒体 URL 转换为 base64（可 JSON 序列化）
 * - data: URL → 保持原样
 * - blob: URL → fetch → base64
 * - http(s): URL → fetch → base64（跨域可能失败，失败时保留原 URL）
 * - embedBase64=false 时：仅移除回调，保留 URL 原样
 */
export async function externalizeMedia(
  nodes: AppNode[],
  embedBase64: boolean,
): Promise<AppNode[]> {
  if (!embedBase64) {
    // 不嵌入时只移除回调，保留 URL
    return nodes.map((node) => ({
      ...node,
      data: stripCallbacks(node.data as Record<string, unknown>),
    })) as AppNode[];
  }

  const results: AppNode[] = [];
  for (const node of nodes) {
    const data = { ...node.data } as Record<string, unknown>;
    const cleaned = stripCallbacks(data);

    // 逐字段处理媒体 URL
    for (const field of MEDIA_FIELDS) {
      const value = getNestedValue(cleaned, field.path);
      if (value === undefined || value === null) continue;

      if (field.isArray && Array.isArray(value)) {
        const processed = await Promise.all(
          (value as Array<{ url?: string } | string>).map(async (item) => {
            if (typeof item === 'string') {
              const converted = await urlToBase64(item);
              return converted;
            }
            if (item && typeof item === 'object' && 'url' in item) {
              const converted = await urlToBase64((item as { url: string }).url);
              return { ...item, url: converted } as { url: string };
            }
            return item;
          })
        );
        setNestedValue(cleaned, field.path, processed);
      } else if (typeof value === 'string') {
        const converted = await urlToBase64(value);
        setNestedValue(cleaned, field.path, converted);
      }
    }

    results.push({ ...node, data: cleaned } as AppNode);
  }

  return results;
}

/**
 * 导入后处理：验证节点数据中是否有断开的 http(s) 媒体 URL
 * （blob URL 在导入后无法使用，导出会话结束后 blob 自动失效）
 * 目前仅做标记，不做额外处理（用户需知悉 blob URL 会丢失）
 */
export function validateImportedNodes(nodes: AppNode[]): {
  validNodes: AppNode[];
  warnings: string[];
} {
  const warnings: string[] = [];
  let hasBlobUrls = false;

  for (const node of nodes) {
    const data = node.data as Record<string, unknown>;
    for (const field of MEDIA_FIELDS) {
      const value = getNestedValue(data, field.path);
      if (value === undefined || value === null) continue;

      if (field.isArray && Array.isArray(value)) {
        for (const item of value as string[]) {
          if (typeof item === 'string' && item.startsWith('blob:')) {
            hasBlobUrls = true;
          }
        }
      } else if (typeof value === 'string' && value.startsWith('blob:')) {
        hasBlobUrls = true;
      }
    }
  }

  if (hasBlobUrls) {
    warnings.push(
      '检测到 blob URL（内存中的图片/视频），这些资源无法在导入后保留。' +
      '建议导出前先将资源保存到本地。'
    );
  }

  return { validNodes: nodes, warnings };
}
