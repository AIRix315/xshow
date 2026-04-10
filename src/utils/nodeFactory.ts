// Ref: flowcraft node-factory.ts + node-registry.ts + §6.11
import { lazy, type ComponentType } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import type {
  ImageNodeData,
  TextNodeData,
  VideoNodeData,
  AudioNodeData,
  GridSplitNodeData,
  GridMergeNodeData,
  CropNodeData,
  UniversalNodeData,
} from '@/types';

// Ref: §6.11 — 懒加载 9 种节点组件（promptNode 映射到 ImageNode）
const ImageNode = lazy(() => import('@/components/canvas/ImageNode'));
const TextNode = lazy(() => import('@/components/canvas/TextNode'));
const CropNode = lazy(() => import('@/components/canvas/CropNode'));

// Phase 3 占位：用 Suspense fallback 包裹
const VideoNode = lazy(() => import('@/components/canvas/VideoNode'));
const AudioNode = lazy(() => import('@/components/canvas/AudioNode'));
const GridSplitNode = lazy(() => import('@/components/canvas/GridSplitNode'));
const GridMergeNode = lazy(() => import('@/components/canvas/GridMergeNode'));
const UniversalNode = lazy(() => import('@/components/canvas/UniversalNode'));

// ReactFlow nodeTypes 要求 ComponentType<NodeProps>，lazy 组件类型不完全匹配
export const nodeTypes: Record<string, ComponentType<NodeProps>> = {
  imageNode: ImageNode as unknown as ComponentType<NodeProps>,
  promptNode: ImageNode as unknown as ComponentType<NodeProps>,
  textNode: TextNode as unknown as ComponentType<NodeProps>,
  videoNode: VideoNode as unknown as ComponentType<NodeProps>,
  audioNode: AudioNode as unknown as ComponentType<NodeProps>,
  gridSplitNode: GridSplitNode as unknown as ComponentType<NodeProps>,
  gridMergeNode: GridMergeNode as unknown as ComponentType<NodeProps>,
  cropNode: CropNode as unknown as ComponentType<NodeProps>,
  customNode: UniversalNode as unknown as ComponentType<NodeProps>,
};

// Ref: §6.11 — 默认尺寸
const NODE_DEFAULTS: Record<string, { width: number; height: number }> = {
  imageNode: { width: 224, height: 224 },
  promptNode: { width: 224, height: 224 },
  videoNode: { width: 320, height: 320 },
  audioNode: { width: 360, height: 200 },
  textNode: { width: 400, height: 240 },
  gridSplitNode: { width: 300, height: 300 },
  gridMergeNode: { width: 300, height: 300 },
  cropNode: { width: 300, height: 300 },
  customNode: { width: 400, height: 300 },
};

// 各节点类型的默认 data
function getDefaultData(type: string): Record<string, unknown> {
  switch (type) {
    case 'imageNode':
    case 'promptNode':
      return {
        prompt: '',
        aspectRatio: '1:1',
        imageSize: '1K',
        drawingModel: '',
        loading: false,
        selectedContextResources: [],
        presetPrompts: [],
      } as ImageNodeData;
    case 'textNode':
      return {
        prompt: '',
        label: '文本节点',
        text: '',
        expanded: true,
        autoSplit: false,
        textModel: '',
        loading: false,
        selectedContextResources: [],
        presetPrompts: [],
      } as TextNodeData;
    case 'videoNode':
      return {
        prompt: '',
        size: '1280x720',
        videoModel: '',
        videoDurations: '10\n15',
        loading: false,
        selectedContextResources: [],
        presetPrompts: [],
      } as VideoNodeData;
    case 'audioNode':
      return {
        loading: false,
      } as AudioNodeData;
    case 'gridSplitNode':
      return {
        gridCount: 3,
        cellSize: 512,
        aspectRatio: '1:1',
        titlePattern: 'id{num}',
      } as GridSplitNodeData;
    case 'gridMergeNode':
      return {
        gridCount: 3,
        cellSize: 512,
        aspectRatio: '1:1',
      } as GridMergeNodeData;
    case 'cropNode':
      return {} as CropNodeData;
    case 'customNode':
      return {
        label: '万能节点',
        configMode: true,
        config: {
          apiUrl: '',
          method: 'POST',
          headers: '{}',
          body: '',
          outputType: 'text' as const,
          executionMode: 'sync' as const,
          resultPath: '',
        },
        loading: false,
      } as UniversalNodeData;
    default:
      return {};
  }
}

export function createNode(
  type: string,
  position: { x: number; y: number },
  partialData?: Record<string, unknown>,
): Node {
  const id = `${type}-${Date.now()}`;
  const size = NODE_DEFAULTS[type] ?? { width: 200, height: 150 };
  const baseData = getDefaultData(type);

  return {
    id,
    type,
    position,
    style: { width: size.width, height: size.height },
    data: { ...baseData, ...partialData },
  };
}