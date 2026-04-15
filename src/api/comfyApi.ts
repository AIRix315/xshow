// Ref: ComfyUI API + RunningHub API — 工作流执行引擎

import type { ComfyUINodeInfo, ComfyUISubType } from '@/types';

// =============================================================================
// Extension Context Fetch 代理（解决 SidePanel CORS 限制）
// =============================================================================

/**
 * 在 SidePanel 中直接 fetch localhost 会 CORS 失败，
 * 因此通过 background.js service worker 代理请求。
 */
async function extensionFetch(url: string, options?: RequestInit): Promise<Response> {
  // 检查是否在 Chrome 扩展环境中
  if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
    // signal 不能被序列化，发送前删掉
    const { signal: _signal, ...cleanOptions } = options ?? {};
    return new Promise((resolve, reject) => {
      console.log('[ComfyAPI] Proxying fetch to background:', url);
      chrome.runtime.sendMessage(
        { type: 'comfy-fetch', url, options: cleanOptions },
        (response) => {
          console.log('[ComfyAPI] Background response:', response);
          if (response?.success) {
            resolve(new Response(JSON.stringify(response.data), {
              status: response.status,
              statusText: response.status === 200 ? 'OK' : 'Error',
              headers: new Headers(response.headers),
            }));
          } else {
            reject(new Error(response?.error ?? 'Proxy fetch failed'));
          }
        }
      );
    });
  }
  // 非扩展环境直接 fetch
  return fetch(url, options);
}

interface ComfyWorkflowParams {
  channelUrl: string;
  channelKey: string;
  subType: ComfyUISubType;
  workflowId?: string;           // RunningHub 模式使用
  workflowJson?: string;         // 本地/Cloud 模式直接传入 JSON
  nodeInfoList?: ComfyUINodeInfo[];
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
}

/**
 * ComfyUI 工作流执行结果
 * 支持单一输出（outputUrl）和批量输出（outputUrls）
 */
export interface ComfyWorkflowResult {
  /** 主要输出 URL（向后兼容，取 outputUrls[0]） */
  outputUrl: string;
  /** 所有输出 URL 数组（ComfyUI 批量输出场景） */
  outputUrls: string[];
}

// =============================================================================
// ComfyUI 本地 / Cloud 执行
// =============================================================================

