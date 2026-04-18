// 核心数据结构定义 + @xyflow/react Node 类型
import type { Node, Edge } from '@xyflow/react';

// 通道配置与全局 API 配置
export type ComfyUISubType = 'local' | 'cloud';

// 模型条目（单个模型配置）
export interface ModelEntry {
  id: string;          // 唯一标识
  name: string;        // 模型名称（如 "Qwen2.5-7B"）
  provider: string;    // 供应商名称（如 "ollama"）
  speed?: number;      // 最近一次连接速度(ms)，undefined表示未测试
  isDefault: boolean;  // 是否默认
}

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
  runninghubWorkflows: RunningHubWorkflow[];  // 工作流列表
  runninghubApps: RunningHubApp[]; // APP 列表
}

// RunningHub APP 配置
export interface RunningHubApp {
  id: string;         // webappId
  name: string;       // 显示名称
  quickCreateCode?: string;  // quickCreateCode（可选）
}

// RunningHub Workflow 配置
export interface RunningHubWorkflow {
  id: string;         // workflowId
  name: string;       // 显示名称（别名）
}

export interface ChannelConfig {
  id: string;               // 唯一标识
  name: string;             // 供应商名称
  url: string;              // API 端点地址
  key: string;              // API 密钥
  protocol: 'openai' | 'gemini' | 'anthropic' | 'custom' | 'comfyui' | 'rhapi';  // 协议类型
  comfyuiSubType?: ComfyUISubType;  // 仅 protocol='comfyui' 时有效
}

// 动态模型参数规范
export interface ModelParams {
  // 图片参数
  aspectRatio?: { options: string[]; default: string; };  // 画面比例
  size?: { options: string[]; default: string; };        // 尺寸
  quality?: { options: string[]; default: string; };      // 质量
  // 图片专用
  imageGenerationMode?: ('text-to-image' | 'image-to-image')[];  // 支持的生成模式
  // 视频参数
  duration?: { options: string[]; default: string; };     // 视频时长
  // 音频参数
  voice?: { options: string[]; default: string; };        // 音色
  // 3D 参数
  format?: { options: string[]; default: string; };        // 格式
}

export interface ApiConfig {
  channels: ChannelConfig[];       // 供应商池
  imageChannelId: string;          // 生图供应商 ID
  drawingModel: string;            // 生图模型（兼容旧版换行分隔，新版用 modelEntries）
  videoChannelId: string;           // 生视频供应商 ID
  videoModel: string;              // 生视频模型（兼容旧版换行分隔，新版用 modelEntries）
  textChannelId: string;            // LLM 供应商 ID
  textModel: string;                // LLM 模型（兼容旧版换行分隔，新版用 modelEntries）
  audioChannelId: string;           // 语音供应商 ID
  audioModel: string;               // 语音模型（兼容旧版换行分隔，新版用 modelEntries）
  model3DChannelId: string;        // 3D模型供应商 ID
  model3D: string;                  // 3D模型（兼容旧版，新版用 modelEntries）
  ttsVoice: string;                 // TTS 语音标识，用户自定义填入
  videoDurations: string;           // 视频时长选项，换行分隔
  audioDurations: string;           // 音频时长选项，换行分隔
  presetPrompts: PresetPrompt[];    // 预设词
  // 模型列表（新版：每个类型的模型列表）
  modelEntries: Record<string, ModelEntry[]>;  // key: 'text'|'image'|'video'|'audio'|'3d'
  // ComfyUI 工作流列表
  comfyuiLocalWorkflows: string;
  comfyuiCloudWorkflows: string;
  comfyuiRunninghubWorkflows: string;
}

// 资源中转站
export interface TransitResource {
  id: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'text';
  timestamp: number;
  pageUrl: string;
  pageTitle: string;
  isFavorite?: boolean;        // 收藏标记
}

// 预设词
export interface PresetPrompt {
  title: string;
  prompt: string;
  type: 'image' | 'text' | 'video' | 'all';
  enabled: boolean;
}

// 节点基础数据 (Ref: node-banana BaseNodeData)
export interface BaseNodeData extends Record<string, unknown> {
  label?: string;
  loading?: boolean;
  errorMessage?: string;
}

// 图片节点数据
export interface ImageNodeData extends BaseNodeData {
  imageUrl?: string;
  prompt: string;
  aspectRatio: string;     // '16:9', '1:1' 等
  imageSize: string;        // '1K', '2K' 等
  customWidth?: string;     // 自定义宽度
  customHeight?: string;    // 自定义高度
  selectedModel?: string;
  drawingModel: string;     // 换行分隔多模型
  selectedContextResources: TransitResource[];
  loading: boolean;
  errorMessage?: string;
  presetPrompts: PresetPrompt[];
  // rhapi 协议字段
  imageGenerationMode?: 'text-to-image' | 'image-to-image';  // 文生图/图生图切换
  modelParams?: ModelParams;  // 动态模型参数规范
  // 历史轮播
  imageHistory?: Array<{ imageUrl: string; prompt: string; timestamp: number }>;
  selectedHistoryIndex?: number;
}

