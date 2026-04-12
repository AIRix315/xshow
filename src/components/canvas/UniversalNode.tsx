// Ref: §6.10 + 产物反推 — 万能节点 (AI 驱动 API 适配器)
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
import { memo, useState, useCallback, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { UniversalNodeType, CustomNodeConfig } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { generateText } from '@/api/textApi';
import { executeComfyWorkflow } from '@/api/comfyApi';
import BaseNodeWrapper from './BaseNode';
import { Save, Sparkles } from 'lucide-react';
import type { ComfyUISubType, ComfyUINodeInfo } from '@/types';

// 变量替换：{{变量名}} → 从变量映射中取值
function replaceVariables(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
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
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const [configMode, setConfigMode] = useState(data.configMode ?? true);
  const [config, setConfig] = useState<CustomNodeConfig>(data.config ?? {
    apiUrl: '',
    method: 'POST',
    headers: '{}',
    body: '',
    outputType: 'text',
    executionMode: 'sync',
    resultPath: '',
    executionType: 'http',
  });
  const [loading, setLoading] = useState(data.loading ?? false);
  const [errorMessage, setErrorMessage] = useState(data.errorMessage ?? '');
  const [resultData, setResultData] = useState(data.resultData ?? '');
  const [progress, setProgress] = useState(data.progress ?? 0);
  const abortRef = useRef<AbortController | null>(null);

  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const textChannelId = useSettingsStore((s) => s.apiConfig.textChannelId);
  const textModel = useSettingsStore((s) => s.apiConfig.textModel);
  const addTemplate = useSettingsStore((s) => s.addTemplate);

  const updateConfig = useCallback((patch: Partial<CustomNodeConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  // AI 辅助：描述需求 → 自动填充 config
  const handleAIAssist = useCallback(async () => {
    const channel = channels.find((c) => c.id === textChannelId);
    if (!channel) {
      setErrorMessage('未选择文本供应商，无法使用 AI 辅助');
      return;
    }

    const description = prompt('请描述你的 API 需求：');
    if (!description) return;

    setLoading(true);
    setErrorMessage('');
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
      setConfig((prev) => ({ ...prev, ...parsed }));
      setConfigMode(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 辅助失败';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [channels, textChannelId, textModel]);

  // 执行请求（根据 executionType 路由到 HTTP/ComfyUI）
  const handleExecute = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setErrorMessage('');
    setResultData('');
    setProgress(0);
    updateNodeData(id, { loading: true, errorMessage: '', resultData: '', progress: 0 });

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // ComfyUI 执行模式
      if (config.executionType === 'comfyui') {
        const channel = channels.find((c) => c.id === config.channelId);
        if (!channel) {
          throw new Error('未选择 ComfyUI 渠道商');
        }
        if (!config.model) {
          throw new Error('请输入工作流 ID');
        }

        const result = await executeComfyWorkflow({
          channelUrl: channel.url,
          channelKey: channel.key,
          subType: config.comfyuiSubType ?? 'local',
          workflowId: config.model,
          nodeInfoList: config.nodeInfoList,
          onProgress: (p) => {
            setProgress(p);
            updateNodeData(id, { progress: p });
          },
          signal: abortController.signal,
        });

        setResultData(result);
        setConfigMode(false);
        updateNodeData(id, { resultData: result, loading: false, configMode: false, progress: 0 });
        return;
      }

      // HTTP 执行模式（同步/异步）
      const variables = config.variables ?? {};
      const result = config.executionMode === 'async'
        ? await executeAsync(config, variables, (p) => {
            setProgress(p);
            updateNodeData(id, { progress: p });
          }, abortController.signal)
        : await executeSync(config, variables);
      setResultData(result);
      setConfigMode(false);
      updateNodeData(id, { resultData: result, loading: false, configMode: false, progress: 0 });
    } catch (err) {
      if (abortController.signal.aborted) return;
      const msg = err instanceof Error ? err.message : '执行失败';
      setErrorMessage(msg);
      updateNodeData(id, { loading: false, errorMessage: msg, progress: 0 });
    } finally {
      setLoading(false);
      setProgress(0);
      abortRef.current = null;
    }
  }, [loading, config, id, updateNodeData, channels]);

  // 停止执行
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setLoading(false);
    setProgress(0);
    updateNodeData(id, { loading: false, progress: 0 });
  }, [id, updateNodeData]);

  // 保存模板
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
      <Handle type="target" position={Position.Left} id="custom-input" className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
      <div className="flex flex-col gap-2 p-2 min-w-[320px]">
        {/* 标题 + 模式切换 */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-secondary font-medium">{data.label || '万能节点'}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setConfigMode(true)}
              className={`text-[9px] px-1.5 py-0.5 rounded ${configMode ? 'bg-primary text-text' : 'bg-surface text-text-secondary'}`}
            >
              配置
            </button>
            <button
              onClick={() => setConfigMode(false)}
              className={`text-[9px] px-1.5 py-0.5 rounded ${!configMode ? 'bg-primary text-text' : 'bg-surface text-text-secondary'}`}
            >
              运行
            </button>
          </div>
        </div>

        {/* 配置模式 */}
        {configMode && (
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
              <select
                value={config.executionType ?? 'http'}
                onChange={(e) => updateConfig({ executionType: e.target.value as 'http' | 'comfyui' })}
                className="bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border"
              >
                <option value="http">HTTP</option>
                <option value="comfyui">ComfyUI</option>
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
            {/* 异步模式配置 */}
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
                <input
                  value={config.pollingProgressPath ?? ''}
                  onChange={(e) => updateConfig({ pollingProgressPath: e.target.value })}
                  placeholder="进度路径 (e.g. progress, 可选)"
                  className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                />
              </div>
            )}
            {/* ComfyUI 配置 */}
            {config.executionType === 'comfyui' && (
              <div className="flex flex-col gap-1 p-1.5 bg-[#1a1a1a] rounded border border-[#555]">
                <span className="text-[9px] text-green-400 font-medium">ComfyUI 配置</span>
                <div className="flex gap-1">
                  <select
                    value={config.comfyuiSubType ?? 'local'}
                    onChange={(e) => updateConfig({ comfyuiSubType: e.target.value as ComfyUISubType })}
                    className="flex-1 bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border"
                  >
                    <option value="local">本地 ComfyUI</option>
                    <option value="cloud">ComfyUI Cloud</option>
                    <option value="runninghub">RunningHub</option>
                  </select>
                  <select
                    value={config.channelId ?? ''}
                    onChange={(e) => updateConfig({ channelId: e.target.value })}
                    className="flex-1 bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border"
                  >
                    <option value="">选择渠道商</option>
                    {channels.filter((c) => c.protocol === 'comfyui').map((ch) => (
                      <option key={ch.id} value={ch.id}>{ch.name || ch.url || ch.id}</option>
                    ))}
                  </select>
                </div>
                <input
                  value={config.model ?? ''}
                  onChange={(e) => updateConfig({ model: e.target.value })}
                  placeholder="工作流 ID"
                  className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-blue-500 outline-none"
                />
                <textarea
                  value={JSON.stringify(config.nodeInfoList ?? [])}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      updateConfig({ nodeInfoList: parsed as ComfyUINodeInfo[] });
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  placeholder='节点字段映射 [{"nodeId": "5", "fieldName": "prompt", "defaultValue": "hello"}]'
                  rows={2}
                  className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border resize-none font-mono"
                />
              </div>
            )}
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
            <button
              onClick={handleExecute}
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover text-text text-xs py-1.5 rounded font-medium"
            >
              {loading ? '执行中...' : '▶ 执行'}
            </button>
            {loading && (
              <button
                onClick={handleStop}
                className="w-full bg-error hover:bg-error/80 text-text text-xs py-1.5 rounded font-medium"
              >
                ⏹ 停止
              </button>
            )}
            {loading && progress > 0 && (
              <div className="w-full bg-surface rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            )}
            {resultData && (
              <div className="bg-surface text-text text-[10px] rounded p-1.5 border border-border max-h-[120px] overflow-y-auto whitespace-pre-wrap break-all font-mono">
                {resultData}
              </div>
            )}
          </>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="custom-output" className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222]" />
    </BaseNodeWrapper>
  );
}

export default memo(UniversalNodeComponent);