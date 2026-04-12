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

// Ref: §6.11 — 懒加载节点组件
const ImageNode = lazy(() => import('@/components/canvas/ImageNode'));
const TextNode = lazy(() => import('@/components/canvas/TextNode'));
const CropNode = lazy(() => import('@/components/canvas/CropNode'));
const VideoNode = lazy(() => import('@/components/canvas/VideoNode'));
const AudioNode = lazy(() => import('@/components/canvas/AudioNode'));
const GridSplitNode = lazy(() => import('@/components/canvas/GridSplitNode'));
const GridMergeNode = lazy(() => import('@/components/canvas/GridMergeNode'));
const UniversalNode = lazy(() => import('@/components/canvas/UniversalNode'));

// 输入节点
const TextInputNode = lazy(() => import('@/components/canvas/TextInputNode'));
const VideoInputNode = lazy(() => import('@/components/canvas/VideoInputNode'));
const ImageInputNode = lazy(() => import('@/components/canvas/ImageInputNode'));
const Generate3DNode = lazy(() => import('@/components/canvas/Generate3DNode'));
const GenerateAudioNode = lazy(() => import('@/components/canvas/GenerateAudioNode'));
const PromptConstructorNode = lazy(() => import('@/components/canvas/PromptConstructorNode'));
const AnnotateNode = lazy(() => import('@/components/canvas/AnnotateNode'));
const ConditionalSwitchNode = lazy(() => import('@/components/canvas/ConditionalSwitchNode'));
const EaseCurveNode = lazy(() => import('@/components/canvas/EaseCurveNode'));
const FrameGrabNode = lazy(() => import('@/components/canvas/FrameGrabNode'));
const ImageCompareNode = lazy(() => import('@/components/canvas/ImageCompareNode'));
const OutputGalleryNode = lazy(() => import('@/components/canvas/OutputGalleryNode'));
const OutputNode = lazy(() => import('@/components/canvas/OutputNode'));
const RouterNode = lazy(() => import('@/components/canvas/RouterNode'));
const SwitchNode = lazy(() => import('@/components/canvas/SwitchNode'));
const VideoStitchNode = lazy(() => import('@/components/canvas/VideoStitchNode'));
const VideoTrimNode = lazy(() => import('@/components/canvas/VideoTrimNode'));
const Viewer3DNode = lazy(() => import('@/components/canvas/Viewer3DNode'));

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
  // 输入节点
  textInputNode: TextInputNode as unknown as ComponentType<NodeProps>,
  videoInputNode: VideoInputNode as unknown as ComponentType<NodeProps>,
  imageInputNode: ImageInputNode as unknown as ComponentType<NodeProps>,
  generate3DNode: Generate3DNode as unknown as ComponentType<NodeProps>,
  generateAudioNode: GenerateAudioNode as unknown as ComponentType<NodeProps>,
  promptConstructorNode: PromptConstructorNode as unknown as ComponentType<NodeProps>,
  annotateNode: AnnotateNode as unknown as ComponentType<NodeProps>,
  conditionalSwitchNode: ConditionalSwitchNode as unknown as ComponentType<NodeProps>,
  easeCurveNode: EaseCurveNode as unknown as ComponentType<NodeProps>,
  frameGrabNode: FrameGrabNode as unknown as ComponentType<NodeProps>,
  imageCompareNode: ImageCompareNode as unknown as ComponentType<NodeProps>,
  outputGalleryNode: OutputGalleryNode as unknown as ComponentType<NodeProps>,
  outputNode: OutputNode as unknown as ComponentType<NodeProps>,
  routerNode: RouterNode as unknown as ComponentType<NodeProps>,
  switchNode: SwitchNode as unknown as ComponentType<NodeProps>,
  videoStitchNode: VideoStitchNode as unknown as ComponentType<NodeProps>,
  videoTrimNode: VideoTrimNode as unknown as ComponentType<NodeProps>,
  viewer3DNode: Viewer3DNode as unknown as ComponentType<NodeProps>,
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
  // 输入节点
  textInputNode: { width: 300, height: 200 },
  videoInputNode: { width: 320, height: 280 },
  imageInputNode: { width: 280, height: 280 },
  generate3DNode: { width: 320, height: 300 },
  generateAudioNode: { width: 320, height: 280 },
  promptConstructorNode: { width: 320, height: 300 },
  annotateNode: { width: 400, height: 400 },
  conditionalSwitchNode: { width: 280, height: 320 },
  easeCurveNode: { width: 240, height: 200 },
  frameGrabNode: { width: 320, height: 300 },
  imageCompareNode: { width: 320, height: 280 },
  outputGalleryNode: { width: 300, height: 300 },
  outputNode: { width: 240, height: 200 },
  routerNode: { width: 200, height: 200 },
  switchNode: { width: 200, height: 160 },
  videoStitchNode: { width: 320, height: 300 },
  videoTrimNode: { width: 320, height: 300 },
  viewer3DNode: { width: 320, height: 320 },
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
          executionType: 'http',
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