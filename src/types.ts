// Ref: §三 — 核心数据结构定义 + @xyflow/react Node 类型
// 所有接口与类型均对照 01-1-reverse-engineering-plan-v2.md §3.1-3.15
import type { Node } from '@xyflow/react';

// §3.1 通道配置与全局 API 配置
export type ComfyUISubType = 'local' | 'cloud' | 'runninghub';

export interface ChannelConfig {
  id: string;               // 唯一标识
  name: string;             // 供应商名称
  url: string;              // API 端点地址
  key: string;              // API 密钥
  protocol: 'openai' | 'gemini' | 'anthropic' | 'custom' | 'comfyui';  // 协议类型
  comfyuiSubType?: ComfyUISubType;  // 仅 protocol='comfyui' 时有效
}

export interface ApiConfig {
  channels: ChannelConfig[];       // 供应商池
  imageChannelId: string;          // 生图供应商 ID
  drawingModel: string;            // 生图模型，换行分隔
  videoChannelId: string;           // 生视频供应商 ID
  videoModel: string;              // 生视频模型，换行分隔
  textChannelId: string;            // LLM 供应商 ID
  textModel: string;                // LLM 模型，换行分隔
  audioChannelId: string;           // 语音供应商 ID
  audioModel: string;               // 语音模型，换行分隔
  ttsVoice: string;                 // TTS 语音标识，用户自定义填入
  videoDurations: string;           // 视频时长选项，换行分隔
  presetPrompts: PresetPrompt[];    // 预设词
  // ComfyUI 工作流列表
  comfyuiLocalWorkflows: string;
  comfyuiCloudWorkflows: string;
  comfyuiRunninghubWorkflows: string;
}

// §3.2 资源中转站
export interface TransitResource {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'text';
  timestamp: number;
  pageUrl: string;
  pageTitle: string;
  isFavorite?: boolean;        // 收藏标记
}

// §3.3 预设词
export interface PresetPrompt {
  title: string;
  prompt: string;
  type: 'image' | 'text' | 'video' | 'all';
  enabled: boolean;
}

// §3.4 图片节点数据
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ReactFlow Node 要求 Record<string, unknown> 兼容
export interface ImageNodeData {
  [key: string]: unknown;
  imageUrl?: string;
  prompt: string;
  aspectRatio: string;     // '16:9', '1:1' 等
  imageSize: string;        // '1K', '2K' 等
  selectedModel?: string;
  drawingModel: string;     // 换行分隔多模型
  selectedContextResources: TransitResource[];
  loading: boolean;
  errorMessage?: string;
  presetPrompts: PresetPrompt[];
  onGenerate?: (nodeId: string, prompt: string, size: string, model?: string) => void;
  onCrop?: (nodeId: string, imageUrl: string) => void;
  onZoom?: (imageUrl: string) => void;
  onEdit?: (nodeId: string, imageUrl: string) => void;
  onAddImage?: (nodeId: string, dataUrl: string) => void;
  onStop?: (nodeId: string) => void;
  onShowToast?: (msg: string) => void;
  onSendToActiveTab?: (resource: string | { url: string; type: string }) => void;
}

// §3.5 文本节点数据
export interface TextNodeData {
  [key: string]: unknown;
  text?: string;
  prompt: string;
  label: string;
  expanded: boolean;
  autoSplit?: boolean;
  selectedModel?: string;
  textModel: string;
  fontSize?: number;
  selectedContextResources: TransitResource[];
  loading: boolean;
  errorMessage?: string;
  presetPrompts: PresetPrompt[];
  onGenerateText?: (nodeId: string, prompt: string, autoSplit: boolean, model?: string) => void;
  onAddImage?: (nodeId: string, dataUrl: string) => void;
  onStop?: (nodeId: string) => void;
  onShowToast?: (msg: string) => void;
}

// §3.6 视频节点数据
export interface VideoNodeData {
  [key: string]: unknown;
  videoUrl?: string;
  thumbnailUrl?: string;
  prompt: string;
  size: string;             // '1280x720'
  selectedModel?: string;
  videoModel: string;
  videoDurations: string;   // 换行分隔
  selectedSeconds?: string;
  selectedContextResources: TransitResource[];
  loading: boolean;
  progress?: number;
  errorMessage?: string;
  presetPrompts: PresetPrompt[];
  onGenerateVideo?: (nodeId: string, prompt: string, size: string, model?: string, duration?: string) => void;
  onAddImage?: (nodeId: string, dataUrl: string) => void;
  onStop?: (nodeId: string) => void;
  onShowToast?: (msg: string) => void;
}

// §3.7 音频节点数据
export interface AudioNodeData {
  [key: string]: unknown;
  audioUrl?: string;                                // 音频 URL
  audioName?: string;                                // 文件名
  chunks?: Array<{ start: number; end: number; text: string }>;  // 断句结果
  ttsText?: string;                                  // TTS 输入文本
  selectedModel?: string;                             // 当前选中模型
  loading: boolean;
  errorMessage?: string;
  onGenerateAudio?: (nodeId: string) => void;        // 听音断句
  onGenerateTTS?: (nodeId: string) => void;           // 文本转语音
  onShowToast?: (msg: string) => void;
}

