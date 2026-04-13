// Ref: §6.10 + 产物反推 — 万能节点 (AI 驱动 API 适配器)
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
// Ref: node-banana — Store-only 模式
import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { UniversalNodeType, CustomNodeConfig } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { generateText } from '@/api/textApi';
import { executeComfyWorkflow, parseWorkflowNodes, fetchComfyWorkflowJson, uploadImageToComfyUI } from '@/api/comfyApi';
import { getConnectedInputs } from '@/utils/connectedInputs';
import BaseNodeWrapper from './BaseNode';
import { Save, Sparkles } from 'lucide-react';
import type { ComfyUISubType, ComfyUINodeInfo } from '@/types';

// 变量替换：{{变量名}} → 从变量映射中取值
function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}

// 根据 URL 推断媒体类型
function guessMediaType(url: string): 'image' | 'video' | 'audio' | 'unknown' {
  const lower = url.toLowerCase();
  if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(lower)) return 'audio';
  if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i.test(lower)) return 'image';
  // ComfyUI view 端点
  if (lower.includes('/view?') || lower.includes('/view?filename=')) return 'image';
  return 'unknown';
}

// 输出预览组件
function OutputPreview({
  loading,
  errorMessage,
  outputUrl,
  textOutput,
  outputType,
}: {
  loading: boolean;
  errorMessage: string;
  outputUrl?: string;
  textOutput?: string;
  outputType: string;
}) {
  if (loading) {
    return (
      <div className="min-h-[100px] flex-1 flex items-center justify-center bg-[#1a1a1a] rounded">
        <div className="flex items-center gap-2 text-neutral-500">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-[10px]">执行中...</span>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-[100px] flex-1 flex items-center justify-center bg-[#1a1a1a] rounded">
        <span className="text-[10px] text-error px-2 text-center">{errorMessage}</span>
      </div>
    );
  }

  // 智能判断：如果有 outputUrl，根据 URL 或 outputType 渲染
  if (outputUrl) {
    const mediaType = outputType !== 'text' ? outputType : guessMediaType(outputUrl);
    
    if (mediaType === 'image' || outputType === 'image') {
      return (
        <div className="min-h-[100px] flex-1 flex items-center justify-center bg-[#1a1a1a] rounded">
          <img
            src={outputUrl}
            alt="生成结果"
            className="max-w-full max-h-[200px] object-contain"
          />
        </div>
      );
    }
    if (mediaType === 'video' || outputType === 'video') {
      return (
        <div className="min-h-[100px] flex-1 flex items-center justify-center bg-[#1a1a1a] rounded">
          <video src={outputUrl} controls className="max-w-full max-h-[200px]" />
        </div>
      );
    }
    if (mediaType === 'audio' || outputType === 'audio') {
      return (
        <div className="min-h-[100px] flex-1 flex items-center justify-center bg-[#1a1a1a] rounded p-2">
          <audio src={outputUrl} controls className="w-full max-w-[280px]" />
        </div>
      );
    }
  }

  // 文本输出
  if (textOutput) {
    return (
      <div className="min-h-[100px] flex-1 bg-[#1a1a1a] rounded">
        <div className="bg-surface text-text text-[10px] rounded p-1.5 border border-border max-h-[120px] overflow-y-auto whitespace-pre-wrap break-all font-mono w-full">
          {textOutput}
        </div>
      </div>
    );
  }

  // 无内容
  return (
    <div className="min-h-[100px] flex-1 flex items-center justify-center bg-[#1a1a1a] rounded">
      <span className="text-[10px] text-text-muted">运行配置</span>
    </div>
  );
}

// 从 JSON 对象中按路径提取值 (e.g. "data.results.0.url")
function extractByPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const idx = parseInt(part, 10);
      current = current[idx];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