async function executeComfyLocalOrCloud(
  params: ComfyWorkflowParams,
): Promise<ComfyWorkflowResult> {
  const { channelUrl, channelKey, workflowId, workflowJson: providedJson, nodeInfoList, onProgress, signal } = params;
  const baseUrl = channelUrl.replace(/\/$/, '');

  // 解析工作流 JSON（优先使用直接提供的，否则通过 API 获取）
  let workflow: Record<string, unknown>;

  if (providedJson) {
    // 直接使用粘贴的 JSON
    try {
      workflow = JSON.parse(providedJson);
    } catch {
      throw new Error('工作流 JSON 格式错误');
    }
  } else {
    // 1. 通过 API 获取工作流 JSON
    const getWorkflowUrl = `${baseUrl}/api/openapi/getJsonApiFormat`;
    const workflowResponse = await extensionFetch(getWorkflowUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: channelKey, workflowId }),
      signal,
    });

    if (!workflowResponse.ok) {
      throw new Error(`获取工作流失败: ${workflowResponse.status}`);
    }

    const respJson = await workflowResponse.json();
    if (respJson.code !== 0) {
      throw new Error(`获取工作流失败: ${respJson.msg}`);
    }

    const workflowStr = respJson.data?.prompt;
    if (!workflowStr) {
      throw new Error('获取工作流失败: 未找到 prompt 字段');
    }

    workflow = JSON.parse(workflowStr);
  }

  // 2. 替换 nodeInfoList 中的字段
  // 重要：只替换用户显式修改的字段，保留工作流原始值
  if (nodeInfoList && nodeInfoList.length > 0) {
    for (const nodeInfo of nodeInfoList) {
      const node = workflow[nodeInfo.nodeId] as Record<string, unknown> | undefined;
      if (node?.inputs) {
        const inputs = node.inputs as Record<string, unknown>;
        
        // 跳过空值替换：空字符串会破坏节点 ID 引用
        // ComfyUI 期望 "images": ["3"] 这种节点引用格式，不能被替换为空字符串
        if (nodeInfo.defaultValue === undefined || nodeInfo.defaultValue === '') {
          continue; // 保留工作流原始值
        }
        
        // 对于有值的字段，执行替换
        inputs[nodeInfo.fieldName] = nodeInfo.defaultValue;
      }
    }
  }

  // 2.5 强制重新执行：破坏缓存
  // ComfyUI 会缓存执行结果，相同输入不重新执行
  // 添加动态参数确保每次都生成新文件
  const timestamp = Date.now();
  const randomSeed = Math.floor(Math.random() * 2 ** 32);
  
  for (const nodeId of Object.keys(workflow)) {
    const node = workflow[nodeId] as Record<string, unknown>;
    const classType = node?.class_type as string | undefined;
    const inputs = node?.inputs as Record<string, unknown> | undefined;
    
    if (!inputs) continue;
    
    // KSampler 等采样器节点：修改 seed 强制重新生成
    if (classType && /KSampler|Sampler|CustomSampler/i.test(classType)) {
      if ('seed' in inputs) {
        inputs.seed = randomSeed;
      }
      if ('noise_seed' in inputs) {
        inputs.noise_seed = randomSeed;
      }
    }
    
    // SaveImage 节点：修改文件名前缀避免覆盖
    if (classType === 'SaveImage' || classType === 'Save image') {
      inputs.filename_prefix = `output_${timestamp}`;
    }
  }

  // 3. 提交任务
  const promptId = `${Date.now()}`;
  const submitBody = JSON.stringify({ prompt: workflow, prompt_id: promptId });
  console.log('[ComfyAPI] Submitting workflow:', { promptId, workflowSize: submitBody.length });
  
  const submitResponse = await extensionFetch(`${baseUrl}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: submitBody,
    signal,
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    console.error('[ComfyAPI] Submit failed:', submitResponse.status, errorText);
    throw new Error(`提交任务失败: ${submitResponse.status} - ${errorText.substring(0, 500)}`);
  }

  // 4. 轮询结果
  const pollInterval = 3000;
  const maxAttempts = 200; // 最多 10 分钟

  for (let i = 0; i < maxAttempts; i++) {
    if (signal?.aborted) throw new Error('任务已取消');

    if (onProgress) {
      onProgress((i / maxAttempts) * 0.9); // 0-90% 是提交到完成之间
    }

    await new Promise((r) => setTimeout(r, pollInterval));

    const historyResponse = await extensionFetch(`${baseUrl}/history/${promptId}`, {
      signal,
    });

    if (historyResponse.ok) {
      const historyJson = await historyResponse.json();
        if (historyJson[promptId]) {
          // 任务完成
          const result = historyJson[promptId];
          const outputs = result.outputs ?? {};
          const allUrls: string[] = [];
          
          // 收集所有图片输出
          for (const nodeId of Object.keys(outputs)) {
            const output = outputs[nodeId];
            if (output?.images) {
              for (const img of output.images) {
                if (img && typeof img === 'object' && 'filename' in img) {
                  const subfolder = img.subfolder ? `&subfolder=${encodeURIComponent(img.subfolder)}` : '';
                  allUrls.push(`${baseUrl}/view?filename=${encodeURIComponent(img.filename)}&type=${img.type ?? 'output'}${subfolder}`);
                }
              }
            }
            if (output?.audio) {
              for (const aud of output.audio) {
                if (aud && typeof aud === 'object' && 'filename' in aud) {
                  const subfolder = aud.subfolder ? `&subfolder=${encodeURIComponent(aud.subfolder)}` : '';
                  allUrls.push(`${baseUrl}/view?filename=${encodeURIComponent(aud.filename)}&type=${aud.type ?? 'output'}${subfolder}`);
                }
              }
            }
          }
          
          if (allUrls.length > 0) {
            return { outputUrl: allUrls[0]!, outputUrls: allUrls };
          }
          
          // 没有找到媒体输出，返回完整结果 JSON
          const jsonStr = JSON.stringify(result);
          return { outputUrl: jsonStr, outputUrls: [jsonStr] };
        }
    }
  }

  throw new Error('任务超时: 轮询次数达到上限');
}

// =============================================================================
// 统一入口
// =============================================================================

export async function executeComfyWorkflow(
  params: ComfyWorkflowParams,
): Promise<ComfyWorkflowResult> {
  // RH 模式已迁移到独立的 RhAppNode/RhWfNode
  // 此处只处理 local 和 cloud 模式
  return executeComfyLocalOrCloud(params);
}

// =============================================================================
// 连接测试
// =============================================================================

export interface ComfyConnectionTestResult {
  ok: boolean;
  message: string;
  workflows?: string[];  // 本地/Cloud 模式返回工作流列表
  apps?: Array<{ id: string; name: string }>;  // RH APP 模式返回 APP 列表
}

/** 测试 ComfyUI 连接 */
export async function testComfyConnection(
  subType: ComfyUISubType,
  url: string,
  _apiKey: string = '',
): Promise<ComfyConnectionTestResult> {
  const baseUrl = url.replace(/\/$/, '');

  try {
    switch (subType) {
      case 'local':
      case 'cloud': {
        // 测试 ComfyUI 系统信息（通过代理避免 SidePanel CORS）
        const sysResponse = await extensionFetch(`${baseUrl}/system_stats`);
        if (!sysResponse.ok) {
          return { ok: false, message: `连接失败: ${sysResponse.status}` };
        }
        const sysJson = await sysResponse.json();
        // 同时尝试获取工作流数量
        let workflowCount: number | undefined;
        try {
          const listResp = await extensionFetch(`${baseUrl}/userdata?dir=workflows&recurse=true`);
          if (listResp.ok) {
            const files: string[] = await listResp.json();
            const jsonFiles = files.filter((f: string) => f.endsWith('.json'));
            workflowCount = jsonFiles.length;
          }
        } catch { /* 非关键，忽略 */ }
        const countInfo = workflowCount !== undefined ? `，发现 ${workflowCount} 个工作流文件` : '';
        return {
          ok: true,
          message: `已连接 ComfyUI ${sysJson.system?.comfyui_version ?? 'OK'}${countInfo}`,
        };
      }

      default:
        return { ok: false, message: '未知模式' };
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '连接失败' };
  }
}

/** 测试 RunningHub 连接（API Key 验证） */
export async function testRunninghubConnection(
  apiKey: string,
): Promise<ComfyConnectionTestResult> {
  try {
    const resp = await extensionFetch('https://www.runninghub.cn/uc/openapi/accountStatus', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ apikey: apiKey }),
    });
    const json = await resp.json();
    if (json.code === 0) {
      return {
        ok: true,
        message: `已连接 RunningHub: 余额 ${json.data?.remainCoins ?? '?'} 币，${json.data?.remainMoney ?? '?'} 元`,
      };
    }
    return { ok: false, message: json.msg ?? 'API Key 无效' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : '连接失败' };
  }
}

/** 判断工作流 JSON 是否为 API 格式（数字 key + class_type） */
function isApiFormatWorkflow(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  // UI 格式特征：有 nodes 数组
  if (Array.isArray(obj['nodes'])) return false;
  // API 格式特征：存在数字 key 且其值为含 class_type 的对象
  for (const key of Object.keys(obj)) {
    if (/^\d+$/.test(key) && typeof obj[key] === 'object' && obj[key] !== null) {
      const node = obj[key] as Record<string, unknown>;
      if ('class_type' in node) return true;
    }
  }
  return false;
}


/**
 * 获取本地/Cloud ComfyUI 可用工作流列表（仅 API 格式工作流）
 *
 * 策略：
 * 1. 递归列出 workflows/ 目录下所有 .json 文件
 * 2. 并发读取每个文件内容，验证是否为 API 格式
 * 3. 返回通过验证的 API 格式工作流列表（显示名含相对路径）
 *
 * 路径映射：
 * - /userdata?dir=workflows 返回的路径是相对于 workflows/ 子目录的
 *   例如 "03-API-ZImage.json"、"Backup/xxx.json"
 * - /userdata/{file} 的 {file} 是相对于用户根目录 (user/default/)
 *   所以需要加上 "workflows/" 前缀，例如 "workflows/03-API-ZImage.json"
 * - 目录分隔符需 URL 编码为 %2F（aiohttp 路由要求）
 */
export async function fetchComfyWorkflows(
  url: string,
): Promise<string[]> {
  const baseUrl = url.replace(/\/$/, '');

  try {
    // 1. 递归获取 workflows/ 目录下的所有文件（包含子目录）
    const listResp = await extensionFetch(`${baseUrl}/userdata?dir=workflows&recurse=true`);
    console.log('[ComfyAPI] fetchComfyWorkflows response:', listResp.status, listResp.ok);
    if (!listResp.ok) {
      console.error('[ComfyAPI] Failed to list workflows, status:', listResp.status);
      return [];
    }
    const relativePaths: string[] = await listResp.json();
    const jsonFiles = relativePaths.filter((f: string) => f.endsWith('.json'));

    // 2. 并发读取并验证 API 格式
    const results = await Promise.all(
      jsonFiles.map(async (relPath: string) => {
        try {
          // 列表返回的路径相对于 workflows/ 目录，而 /userdata/{file} 相对于用户根目录
          // 所以需要加 "workflows/" 前缀
          // e.g. "03-API-ZImage.json" → "workflows/03-API-ZImage.json"
          // e.g. "Backup/xxx.json" → "workflows/Backup/xxx.json"
          const fullPath = `workflows/${relPath}`;
          const encodedPath = fullPath.split('/').map(seg => encodeURIComponent(seg)).join('%2F');
          const resp = await extensionFetch(`${baseUrl}/userdata/${encodedPath}`);
          if (!resp.ok) {
            console.warn('[ComfyAPI] Failed to read workflow:', relPath, resp.status);
            return null;
          }
          const data = await resp.json();
          if (!isApiFormatWorkflow(data)) {
            console.log('[ComfyAPI] Skipped non-API format workflow:', relPath);
            return null;
          }
          // 显示名返回相对于 workflows/ 的路径，不含 .json 后缀
          return relPath.replace(/\.json$/, '');
        } catch (err) {
          console.error('[ComfyAPI] Error reading workflow:', relPath, err);
          return null;
        }
      })
    );

    const validWorkflows = results.filter((f): f is string => f !== null);
    console.log('[ComfyAPI] Found', validWorkflows.length, 'API format workflows:', validWorkflows);
    return validWorkflows;
  } catch (err) {
    console.error('[ComfyAPI] fetchComfyWorkflows error:', err);
    return [];
  }
}

/** 获取本地/Cloud ComfyUI 单个工作流 JSON 内容 */
export async function fetchComfyWorkflowJson(
  url: string,
  filepath: string,
): Promise<string | null> {
  const baseUrl = url.replace(/\/$/, '');
  // 确保路径以 .json 结尾
  const jsonPath = filepath.endsWith('.json') ? filepath : `${filepath}.json`;
  // filepath 是相对于 workflows/ 目录的路径（如 "03-API-ZImage.json" 或 "Backup/xxx.json"）
  // /userdata/{file} 的 {file} 是相对于用户根目录，需加 "workflows/" 前缀
  const fullPath = `workflows/${jsonPath}`;
  const encoded = fullPath.split('/').map((seg) => encodeURIComponent(seg)).join('%2F');

  try {
    const resp = await extensionFetch(`${baseUrl}/userdata/${encoded}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

// =============================================================================
// 图片上传到 ComfyUI
// =============================================================================

/**
 * 上传图片到 ComfyUI 的 input 目录
 * 支持远程 URL 和 base64 data URL
 * 
 * @param baseUrl ComfyUI 服务器地址
 * @paramimageUrl 图片 URL（远程 URL 或 data:image/... 格式）
 * @param signal 可选的 AbortSignal
 * @returns 上传后的文件名（不含路径）
 */
export async function uploadImageToComfyUI(
  baseUrl: string,
  imageUrl: string,
  signal?: AbortSignal
): Promise<string> {
  const url = baseUrl.replace(/\/$/, '');
  
  // 生成唯一文件名
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  let filename = `xshow_${timestamp}_${randomSuffix}`;
  
  // 获取图片数据
  let imageBlob: Blob;
  
  if (imageUrl.startsWith('data:')) {
    // Base64 data URL
    const response = await fetch(imageUrl);
    imageBlob = await response.blob();
    
    // 从 data URL 提取扩展名
    const mimeMatch = imageUrl.match(/data:image\/(\w+);/);
    if (mimeMatch && mimeMatch[1]) {
      const ext = mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1];
      filename = `${filename}.${ext}`;
    } else {
      filename = `${filename}.png`;
    }
  } else {
    // 远程 URL
    const response = await fetch(imageUrl, { signal });
    if (!response.ok) {
      throw new Error(`下载图片失败: ${response.status}`);
    }
    imageBlob = await response.blob();
    
    // 从 URL 或 Content-Type 提取扩展名
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('png')) {
      filename = `${filename}.png`;
    } else if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      filename = `${filename}.jpg`;
    } else if (contentType.includes('webp')) {
      filename = `${filename}.webp`;
    } else if (contentType.includes('gif')) {
      filename = `${filename}.gif`;
    } else {
      // 从 URL 提取扩展名
      const urlWithoutQuery = imageUrl.split('?')[0] || '';
      const lastDotIndex = urlWithoutQuery.lastIndexOf('.');
      const urlExt = lastDotIndex > 0 ? urlWithoutQuery.substring(lastDotIndex + 1).toLowerCase() : '';
      if (urlExt === 'png' || urlExt === 'jpg' || urlExt === 'jpeg') {
        filename = `${filename}.${urlExt === 'jpeg' ? 'jpg' : urlExt}`;
      } else if (urlExt === 'webp' || urlExt === 'gif') {
        filename = `${filename}.${urlExt}`;
      } else {
        filename = `${filename}.png`;
      }
    }
  }
  
  // 上传到 ComfyUI（必须直接 fetch，不能用 extensionFetch 代理）
  // FormData 无法通过 chrome.runtime.sendMessage 序列化，
  // 但 ComfyUI 启用了 CORS（--enable-cors-header），SidePanel 可直连
  const formData = new FormData();
  formData.append('image', imageBlob, filename);
  formData.append('overwrite', 'true');
  
  const uploadResponse = await fetch(`${url}/upload/image`, {
    method: 'POST',
    body: formData,
    signal,
  });
  
  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`上传图片到 ComfyUI 失败: ${uploadResponse.status} - ${errorText.substring(0, 200)}`);
  }
  
  const uploadResult = await uploadResponse.json();
  // ComfyUI 返回 { name: "filename.png", subfolder: "", type: "input" }
  return uploadResult.name || filename;
}

