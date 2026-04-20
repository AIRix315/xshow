/**
 * Node Executor Types
 *
 * 定义节点执行上下文和执行器接口
 * 参考 node-banana 架构
 */

import type { Node, Edge } from '@xyflow/react';
import type { ConnectedInputs } from '@/utils/connectedInputs';

/**
 * 节点执行上下文
 *
 * 传递给每个节点执行器的上下文信息
 */
export interface NodeExecutionContext {
  /** 当前执行的节点 */
  node: Node;
  /** 所有节点 */
  nodes: Node[];
  /** 所有边 */
  edges: Edge[];
  /** 获取指定节点的上游输入数据 */
  getConnectedInputs: (nodeId: string) => ConnectedInputs;
  /** 更新节点数据 */
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  /** 获取最新的节点数据（非陈旧副本） */
  getFreshNode: (nodeId: string) => Node | undefined;
  /** AbortSignal 用于取消请求 */
  signal?: AbortSignal;
}

/**
 * 节点执行器函数类型
 */
export type NodeExecutor = (ctx: NodeExecutionContext) => Promise<void>;

/**
 * 节点执行器注册表
 */
export type NodeExecutorRegistry = Record<string, NodeExecutor>;