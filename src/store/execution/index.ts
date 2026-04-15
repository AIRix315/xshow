/**
 * Node Executor Registry
 *
 * 导出所有执行器和类型
 * 命名规范：Input 后缀 = 输入节点，无后缀 = 生成节点
 */

export type { NodeExecutionContext, NodeExecutor, NodeExecutorRegistry } from './types';

// 简单节点执行器
export {
  executeOutput,
  executeOutputGallery,
  executeImageInput,
  executeVideoInput,
  executeAudioInput,
  executeTextInput,
  executeCrop,
  executeAnnotate,
  executeFrameGrab,
  executeVideoTrim,
  executeVideoStitch,
  executeImageCompare,
  executeGridSplit,
} from './simpleNodeExecutors';

// 生成节点执行器
export {
  executeImageNode,
  executeTextNode,
  executeVideoNode,
  executeAudioNode,
} from './generateNodeExecutors';

// 万能节点执行器
export { executeOmniNode } from './omniExecutor';

// RH 节点执行器
export { executeRhAppNode } from './rhAppExecutor';
export { executeRhWfNode } from './rhWfExecutor';
export { executeRhZipNode, executeRhZipLocal } from './rhZipExecutor';

import type { NodeExecutor, NodeExecutorRegistry } from './types';
import {
  executeOutput,
  executeOutputGallery,
  executeImageInput,
  executeVideoInput,
  executeAudioInput,
  executeTextInput,
  executeCrop,
  executeAnnotate,
  executeFrameGrab,
  executeVideoTrim,
  executeVideoStitch,
  executeImageCompare,
  executeGridSplit,
} from './simpleNodeExecutors';
import {
  executeImageNode,
  executeTextNode,
  executeVideoNode,
  executeAudioNode,
} from './generateNodeExecutors';
import { executeOmniNode } from './omniExecutor';
import { executeRhAppNode } from './rhAppExecutor';
import { executeRhWfNode } from './rhWfExecutor';
import { executeRhZipNode } from './rhZipExecutor';

/**
 * 节点类型到执行器的映射表
 * 
 * XShow 架构：用户可配置任意供应商和模型
 * 命名规范：Input 后缀 = 输入节点，无后缀 = 生成节点
 * 
 * - imageInputNode/imageNode: 图片输入/生成
 * - videoInputNode/videoNode: 视频输入/生成
 * - audioInputNode/audioNode: 音频输入/生成（TTS）
 * - textInputNode/textNode: 文本输入/生成（LLM）
 * - promptNode: 提示词节点（与 textNode 共用执行器）
 * - omniNode: 万能节点（HTTP API / ComfyUI）
 */
export const nodeExecutors: NodeExecutorRegistry = {
  // 输出节点
  outputNode: executeOutput,
  outputGalleryNode: executeOutputGallery,

  // 输入节点（数据透传）
  imageInputNode: executeImageInput,
  videoInputNode: executeVideoInput,
  audioInputNode: executeAudioInput,
  textInputNode: executeTextInput,
  viewer3DNode: undefined as unknown as NodeExecutor, // 3D 查看器无执行逻辑

  // 生成节点
  imageNode: executeImageNode,
  textNode: executeTextNode,
  promptNode: executeTextNode, // 提示词节点与文本节点共用执行器
  videoNode: executeVideoNode,
  audioNode: executeAudioNode, // 音频生成（TTS）
  d3Node: undefined as unknown as NodeExecutor, // 3D 生成（待实现）

  // 处理节点
  cropNode: executeCrop,
  annotateNode: executeAnnotate,
  frameGrabNode: executeFrameGrab,
  videoTrimNode: executeVideoTrim,
  videoStitchNode: executeVideoStitch,
  imageCompareNode: executeImageCompare,
  gridSplitNode: executeGridSplit,

  // 万能节点
  omniNode: executeOmniNode,

  // RH 节点
  rhAppNode: executeRhAppNode,
  rhWfNode: executeRhWfNode,
  rhZipNode: executeRhZipNode,
};

/**
 * 获取节点执行器
 */
export function getNodeExecutor(nodeType: string): NodeExecutor | undefined {
  return nodeExecutors[nodeType];
}

/**
 * 检查节点是否有执行器
 */
export function hasNodeExecutor(nodeType: string): boolean {
  return nodeType in nodeExecutors && nodeExecutors[nodeType] !== undefined;
}