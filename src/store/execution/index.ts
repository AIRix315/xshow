/**
 * Node Executor Registry
 *
 * 导出所有执行器和类型
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
} from './simpleNodeExecutors';

// 万能节点执行器
export { executeUniversalNode } from './universalExecutor';

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
} from './simpleNodeExecutors';
import { executeUniversalNode } from './universalExecutor';

/**
 * 节点类型到执行器的映射表
 */
export const nodeExecutors: NodeExecutorRegistry = {
  // 输出节点
  outputNode: executeOutput,
  outputGalleryNode: executeOutputGallery,

  // 输入节点
  imageInputNode: executeImageInput,
  videoInputNode: executeVideoInput,
  audioInputNode: executeAudioInput,
  textInputNode: executeTextInput,

  // 处理节点
  cropNode: executeCrop,
  annotateNode: executeAnnotate,
  frameGrabNode: executeFrameGrab,
  videoTrimNode: executeVideoTrim,
  videoStitchNode: executeVideoStitch,
  imageCompareNode: executeImageCompare,

  // 万能节点
  customNode: executeUniversalNode,
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
  return nodeType in nodeExecutors;
}