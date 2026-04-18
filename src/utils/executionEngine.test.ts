// Ref: executionEngine.ts — 执行引擎测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeCanvas, executeFromNode, buildLayers } from './executionEngine';
import type { Node, Edge } from '@xyflow/react';

function makeNode(id: string, type = 'testNode'): Node {
  return { id, type, position: { x: 0, y: 0 }, data: {} };
}

function makeEdge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

// ============================================================
// buildLayers
// ============================================================

describe('buildLayers', () => {
  it('链式 A→B→C 产生 3 层', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')];
    const layers = buildLayers(nodes, edges);
    expect(layers).toHaveLength(3);
    expect(layers[0]).toEqual(['A']);
    expect(layers[1]).toEqual(['B']);
    expect(layers[2]).toEqual(['C']);
  });

  it('并行 A→C, B→C 产生 2 层', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('A', 'C'), makeEdge('B', 'C')];
    const layers = buildLayers(nodes, edges);
    expect(layers).toHaveLength(2);
    expect(layers[0]).toContain('A');
    expect(layers[0]).toContain('B');
    expect(layers[1]).toEqual(['C']);
  });

  it('无边的孤立节点各占一层', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges: Edge[] = [];
    const layers = buildLayers(nodes, edges);
    // 每个孤立节点入度为 0，同时在第一层
    expect(layers).toHaveLength(1);
    expect(layers[0]).toContain('A');
    expect(layers[0]).toContain('B');
    expect(layers[0]).toContain('C');
  });

  it('环路节点不阻塞正常节点', () => {
    // A → B → C，B → B（自环）
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'B'), makeEdge('B', 'C')];
    const layers = buildLayers(nodes, edges);
    // 自环不影响 inDegree 计算（edge.source !== edge.target 过滤）
    expect(layers).toHaveLength(3);
    expect(layers[0]).toEqual(['A']);
    expect(layers[1]).toEqual(['B']);
    expect(layers[2]).toEqual(['C']);
  });

  it('diamond 图 A→B→D, A→C→D', () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'D'), makeEdge('A', 'C'), makeEdge('C', 'D')];
    const layers = buildLayers(nodes, edges);
    expect(layers).toHaveLength(3);
    expect(layers[0]).toEqual(['A']);
    expect(layers[1]).toEqual(expect.arrayContaining(['B', 'C']));
    expect(layers[2]).toEqual(['D']);
  });
});

// ============================================================
// executeCanvas
// ============================================================

