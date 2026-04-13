// Ref: node-banana connectedInputs.ts — 核心数据流函数
// 从上游节点提取数据，统一类型映射

import type { Node, Edge } from '@xyflow/react';
import type { UniversalNodeData } from '@/types';

/**
 * 连接输入数据结构
 * 从上游节点收集的所有输入数据
 */
export interface ConnectedInputs {
  images: string[];
  videos: string[];
  audio: string[];
  text: string | null;
  textItems: string[];
  model3d: string | null;
}

/**
 * 判断 Handle 是否为图片类型
 */
function isImageHandle(handleId: string | null | undefined): boolean {
  if (!handleId) return false;
  return (
    handleId === 'image' ||
    handleId.startsWith('image-') ||
    handleId.includes('frame') ||
    handleId === 'source-image' ||
    handleId === 'cropped-image' ||
    handleId.startsWith('cell-')
  );
}

/**
 * 判断 Handle 是否为文本类型
 */
function isTextHandle(handleId: string | null | undefined): boolean {
  if (!handleId) return false;
  return handleId === 'text' || handleId.startsWith('text-') || handleId.includes('prompt');
}

/**
 * 判断 Handle 是否为视频类型
 */
export function isVideoHandle(handleId: string | null | undefined): boolean {
  if (!handleId) return false;
  return handleId === 'video' || handleId.startsWith('video-');
}

/**
 * 判断 Handle 是否为音频类型
 */
export function isAudioHandle(handleId: string | null | undefined): boolean {
  if (!handleId) return false;
  return handleId === 'audio' || handleId.startsWith('audio-');
}

/**
 * 从源节点提取输出数据和类型
 * 统一映射各节点类型的输出字段
 */
function getSourceOutput(
  sourceNode: Node,
  _sourceHandle?: string | null
): { type: 'image' | 'video' | 'audio' | 'text' | '3d'; value: string | null } {
  const data = sourceNode.data as Record<string, unknown>;
  const nodeType = sourceNode.type;

  switch (nodeType) {
    // 输入节点
    case 'imageInputNode':
      return { type: 'image', value: (data.imageUrl as string) || null };
    case 'videoInputNode':
      return { type: 'video', value: (data.videoUrl as string) || null };
    case 'textInputNode':
      return { type: 'text', value: (data.text as string) || null };

    // 生成节点
    case 'imageNode':
    case 'promptNode':
      return { type: 'image', value: (data.imageUrl as string) || null };
    case 'videoNode':
      return { type: 'video', value: (data.videoUrl as string) || null };
    case 'audioNode':
    case 'generateAudioNode':
      return { type: 'audio', value: (data.audioUrl as string) || null };
    case 'textNode':
      return { type: 'text', value: (data.text as string) || null };

    // 处理节点
    case 'cropNode':
      return { type: 'image', value: (data.croppedImageUrl as string) || null };
    case 'annotateNode':
      return { type: 'image', value: (data.outputImageUrl as string) || null };
    case 'frameGrabNode':
      return { type: 'image', value: (data.resultImageUrl as string) || null };
    case 'videoTrimNode':
      return { type: 'video', value: (data.resultUrl as string) || null };
    case 'videoStitchNode':
      return { type: 'video', value: (data.resultUrl as string) || null };
    case 'gridMergeNode':
      return { type: 'image', value: (data.mergedImageUrl as string) || null };

    // 万能节点
    case 'customNode': {
      const config = data.config as UniversalNodeData['config'] | undefined;
      const outputType = config?.outputType || 'text';
      if (outputType === 'text') {
        return { type: 'text', value: (data.textOutput as string) || null };
      }
      // image/video/audio 输出
      const outputUrl = data.outputUrl as string | undefined;
      if (outputType === 'image') return { type: 'image', value: outputUrl || null };
      if (outputType === 'video') return { type: 'video', value: outputUrl || null };
      if (outputType === 'audio') return { type: 'audio', value: outputUrl || null };
      return { type: 'text', value: (data.textOutput as string) || null };
    }

    // 3D 节点
    case 'generate3DNode':
    case 'viewer3DNode':
      return { type: '3d', value: (data.modelUrl as string) || null };

    // 默认：尝试通用字段
    default:
      if (data.imageUrl) return { type: 'image', value: data.imageUrl as string };
      if (data.videoUrl) return { type: 'video', value: data.videoUrl as string };
      if (data.audioUrl) return { type: 'audio', value: data.audioUrl as string };
      if (data.text) return { type: 'text', value: data.text as string };
      if (data.outputUrl) {
        // 根据上下文推断类型
        const url = data.outputUrl as string;
        if (/\.(mp4|webm|mov|avi)(\?|$)/i.test(url)) return { type: 'video', value: url };
        if (/\.(mp3|wav|ogg|m4a)(\?|$)/i.test(url)) return { type: 'audio', value: url };
        return { type: 'image', value: url };
      }
      return { type: 'image', value: null };
  }
}

/**
 * 解析文本源节点穿过路由器节点
 * 递归查找实际产生文本的源节点
 */
