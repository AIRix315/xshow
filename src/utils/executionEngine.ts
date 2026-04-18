// Ref: flowcraft workflow-engine.ts — BFS 依次运行引擎
// 沿 edge BFS, 按层 Promise.all, 失败停分支, autoSplit 子节点入队, 每层 150ms 间隔
import type { Node, Edge } from '@xyflow/react';

const LAYER_DELAY = 150; // ms 每层间隔
const MAX_CONCURRENT = 3; // 每层最大并发数

interface ExecutionCallbacks {
  executeNode: (node: Node, edges: Edge[], allNodes: Node[]) => Promise<void>;
  onNodeStart?: (nodeId: string) => void;
  onNodeComplete?: (nodeId: string) => void;
  onNodeError?: (nodeId: string, error: string) => void;
  onNodeSkipped?: (nodeId: string, reason: string) => void;
  onLayerStart?: (layerIndex: number, nodeIds: string[]) => void;
}

// BFS 拓扑分层：找出每层可并行执行的节点
export function buildLayers(nodes: Node[], edges: Edge[]): string[][] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  }

  for (const edge of edges) {
    if (edge.source !== edge.target) {
      adjList.get(edge.source)?.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  const layers: string[][] = [];
  let queue: string[] = [];

  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  while (queue.length > 0) {
    layers.push([...queue]);
    const nextQueue: string[] = [];
    for (const nodeId of queue) {
      const neighbors = adjList.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          nextQueue.push(neighbor);
        }
      }
    }
    queue = nextQueue;
  }

  return layers;
}

// 执行整个画布 — BFS 分层按层并行，支持 fail-fast
export async function executeCanvas(
  nodes: Node[],
  edges: Edge[],
  callbacks: ExecutionCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const layers = buildLayers(nodes, edges);

  // fail-fast：记录失败的节点 ID，阻止下游执行
  const failedNodeIds = new Set<string>();

  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    if (signal?.aborted) return;

    const layerIds = layers[layerIndex]!;
    const layerNodes = layerIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node => n !== undefined);

    callbacks.onLayerStart?.(layerIndex, layerIds);

    // 分块执行，每块最多 MAX_CONCURRENT 个并发
    for (let i = 0; i < layerNodes.length; i += MAX_CONCURRENT) {
      const chunk = layerNodes.slice(i, i + MAX_CONCURRENT);
      // 按块并行执行，单节点失败不影响其他节点
      await Promise.allSettled(
        chunk.map(async (node) => {
          callbacks.onNodeStart?.(node.id);
          try {
            await callbacks.executeNode(node, edges, nodes);
            callbacks.onNodeComplete?.(node.id);
          } catch (err) {
            const msg = err instanceof Error ? err.message : '执行失败';
            callbacks.onNodeError?.(node.id, msg);
            failedNodeIds.add(node.id);
            // 不 rethrow — 允许其他节点继续
          }
        }),
      );
    }

    // 层间延迟
    if (layerIndex < layers.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, LAYER_DELAY));
      if (signal?.aborted) return;

      // fail-fast：检查下层节点的直接上游是否失败
      const nextLayerIds = layers[layerIndex + 1]!;
      for (const nodeId of nextLayerIds) {
        const upstreamEdge = edges.find((e) => e.target === nodeId && failedNodeIds.has(e.source));
        if (upstreamEdge) {
          callbacks.onNodeSkipped?.(nodeId, `上游节点 ${upstreamEdge.source} 执行失败`);
          failedNodeIds.add(nodeId);
        }
      }
    }
  }
}

// 执行单个节点（从起始节点出发）
export async function executeFromNode(
  startNodeId: string,
  nodes: Node[],
  edges: Edge[],
  callbacks: ExecutionCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  // 找到从 startNodeId 可达的所有下游节点 + 自身
  const reachable = new Set<string>();
  const queue = [startNodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const edge of edges) {
      if (edge.source === current) {
        queue.push(edge.target);
      }
    }
  }

  const subNodes = nodes.filter((n) => reachable.has(n.id));
  const subEdges = edges.filter((e) => reachable.has(e.source) && reachable.has(e.target));

  return executeCanvas(subNodes, subEdges, callbacks, signal);
}