// Ref: §6.15 — 画布项目 CRUD + localforage 持久化
import localforage from 'localforage';
import type { Node, Edge } from '@xyflow/react';

const CANVAS_STATE_PREFIX = 'canvas-state-v1-';

// 保存画布状态到 localforage
export async function saveCanvasState(
  projectId: string,
  nodes: Node[],
  edges: Edge[],
): Promise<void> {
  const key = `${CANVAS_STATE_PREFIX}${projectId}`;
  await localforage.setItem(key, { nodes, edges, timestamp: Date.now() });
}

// 加载画布状态
export async function loadCanvasState(
  projectId: string,
): Promise<{ nodes: Node[]; edges: Edge[] } | null> {
  const key = `${CANVAS_STATE_PREFIX}${projectId}`;
  const data = await localforage.getItem<{ nodes: Node[]; edges: Edge[]; timestamp: number }>(key);
  if (!data) return null;
  return { nodes: data.nodes, edges: data.edges };
}

// 删除画布状态
export async function deleteCanvasState(projectId: string): Promise<void> {
  const key = `${CANVAS_STATE_PREFIX}${projectId}`;
  await localforage.removeItem(key);
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