// 文本节点数据
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

// 视频节点数据
export interface VideoNodeData extends BaseNodeData {
  videoUrl?: string;
  thumbnailUrl?: string;
  prompt: string;
  size: string;
  imageSize?: string;        // 兼容 imageSize 字段
  aspectRatio?: string;     // '16:9', '1:1' 等
  customWidth?: string;     // 自定义宽度
  customHeight?: string;    // 自定义高度
  selectedModel?: string;
  videoModel: string;
  videoDurations: string;
  selectedSeconds?: string;
  customDuration?: string; // 自定义时长
  selectedContextResources: TransitResource[];
  loading: boolean;
  progress?: number;
  errorMessage?: string;
  presetPrompts: PresetPrompt[];
  onGenerateVideo?: (nodeId: string, prompt: string, size: string, model?: string, duration?: string) => void;
  onAddImage?: (nodeId: string, dataUrl: string) => void;
  onStop?: (nodeId: string) => void;
  onShowToast?: (msg: string) => void;
  // rhapi 协议字段
  videoGenerationMode?: 'text-to-video' | 'image-to-video';  // 文生视频/图生视频切换
  // 历史轮播
  videoHistory?: Array<{ videoUrl: string; thumbnailUrl: string; prompt: string; timestamp: number }>;
  selectedVideoHistoryIndex?: number;
}

// 音频输入节点数据（audioInputNode）
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

// 音频生成节点数据（audioNode - TTS）
export interface GenerateAudioNodeData extends BaseNodeData {
  text?: string;
  voice?: string;
  audioUrl?: string;
  loading?: boolean;
  errorMessage?: string;
  selectedChannelId?: string;
  selectedModel?: string;
  audioDuration?: string;
}

// 宫格分拆节点
export interface GridSplitNodeData extends BaseNodeData {
  /** 行数 */
  gridRows: number;
  /** 列数 */
  gridCols: number;
  /** 单元格最大输出尺寸（可选，0 = 保持原图宽高比） */
  cellSize: number;
  /** 预设布局 key，如 "2x2"、"2x3" */
  presetKey: string;
  /** 拆分结果 DataURL 数组 */
  splitResults?: string[];
  /** 参考连接的子 ImageInput 节点 ID 列表（可选创建） */
  childNodeIds?: Array<{ imageInputId: string }>;
  /** 是否已创建子节点 */
  hasChildNodes?: boolean;
  [key: string]: unknown;
}

// 宫格合拼节点
export interface GridMergeNodeData extends BaseNodeData {
  /** 行数 */
  gridRows: number;
  /** 列数 */
  gridCols: number;
  /** 单元格尺寸 */
  cellSize: number;
  /** 合并结果 DataURL */
  mergedImageUrl?: string;
  /** 预设布局 key */
  presetKey: string;
  [key: string]: unknown;
}

// 万能节点配置
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
  comfyuiSubType?: 'local' | 'cloud';
  // ComfyUI 独立的输出类型（不继承 HTTP 模式）
  comfyuiOutputType?: 'auto' | 'text' | 'image' | 'video' | 'audio';
  // 工作流标识
  workflowId?: string;           // RunningHub workflowId
  workflowJson?: string;         // 本地/Cloud 工作流 JSON
  workflowName?: string;          // 工作流显示名称
  // 节点字段映射
  nodeInfoList?: ComfyUINodeInfo[];
}

// RunningHub APP 节点配置
export interface RhAppNodeConfig {
  /** 选中的 APP ID（webappId） */
  appId?: string;
  /** APP 显示名称 */
  appName?: string;
  /** 输出类型 */
  outputType?: 'auto' | 'text' | 'image' | 'video' | 'audio';
  /** 节点字段映射（nodeInfoList）- AI App 完整格式 */
  nodeInfoList?: Array<{
    nodeId: string;
    nodeName: string;
    fieldName: string;
    fieldValue: string;
    fieldType: string;
    description: string;
    fieldData?: string;       // LIST 类型的选项数据（JSON 字符串）
    descriptionEn?: string;   // 英文描述
  }>;
}

// RunningHub Workflow 节点配置
export interface RhWfNodeConfig {
  /** 选中的 Workflow ID */
  workflowId?: string;
  /** Workflow 显示名称 */
  workflowName?: string;
  /** 输出类型 */
  outputType?: 'auto' | 'text' | 'image' | 'video' | 'audio';
  /** 节点字段映射（nodeInfoList）- 提交时使用 */
  nodeInfoList?: ComfyUINodeInfo[];
  /** 节点字段值缓存（用于画布级执行，存储用户编辑的值） */
  nodeValues?: Record<string, Record<string, unknown>>;
  /** 工作流 JSON（缓存） */
  workflowJson?: string;
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
  outputUrlTypes?: string[]; // 每个 URL 的类型注解 ['image'|'video'|'audio']
  textOutput?: string;       // 文本输出
  errorMessage?: string;
  // ComfyUI 工作流节点值缓存（用于画布级执行）
  nodeValues?: Record<string, Record<string, unknown>>;
  onAIAssist?: (desc: string, config: OmniNodeConfig) => Promise<string>;
  onGenerateCustom?: (nodeId: string) => void;
  onSaveTemplate?: (name: string, config: OmniNodeConfig) => void;
  onShowToast?: (msg: string) => void;
  onStop?: (nodeId: string) => void;
}