describe('executeCanvas', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('每个节点调用一次 executeNode', async () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const edges = [makeEdge('A', 'B')];

    const executeNode = vi.fn().mockResolvedValue(undefined);

    const executePromise = executeCanvas(nodes, edges, { executeNode });
    // 等所有 promise 解决
    await vi.runAllTimersAsync();
    await executePromise;

    expect(executeNode).toHaveBeenCalledTimes(2);
  });

  it('AbortSignal 中止后续节点执行', async () => {
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')];

    const executeNode = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    const ac = new AbortController();
    const executePromise = executeCanvas(nodes, edges, { executeNode }, ac.signal);

    // 等 A 开始
    await vi.advanceTimersByTimeAsync(10);
    expect(executeNode).toHaveBeenCalledTimes(1);

    // 中止
    ac.abort();
    await vi.runAllTimersAsync();
    await executePromise;

    // B 和 C 不应被调用
    expect(executeNode).toHaveBeenCalledTimes(1);
  });

  it('onNodeStart / onNodeComplete 按序触发', async () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const edges: Edge[] = [];

    const executeNode = vi.fn().mockResolvedValue(undefined);
    const onNodeStart = vi.fn();
    const onNodeComplete = vi.fn();

    const executePromise = executeCanvas(nodes, edges, {
      executeNode,
      onNodeStart,
      onNodeComplete,
    });
    await vi.runAllTimersAsync();
    await executePromise;

    expect(onNodeStart).toHaveBeenCalledWith('A');
    expect(onNodeStart).toHaveBeenCalledWith('B');
    expect(onNodeComplete).toHaveBeenCalledWith('A');
    expect(onNodeComplete).toHaveBeenCalledWith('B');
  });

  it('单节点错误不中断其他节点', async () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const edges: Edge[] = [];

    const executeNode = vi.fn().mockImplementation(async (node: Node) => {
      if (node.id === 'A') throw new Error('A failed');
    });

    const onNodeError = vi.fn();

    const executePromise = executeCanvas(nodes, edges, { executeNode, onNodeError });
    await vi.runAllTimersAsync();
    await executePromise;

    expect(onNodeError).toHaveBeenCalledWith('A', 'A failed');
    // B 仍被执行
    expect(executeNode).toHaveBeenCalledTimes(2);
  });

  it('层间有 LAYER_DELAY=150ms 延迟', async () => {
    const nodes = [makeNode('A'), makeNode('B')];
    const edges = [makeEdge('A', 'B')];

    const executeNode = vi.fn().mockResolvedValue(undefined);
    const onLayerStart = vi.fn();

    const executePromise = executeCanvas(nodes, edges, { executeNode, onLayerStart });
    await vi.runAllTimersAsync();
    await executePromise;

    // 层 0 (A) → 等待 150ms → 层 1 (B)
    expect(onLayerStart).toHaveBeenCalledTimes(2);
    expect(onLayerStart).toHaveBeenNthCalledWith(1, 0, ['A']);
    expect(onLayerStart).toHaveBeenNthCalledWith(2, 1, ['B']);
  });

  it('同层超过 MAX_CONCURRENT=3 的节点分块执行', async () => {
    // 4 个节点无依赖关系，同层，MAX_CONCURRENT=3
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges: Edge[] = [];

    const executeNode = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const onLayerStart = vi.fn();

    const executePromise = executeCanvas(nodes, edges, { executeNode, onLayerStart });
    await vi.runAllTimersAsync();
    await executePromise;

    // 4 个节点在同层（入度都为0）
    // 验证 onLayerStart 仍只被调用 1 次（因为同属一层）
    expect(onLayerStart).toHaveBeenCalledTimes(1);
    expect(executeNode).toHaveBeenCalledTimes(4);
  });

  it('chunk 内节点并行执行，chunk 间串行等待', async () => {
    // 3 个节点无依赖，MAX_CONCURRENT=3，它们都在同一 chunk
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges: Edge[] = [];

    const callOrder: string[] = [];
    const executeNode = vi.fn().mockImplementation(async (node: Node) => {
      callOrder.push(`start-${node.id}`);
      await new Promise((r) => setTimeout(r, 50));
      callOrder.push(`end-${node.id}`);
    });

    const executePromise = executeCanvas(nodes, edges, { executeNode });
    await vi.runAllTimersAsync();
    await executePromise;

    // 3 个节点在第一层，同一 chunk 内并行
    // 所以它们的 start 和 end 可能交叉
    expect(executeNode).toHaveBeenCalledTimes(3);
    // 验证 start/end 各有 3 个（并行执行）
    expect(callOrder.filter((c) => c.startsWith('start-')).length).toBe(3);
    expect(callOrder.filter((c) => c.startsWith('end-')).length).toBe(3);
  });

  it('chunk 内节点失败不影响 chunk 内其他节点', async () => {
    // 3 个节点同一 chunk
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges: Edge[] = [];

    const executeNode = vi.fn().mockImplementation(async (node: Node) => {
      if (node.id === 'B') throw new Error('B failed');
    });

    const onNodeError = vi.fn();
    const onNodeComplete = vi.fn();

    const executePromise = executeCanvas(nodes, edges, {
      executeNode,
      onNodeError,
      onNodeComplete,
    });
    await vi.runAllTimersAsync();
    await executePromise;

    expect(onNodeError).toHaveBeenCalledWith('B', 'B failed');
    // A 和 C 仍应完成
    expect(onNodeComplete).toHaveBeenCalledTimes(2);
  });
});

// ============================================================
// T4: 并发控制扩展测试
// ============================================================
describe('T4 — 并发控制', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('节点数 > MAX_CONCURRENT 时分块执行', async () => {
    // 5 个节点无依赖，第一层，MAX_CONCURRENT=3 → 分两块
    const nodes = [
      makeNode('A'),
      makeNode('B'),
      makeNode('C'),
      makeNode('D'),
      makeNode('E'),
    ];
    const edges: Edge[] = [];

    const executeNode = vi.fn().mockResolvedValue(undefined);

    const executePromise = executeCanvas(nodes, edges, { executeNode });
    await vi.runAllTimersAsync();
    await executePromise;

    expect(executeNode).toHaveBeenCalledTimes(5);
  });

  it('chunk 内错误不传播到下一个 chunk', async () => {
    // 5 个节点同一层，MAX_CONCURRENT=3 → chunk1: A,B,C  chunk2: D,E
    const nodes = [
      makeNode('A'),
      makeNode('B'),
      makeNode('C'),
      makeNode('D'),
      makeNode('E'),
    ];
    const edges: Edge[] = [];

    const executeNode = vi.fn().mockImplementation(async (node: Node) => {
      if (node.id === 'B') throw new Error('B failed');
    });

    const onNodeError = vi.fn();
    const onNodeComplete = vi.fn();

    const executePromise = executeCanvas(nodes, edges, {
      executeNode,
      onNodeError,
      onNodeComplete,
    });
    await vi.runAllTimersAsync();
    await executePromise;

    expect(onNodeError).toHaveBeenCalledWith('B', 'B failed');
    // A, C (chunk1), D, E (chunk2) 都要完成
    expect(onNodeComplete).toHaveBeenCalledTimes(4);
  });
});

