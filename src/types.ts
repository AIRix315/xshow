// Ref: §三 — 核心数据结构定义 + @xyflow/react Node 类型
// 所有接口与类型均对照 01-1-reverse-engineering-plan-v2.md §3.1-3.15
import type { Node, Edge } from '@xyflow/react';

// §3.1 通道配置与全局 API 配置
export type ComfyUISubType = 'local' | 'cloud' | 'runninghub' | 'runninghubApp';

// ComfyUI 独立配置（与渠道商框架分离）
export interface ComfyUIConfig {
  // 本地 ComfyUI
  localUrl: string;              // 本地 ComfyUI 地址（如 http://127.0.0.1:8188）
  localWorkflows: string[];      // 本地检测到的 API 格式工作流列表

  // ComfyUI Cloud
  cloudUrl: string;              // Cloud API 地址
  cloudWorkflows: string[];       // Cloud 检测到的 API 格式工作流列表

  // RunningHub（共用一个 API Key）
  runninghubApiKey: string;      // RunningHub API Key
  runninghubWorkflows: string[];  // 工作流 ID 列表
  runninghubApps: RunningHubApp[]; // APP 列表
}

// RunningHub APP 配置
export interface RunningHubApp {
  id: string;         // webappId
  name: string;       // 显示名称
  quickCreateCode?: string;  // quickCreateCode（可选）
}

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

// §3.4 节点基础数据 (Ref: node-banana BaseNodeData)
export interface BaseNodeData extends Record<string, unknown> {
  label?: string;
  loading?: boolean;
  errorMessage?: string;
}