// =============================================================================
// 工作流节点解析
// =============================================================================

/** 工作流节点字段 */
export interface WorkflowNodeField {
  name: string;           // 字段名，如 "text", "width", "image_path"
  value: unknown;         // 当前值
  type: 'STRING' | 'NUMBER' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'MODEL' | 'FLOAT' | 'INT' | 'BOOLEAN' | 'UNKNOWN';
  label: string;           // 中文标签
  options?: string[];     // 可选值（如果有）
}

/** 工作流节点 */
export interface WorkflowNode {
  nodeId: string;
  classType: string;       // 节点类型，如 "CLIPTextEncode"
  inputs: Record<string, WorkflowNodeField>;
}

/**
 * 解析 workflow JSON，提取所有可编辑节点和字段
 */
export function parseWorkflowNodes(workflowJson: string): WorkflowNode[] {
  let workflow: Record<string, unknown>;
  try {
    workflow = JSON.parse(workflowJson);
  } catch {
    return [];
  }

  const nodes: WorkflowNode[] = [];

  for (const [nodeId, nodeData] of Object.entries(workflow)) {
    if (!/^\d+$/.test(nodeId)) continue;
    if (typeof nodeData !== 'object' || nodeData === null) continue;

    const node = nodeData as Record<string, unknown>;
    const classType = node['class_type'] as string | undefined;
    if (!classType) continue;

    const inputsRaw = node['inputs'] as Record<string, unknown> | undefined;
    if (!inputsRaw) continue;

    const inputs: Record<string, WorkflowNodeField> = {};

    for (const [fieldName, fieldValue] of Object.entries(inputsRaw)) {
      inputs[fieldName] = {
        name: fieldName,
        value: fieldValue,
        type: guessFieldType(fieldName, fieldValue),
        label: fieldName,
      };
    }

    nodes.push({ nodeId, classType, inputs });
  }

  return nodes;
}

