// Ref: node-banana connectedInputs.ts — 核心数据流函数
// 从上游节点提取数据，统一类型映射

import type { Node, Edge } from '@xyflow/react';
// OmniNodeData 类型不再需要单独导入，inferMediaOutput 通过 data.config 动态读取

/**
 * 源节点输出数据
 * getSourceOutput 的返回类型，支持多值输出
 */
export interface SourceOutput {
  type: 'image' | 'video' | 'audio' | 'text' | '3d' | 'reference';
  value: string | null;
  /** 多值输出（如 OmniNode 的 outputUrls 数组、GridSplitNode 的 splitResults） */
  additionalValues?: string[];
}

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
 * 判断 Handle 是否为引用类型（视觉关联，非数据流）
 * reference 边不传输数据，仅表示父子节点关系
 */
export function isReferenceHandle(handleId: string | null | undefined): boolean {
  return handleId === 'reference' || handleId?.startsWith('reference-') === true;
}

/**
 * 判断 Handle 是否为图片类型
 * 支持: image, image-*, image-\d\d (GridSplit/Merge), source-image, cropped-image, cell-*
 * 排除: reference 类型
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
 * 从 handle ID 推断目标 handle 的数据类型
 * 用于 getSourceOutput 按下游需要分发数据
 * 支持: image-\d\d (GridSplit/Merge 01-based编号), image-* (OmniNode等)
 */
function inferHandleType(handleId: string | null | undefined): 'image' | 'video' | 'audio' | 'text' | 'reference' | 'any' {
  if (!handleId) return 'any';
  // reference 是视觉关联边，不参与数据流
  if (isReferenceHandle(handleId)) return 'reference';
  if (handleId === 'image' || handleId.startsWith('image-') || handleId.startsWith('cell-') || handleId === 'source-image' || handleId === 'cropped-image' || handleId.includes('frame')) return 'image';
  if (handleId === 'video' || handleId.startsWith('video-')) return 'video';
  if (handleId === 'audio' || handleId.startsWith('audio-')) return 'audio';
  if (handleId === 'text' || handleId.startsWith('text-') || handleId.includes('prompt')) return 'text';
  return 'any';
}

/**
 * 推断媒体输出类型和分发数据
 * OmniNode / RhAppNode / RhWfNode 共享的输出推断逻辑
 *
 * 设计规则：
 * - 显式 outputType（非 auto）→ 只输出该类型数据
 * - auto 模式 → 根据下游 targetHandleType 需求分发
 * - additionalValues 携带 outputUrls 中的同类型其余 URL
 * - outputUrlTypes 提供每个 URL 的精确类型元数据（优先于 URL 推断）
 */
