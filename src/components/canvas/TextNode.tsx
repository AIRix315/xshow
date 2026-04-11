// Ref: node-banana LLMGenerateNode.tsx + @xyflow/react 自定义节点文档 + §6.4
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TextNodeType } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { generateText } from '@/api/textApi';
import BaseNodeWrapper from './BaseNode';
import { ChevronDown, ChevronRight } from 'lucide-react';

function TextNode({ id, data, selected }: NodeProps<TextNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const [prompt, setPrompt] = useState(data.prompt ?? '');
  const [text, setText] = useState(data.text ?? '');
  const [loading, setLoading] = useState(data.loading ?? false);
  const [errorMessage, setErrorMessage] = useState(data.errorMessage ?? '');
  const [autoSplit, setAutoSplit] = useState(data.autoSplit ?? false);
  const [selectedModel, setSelectedModel] = useState(data.selectedModel ?? '');
  const [expanded, setExpanded] = useState(data.expanded ?? true);

  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const textChannelId = useSettingsStore((s) => s.apiConfig.textChannelId);
  const textModel = useSettingsStore((s) => s.apiConfig.textModel);

  const models = textModel.split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || models[0] || '';

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    const channel = channels.find((c) => c.id === textChannelId);
    if (!channel) {
      setErrorMessage('未选择文本供应商');
      updateNodeData(id, { errorMessage: '未选择文本供应商' });
      return;
    }
    setLoading(true);
    setErrorMessage('');
    updateNodeData(id, { loading: true, errorMessage: '', prompt: prompt.trim() });
    try {
      const result = await generateText({
        channelUrl: channel.url,
        channelKey: channel.key,
        model: currentModel,
        messages: [{ role: 'user', content: prompt.trim() }],
        autoSplit,
      });
      setText(result.text);
      setExpanded(true);
      updateNodeData(id, { text: result.text, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '文本生成失败';
      setErrorMessage(msg);
      updateNodeData(id, { loading: false, errorMessage: msg });
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, channels, textChannelId, currentModel, autoSplit, id, updateNodeData]);

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage}>
      <Handle type="target" position={Position.Left} id="text" style={{ top: '65%' }} className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222] hover:!bg-primary" />
      <div className="flex flex-col gap-2 p-2 min-w-[200px]">
        {/* 标签 + 折叠 */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-secondary font-medium truncate max-w-[120px]">
            {data.label || '文本节点'}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-text-muted hover:text-text text-[10px] px-1"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>

        {/* 提示词输入 */}
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            updateNodeData(id, { prompt: e.target.value });
          }}
          placeholder="输入文本描述..."
          className="w-full bg-surface text-text text-xs rounded p-1.5 resize-none border border-border focus:border-primary outline-none"
          rows={2}
        />

        {/* 模型选择 + autoSplit */}
        <div className="flex gap-1 items-center">
          {models.length > 1 && (
            <select
              value={currentModel}
              onChange={(e) => {
            setSelectedModel(e.target.value);
            updateNodeData(id, { selectedModel: e.target.value });
          }}
              className="flex-1 bg-surface text-text text-[10px] rounded p-0.5 border border-border"
            >
              {models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-1 text-[10px] text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={autoSplit}
              onChange={(e) => {
            setAutoSplit(e.target.checked);
            updateNodeData(id, { autoSplit: e.target.checked });
          }}
              className="accent-primary"
            />
            拆分
          </label>
        </div>

        {/* 生成按钮 */}
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1.5 rounded font-medium"
        >
          {loading ? '生成中...' : '生成文本'}
        </button>

        {/* 文本输出 */}
        {expanded && text && !loading && (
          <div className="bg-surface text-text text-xs rounded p-1.5 border border-border max-h-[150px] overflow-y-auto whitespace-pre-wrap break-all">
            {text}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="text" className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222] hover:!bg-primary" />
    </BaseNodeWrapper>
  );
}

export default memo(TextNode);