// RunningHub APP 节点数据
export interface RhAppNodeData extends BaseNodeData {
  label: string;
  configMode: boolean;
  config: RhAppNodeConfig;
  loading: boolean;
  progress?: number;
  // 标准化输出字段
  outputUrl?: string;
  outputUrls?: string[];
  outputUrlTypes?: string[]; // 每个 URL 的类型注解 ['image'|'video'|'audio']
  textOutput?: string;
  errorMessage?: string;
  /** 节点字段值缓存 */
  nodeValues?: Record<string, Record<string, unknown>>;
}

// RunningHub Workflow 节点数据
export interface RhWfNodeData extends BaseNodeData {
  label: string;
  configMode: boolean;
  config: RhWfNodeConfig;
  loading: boolean;
  progress?: number;
  // 标准化输出字段
  outputUrl?: string;
  outputUrls?: string[];
  outputUrlTypes?: string[]; // 每个 URL 的类型注解 ['image'|'video'|'audio']
  textOutput?: string;
  errorMessage?: string;
  /** 节点字段值缓存 */
  nodeValues?: Record<string, Record<string, unknown>>;
}

// ZIP 解压节点配置
export interface RhZipNodeConfig {
  /** 输出类型 */
  outputType?: 'auto' | 'image' | 'video' | 'audio';
}

// ZIP 解压节点数据
export interface RhZipNodeData extends BaseNodeData {
  label: string;
  /** 输入的 ZIP URL（上游传入或手动输入） */
  zipUrl?: string;
  /** 本地上传的 ZIP 文件名 */
  zipFileName?: string;
  /** 标准化输出字段（供下游节点读取） */
  outputUrl?: string;
  outputUrls?: string[];
  outputUrlTypes?: string[]; // 每个 URL 的类型注解 ['image'|'video'|'audio']
  textOutput?: string;
  loading: boolean;
  errorMessage?: string;
  /** 提取的文件数量信息 */
  extractedInfo?: string;
}

// 全局任务追踪
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

// 裁剪节点数据
export interface CropNodeData extends BaseNodeData {
  sourceImageUrl?: string;
  onCropComplete?: (nodeId: string, croppedDataUrl: string) => void;
  onCancel?: (nodeId: string) => void;
}

// 输入节点数据
export interface TextInputNodeData extends BaseNodeData { text?: string; filename?: string; }
export interface VideoInputNodeData extends BaseNodeData { videoUrl?: string; filename?: string; }
export interface ImageInputNodeData extends BaseNodeData { imageUrl?: string; filename?: string; isOptional?: boolean; dimensions?: { width: number; height: number }; }
// 3D 节点数据
export interface Generate3DNodeData extends BaseNodeData { prompt?: string; modelUrl?: string; progress?: number; selectedChannelId?: string; selectedModel?: string; }
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

// 画布项目
export interface Project {
  id: string;          // 默认 "default"
  name: string;        // 项目名
}

// 项目文件格式（导出/导入 JSON）
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

// 自定义节点模板
export interface CustomNodeTemplate {
  id: string;
  name: string;
  config: OmniNodeConfig;
}

// ReactFlow Node 类型别名
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
export type RhAppNodeType = Node<RhAppNodeData, 'rhAppNode'>;
export type RhWfNodeType = Node<RhWfNodeData, 'rhWfNode'>;
export type RhZipNodeType = Node<RhZipNodeData, 'rhZipNode'>;

export type AppNode = ImageNodeType | PromptNodeType | TextNodeType | VideoNodeType | AudioNodeType | GridSplitNodeType | GridMergeNodeType | CropNodeType | OmniNodeType | TextInputNodeType | VideoInputNodeType | ImageInputNodeType | D3NodeType | Viewer3DNodeType | PromptConstructorNodeType | AnnotateNodeType | ConditionalSwitchNodeType | EaseCurveNodeType | FrameGrabNodeType | ImageCompareNodeType | OutputGalleryNodeType | OutputNodeType | RouterNodeType | SwitchNodeType | VideoStitchNodeType | VideoTrimNodeType | RhAppNodeType | RhWfNodeType | RhZipNodeType;

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
  model3DChannelId: 'default',
  model3D: '',
  ttsVoice: '',
  videoDurations: '',
  audioDurations: '',
  presetPrompts: [],
  modelEntries: {},  // 模型列表
  comfyuiLocalWorkflows: '',
  comfyuiCloudWorkflows: '',
  comfyuiRunninghubWorkflows: '',
};

export const DEFAULT_PROJECT: Project = {
  id: 'default',
  name: '默认项目',
};