function inferMediaOutput(
  outputUrl: string | undefined,
  outputUrls: string[] | undefined,
  textOutput: string | undefined,
  outputType: string,
  targetHandleType: 'image' | 'video' | 'audio' | 'text' | 'reference' | 'any',
  outputUrlTypes?: string[],
): SourceOutput {
  // ─── 辅助：根据 URL 推断媒体类型 ───
  const inferType = (url: string, index?: number): SourceOutput['type'] => {
    // Priority 1: Use explicit type metadata if available
    if (outputUrlTypes && index !== undefined && outputUrlTypes[index]) {
      const t = outputUrlTypes[index]!;
      if (t === 'image' || t === 'video' || t === 'audio' || t === 'text') return t;
    }
    // Priority 2: URL extension inference
    const lower = url.toLowerCase();
    if (url.startsWith('blob:')) {
      // blob URL without metadata — fallback based on outputType
      if (outputType === 'video') return 'video';
      if (outputType === 'audio') return 'audio';
      return 'image'; // default fallback for blob
    }
    if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(lower)) return 'video';
    if (/\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(lower)) return 'audio';
    if (lower.includes('/view?') || lower.includes('/view?filename=')) return 'image';
    if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i.test(lower)) return 'image';
    // ZIP 文件应识别为 text（供 RhZipNode 正确提取）
    if (/\.zip(\?|$)/i.test(lower)) return 'text';
    if (outputType === 'video') return 'video';
    if (outputType === 'audio') return 'audio';
    return 'image';
  };

  // ─── 辅助：URL 是否匹配期望类型 ───
  const urlMatchesType = (url: string, want: 'image' | 'video' | 'audio', index?: number): boolean => {
    // Check metadata first
    if (outputUrlTypes && index !== undefined && outputUrlTypes[index]) {
      return outputUrlTypes[index] === want;
    }
    return inferType(url, index) === want;
  };

  // ─── 显式类型模式 ───
  if (outputType !== 'auto') {
    if (outputType === 'reference') {
      return { type: 'reference', value: null };
    }
    if (outputType === 'text') {
      return { type: 'text', value: textOutput || null };
    }
    // image / video / audio
    if (outputUrl && urlMatchesType(outputUrl, outputType as 'image' | 'video' | 'audio')) {
      const additional = (outputUrls && outputUrls.length > 0)
        ? outputUrls.filter((u, i) => u !== outputUrl && urlMatchesType(u, outputType as 'image' | 'video' | 'audio', i))
        : undefined;
      return { type: outputType as SourceOutput['type'], value: outputUrl, additionalValues: additional };
    }
    if (outputUrls) {
      const matching = outputUrls.filter((u, i) => urlMatchesType(u, outputType as 'image' | 'video' | 'audio', i));
      if (matching.length > 0) {
        return { type: outputType as SourceOutput['type'], value: matching[0]!, additionalValues: matching.length > 1 ? matching.slice(1) : undefined };
      }
    }
    return { type: outputType as SourceOutput['type'], value: null, additionalValues: undefined };
  }

  // ─── auto 模式：万能分发 ───
  const want = targetHandleType ?? 'any';

  // reference 类型不传输数据
  if (want === 'reference') {
    return { type: 'reference', value: null };
  }

  if (want === 'text') {
    if (textOutput) return { type: 'text', value: textOutput };
    if (outputUrl && !urlMatchesType(outputUrl, 'image') && !urlMatchesType(outputUrl, 'video') && !urlMatchesType(outputUrl, 'audio')) {
      return { type: 'text', value: outputUrl };
    }
    return { type: 'text', value: null };
  }

  if (want === 'image') {
    if (outputUrl && urlMatchesType(outputUrl, 'image')) {
      const additional = outputUrls ? outputUrls.filter((u, i) => u !== outputUrl && urlMatchesType(u, 'image', i)) : undefined;
      return { type: 'image', value: outputUrl, additionalValues: additional };
    }
    if (outputUrls) {
      const matching = outputUrls.filter((u, i) => urlMatchesType(u, 'image', i));
      if (matching.length > 0) {
        return { type: 'image', value: matching[0]!, additionalValues: matching.length > 1 ? matching.slice(1) : undefined };
      }
    }
    return { type: 'image', value: null };
  }

  if (want === 'video') {
    if (outputUrl && urlMatchesType(outputUrl, 'video')) return { type: 'video', value: outputUrl };
    if (outputUrls) {
      const matching = outputUrls.filter((u, i) => urlMatchesType(u, 'video', i));
      if (matching.length > 0) return { type: 'video', value: matching[0]! };
    }
    return { type: 'video', value: null };
  }

  if (want === 'audio') {
    if (outputUrl && urlMatchesType(outputUrl, 'audio')) return { type: 'audio', value: outputUrl };
    if (outputUrls) {
      const matching = outputUrls.filter((u, i) => urlMatchesType(u, 'audio', i));
      if (matching.length > 0) return { type: 'audio', value: matching[0]! };
    }
    return { type: 'audio', value: null };
  }

  // want === 'any'：返回主输出
  if (outputUrl) {
    const inferred = inferType(outputUrl);
    const additional = outputUrls ? outputUrls.filter((u) => u !== outputUrl) : undefined;
    return { type: inferred, value: outputUrl, additionalValues: additional };
  }
  if (outputUrls && outputUrls.length > 0) {
    const primaryType = inferType(outputUrls[0]!, 0);
    return { type: primaryType, value: outputUrls[0]!, additionalValues: outputUrls.length > 1 ? outputUrls.slice(1) : undefined };
  }
  if (textOutput) return { type: 'text', value: textOutput };
  return { type: 'text', value: null };
}

/**
 * 从源节点提取输出数据和类型
 * 统一映射各节点类型的输出字段
 */