// §3.5 图片节点数据
export interface ImageNodeData extends BaseNodeData {
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
export interface TextNodeData extends BaseNodeData {
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
export interface VideoNodeData extends BaseNodeData {
  videoUrl?: string;
  thumbnailUrl?: string;
  prompt: string;
  size: string;
  selectedModel?: string;
  videoModel: string;
  videoDurations: string;
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

// §3.7 音频输入节点数据（audioInputNode）
export interface AudioNodeData extends BaseNodeData {
  audioUrl?: string;
  audioName?: string;
  chunks?: Array<{ start: number; end: number; text: string }>;
  ttsText?: string;
  selectedModel?: string;
  loading: boolean;
  errorMessage?: string;
  onGenerateAudio?: (nodeId: string) => void;
  onGenerateTTS?: (nodeId: string) => void;
  onShowToast?: (msg: string) => void;
}

// §3.7.1 音频生成节点数据（audioNode - TTS）
export interface GenerateAudioNodeData extends BaseNodeData { 
  text?: string; 
  voice?: string;
  audioUrl?: string;
  loading?: boolean;
  errorMessage?: string;
}

// §3.8 九宫格分拆节点
export interface GridSplitNodeData extends BaseNodeData {
  gridCount: number;
  /** 行数（默认等于 gridCount） */
  gridRows?: number;
  /** 列数（默认等于 gridCount） */
  gridCols?: number;
  cellSize: number;
  aspectRatio: string;
  titlePattern: string;
  splitResults?: string[];
  /** 要创建的子节点组数（默认 = gridRows * gridCols） */
  targetCount?: number;
  /** 参考连接的子节点 ID 列表（拆分后自动创建的 ImageInput 节点） */
  childNodeIds?: Array<{ imageInputId: string }>;
  /** 是否已配置子节点 */
  isConfigured?: boolean;
  [key: string]: unknown;
}

// §3.9 九宫格合拼节点
export interface GridMergeNodeData extends BaseNodeData {
  gridCount: number;
  cellSize: number;
  aspectRatio: string;
  mergedImageUrl?: string;
}

// §3.10 万能节点配置
export interface OmniNodeConfig {
  apiUrl: string;
  method: string;
  headers: string;          // JSON 字符串
  body: string;             // 支持 {{变量名}}
  outputType: 'auto' | 'text' | 'image' | 'video' | 'audio';
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
  comfyuiSubType?: ComfyUISubType;
  // ComfyUI 独立的输出类型（不继承 HTTP 模式）
  comfyuiOutputType?: 'auto' | 'text' | 'image' | 'video' | 'audio';
  // 工作流标识
  workflowId?: string;           // RunningHub workflowId
  workflowJson?: string;         // 本地/Cloud 工作流 JSON
  workflowName?: string;          // 工作流显示名称
  // RunningHub APP 模式
  runninghubAppId?: string;       // webappId
  runninghubQuickCreateCode?: string;  // quickCreateCode
  // 节点字段映射
  nodeInfoList?: ComfyUINodeInfo[];
}

// ComfyUI 节点字段映射
export interface ComfyUINodeInfo {
  nodeId: string;
  fieldName: string;
  fieldType?: 'STRING' | 'NUMBER' | 'IMAGE';
  defaultValue?: string;
}

export interface OmniNodeData extends BaseNodeData {
  label: string;
  configMode: boolean;
  config: OmniNodeConfig;
  loading: boolean;
  progress?: number;
  resultData?: string;       // 原始返回数据（兼容）
  // 标准化输出字段（供下游节点读取）
  outputUrl?: string;        // image/video/audio 单输出 URL
  outputUrls?: string[];     // 多图/多输出 URL 数组
  textOutput?: string;       // 文本输出
  errorMessage?: string;
  onAIAssist?: (desc: string, config: OmniNodeConfig) => Promise<string>;
  onGenerateCustom?: (nodeId: string) => void;
  onSaveTemplate?: (name: string, config: OmniNodeConfig) => void;
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
export interface CropNodeData extends BaseNodeData {
  sourceImageUrl?: string;
  onCropComplete?: (nodeId: string, croppedDataUrl: string) => void;
  onCancel?: (nodeId: string) => void;
}

// §3.13 输入节点数据
export interface TextInputNodeData extends BaseNodeData { text?: string; filename?: string; }
export interface VideoInputNodeData extends BaseNodeData { videoUrl?: string; filename?: string; }
export interface ImageInputNodeData extends BaseNodeData { imageUrl?: string; filename?: string; isOptional?: boolean; dimensions?: { width: number; height: number }; }
// §3.14.1 3D 节点数据
export interface Generate3DNodeData extends BaseNodeData { prompt?: string; modelUrl?: string; progress?: number; }
export interface Viewer3DNodeData extends BaseNodeData { modelUrl?: string; }
export interface PromptConstructorNodeData extends BaseNodeData { parts?: Array<{ id: string; text: string; enabled: boolean }>; }
export interface AnnotateNodeData extends BaseNodeData { inputImageUrl?: string; annotations?: Array<{ id: string; type: 'text' | 'rect' | 'arrow' | 'circle'; x: number; y: number; width?: number; height?: number; endX?: number; endY?: number; text?: string; fontSize: number; color: string }>; fontSize?: number; color?: string; annotationText?: string; }
export interface ConditionalSwitchNodeData extends BaseNodeData { rules?: Array<{ id: string; name: string; operator: string; value: string; outputIndex: number }>; }
export interface EaseCurveNodeData extends BaseNodeData { curveType?: string; }
export interface FrameGrabNodeData extends BaseNodeData { inputVideoUrl?: string; framePosition?: number; resultImageUrl?: string; }
export interface ImageCompareNodeData extends BaseNodeData { imageLeft?: string; imageRight?: string; mode?: string; outputImageUrl?: string; }
export interface OutputGalleryNodeData extends BaseNodeData {
  items?: Array<{ type: 'image' | 'video' | 'audio' | 'text'; url?: string; content?: string }>;
  columns?: number;
  // 上游数据输入字段
  inputImages?: string[];
  inputVideos?: string[];
  inputAudio?: string[];
  inputText?: string;
}
export interface OutputNodeData extends BaseNodeData { inputImageUrl?: string; inputVideoUrl?: string; inputAudioUrl?: string; inputValue?: string; label?: string; }
export interface RouterNodeData extends BaseNodeData { outputCount?: number; inputValue?: unknown; }
export interface SwitchNodeData extends BaseNodeData { enabled?: boolean; }
export interface VideoStitchNodeData extends BaseNodeData { videoUrls?: string[]; resultUrl?: string; }
export interface VideoTrimNodeData extends BaseNodeData { inputVideoUrl?: string; startTime?: number; endTime?: number; resultUrl?: string; }

// §3.14 画布项目
export interface Project {
  id: string;          // 默认 "default"
  name: string;        // 项目名
}

// §3.16 项目文件格式（导出/导入 JSON）
// 用于项目完整保存和跨设备迁移
export interface XShowWorkflowFile {
  version: 1;
  id: string;          // 项目 ID（时间戳）
  name: string;        // 项目名称
  embedBase64: boolean; // 是否嵌入了 Base64 媒体
  nodes: AppNode[];    // 节点数据
  edges: Edge[];
  savedAt: number;     // 保存时间戳（ISO ms）
  xshowVersion: string; // XShow 版本号
}

// §3.14 自定义节点模板
export interface CustomNodeTemplate {
  id: string;
  name: string;
  config: OmniNodeConfig;
}

// §3.15 ReactFlow Node 类型别名
// 命名规范：功能 + 类型 + NodeType（如 ImageNodeType, AudioInputNodeType）
// Input 后缀 = 输入节点，无后缀 = 生成节点
export type ImageNodeType = Node<ImageNodeData, 'imageNode'>;
export type PromptNodeType = Node<TextNodeData, 'promptNode'>; // promptNode 与 textNode 共用数据结构
export type TextNodeType = Node<TextNodeData, 'textNode'>;
export type VideoNodeType = Node<VideoNodeData, 'videoNode'>;
export type AudioInputNodeType = Node<AudioNodeData, 'audioInputNode'>; // 音频输入节点
export type AudioNodeType = Node<GenerateAudioNodeData, 'audioNode'>; // 音频生成节点（TTS）
export type GridSplitNodeType = Node<GridSplitNodeData, 'gridSplitNode'>;
export type GridMergeNodeType = Node<GridMergeNodeData, 'gridMergeNode'>;
export type CropNodeType = Node<CropNodeData, 'cropNode'>;
export type OmniNodeType = Node<OmniNodeData, 'omniNode'>; // 万能节点
export type TextInputNodeType = Node<TextInputNodeData, 'textInputNode'>;
export type VideoInputNodeType = Node<VideoInputNodeData, 'videoInputNode'>;
export type ImageInputNodeType = Node<ImageInputNodeData, 'imageInputNode'>;
export type D3NodeType = Node<Generate3DNodeData, 'd3Node'>; // 3D 生成节点
export type Viewer3DNodeType = Node<Viewer3DNodeData, 'viewer3DNode'>; // 3D 查看节点
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

export type AppNode = ImageNodeType | PromptNodeType | TextNodeType | VideoNodeType | AudioNodeType | GridSplitNodeType | GridMergeNodeType | CropNodeType | OmniNodeType | TextInputNodeType | VideoInputNodeType | ImageInputNodeType | D3NodeType | Viewer3DNodeType | PromptConstructorNodeType | AnnotateNodeType | ConditionalSwitchNodeType | EaseCurveNodeType | FrameGrabNodeType | ImageCompareNodeType | OutputGalleryNodeType | OutputNodeType | RouterNodeType | SwitchNodeType | VideoStitchNodeType | VideoTrimNodeType;

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