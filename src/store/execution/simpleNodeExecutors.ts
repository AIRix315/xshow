/**
 * Simple Node Executors
 *
 * 不调用外部 API 的节点执行器：
 * - OutputNode：从上游拉取数据并显示
 * - OutputGalleryNode：收集多个上游结果
 * - ImageInputNode：上游数据覆盖本地上传
 * - VideoInputNode：上游数据覆盖本地上传
 * - AudioInputNode：上游数据覆盖本地上传
 * - TextInputNode：更新文本输入
 */

import type { NodeExecutionContext } from './types';

/**
 * OutputNode 执行器
 * 从上游拉取数据并写入到自己的 data 字段
 */
export async function executeOutput(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { images, videos, audio, text } = getConnectedInputs(node.id);

  updateNodeData(node.id, {
    inputImageUrl: images[0]?.toString() || null,
    inputVideoUrl: videos[0]?.toString() || null,
    inputAudioUrl: audio[0]?.toString() || null,
    inputValue: text?.toString() || null,
  });
}

/**
 * OutputGalleryNode 执行器
 * 收集多个上游结果并构建 items 数组
 */
export async function executeOutputGallery(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { images, videos, audio } = getConnectedInputs(node.id);

  const items = [
    ...images.map((url) => ({ type: 'image' as const, url })),
    ...videos.map((url) => ({ type: 'video' as const, url })),
    ...audio.map((url) => ({ type: 'audio' as const, url })),
  ];

  updateNodeData(node.id, { items });
}

/**
 * ImageInputNode 执行器
 * 如果有上游连接，则使用上游数据；否则保留本地上传
 */
export async function executeImageInput(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { images } = getConnectedInputs(node.id);

  // 上游数据优先（connection wins over upload）
  if (images[0]) {
    updateNodeData(node.id, {
      imageUrl: images[0],
      // 清除本地文件引用，显示上游数据来源
      filename: undefined,
    });
  }
  // 如果没有上游数据，保留本地 uploaded 数据（已在 data.imageUrl 中）
}

/**
 * VideoInputNode 执行器
 * 如果有上游连接，则使用上游数据
 */
export async function executeVideoInput(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { videos } = getConnectedInputs(node.id);

  if (videos[0]) {
    updateNodeData(node.id, {
      videoUrl: videos[0],
      filename: undefined,
    });
  }
}

/**
 * AudioInputNode 执行器
 * 如果有上游连接，则使用上游数据
 */
export async function executeAudioInput(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { audio } = getConnectedInputs(node.id);

  if (audio[0]) {
    updateNodeData(node.id, {
      audioUrl: audio[0],
      audioName: undefined,
    });
  }
}

/**
 * TextInputNode 执行器
 * 如果有上游连接，则使用上游文本
 */
export async function executeTextInput(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { text } = getConnectedInputs(node.id);

  if (text) {
    updateNodeData(node.id, { text });
  }
}

/**
 * CropNode 执行器
 * 从上游获取图片进行裁剪
 */
export async function executeCrop(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { images } = getConnectedInputs(node.id);

  if (images[0]) {
    // 更新源图片（上游数据覆盖本地）
    updateNodeData(node.id, { sourceImageUrl: images[0] });
  }
}

/**
 * AnnotateNode 执行器
 * 从上游获取图片进行标注
 */
export async function executeAnnotate(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { images } = getConnectedInputs(node.id);

  if (images[0]) {
    const nodeData = node.data as Record<string, unknown>;
    updateNodeData(node.id, { inputImageUrl: images[0] });
    // 如果之前输出的是旧图片，需要清除
    if (nodeData.outputImageUrl === nodeData.inputImageUrl) {
      updateNodeData(node.id, { outputImageUrl: images[0] });
    }
  }
}

/**
 * FrameGrabNode 执行器
 * 从上游视频获取帧
 */
export async function executeFrameGrab(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { videos } = getConnectedInputs(node.id);

  if (videos[0]) {
    updateNodeData(node.id, { inputVideoUrl: videos[0] });
  }
}

/**
 * VideoTrimNode 执行器
 * 从上游视频进行裁剪
 */
export async function executeVideoTrim(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const { videos } = getConnectedInputs(node.id);

  if (videos[0]) {
    updateNodeData(node.id, { inputVideoUrl: videos[0] });
  }
}

/**
 * VideoStitchNode 执行器
 * 从多个上游视频进行拼接
 */
export async function executeVideoStitch(ctx: NodeExecutionContext): Promise<void> {
  const { node, nodes, edges, updateNodeData } = ctx;

  // 获取所有连接的视频
  const incomingEdges = edges.filter((e) => e.target === node.id);
  const videoUrls: string[] = [];

  for (const edge of incomingEdges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) continue;

    const sourceData = sourceNode.data as Record<string, unknown>;
    if (sourceData.videoUrl) {
      videoUrls.push(sourceData.videoUrl as string);
    }
  }

  if (videoUrls.length > 0) {
    updateNodeData(node.id, { videoUrls });
  }
}

/**
 * ImageCompareNode 执行器
 * 从两个上游获取图片进行比较
 */
export async function executeImageCompare(ctx: NodeExecutionContext): Promise<void> {
  const { node, nodes, edges, updateNodeData } = ctx;

  const incomingEdges = edges.filter((e) => e.target === node.id);

  for (const edge of incomingEdges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) continue;

    const sourceData = sourceNode.data as Record<string, unknown>;
    const handleId = edge.targetHandle;

    if (handleId === 'image-left' && sourceData.imageUrl) {
      updateNodeData(node.id, { imageLeft: sourceData.imageUrl });
    } else if (handleId === 'image-right' && sourceData.imageUrl) {
      updateNodeData(node.id, { imageRight: sourceData.imageUrl });
    }
  }
}