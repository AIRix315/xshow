// Ref: §6.15 — 画布项目 CRUD + localforage 持久化
import localforage from 'localforage';
import type { Node, Edge } from '@xyflow/react';

const CANVAS_STATE_PREFIX = 'canvas-state-v1-';

// =============================================================================
// 节点类型迁移映射（旧名 → 新名）
// =============================================================================

/** 旧节点类型名到新类型名的映射表，用于加载旧版画布数据时自动迁移 */
const NODE_TYPE_MIGRATIONS: Record<string, string> = {
  universalNode: 'omniNode',
};

/** 对节点数组执行类型名迁移，将不存在的旧类型名替换为当前有效类型名 */
function migrateNodeTypes(nodes: Node[]): Node[] {
  return nodes.map((node) => {
    const newType = NODE_TYPE_MIGRATIONS[node.type ?? ''];
    if (newType) {
      return { ...node, type: newType };
    }
    return node;
  });
}

// =============================================================================
// 画布状态 CRUD
// =============================================================================

// 保存画布状态到 localforage
export async function saveCanvasState(
  projectId: string,
  nodes: Node[],
  edges: Edge[],
): Promise<void> {
  const key = `${CANVAS_STATE_PREFIX}${projectId}`;
  await localforage.setItem(key, { nodes, edges, timestamp: Date.now() });
}

// 加载画布状态（自动迁移旧节点类型名）
export async function loadCanvasState(
  projectId: string,
): Promise<{ nodes: Node[]; edges: Edge[] } | null> {
  const key = `${CANVAS_STATE_PREFIX}${projectId}`;
  const data = await localforage.getItem<{ nodes: Node[]; edges: Edge[]; timestamp: number }>(key);
  if (!data) return null;
  // 去重：防止旧数据损坏导致重复ID
  const seenNodeIds = new Set<string>();
  const uniqueNodes = migrateNodeTypes(data.nodes).filter((n) => {
    if (seenNodeIds.has(n.id)) return false;
    seenNodeIds.add(n.id);
    return true;
  });
  const seenEdgeIds = new Set<string>();
  const uniqueEdges = data.edges.filter((e) => {
    if (seenEdgeIds.has(e.id)) return false;
    seenEdgeIds.add(e.id);
    return true;
  });
  return { nodes: uniqueNodes, edges: uniqueEdges };
}

// 删除画布状态
export async function deleteCanvasState(projectId: string): Promise<void> {
  const key = `${CANVAS_STATE_PREFIX}${projectId}`;
  await localforage.removeItem(key);
}

// 清除所有画布缓存数据
export async function clearAllCanvasStates(): Promise<number> {
  const keysToRemove: string[] = [];
  await localforage.iterate((_value, key) => {
    if (key.startsWith(CANVAS_STATE_PREFIX)) {
      keysToRemove.push(key);
    }
  });
  for (const key of keysToRemove) {
    await localforage.removeItem(key);
  }
  return keysToRemove.length;
}

// 列出所有画布状态 key（用于调试）
export async function listCanvasStateKeys(): Promise<string[]> {
  const keys: string[] = [];
  await localforage.iterate((_value, key) => {
    if (key.startsWith(CANVAS_STATE_PREFIX)) {
      keys.push(key);
    }
  });
  return keys;
}