export function resolveTextSourcesThroughRouters(
  sourceNodes: Node[],
  allNodes: Node[],
  edges: Edge[],
  visited?: Set<string>
): Node[] {
  const seen = visited ?? new Set<string>();
  const resolved: Node[] = [];

  for (const node of sourceNodes) {
    if (seen.has(node.id)) continue;
    seen.add(node.id);

    // 路由器和开关节点：继续向上游查找
    if (node.type === 'routerNode' || node.type === 'switchNode') {
      const upstreamNodes = edges
        .filter((e) => e.target === node.id && e.targetHandle === 'text')
        .map((e) => allNodes.find((n) => n.id === e.source))
        .filter((n): n is Node => n !== undefined);
      resolved.push(...resolveTextSourcesThroughRouters(upstreamNodes, allNodes, edges, seen));
    } else {
      resolved.push(node);
    }
  }

  return resolved;
}

/**
 * 获取节点的所有上游输入数据
 * 遍历 edges，提取所有相连上游节点的输出数据
 *
 * @param nodeId 目标节点 ID
 * @param nodes 所有节点
 * @param edges 所有边
 * @returns 连接输入数据
 */
export function getConnectedInputs(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  visited?: Set<string>
): ConnectedInputs {
  const _visited = visited ?? new Set<string>();
  if (_visited.has(nodeId)) {
    return { images: [], videos: [], audio: [], text: null, textItems: [], model3d: null };
  }
  _visited.add(nodeId);

  const images: string[] = [];
  const videos: string[] = [];
  const audio: string[] = [];
  let text: string | null = null;
  const textItems: string[] = [];
  let model3d: string | null = null;

  // 缓存 passthrough 节点的结果
  const passthroughCache = new Map<string, ConnectedInputs>();

  // 遍历所有指向当前节点的边
  edges
    .filter((edge) => edge.target === nodeId)
    .forEach((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) return;

      // 路由器节点：透传上游数据
      if (sourceNode.type === 'routerNode') {
        const routerInputs =
          passthroughCache.get(sourceNode.id) ??
          getConnectedInputs(sourceNode.id, nodes, edges, _visited);
        passthroughCache.set(sourceNode.id, routerInputs);

        const edgeType = edge.sourceHandle;
        if (edgeType === 'image' || (!edgeType && isImageHandle(edge.sourceHandle))) {
          images.push(...routerInputs.images);
        } else if (edgeType === 'text' || (!edgeType && isTextHandle(edge.sourceHandle))) {
          if (routerInputs.text) text = routerInputs.text;
        } else if (edgeType === 'video') {
          videos.push(...routerInputs.videos);
        } else if (edgeType === 'audio') {
          audio.push(...routerInputs.audio);
        } else if (edgeType === '3d') {
          if (routerInputs.model3d) model3d = routerInputs.model3d;
        }
        return;
      }

      // 开关节点：检查是否启用
      if (sourceNode.type === 'switchNode') {
        const switchData = sourceNode.data as Record<string, unknown>;
        const switchId = edge.sourceHandle;
        const switches = switchData.switches as Array<{ id: string; enabled: boolean }> | undefined;
        const switchEntry = switches?.find((s) => s.id === switchId);

        // 禁用的输出不传递数据
        if (!switchEntry || !switchEntry.enabled) return;

        const switchInputs =
          passthroughCache.get(sourceNode.id) ??
          getConnectedInputs(sourceNode.id, nodes, edges, _visited);
        passthroughCache.set(sourceNode.id, switchInputs);

        const inputType = switchData.inputType as string | undefined;
        if (inputType === 'image') {
          images.push(...switchInputs.images);
        } else if (inputType === 'text') {
          if (switchInputs.text) text = switchInputs.text;
        } else if (inputType === 'video') {
          videos.push(...switchInputs.videos);
        } else if (inputType === 'audio') {
          audio.push(...switchInputs.audio);
        }
        return;
      }

      // 条件开关：检查规则匹配
      if (sourceNode.type === 'conditionalSwitchNode') {
        const condData = sourceNode.data as Record<string, unknown>;
        const evaluationPaused = condData.evaluationPaused as boolean | undefined;

        // 暂停评估时所有输出激活
        if (!evaluationPaused) {
          const rules = condData.rules as Array<{ id: string; isMatched?: boolean }> | undefined;
          const sourceHandle = edge.sourceHandle;
          const rule = rules?.find((r) => r.id === sourceHandle);
          const isDefault = sourceHandle === 'default';

          let isActive = false;
          if (rule) {
            isActive = !!rule.isMatched;
          } else if (isDefault) {
            isActive = !rules?.some((r) => r.isMatched);
          }

          // 非激活输出不传递数据
          if (!isActive) return;
        }
        // 激活输出：条件开关是门，不传递数据
        return;
      }

      // 普通节点：提取输出数据
      const handleId = edge.targetHandle;
      const { type, value } = getSourceOutput(sourceNode, edge.sourceHandle);

      if (!value) return;

      // 根据类型分发到对应数组
      if (type === '3d') {
        model3d = value;
      } else if (type === 'video') {
        videos.push(value);
      } else if (type === 'audio') {
        audio.push(value);
      } else if (type === 'text' || isTextHandle(handleId)) {
        text = typeof value === 'string' ? value : String(value);
      } else if (isImageHandle(handleId) || !handleId) {
        images.push(value);
      }
    });

  return { images, videos, audio, text, textItems, model3d };
}

/**
 * 获取上游节点列表
 * 返回所有直接连接的上游节点及其边信息
 */
export function getUpstreamNodes(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): Array<{ edge: Edge; node: Node }> {
  return edges
    .filter((e) => e.target === nodeId)
    .map((edge) => {
      const node = nodes.find((n) => n.id === edge.source);
      if (!node) return null;
      return { edge, node };
    })
    .filter((item): item is { edge: Edge; node: Node } => item !== null);
}