// §3.8 九宫格分拆节点
export interface GridSplitNodeData {
  [key: string]: unknown;
  gridCount: number;        // 默认 3
  cellSize: number;         // 默认 512
  aspectRatio: string;      // 默认 '1:1'
  titlePattern: string;     // 默认 'id{num}'
  splitResults?: string[];  // 拆图结果：N×N 个 DataURL
  loading?: boolean;
  errorMessage?: string;
}

// §3.9 九宫格合拼节点
export interface GridMergeNodeData {
  [key: string]: unknown;
  gridCount: number;        // 默认 3
  cellSize: number;         // 默认 512
  aspectRatio: string;      // 默认 '1:1'
  mergedImageUrl?: string;   // 合拼结果 DataURL
  loading?: boolean;
  errorMessage?: string;
}

// §3.10 万能节点配置
export interface CustomNodeConfig {
  apiUrl: string;
  method: string;
  headers: string;          // JSON 字符串
  body: string;             // 支持 {{变量名}}
  outputType: 'text' | 'image' | 'video' | 'audio';
  executionMode: 'sync' | 'async';
  resultPath: string;
  taskIdPath?: string;
  pollingUrl?: string;
  pollingMethod?: string;
  pollingHeaders?: string;
  pollingBody?: string;
  pollingResultPath?: string;
  pollingCompletedValue?: string;
  pollingFailedValue?: string;
  pollingErrorPath?: string;
  pollingProgressPath?: string;
  pollingResultDataPath?: string;
  rawTextOutput?: boolean;
  variables?: Record<string, string>;
  // ComfyUI 执行配置
  executionType?: 'http' | 'comfyui';
  channelId?: string;
  comfyuiSubType?: ComfyUISubType;
  nodeInfoList?: ComfyUINodeInfo[];
  model?: string;
}

// ComfyUI 节点字段映射
export interface ComfyUINodeInfo {
  nodeId: string;
  fieldName: string;
  fieldType?: 'STRING' | 'NUMBER' | 'IMAGE';
  defaultValue?: string;
}

export interface UniversalNodeData {
  [key: string]: unknown;
  label: string;
  configMode: boolean;
  config: CustomNodeConfig;
  loading: boolean;
  progress?: number;
  resultData?: string;
  errorMessage?: string;
  onAIAssist?: (desc: string, config: CustomNodeConfig) => Promise<string>;
  onGenerateCustom?: (nodeId: string) => void;
  onSaveTemplate?: (name: string, config: CustomNodeConfig) => void;
  onShowToast?: (msg: string) => void;
  onStop?: (nodeId: string) => void;
}

// §3.11 全局任务追踪
export interface GlobalTask {
  id: string;
  type: 'video' | 'custom';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  createdAt: number;
  prompt?: string;
  errorMsg?: string;
  resultUrl?: string;
  thumbnailUrl?: string;
}

// §3.12 裁剪节点数据
export interface CropNodeData {
  [key: string]: unknown;
  sourceImageUrl?: string;  // 待裁剪的原图 URL
  onCropComplete?: (nodeId: string, croppedDataUrl: string) => void;
  onCancel?: (nodeId: string) => void;
}

// §3.13 输入节点数据
export interface TextInputNodeData { [key: string]: unknown; text?: string; filename?: string; }
export interface VideoInputNodeData { [key: string]: unknown; videoUrl?: string; filename?: string; }
export interface ImageInputNodeData { [key: string]: unknown; imageUrl?: string; filename?: string; isOptional?: boolean; dimensions?: { width: number; height: number }; }
export interface Generate3DNodeData { [key: string]: unknown; prompt?: string; modelUrl?: string; progress?: number; }
export interface GenerateAudioNodeData { [key: string]: unknown; text?: string; voice?: string; }
export interface PromptConstructorNodeData { [key: string]: unknown; parts?: Array<{ id: string; text: string; enabled: boolean }>; }
export interface AnnotateNodeData { [key: string]: unknown; inputImageUrl?: string; annotations?: Array<{ id: string; type: 'text' | 'rect' | 'arrow' | 'circle'; x: number; y: number; width?: number; height?: number; endX?: number; endY?: number; text?: string; fontSize: number; color: string }>; fontSize?: number; color?: string; annotationText?: string; }
export interface ConditionalSwitchNodeData { [key: string]: unknown; rules?: Array<{ id: string; name: string; operator: string; value: string; outputIndex: number }>; }
export interface EaseCurveNodeData { [key: string]: unknown; curveType?: string; }
export interface FrameGrabNodeData { [key: string]: unknown; inputVideoUrl?: string; framePosition?: number; resultImageUrl?: string; }
export interface ImageCompareNodeData { [key: string]: unknown; imageLeft?: string; imageRight?: string; mode?: string; }
export interface OutputGalleryNodeData { [key: string]: unknown; items?: Array<{ type: string }>; columns?: number; }
export interface OutputNodeData { [key: string]: unknown; inputImageUrl?: string; inputVideoUrl?: string; inputAudioUrl?: string; inputValue?: string; label?: string; }
export interface RouterNodeData { [key: string]: unknown; outputCount?: number; inputValue?: unknown; }
export interface SwitchNodeData { [key: string]: unknown; enabled?: boolean; }
export interface VideoStitchNodeData { [key: string]: unknown; videoUrls?: string[]; resultUrl?: string; }
export interface VideoTrimNodeData { [key: string]: unknown; inputVideoUrl?: string; startTime?: number; endTime?: number; resultUrl?: string; }
export interface Viewer3DNodeData { [key: string]: unknown; modelUrl?: string; }