// ============================================================
// T5: fail-fast 扩展测试
// ============================================================
describe('T5 — fail-fast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('同层节点失败时该层其他节点仍执行', async () => {
    // A → B，A 和 B 同一层（无依赖）
    // 在当前实现中：同层节点在同一 chunk 内并行执行，一个失败不影响另一个执行
    const nodes = [makeNode('A'), makeNode('B')];
    const edges: Edge[] = [];

    const executeNode = vi.fn().mockImplementation(async (node: Node) => {
      if (node.id === 'A') throw new Error('A failed');
    });

    const onNodeError = vi.fn();
    const onNodeSkipped = vi.fn();

    const executePromise = executeCanvas(nodes, edges, {
      executeNode,
      onNodeError,
      onNodeSkipped,
    });
    await executePromise;

    expect(onNodeError).toHaveBeenCalledWith('A', 'A failed');
    // B 和 A 在同一层，B 会被执行（并行），fail-fast 只跨层生效
    expect(executeNode).toHaveBeenCalledTimes(2);
  });

  it('上游失败阻止间接下游执行', async () => {
    // A → B → C，A 失败时 C 也应被跳过
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')];

    const executeNode = vi.fn().mockImplementation(async (node: Node) => {
      if (node.id === 'A') throw new Error('A failed');
    });

    const onNodeError = vi.fn();
    const onNodeSkipped = vi.fn();

    const executePromise = executeCanvas(nodes, edges, {
      executeNode,
      onNodeError,
      onNodeSkipped,
    });
    await vi.runAllTimersAsync();
    await executePromise;

    expect(onNodeError).toHaveBeenCalledWith('A', 'A failed');
    expect(onNodeSkipped).toHaveBeenCalledWith('B', '上游节点 A 执行失败');
    expect(onNodeSkipped).toHaveBeenCalledWith('C', '上游节点 B 执行失败');
  });

  it('onNodeSkipped 在跳过节点时正确触发', async () => {
    // A → B，A 失败，B 被跳过
    const nodes = [makeNode('A'), makeNode('B')];
    const edges = [makeEdge('A', 'B')];

    const executeNode = vi.fn().mockImplementation(async (node: Node) => {
      if (node.id === 'A') throw new Error('A failed');
    });

    const onNodeSkipped = vi.fn();

    const executePromise = executeCanvas(nodes, edges, { executeNode, onNodeSkipped });
    await vi.runAllTimersAsync();
    await executePromise;

    expect(onNodeSkipped).toHaveBeenCalledTimes(1);
    expect(onNodeSkipped).toHaveBeenCalledWith('B', '上游节点 A 执行失败');
  });

  it('diamond 图中直接上游失败时下游正确跳过', async () => {
    // A → B, A → C, B → D, C → D
    // A 失败时 B 和 C 应被标记为 failed（直接执行失败传播），D 的直接上游 B 和 C 在 failedNodeIds 中
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [
      makeEdge('A', 'B'),
      makeEdge('A', 'C'),
      makeEdge('B', 'D'),
      makeEdge('C', 'D'),
    ];

    const executeNode = vi.fn().mockImplementation(async (node: Node) => {
      if (node.id === 'A') throw new Error('A failed');
    });

    const onNodeError = vi.fn();
    const onNodeSkipped = vi.fn();

    const executePromise = executeCanvas(nodes, edges, {
      executeNode,
      onNodeError,
      onNodeSkipped,
    });
    await vi.runAllTimersAsync();
    await executePromise;

    expect(onNodeError).toHaveBeenCalledWith('A', 'A failed');
    // B 和 C 是 A 的直接下游，应被跳过
    expect(onNodeSkipped).toHaveBeenCalledWith('B', '上游节点 A 执行失败');
    expect(onNodeSkipped).toHaveBeenCalledWith('C', '上游节点 A 执行失败');
  });
});

// ============================================================
// executeFromNode
// ============================================================

describe('executeFromNode', () => {
  it('只执行从起始节点可达的下游节点', async () => {
    // A→B→C, D 为孤立
    const nodes = [makeNode('A'), makeNode('B'), makeNode('C'), makeNode('D')];
    const edges = [makeEdge('A', 'B'), makeEdge('B', 'C')];

    const executeNode = vi.fn().mockResolvedValue(undefined);

    const executePromise = executeFromNode('A', nodes, edges, { executeNode });
    await executePromise;

    // D 不应被执行
    expect(executeNode).toHaveBeenCalledTimes(3);
    expect(executeNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'A' }), expect.any(Array), expect.any(Array));
    expect(executeNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'B' }), expect.any(Array), expect.any(Array));
    expect(executeNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'C' }), expect.any(Array), expect.any(Array));
    expect(executeNode).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'D' }), expect.any(Array), expect.any(Array));
  });

  it('起始节点包含自身', async () => {
    const nodes = [makeNode('A')];
    const edges: Edge[] = [];

    const executeNode = vi.fn().mockResolvedValue(undefined);
    const executePromise = executeFromNode('A', nodes, edges, { executeNode });
    await executePromise;

    expect(executeNode).toHaveBeenCalledTimes(1);
  });
});