// 同步执行万能节点
async function executeSync(config: CustomNodeConfig, variables: Record<string, string>): Promise<string> {
  const url = replaceVariables(config.apiUrl, variables);
  const headers = JSON.parse(replaceVariables(config.headers, variables));
  const body = replaceVariables(config.body, variables);

  const response = await fetch(url, {
    method: config.method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: config.method !== 'GET' ? body : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`万能节点请求失败: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  if (config.rawTextOutput) {
    return await response.text();
  }

  const json = await response.json();
  const result = extractByPath(json, config.resultPath);
  if (result === undefined || result === null) {
    throw new Error(`万能节点: resultPath "${config.resultPath}" 未找到数据`);
  }
  return typeof result === 'string' ? result : JSON.stringify(result);
}

// 异步执行万能节点（提交任务 -> 轮询状态 -> 返回结果）
async function executeAsync(
  config: CustomNodeConfig,
  variables: Record<string, string>,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const url = replaceVariables(config.apiUrl, variables);
  const headers = JSON.parse(replaceVariables(config.headers, variables));
  const body = config.method !== 'GET' ? replaceVariables(config.body, variables) : undefined;

  // 1. 提交异步任务
  const submitResponse = await fetch(url, {
    method: config.method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
    signal,
  });

  if (!submitResponse.ok) {
    const errorText = await submitResponse.text();
    throw new Error(`异步任务提交失败: ${submitResponse.status} - ${errorText.substring(0, 200)}`);
  }

  const submitJson = await submitResponse.json();
  const taskId = String(extractByPath(submitJson, config.taskIdPath ?? 'id') ?? '');
  if (!taskId) {
    throw new Error('异步任务提交失败: 未获取到 taskId');
  }

  // 2. 轮询任务状态
  const pollInterval = 3000; // 3 秒
  const maxAttempts = 600; // 最多 30 分钟
  const pollHeaders = config.pollingHeaders
    ? JSON.parse(replaceVariables(config.pollingHeaders, variables))
    : {};

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error('任务已取消');

    const pollUrl = replaceVariables(config.pollingUrl ?? `${url}/${taskId}`, { ...variables, taskId });
    const pollMethod = config.pollingMethod ?? 'GET';

    const pollResponse = await fetch(pollUrl, {
      method: pollMethod,
      headers: { 'Content-Type': 'application/json', ...pollHeaders },
      signal,
    });

    if (!pollResponse.ok) {
      throw new Error(`轮询请求失败: ${pollResponse.status}`);
    }

    const pollJson = await pollResponse.json();
    const status = String(extractByPath(pollJson, config.pollingResultPath ?? 'status') ?? '');

    // 完成状态
    const completedValue = config.pollingCompletedValue ?? 'completed';
    if (status === completedValue || status === 'success' || status === 'done') {
      const resultPath = config.pollingResultDataPath ?? config.resultPath;
      const result = resultPath ? extractByPath(pollJson, resultPath) : pollJson;
      if (result === undefined || result === null) {
        throw new Error(`异步任务完成但未找到结果数据 (路径: "${resultPath}")`);
      }
      return typeof result === 'string' ? result : JSON.stringify(result);
    }

    // 失败状态
    const failedValue = config.pollingFailedValue ?? 'failed';
    if (status === failedValue || status === 'error') {
      const errorMsg = config.pollingErrorPath
        ? String(extractByPath(pollJson, config.pollingErrorPath) ?? '异步任务失败')
        : '异步任务失败';
      throw new Error(errorMsg);
    }

    // 进度
    if (config.pollingProgressPath && onProgress) {
      const progress = extractByPath(pollJson, config.pollingProgressPath);
      if (typeof progress === 'number') onProgress(progress);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('异步任务超时: 轮询次数达到上限');
}

function UniversalNodeComponent({ id, data, selected }: NodeProps<UniversalNodeType>) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);

  // Store-only: 业务数据从 data 读取
  const configMode = data.configMode ?? true;
  const config = data.config ?? {
    apiUrl: '',
    method: 'POST',
    headers: '{}',
    body: '',
    outputType: 'text',
    executionMode: 'sync',
    resultPath: '',
    executionType: 'http',
  };
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const progress = data.progress ?? 0;
  const nodeValues = (data.nodeValues ?? {}) as Record<string, Record<string, unknown>>;
  
  // 输出数据（根据 outputType 标准化）
  const outputUrl = data.outputUrl;
  const textOutput = data.textOutput;

  // UI 状态保留 useState
  const abortRef = useRef<AbortController | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState('');
  const [parsedNodes, setParsedNodes] = useState<ReturnType<typeof parseWorkflowNodes>>([]);

  // 从上游节点读取数据
  const upstreamData = useMemo(() => {
    return getConnectedInputs(id, nodes, edges);
  }, [id, nodes, edges]);

  // 从设置 Store 读取配置
  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const textChannelId = useSettingsStore((s) => s.apiConfig.textChannelId);
  const textModel = useSettingsStore((s) => s.apiConfig.textModel);
  const addTemplate = useSettingsStore((s) => s.addTemplate);
  const comfyuiConfig = useSettingsStore((s) => s.comfyuiConfig);

  const subType = config.comfyuiSubType ?? 'local';

  // 初始化时如果已有 selectedWorkflow，加载节点
  useEffect(() => {
    if (selectedWorkflow && !parsedNodes.length) {
      handleSelectWorkflow(selectedWorkflow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Store-only: 更新配置
  const updateConfig = useCallback((patch: Partial<CustomNodeConfig>) => {
    updateNodeData(id, { config: { ...config, ...patch } });
  }, [id, config, updateNodeData]);

  // 选择工作流后解析节点
  const handleSelectWorkflow = useCallback(async (workflowName: string) => {
    setSelectedWorkflow(workflowName);
    setParsedNodes([]);
    updateNodeData(id, { nodeValues: {} });

    if (!workflowName) return;

    const url = subType === 'cloud' ? comfyuiConfig.cloudUrl : comfyuiConfig.localUrl;
    if (!url) return;

    const jsonStr = await fetchComfyWorkflowJson(url, workflowName);
    if (!jsonStr) {
      updateNodeData(id, { errorMessage: `读取工作流 "${workflowName}" 失败` });
      return;
    }

    const parsedNodes = parseWorkflowNodes(jsonStr);
    setParsedNodes(parsedNodes);

    // 只初始化用户可编辑的字段（排除节点引用）
    const values: Record<string, Record<string, unknown>> = {};
    for (const node of parsedNodes) {
      values[node.nodeId] = {};
      for (const [field, fieldInfo] of Object.entries(node.inputs)) {
        const val = fieldInfo?.value;
        // 跳过节点引用（数组格式：[" nodeId", index]）
        if (Array.isArray(val)) {
          continue;
        }
        // 只保留用户可编辑的简单值
        if (val !== undefined && val !== null) {
          const nv = values[node.nodeId];
          if (nv) nv[field] = val;
        }
      }
    }
    updateNodeData(id, { nodeValues: values, config: { ...config, workflowJson: jsonStr } });
  }, [config.comfyuiSubType, comfyuiConfig.localUrl, comfyuiConfig.cloudUrl, id, config, updateNodeData]);

  // 节点字段值变化
  const handleNodeValueChange = useCallback((nodeId: string, field: string, value: unknown) => {
    const newValues = {
      ...nodeValues,
      [nodeId]: { ...nodeValues[nodeId], [field]: value },
    };
    updateNodeData(id, { nodeValues: newValues });
  }, [id, nodeValues, updateNodeData]);

  // 从 nodeValues 生成 nodeInfoList
  const generateNodeInfoList = useCallback((): ComfyUINodeInfo[] => {
    const list: ComfyUINodeInfo[] = [];
    for (const [nodeId, fields] of Object.entries(nodeValues)) {
      for (const [fieldName, value] of Object.entries(fields)) {
        const strValue = String(value ?? '');
        if (strValue.trim() !== '') {
          list.push({ nodeId, fieldName, defaultValue: strValue });
        }
      }
    }
    return list;
  }, [nodeValues]);

  // AI 辅助
  const handleAIAssist = useCallback(async () => {
    const channel = channels.find((c) => c.id === textChannelId);
    if (!channel) {
      updateNodeData(id, { errorMessage: '未选择文本供应商，无法使用 AI 辅助' });
      return;
    }

    const description = prompt('请描述你的 API 需求：');
    if (!description) return;

    updateNodeData(id, { loading: true, errorMessage: '' });
    try {
      const result = await generateText({
        channelUrl: channel.url,
        channelKey: channel.key,
        model: textModel.split('\n')[0] ?? 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `根据以下 API 需求描述，生成一个 JSON 配置。只返回 JSON，不要其他文字。
需求: ${description}
JSON 格式: { "apiUrl": "", "method": "POST", "headers": "{}", "body": "", "outputType": "text", "executionMode": "sync", "resultPath": "", "taskIdPath": "", "pollingUrl": "", "pollingResultPath": "", "pollingCompletedValue": "completed", "pollingFailedValue": "failed" }`,
        }],
      });

      const cleaned = result.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      updateNodeData(id, { config: { ...config, ...parsed }, configMode: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 辅助失败';
      updateNodeData(id, { errorMessage: msg, loading: false });
    }
  }, [channels, textChannelId, textModel, config, id, updateNodeData]);

  // 执行请求
  const handleExecute = useCallback(async () => {
    if (loading) return;
    updateNodeData(id, { loading: true, errorMessage: '', resultData: '', progress: 0 });

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // ComfyUI 执行模式
      if (config.executionType === 'comfyui') {
        const subType = config.comfyuiSubType ?? 'local';
        const currentComfyConfig = useSettingsStore.getState().comfyuiConfig;

        const getChannelConfig = () => {
          switch (subType) {
            case 'local':
              return { url: currentComfyConfig.localUrl, key: '' };
            case 'cloud':
              return { url: currentComfyConfig.cloudUrl, key: '' };
            case 'runninghub':
              return { url: '', key: currentComfyConfig.runninghubApiKey };
            case 'runninghubApp':
              return { url: '', key: currentComfyConfig.runninghubApiKey };
            default:
              return { url: '', key: '' };
          }
        };

        const { url, key } = getChannelConfig();

        if ((subType === 'local' || subType === 'cloud') && !config.workflowJson) {
          throw new Error('请先选择工作流');
        }
        if ((subType === 'runninghub' || subType === 'runninghubApp') && !config.workflowId) {
          throw new Error('请输入工作流 ID');
        }

        // 生成 nodeInfoList（保留工作流默认值）
        const processedNodeInfoList = Object.keys(nodeValues).length > 0 
          ? generateNodeInfoList() 
          : [...(config.nodeInfoList ?? [])];
        
        // 图生图场景：如有上游图片且有 IMAGE 类型字段，上传到 ComfyUI
        if (subType === 'local' && url && upstreamData.images.length > 0) {
          const imageFields = processedNodeInfoList.filter(n => n.fieldType === 'IMAGE');
          
          for (let i = 0; i < Math.min(imageFields.length, upstreamData.images.length); i++) {
            const field = imageFields[i];
            const imageUrl = upstreamData.images[i];
            
            if (field && imageUrl) {
              try {
                const comfyFilename = await uploadImageToComfyUI(url, imageUrl, abortController.signal);
                const fieldIndex = processedNodeInfoList.findIndex(n => n.nodeId === field.nodeId && n.fieldName === field.fieldName);
                if (fieldIndex >= 0) {
                  processedNodeInfoList[fieldIndex] = {
                    ...processedNodeInfoList[fieldIndex]!,
                    defaultValue: comfyFilename,
                  };
                }
              } catch (uploadErr) {
                console.error('[UniversalNode] 上传图片失败:', uploadErr);
                throw new Error(`上传图片到 ComfyUI 失败: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
              }
            }
          }
        }

        const result = await executeComfyWorkflow({
          channelUrl: url,
          channelKey: key,
          subType,
          workflowId: config.workflowId,
          workflowJson: config.workflowJson,
          nodeInfoList: processedNodeInfoList,
          onProgress: (p) => {
            updateNodeData(id, { progress: p });
          },
          signal: abortController.signal,
        });

        // ComfyUI 返回的通常是媒体 URL，智能判断
        const isMediaUrl = result.includes('/view?') || 
          /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav)(\?|$)/i.test(result);
        
        if (config.outputType === 'text' && !isMediaUrl) {
          updateNodeData(id, {
            textOutput: result,
            outputUrl: undefined,
            outputUrls: undefined,
            loading: false,
            configMode: false,
            progress: 0
          });
        } else {
          // 图片/视频/音频，或 ComfyUI 返回的媒体 URL
          updateNodeData(id, {
            outputUrl: result,
            textOutput: undefined,
            outputUrls: undefined,
            loading: false,
            configMode: false,
            progress: 0
          });
        }
        return;
      }

      // HTTP 执行模式
      const variables = config.variables ?? {};
      const result = config.executionMode === 'async'
        ? await executeAsync(config, variables, (p) => {
            updateNodeData(id, { progress: p });
          }, abortController.signal)
        : await executeSync(config, variables);

      // 智能判断：如果返回的是媒体 URL，写入 outputUrl
      const isMediaUrl = result.includes('/view?') || 
        /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav)(\?|$)/i.test(result);
      
      if (config.outputType === 'text' && !isMediaUrl) {
        updateNodeData(id, {
          textOutput: result,
          outputUrl: undefined,
          outputUrls: undefined,
          loading: false,
          configMode: false,
          progress: 0
        });
      } else {
        updateNodeData(id, {
          outputUrl: result,
          textOutput: undefined,
          outputUrls: undefined,
          loading: false,
          configMode: false,
          progress: 0
        });
      }
    } catch (err) {
      if (abortController.signal.aborted) return;
      const msg = err instanceof Error ? err.message : '执行失败';
      updateNodeData(id, { loading: false, errorMessage: msg, progress: 0 });
    } finally {
      abortRef.current = null;
    }
  }, [loading, config, id, updateNodeData, nodeValues, generateNodeInfoList, upstreamData]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    updateNodeData(id, { loading: false, progress: 0 });
  }, [id, updateNodeData]);

  const handleSaveTemplate = useCallback(() => {
    const name = prompt('模板名称：');
    if (!name) return;
    addTemplate({
      id: Date.now().toString(),
      name,
      config,
    });
  }, [config, addTemplate]);

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage} minHeight={200} minWidth={360}>
      <Handle type="target" position={Position.Left} id="custom-input" className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" data-handletype="any" />
      <div className="flex flex-col gap-2 p-2 min-w-[320px]">
        {/* 标题 + 配置/运行切换 */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-secondary font-medium">{data.label || '万能节点'}</span>
          <div className="flex gap-1">
            <button
              onClick={() => updateNodeData(id, { configMode: true })}
              className={`text-[9px] px-1.5 py-0.5 rounded ${configMode ? 'bg-primary text-text' : 'bg-surface text-text-secondary'}`}
            >
              配置
            </button>
            <button
              onClick={() => updateNodeData(id, { configMode: false })}
              className={`text-[9px] px-1.5 py-0.5 rounded ${!configMode ? 'bg-primary text-text' : 'bg-surface text-text-secondary'}`}
            >
              运行
            </button>
          </div>
        </div>

        {configMode && (
          <>
            {/* ========== 模式选择（首位） ========== */}
            <select
              value={config.executionType ?? 'http'}
              onChange={(e) => {
                const newType = e.target.value as 'http' | 'comfyui';
                updateConfig({
                  executionType: newType,
                  ...(newType === 'comfyui' && !config.comfyuiSubType ? { comfyuiSubType: 'local' } : {}),
                });
              }}
              className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border"
            >
              <option value="http">HTTP</option>
              <option value="comfyui">ComfyUI</option>
            </select>

            {/* ========== HTTP 模式 ========== */}
            {config.executionType === 'http' && (
              <>
                <input
                  value={config.apiUrl}
                  onChange={(e) => updateConfig({ apiUrl: e.target.value })}
                  placeholder="API URL"
                  className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                />
                <div className="flex gap-1">
                  <select
                    value={config.method}
                    onChange={(e) => updateConfig({ method: e.target.value })}
                    className="bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border"
                  >
                    {['GET', 'POST', 'PUT', 'DELETE'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={config.outputType}
                    onChange={(e) => updateConfig({ outputType: e.target.value as CustomNodeConfig['outputType'] })}
                    className="bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border"
                  >
                    {['text', 'image', 'video', 'audio'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <select
                    value={config.executionMode}
                    onChange={(e) => updateConfig({ executionMode: e.target.value as 'sync' | 'async' })}
                    className="bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border"
                  >
                    <option value="sync">同步</option>
                    <option value="async">异步</option>
                  </select>
                </div>
                <textarea
                  value={config.headers}
                  onChange={(e) => updateConfig({ headers: e.target.value })}
                  placeholder='Headers JSON (e.g. {"Authorization": "Bearer ..."})'
                  className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border resize-none font-mono"
                  rows={2}
                />
                <textarea
                  value={config.body}
                  onChange={(e) => updateConfig({ body: e.target.value })}
                  placeholder="Body (支持 {{变量名}} )"
                  className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border resize-none font-mono"
                  rows={2}
                />
                <input
                  value={config.resultPath}
                  onChange={(e) => updateConfig({ resultPath: e.target.value })}
                  placeholder="结果路径 (e.g. data.results.0.url)"
                  className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                />
                {config.executionMode === 'async' && (
                  <div className="flex flex-col gap-1 p-1.5 bg-[#1a1a1a] rounded border border-[#555]">
                    <span className="text-[9px] text-blue-400 font-medium">异步轮询配置</span>
                    <input
                      value={config.taskIdPath ?? ''}
                      onChange={(e) => updateConfig({ taskIdPath: e.target.value })}
                      placeholder="Task ID 路径 (e.g. id)"
                      className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                    />
                    <input
                      value={config.pollingUrl ?? ''}
                      onChange={(e) => updateConfig({ pollingUrl: e.target.value })}
                      placeholder="轮询 URL (留空则用 提交URL/taskId)"
                      className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                    />
                    <input
                      value={config.pollingResultPath ?? ''}
                      onChange={(e) => updateConfig({ pollingResultPath: e.target.value })}
                      placeholder="状态路径 (e.g. status)"
                      className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                    />
                    <div className="flex gap-1">
                      <input
                        value={config.pollingCompletedValue ?? ''}
                        onChange={(e) => updateConfig({ pollingCompletedValue: e.target.value })}
                        placeholder="完成值 (e.g. completed)"
                        className="flex-1 bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                      />
                      <input
                        value={config.pollingFailedValue ?? ''}
                        onChange={(e) => updateConfig({ pollingFailedValue: e.target.value })}
                        placeholder="失败值 (e.g. failed)"
                        className="flex-1 bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                      />
                    </div>
                    <input
                      value={config.pollingResultDataPath ?? ''}
                      onChange={(e) => updateConfig({ pollingResultDataPath: e.target.value })}
                      placeholder="结果数据路径 (留空则用结果路径)"
                      className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                    />
                  </div>
                )}
              </>
            )}

            {/* ========== ComfyUI 模式 ========== */}
            {config.executionType === 'comfyui' && (
              <div className="flex flex-col gap-1 p-1.5 bg-[#1a1a1a] rounded border border-[#555]">
                <span className="text-[9px] text-green-400 font-medium">ComfyUI</span>
                <select
                  value={subType}
                  onChange={(e) => {
                    updateConfig({ comfyuiSubType: e.target.value as ComfyUISubType });
                    setSelectedWorkflow('');
                    setParsedNodes([]);
                    updateNodeData(id, { nodeValues: {} });
                  }}
                  className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border"
                >
                  <option value="local">本地 ComfyUI</option>
                  <option value="cloud">ComfyUI Cloud</option>
                  <option value="runninghub">RunningHub</option>
                  <option value="runninghubApp">RunningHub APP</option>
                </select>

                {/* 本地/Cloud: 工作流下拉 */}
                {(subType === 'local' || subType === 'cloud') && (
                  <>
                    <select
                      value={selectedWorkflow}
                      onChange={(e) => handleSelectWorkflow(e.target.value)}
                      className="w-full bg-surface text-text text-[9px] rounded px-1 py-0.5 border border-border"
                    >
                      <option value="">— 选择工作流 —</option>
                        {(subType === 'local' ? comfyuiConfig.localWorkflows : comfyuiConfig.cloudWorkflows).map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>

                    {/* 节点参数（可调节） */}
                    {parsedNodes.length > 0 && (
                      <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto bg-[#111] rounded p-1">
                        {parsedNodes.map((node) => (
                          <div key={node.nodeId} className="flex flex-col gap-0.5 p-1 bg-surface rounded">
                            <span className="text-[8px] text-primary font-mono">[{node.nodeId}] {node.classType}</span>
                            {Object.entries(node.inputs)
                              .filter(([, fieldInfo]) => !Array.isArray(fieldInfo?.value))
                              .slice(0, 8)
                              .map(([field]) => (
                              <div key={field} className="flex items-center gap-1">
                                <span className="text-[7px] text-text-muted w-12 truncate shrink-0">{field}</span>
                                <input
                                  value={String(nodeValues[node.nodeId]?.[field] ?? '')}
                                  onChange={(e) => handleNodeValueChange(node.nodeId, field, e.target.value)}
                                  className="flex-1 bg-surface-hover text-text text-[8px] rounded px-1 py-0.5 border border-border outline-none min-w-0"
                                />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* RunningHub: 工作流 ID */}
                {(subType === 'runninghub' || subType === 'runninghubApp') && (
                  <>
                    <input
                      value={config.workflowId ?? ''}
                      onChange={(e) => updateConfig({ workflowId: e.target.value })}
                      placeholder="工作流 ID"
                      className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                    />
                    {subType === 'runninghubApp' && (
                      <input
                        value={config.runninghubAppId ?? ''}
                        onChange={(e) => updateConfig({ runninghubAppId: e.target.value })}
                        placeholder="WebAPP ID (可选)"
                        className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* AI 辅助 + 保存模板 */}
            <div className="flex gap-1">
              <button
                onClick={handleAIAssist}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-text text-[10px] py-1 rounded font-medium flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3 h-3" />
                AI 辅助
              </button>
              <button
                onClick={handleSaveTemplate}
                className="flex-1 bg-surface hover:bg-surface-hover text-text-secondary text-[10px] py-1 rounded flex items-center justify-center gap-1"
              >
                <Save className="w-3 h-3" />
                保存模板
              </button>
            </div>
          </>
        )}

        {/* 运行模式 */}
        {!configMode && (
          <>
            {/* 输出预览区 */}
            <OutputPreview
              loading={loading}
              errorMessage={errorMessage}
              outputUrl={outputUrl}
              textOutput={textOutput}
              outputType={config.outputType}
            />
            
            {/* 进度条 */}
            {loading && progress > 0 && (
              <div className="w-full bg-surface rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
          </>
        )}
        
        {/* 底部按钮区 - 始终显示 */}
        <div className="flex gap-1 mt-1 pt-1 border-t border-border">
          <button
            onClick={handleExecute}
            disabled={loading}
            className="flex-1 bg-primary hover:bg-primary-hover disabled:bg-surface-hover text-text text-[10px] py-1 rounded font-medium"
          >
            {loading ? '执行中...' : '▶ 执行'}
          </button>
          {loading && (
            <button
              onClick={handleStop}
              className="flex-1 bg-error hover:bg-error/80 text-text text-[10px] py-1 rounded font-medium"
            >
              ⏹ 停止
            </button>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        id="custom-output"
        className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]"
        data-handletype={config.outputType || 'text'}
      />
    </BaseNodeWrapper>
  );
}

export default memo(UniversalNodeComponent);