// §3.14 画布项目
export interface Project {
  id: string;          // 默认 "default"
  name: string;        // 项目名
}

// §3.14 自定义节点模板
export interface CustomNodeTemplate {
  id: string;
  name: string;
  config: CustomNodeConfig;
}

// §3.15 ReactFlow Node 类型别名
export type ImageNode = Node<ImageNodeData, 'imageNode'>;
export type PromptNode = Node<ImageNodeData, 'promptNode'>;
export type TextNodeType = Node<TextNodeData, 'textNode'>;
export type VideoNode = Node<VideoNodeData, 'videoNode'>;
export type AudioNodeType = Node<AudioNodeData, 'audioNode'>;
export type GridSplitNode = Node<GridSplitNodeData, 'gridSplitNode'>;
export type GridMergeNodeType = Node<GridMergeNodeData, 'gridMergeNode'>;
export type CropNodeType = Node<CropNodeData, 'cropNode'>;
export type UniversalNodeType = Node<UniversalNodeData, 'customNode'>;
export type TextInputNodeType = Node<TextInputNodeData, 'textInputNode'>;
export type VideoInputNodeType = Node<VideoInputNodeData, 'videoInputNode'>;
export type ImageInputNodeType = Node<ImageInputNodeData, 'imageInputNode'>;
export type ImageInputNode = ImageInputNodeType;
export type Generate3DNodeType = Node<Generate3DNodeData, 'generate3DNode'>;
export type GenerateAudioNodeType = Node<GenerateAudioNodeData, 'generateAudioNode'>;
export type PromptConstructorNodeType = Node<PromptConstructorNodeData, 'promptConstructorNode'>;
export type AnnotateNodeType = Node<AnnotateNodeData, 'annotateNode'>;
export type ConditionalSwitchNodeType = Node<ConditionalSwitchNodeData, 'conditionalSwitchNode'>;
export type EaseCurveNodeType = Node<EaseCurveNodeData, 'easeCurveNode'>;
export type FrameGrabNodeType = Node<FrameGrabNodeData, 'frameGrabNode'>;
export type ImageCompareNodeType = Node<ImageCompareNodeData, 'imageCompareNode'>;
export type OutputGalleryNodeType = Node<OutputGalleryNodeData, 'outputGalleryNode'>;
export type OutputNodeType = Node<OutputNodeData, 'outputNode'>;
export type RouterNodeType = Node<RouterNodeData, 'routerNode'>;
export type SwitchNodeType = Node<SwitchNodeData, 'switchNode'>;
export type VideoStitchNodeType = Node<VideoStitchNodeData, 'videoStitchNode'>;
export type VideoTrimNodeType = Node<VideoTrimNodeData, 'videoTrimNode'>;
export type Viewer3DNodeType = Node<Viewer3DNodeData, 'viewer3DNode'>;
export type AppNode = ImageNode | PromptNode | TextNodeType | VideoNode | AudioNodeType | GridSplitNode | GridMergeNodeType | CropNodeType | UniversalNodeType | TextInputNodeType | VideoInputNodeType | ImageInputNodeType | Generate3DNodeType | GenerateAudioNodeType | PromptConstructorNodeType | AnnotateNodeType | ConditionalSwitchNodeType | EaseCurveNodeType | FrameGrabNodeType | ImageCompareNodeType | OutputGalleryNodeType | OutputNodeType | RouterNodeType | SwitchNodeType | VideoStitchNodeType | VideoTrimNodeType | Viewer3DNodeType;

// 默认值常量
export const DEFAULT_CHANNEL: ChannelConfig = {
  id: 'default',
  name: '',
  url: '',
  key: '',
  protocol: 'openai',
};

export const DEFAULT_API_CONFIG: ApiConfig = {
  channels: [DEFAULT_CHANNEL],
  imageChannelId: 'default',
  drawingModel: '',
  videoChannelId: 'default',
  videoModel: '',
  textChannelId: 'default',
  textModel: '',
  audioChannelId: 'default',
  audioModel: '',
  ttsVoice: '',
  videoDurations: '',
  presetPrompts: [],
  comfyuiLocalWorkflows: '',
  comfyuiCloudWorkflows: '',
  comfyuiRunninghubWorkflows: '',
};

export const DEFAULT_PROJECT: Project = {
  id: 'default',
  name: '默认项目',
};