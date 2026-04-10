// Ref: §6.10 + 产物反推 — 万能节点 (AI 驱动 API 适配器)
import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { UniversalNodeType, CustomNodeConfig } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { generateText } from '@/api/textApi';
import BaseNodeWrapper from './BaseNode';

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

function UniversalNodeComponent({ data, selected }: NodeProps<UniversalNodeType>) {
  const [configMode, setConfigMode] = useState(data.configMode ?? true);
  const [config, setConfig] = useState<CustomNodeConfig>(data.config ?? {
    apiUrl: '',
    method: 'POST',
    headers: '{}',
    body: '',
    outputType: 'text',
    executionMode: 'sync',
    resultPath: '',
  });
  const [loading, setLoading] = useState(data.loading ?? false);
  const [errorMessage, setErrorMessage] = useState(data.errorMessage ?? '');
  const [resultData, setResultData] = useState(data.resultData ?? '');

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
JSON 格式: { "apiUrl": "", "method": "POST", "headers": "{}", "body": "", "outputType": "text", "executionMode": "sync", "resultPath": "" }`,
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

  // 执行请求
  const handleExecute = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setErrorMessage('');
    setResultData('');
    try {
      const variables = config.variables ?? {};
      const result = await executeSync(config, variables);
      setResultData(result);
      setConfigMode(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '执行失败';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [loading, config]);

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
          <span className="text-[10px] text-gray-400 font-medium">⚙️ {data.label || '万能节点'}</span>
          <div className="flex gap-1">
            <button
              onClick={() => setConfigMode(true)}
              className={`text-[9px] px-1.5 py-0.5 rounded ${configMode ? 'bg-blue-600 text-white' : 'bg-[#333] text-gray-400'}`}
            >
              配置
            </button>
            <button
              onClick={() => setConfigMode(false)}
              className={`text-[9px] px-1.5 py-0.5 rounded ${!configMode ? 'bg-blue-600 text-white' : 'bg-[#333] text-gray-400'}`}
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
              className="w-full bg-[#2a2a2a] text-white text-[10px] rounded px-1.5 py-1 border border-[#444] focus:border-blue-500 outline-none"
            />
            <div className="flex gap-1">
              <select
                value={config.method}
                onChange={(e) => updateConfig({ method: e.target.value })}
                className="bg-[#2a2a2a] text-white text-[10px] rounded px-1 py-0.5 border border-[#444]"
              >
                {['GET', 'POST', 'PUT', 'DELETE'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                value={config.outputType}
                onChange={(e) => updateConfig({ outputType: e.target.value as CustomNodeConfig['outputType'] })}
                className="bg-[#2a2a2a] text-white text-[10px] rounded px-1 py-0.5 border border-[#444]"
              >
                {['text', 'image', 'video', 'audio'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <textarea
              value={config.headers}
              onChange={(e) => updateConfig({ headers: e.target.value })}
              placeholder='Headers JSON (e.g. {"Authorization": "Bearer ..."})'
              className="w-full bg-[#2a2a2a] text-white text-[10px] rounded px-1.5 py-1 border border-[#444] resize-none font-mono"
              rows={2}
            />
            <textarea
              value={config.body}
              onChange={(e) => updateConfig({ body: e.target.value })}
              placeholder="Body (支持 {{变量名}} )"
              className="w-full bg-[#2a2a2a] text-white text-[10px] rounded px-1.5 py-1 border border-[#444] resize-none font-mono"
              rows={2}
            />
            <input
              value={config.resultPath}
              onChange={(e) => updateConfig({ resultPath: e.target.value })}
              placeholder="结果路径 (e.g. data.results.0.url)"
              className="w-full bg-[#2a2a2a] text-white text-[10px] rounded px-1.5 py-1 border border-[#444] focus:border-blue-500 outline-none"
            />
            <div className="flex gap-1">
              <button
                onClick={handleAIAssist}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] py-1 rounded font-medium"
              >
                🤖 AI 辅助
              </button>
              <button
                onClick={handleSaveTemplate}
                className="flex-1 bg-[#333] hover:bg-[#444] text-gray-300 text-[10px] py-1 rounded"
              >
                💾 保存模板
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
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs py-1.5 rounded font-medium"
            >
              {loading ? '执行中...' : '▶ 执行'}
            </button>
            {resultData && (
              <div className="bg-[#2a2a2a] text-gray-200 text-[10px] rounded p-1.5 border border-[#444] max-h-[120px] overflow-y-auto whitespace-pre-wrap break-all font-mono">
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