/** 根据字段名和值推断类型 */
function guessFieldType(fieldName: string, value: unknown): WorkflowNodeField['type'] {
  // 图片类
  if (/\b(image|img|picture|photo|photo_path|image_path)\b/i.test(fieldName)) return 'IMAGE';
  // 视频类
  if (/\b(video|clip|movie|video_path)\b/i.test(fieldName)) return 'VIDEO';
  // 音频类
  if (/\b(audio|sound|voice|audio_path|audio_path)\b/i.test(fieldName)) return 'AUDIO';
  // 模型类
  if (/\b(model|ckpt|lora|vae|checkpoint|model_name|ckpt_name)\b/i.test(fieldName)) return 'MODEL';
  // 整数类
  if (/\b(width|height|size|fps|frames|steps|seed|batch|count|rows|columns|latent_)\b/i.test(fieldName) && typeof value === 'number') return 'INT';
  // 浮点类
  if (/\b(density|scale|ratio|strength|guidance|weight|latent_)\b/i.test(fieldName) && typeof value === 'number') return 'FLOAT';
  // 布尔类
  if (typeof value === 'boolean') return 'BOOLEAN';
  // 字符串类
  return 'STRING';
}

/** 获取 RunningHub 工作流列表 */
export async function fetchRunninghubWorkflows(
  apiKey: string,
): Promise<string[]> {
  try {
    const resp = await extensionFetch('https://www.runninghub.cn/api/openapi/getWorkflowList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const json = await resp.json();
    if (json.code === 0 && Array.isArray(json.data)) {
      return json.data.map((w: { workflowId?: string; name?: string }) => w.workflowId ?? w.name ?? '');
    }
    return [];
  } catch {
    return [];
  }
}

/** 获取 RunningHub APP 列表 */
export async function fetchRunninghubApps(
  apiKey: string,
): Promise<Array<{ id: string; name: string }>> {
  try {
    const resp = await extensionFetch('https://www.runninghub.cn/api/openapi/getWebappList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    });
    const json = await resp.json();
    if (json.code === 0 && Array.isArray(json.data)) {
      return json.data.map((app: { webappId?: string; appName?: string }) => ({
        id: app.webappId ?? '',
        name: app.appName ?? app.webappId ?? '',
      }));
    }
    return [];
  } catch {
    return [];
  }
}
