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
const AudioNode = lazy(() => import('@/components/canvas/AudioNode')); // 音频输入节点
const GridSplitNode = lazy(() => import('@/components/canvas/GridSplitNode'));
const GridMergeNode = lazy(() => import('@/components/canvas/GridMergeNode'));
const UniversalNode = lazy(() => import('@/components/canvas/UniversalNode')); // 万能节点（omniNode）

// 输入节点
const TextInputNode = lazy(() => import('@/components/canvas/TextInputNode'));
const VideoInputNode = lazy(() => import('@/components/canvas/VideoInputNode'));
const ImageInputNode = lazy(() => import('@/components/canvas/ImageInputNode'));
const D3Node = lazy(() => import('@/components/canvas/Generate3DNode')); // d3Node（3D生成）
const Viewer3DNode = lazy(() => import('@/components/canvas/Viewer3DNode')); // 3D 查看器
const GenerateAudioNode = lazy(() => import('@/components/canvas/GenerateAudioNode')); // audioNode（TTS 生成）
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

// ReactFlow nodeTypes 要求 ComponentType<NodeProps>，lazy 组件类型不完全匹配
// 命名规范：Input 后缀 = 输入节点，无后缀 = 生成节点
export const nodeTypes: Record<string, ComponentType<NodeProps>> = {
  // 生成节点
  imageNode: ImageNode as unknown as ComponentType<NodeProps>,
  promptNode: TextNode as unknown as ComponentType<NodeProps>, // promptNode 与 textNode 共用组件
  textNode: TextNode as unknown as ComponentType<NodeProps>,
  videoNode: VideoNode as unknown as ComponentType<NodeProps>,
  audioNode: GenerateAudioNode as unknown as ComponentType<NodeProps>, // 音频生成（TTS）
  d3Node: D3Node as unknown as ComponentType<NodeProps>, // 3D 生成
  omniNode: UniversalNode as unknown as ComponentType<NodeProps>, // 万能节点
  
  // 输入节点（Input 后缀）
  textInputNode: TextInputNode as unknown as ComponentType<NodeProps>,
  videoInputNode: VideoInputNode as unknown as ComponentType<NodeProps>,
  imageInputNode: ImageInputNode as unknown as ComponentType<NodeProps>,
  audioInputNode: AudioNode as unknown as ComponentType<NodeProps>, // 音频输入
  viewer3DNode: Viewer3DNode as unknown as ComponentType<NodeProps>, // 3D 查看器
  
  // 处理节点
  gridSplitNode: GridSplitNode as unknown as ComponentType<NodeProps>,
  gridMergeNode: GridMergeNode as unknown as ComponentType<NodeProps>,
  cropNode: CropNode as unknown as ComponentType<NodeProps>,
  promptConstructorNode: PromptConstructorNode as unknown as ComponentType<NodeProps>,
  annotateNode: AnnotateNode as unknown as ComponentType<NodeProps>,
  conditionalSwitchNode: ConditionalSwitchNode as unknown as ComponentType<NodeProps>,
  easeCurveNode: EaseCurveNode as unknown as ComponentType<NodeProps>,
  frameGrabNode: FrameGrabNode as unknown as ComponentType<NodeProps>,
  imageCompareNode: ImageCompareNode as unknown as ComponentType<NodeProps>,
  
  // 输出节点
  outputGalleryNode: OutputGalleryNode as unknown as ComponentType<NodeProps>,
  outputNode: OutputNode as unknown as ComponentType<NodeProps>,
  
  // 路由节点
  routerNode: RouterNode as unknown as ComponentType<NodeProps>,
  switchNode: SwitchNode as unknown as ComponentType<NodeProps>,
  videoStitchNode: VideoStitchNode as unknown as ComponentType<NodeProps>,
  videoTrimNode: VideoTrimNode as unknown as ComponentType<NodeProps>,
};

// Ref: §6.11 — 默认尺寸
const NODE_DEFAULTS: Record<string, { width: number; height: number }> = {
  // 生成节点
  imageNode: { width: 224, height: 224 },
  promptNode: { width: 400, height: 240 },
  textNode: { width: 400, height: 240 },
  videoNode: { width: 320, height: 320 },
  audioNode: { width: 320, height: 280 },
  d3Node: { width: 320, height: 300 },
  omniNode: { width: 400, height: 300 },
  
  // 输入节点
  textInputNode: { width: 300, height: 200 },
  videoInputNode: { width: 320, height: 280 },
  imageInputNode: { width: 280, height: 280 },
  audioInputNode: { width: 360, height: 200 },
  viewer3DNode: { width: 320, height: 320 },
  
  // 处理节点
  gridSplitNode: { width: 300, height: 300 },
  gridMergeNode: { width: 300, height: 300 },
  cropNode: { width: 300, height: 300 },
  promptConstructorNode: { width: 320, height: 300 },
  annotateNode: { width: 400, height: 400 },
  conditionalSwitchNode: { width: 280, height: 320 },
  easeCurveNode: { width: 240, height: 200 },
  frameGrabNode: { width: 320, height: 300 },
  imageCompareNode: { width: 320, height: 280 },
  
  // 输出节点
  outputGalleryNode: { width: 300, height: 300 },
  outputNode: { width: 240, height: 200 },
  
  // 路由节点
  routerNode: { width: 200, height: 200 },
  switchNode: { width: 200, height: 160 },
  videoStitchNode: { width: 320, height: 300 },
  videoTrimNode: { width: 320, height: 300 },
};

// 各节点类型的默认 data
// 命名规范：Input 后缀 = 输入节点，无后缀 = 生成节点
function getDefaultData(type: string): Record<string, unknown> {
  switch (type) {
    // 图片生成节点
    case 'imageNode':
      return {
        prompt: '',
        aspectRatio: '1:1',
        imageSize: '1K',
        drawingModel: '',
        loading: false,
        selectedContextResources: [],
        presetPrompts: [],
      } as ImageNodeData;
    
    // 文本生成节点 + 提示词节点（共用）
    case 'textNode':
    case 'promptNode':
      return {
        prompt: '',
        label: type === 'promptNode' ? '提示词' : '文本节点',
        text: '',
        expanded: true,
        autoSplit: false,
        textModel: '',
        loading: false,
        selectedContextResources: [],
        presetPrompts: [],
      } as TextNodeData;
    
    // 视频生成节点
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
    
    // 音频生成节点（TTS）
    case 'audioNode':
      return {
        text: '',
        voice: 'alloy',
        loading: false,
      };
    
    // 音频输入节点
    case 'audioInputNode':
      return {
        loading: false,
      } as AudioNodeData;
    
    // 3D 生成节点
    case 'd3Node':
      return {
        prompt: '',
        loading: false,
      };
    
    // 万能节点
    case 'omniNode':
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
    
    // 九宫格拆分
    case 'gridSplitNode':
      return {
        gridCount: 3,
        cellSize: 512,
        aspectRatio: '1:1',
        titlePattern: 'id{num}',
      } as GridSplitNodeData;
    
    // 九宫格合并
    case 'gridMergeNode':
      return {
        gridCount: 3,
        cellSize: 512,
        aspectRatio: '1:1',
      } as GridMergeNodeData;
    
    // 裁剪节点
    case 'cropNode':
      return {} as CropNodeData;
    
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