function getSourceOutput(
  sourceNode: Node,
  _sourceHandle?: string | null,
  targetHandleType?: 'image' | 'video' | 'audio' | 'text' | 'reference' | 'any'
): SourceOutput {
  const data = sourceNode.data as Record<string, unknown>;
  const nodeType = sourceNode.type;

  switch (nodeType) {
    // 输入节点（Input 后缀）
    case 'imageInputNode':
      return { type: 'image', value: (data.imageUrl as string) || null };
    case 'videoInputNode':
      return { type: 'video', value: (data.videoUrl as string) || null };
    case 'audioInputNode':
      return { type: 'audio', value: (data.audioUrl as string) || null };
    case 'textInputNode':
      return { type: 'text', value: (data.text as string) || null };

    // 生成节点（无后缀）
    case 'imageNode':
      return { type: 'image', value: (data.imageUrl as string) || null };
    case 'videoNode':
      return { type: 'video', value: (data.videoUrl as string) || null };
    case 'audioNode':
      return { type: 'audio', value: (data.audioUrl as string) || null };
    case 'textNode':
    case 'promptNode':
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

    // 九宫格拆分节点：多图输出，按 image-01~image-NN handle 分发
    case 'gridSplitNode': {
      const splitResults = data.splitResults as string[] | undefined;
      if (splitResults && splitResults.length > 0) {
        // 如果下游 targetHandle 是 image-01~image-NN，按编号分发对应图片
        if (targetHandleType === 'image' && _sourceHandle) {
          const match = _sourceHandle.match(/^image-(\d+)$/);
          if (match) {
            const idx = parseInt(match[1]!, 10) - 1; // 1-based → 0-based
            const value = splitResults[idx] ?? null;
            return { type: 'image', value };
          }
        }
        // 兜底：返回第一张 + additionalValues
        return {
          type: 'image',
          value: splitResults[0] || null,
          additionalValues: splitResults.length > 1 ? splitResults.slice(1) : undefined,
        };
      }
      return { type: 'image', value: null };
    }

    // 万能节点（omniNode）
    case 'omniNode': {
      return inferMediaOutput(
        data.outputUrl as string | undefined,
        data.outputUrls as string[] | undefined,
        data.textOutput as string | undefined,
        (data.config as Record<string, unknown> | undefined)?.executionType === 'comfyui'
          ? ((data.config as Record<string, unknown> | undefined)?.comfyuiOutputType as string || 'auto')
          : ((data.config as Record<string, unknown> | undefined)?.outputType as string || 'auto'),
        targetHandleType ?? 'any',
        data.outputUrlTypes as string[] | undefined,
      );
    }

    // RunningHub APP 节点（rhAppNode）
    case 'rhAppNode': {
      return inferMediaOutput(
        data.outputUrl as string | undefined,
        data.outputUrls as string[] | undefined,
        data.textOutput as string | undefined,
        (data.config as Record<string, unknown> | undefined)?.outputType as string || 'auto',
        targetHandleType ?? 'any',
        data.outputUrlTypes as string[] | undefined,
      );
    }

    // RunningHub Workflow 节点（rhWfNode）
    case 'rhWfNode': {
      return inferMediaOutput(
        data.outputUrl as string | undefined,
        data.outputUrls as string[] | undefined,
        data.textOutput as string | undefined,
        (data.config as Record<string, unknown> | undefined)?.outputType as string || 'auto',
        targetHandleType ?? 'any',
        data.outputUrlTypes as string[] | undefined,
      );
    }

    // ZIP 解压节点（rhZipNode）
    case 'rhZipNode': {
      return inferMediaOutput(
        data.outputUrl as string | undefined,
        data.outputUrls as string[] | undefined,
        data.textOutput as string | undefined,
        'auto',
        targetHandleType ?? 'any',
        data.outputUrlTypes as string[] | undefined,
      );
    }

    // 3D 节点
    case 'd3Node':
    case 'viewer3DNode':
      return { type: '3d', value: (data.modelUrl as string) || null };

    // 图片比较节点
    case 'imageCompareNode':
      return { type: 'image', value: (data.outputImageUrl as string) || null };

    // 默认：尝试通用字段
    default:
      if (data.imageUrl) return { type: 'image', value: data.imageUrl as string };
      if (data.videoUrl) return { type: 'video', value: data.videoUrl as string };
      if (data.audioUrl) return { type: 'audio', value: data.audioUrl as string };
      if (data.text) return { type: 'text', value: data.text as string };
      if (data.outputUrl) {
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

  // 遍历所有指向当前节点的边（排除 reference 视觉关联边）
  edges
    .filter((edge) => edge.target === nodeId && edge.type !== 'reference')
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
        } else {
          // 泛型输出（generic-output / 旧 handle）：透传所有上游数据
          images.push(...routerInputs.images);
          videos.push(...routerInputs.videos);
          audio.push(...routerInputs.audio);
          if (routerInputs.text) text = routerInputs.text;
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
      // 推断下游 target handle 的数据类型（万能节点按此分发数据）
      const targetHandleType = inferHandleType(handleId);
      const { type, value, additionalValues } = getSourceOutput(sourceNode, edge.sourceHandle, targetHandleType);

      if (!value) return;

      // 根据类型分发到对应数组
      // 优先使用 getSourceOutput 返回的 type（已做精确推断），
      // 仅当 type 不明确时才用 handleId 兜底
      if (type === '3d') {
        model3d = value;
      } else if (type === 'video') {
        videos.push(value);
        additionalValues?.forEach((v) => videos.push(v));
      } else if (type === 'audio') {
        audio.push(value);
        additionalValues?.forEach((v) => audio.push(v));
      } else if (type === 'image') {
        images.push(value);
        additionalValues?.forEach((v) => images.push(v));
      } else if (type === 'text') {
        text = typeof value === 'string' ? value : String(value);
      } else if (isTextHandle(handleId)) {
        text = typeof value === 'string' ? value : String(value);
      } else if (isImageHandle(handleId)) {
        // 未识别类型的 handle，默认按 image 处理
        // 但 text 类型（包含 .zip）不进入 images
        images.push(value);
        additionalValues?.forEach((v) => images.push(v));
      } else if (!handleId) {
        // handleId 为空时（边直接连接），按 sourceHandle 类型分发
        // image 类型进入 images
        // @ts-ignore - TS 窄缩问题：type 在此处被窄缩为 'reference'，但实际可能有其他值
        if (type === 'image') {
          images.push(value);
          additionalValues?.forEach((v) => images.push(v));
          // @ts-ignore
        } else if (type === 'video') {
          videos.push(value);
          additionalValues?.forEach((v) => videos.push(v));
          // @ts-ignore
        } else if (type === 'audio') {
          audio.push(value);
          additionalValues?.forEach((v) => audio.push(v));
        }
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

/**
 * 按 targetHandle 收集上游数据
 * 用于 OmniNode/RhWfNode 等支持多输入的节点
 * 支持所有媒体类型的 handle: image-*, video-*, audio-*
 * 返回格式: { "image-0": ["url1"], "video-0": ["url2"], "audio-0": ["url3"] }
 */
export function getInputsByHandle(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  // 获取目标节点的 customInputHandles 声明（一次性查找）
  const targetNode = nodes.find((n) => n.id === nodeId);
  const customHandles = (targetNode?.data as Record<string, unknown>)?.customInputHandles as
    Array<{ id: string; type: string }> | undefined;
  const customHandleMap = new Map<string, string>();
  if (customHandles) {
    for (const ch of customHandles) {
      customHandleMap.set(ch.id, ch.type);
    }
  }

  // 遍历所有指向当前节点的边（排除 reference 视觉关联边）
  edges
    .filter((e) => e.target === nodeId && e.targetHandle && e.type !== 'reference')
    .forEach((edge) => {
      const handleId = edge.targetHandle!;

      // 路由 Step 1: 从 customInputHandles 声明中查找类型
      let handleType = customHandleMap.get(handleId);

      // 路由 Step 2: 降级到 inferHandleType 推断（覆盖裸 image, first-frame, image-N 等预定义模式）
      if (!handleType) {
        handleType = inferHandleType(handleId);
      }

      // 过滤：只接受 image / video / audio（排除 text, any, reference）
      if (handleType !== 'image' && handleType !== 'video' && handleType !== 'audio') return;

      if (!result[handleId]) result[handleId] = [];

      const sourceNode = nodes.find((n) => n.id === edge.source);
      if (!sourceNode) return;

      // 推断 targetHandle 类型用于 getSourceOutput
      const sourceOutput = getSourceOutput(sourceNode, edge.sourceHandle, handleType);

      if (sourceOutput.value) {
        const arr = result[handleId] ?? [];
        arr.push(sourceOutput.value);
        result[handleId] = arr;
      }
      // 处理 additionalValues（如多图输出）
      sourceOutput.additionalValues?.forEach((v) => {
        const arr = result[handleId] ?? [];
        arr.push(v);
        result[handleId] = arr;
      });
    });

  return result;
}