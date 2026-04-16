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

/**
 * GridSplitNode 执行器
 * 从上游获取图片并按 rows×cols 网格拆分，将结果写入 splitResults。
 * 保留原图宽高比，不再强制输出正方形。
 * 如果 hasChildNodes 为 true，将拆分结果填充到子 ImageInput 节点。
 */
export async function executeGridSplit(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;

  const nodeData = node.data as Record<string, unknown>;
  const gridRows = (nodeData.gridRows as number) ?? 3;
  const gridCols = (nodeData.gridCols as number) ?? 3;
  const cellSize = (nodeData.cellSize as number) ?? 0;

  updateNodeData(node.id, { loading: true, errorMessage: '' });

  try {
    const { images } = getConnectedInputs(node.id);

    if (!images[0]) {
      updateNodeData(node.id, { splitResults: [], loading: false });
      return;
    }

    // 动态导入图片处理工具（避免 Canvas API 在非浏览器环境的直接引用）
    const { loadImage, splitImageToGrid } = await import('@/utils/imageProcessing');
    const img = await loadImage(images[0]!);
    const splitResults = cellSize > 0
      ? splitImageToGrid(img, gridRows, gridCols, cellSize)
      : splitImageToGrid(img, gridRows, gridCols);

    // 写入拆分结果
    updateNodeData(node.id, { splitResults, loading: false });

    // 如果子节点已创建，将拆分结果填充到子 ImageInput 节点
    const childNodeIds = nodeData.childNodeIds as Array<{ imageInputId: string }> | undefined;
    const hasChildNodes = nodeData.hasChildNodes as boolean | undefined;
    if (hasChildNodes && childNodeIds && childNodeIds.length > 0) {
      for (let i = 0; i < childNodeIds.length; i++) {
        const imageInputId = childNodeIds[i]!.imageInputId;
        if (splitResults[i]) {
          updateNodeData(imageInputId, {
            imageUrl: splitResults[i],
            filename: `split-${Math.floor(i / gridCols) + 1}-${(i % gridCols) + 1}.png`,
          });
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '图片分拆失败';
    updateNodeData(node.id, { loading: false, errorMessage: msg });
  }
}

/**
 * GridMergeNode 执行器
 * 通过 getInputsByHandle 收集 image-01~image-NN 上游数据，
 * 合并为一张网格大图。
 */
export async function executeGridMerge(ctx: NodeExecutionContext): Promise<void> {
  const { node, nodes, edges, updateNodeData } = ctx;

  const nodeData = node.data as Record<string, unknown>;
  const gridRows = (nodeData.gridRows as number) ?? 3;
  const gridCols = (nodeData.gridCols as number) ?? 3;
  const cellSize = (nodeData.cellSize as number) ?? 512;
  const totalCells = gridRows * gridCols;

  updateNodeData(node.id, { loading: true, errorMessage: '' });

  try {
    // 通过 getInputsByHandle 收集 image-01~image-NN 的上游数据
    const { getInputsByHandle } = await import('@/utils/connectedInputs');
    const inputsByHandle = getInputsByHandle(node.id, nodes, edges);

    // 构建按编号排序的 cellImages 数组
    const cellImages: Array<string | undefined> = Array.from(
      { length: totalCells },
      () => undefined,
    );

    for (const [handleId, urls] of Object.entries(inputsByHandle)) {
      if (!handleId.startsWith('image-')) continue;
      // 从 handle 编号提取 index: image-01 → 0, image-02 → 1, ...
      const num = parseInt(handleId.replace('image-', ''), 10);
      const idx = num - 1; // 1-based → 0-based
      if (idx >= 0 && idx < totalCells && urls[0]) {
        cellImages[idx] = urls[0];
      }
    }

    // 也兼容通用 image handle（无编号）
    const { images } = ctx.getConnectedInputs(node.id);
    for (let i = 0; i < Math.min(images.length, totalCells); i++) {
      if (!cellImages[i] && images[i]) {
        cellImages[i] = images[i];
      }
    }

    const hasImages = cellImages.some((url) => url !== undefined);
    if (!hasImages) {
      updateNodeData(node.id, { mergedImageUrl: undefined, loading: false });
      return;
    }

    // 动态导入图片处理工具
    const { mergeImagesFromGrid } = await import('@/utils/imageProcessing');
    const mergedImageUrl = await mergeImagesFromGrid(cellImages, gridRows, gridCols, cellSize);

    updateNodeData(node.id, { mergedImageUrl, loading: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '图片合拼失败';
    updateNodeData(node.id, { loading: false, errorMessage: msg });
  }
}