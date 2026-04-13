// Ref: node-banana LLMGenerateNode.tsx + 悬停展开模式
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
// 模式：默认只显示文本输出，hover 显示完整参数
import { memo, useCallback } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { TextNodeType } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { generateText } from '@/api/textApi';
import BaseNodeWrapper from './BaseNode';
import ProviderModelSelector from './ProviderModelSelector';

function TextNode({ id, data, selected }: NodeProps<TextNodeType>) {
  const nodes = useFlowStore((s) => s.nodes);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const addNodes = useFlowStore((s) => s.addNodes);
  const addEdge = useFlowStore((s) => s.addEdge);

  // 直接从 data 读取业务数据
  const prompt = data.prompt ?? '';
  const text = data.text ?? '';
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const autoSplit = data.autoSplit ?? false;
  const selectedModel = data.selectedModel ?? '';
  const selectedChannelId = (data as { selectedChannelId?: string }).selectedChannelId;

  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const textChannelId = useSettingsStore((s) => s.apiConfig.textChannelId);
  const textModel = useSettingsStore((s) => s.apiConfig.textModel);

  const models = textModel.split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || models[0] || '';

  // 使用节点选择的 channel（如果有）否则用默认的
  const currentChannelId = selectedChannelId || textChannelId;

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    const channel = channels.find((c) => c.id === currentChannelId);
    if (!channel) {
      updateNodeData(id, { errorMessage: '未选择文本供应商' });
      return;
    }
    updateNodeData(id, { loading: true, errorMessage: '', prompt: prompt.trim() });
    try {
      const result = await generateText({
        channelUrl: channel.url,
        channelKey: channel.key,
        protocol: channel.protocol as 'openai' | 'gemini',
        model: currentModel,
        messages: [{ role: 'user', content: prompt.trim() }],
        autoSplit,
      });
      updateNodeData(id, { text: result.text, loading: false });

      // autoSplit: 自动创建子节点并连线
      if (autoSplit && result.splitItems && result.splitItems.length > 0) {
        const parentNode = nodes.find((n) => n.id === id);
        if (parentNode) {
          const childNodes: Node[] = result.splitItems.map((item, index) => ({
            id: `textNode-split-${Date.now()}-${index}`,
            type: 'textNode',
            position: {
              x: parentNode.position.x + 250,
              y: parentNode.position.y + index * 100,
            },
            data: {
              label: item.title,
              text: item.content,
              prompt: '',
              expanded: true,
              autoSplit: false,
              textModel: data.textModel,
              loading: false,
              selectedContextResources: [],
              presetPrompts: [],
            },
            style: { width: 400, height: 240 },
          }));

          addNodes(childNodes);

          childNodes.forEach((child) => {
            addEdge({
              id: `${id}-${child.id}`,
              source: id,
              target: child.id,
            });
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '文本生成失败';
      updateNodeData(id, { loading: false, errorMessage: msg });
    }
  }, [prompt, loading, channels, textChannelId, currentModel, autoSplit, id, updateNodeData]);

  // 精简内容：只显示文本输出，无边距
  const minimalContent = (
    <>
      {/* 输入 Handle (67%) */}
      <Handle type="target" position={Position.Left} id="text" style={{ top: '67%', zIndex: 10 }} data-handletype="text" />
      
      {/* 文本输出区域 - 全屏无间隙 */}
      {text && !loading ? (
        <div className="flex-1 min-h-[100px] bg-[#1a1a1a] p-2 overflow-auto">
          <p className="text-[10px] text-neutral-300 whitespace-pre-wrap break-words">
            {text.length > 200 ? text.substring(0, 200) + '...' : text}
          </p>
        </div>
      ) : loading ? (
        <div className="flex-1 min-h-[100px] flex items-center justify-center bg-[#1a1a1a]">
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[10px]">生成中...</span>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-[100px] flex items-center justify-center bg-[#1a1a1a]">
          <span className="text-neutral-500 text-[10px]">运行生成</span>
        </div>
      )}
      
      {/* 输出 Handle (33%) */}
      <Handle type="source" position={Position.Right} id="text" style={{ top: '33%', zIndex: 10 }} data-handletype="text" />
    </>
  );

  // 悬停完整参数内容 - 参数在底部
  const fullContent = (
    <>
      {/* 输入 Handle (67%) */}
      <Handle type="target" position={Position.Left} id="text" style={{ top: '67%', zIndex: 10 }} data-handletype="text" />
      
      {/* 内容区域：文本预览在上，参数在底部 */}
      <div className="flex flex-col h-full">
        {/* 文本预览区域 */}
        <div className="flex-1 min-h-0">
          {text && !loading && (
            <div className="w-full h-full min-h-[80px] bg-[#1a1a1a] rounded p-2 overflow-auto">
              <p className="text-[10px] text-neutral-300 whitespace-pre-wrap break-words">
                {text.length > 300 ? text.substring(0, 300) + '...' : text}
              </p>
            </div>
          )}
        </div>
        
        {/* 参数区域 - 在底部 */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
          {/* 提示词输入 - 增加高度 */}
          <textarea
            value={prompt}
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
            placeholder="输入文本描述..."
            className="w-full bg-[#1a1a1a] text-white text-xs rounded p-1.5 resize-none border border-[#333] focus:border-blue-500 outline-none"
            rows={3}
          />

          {/* 供应商+模型选择 */}
          <ProviderModelSelector
            type="text"
            selectedChannelId={selectedChannelId}
            selectedModel={selectedModel}
            onChannelChange={(channelId) => updateNodeData(id, { selectedChannelId: channelId })}
            onModelChange={(model) => updateNodeData(id, { selectedModel: model })}
          />

          {/* autoSplit 选项 */}
          <label className="flex items-center gap-1 text-[10px] text-neutral-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoSplit}
              onChange={(e) => updateNodeData(id, { autoSplit: e.target.checked })}
              className="accent-blue-500"
            />
            自动拆分输出
          </label>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#333] disabled:cursor-not-allowed text-white text-xs py-1.5 rounded font-medium"
          >
            {loading ? '生成中...' : '生成文本'}
          </button>
        </div>
      </div>
      
      {/* 输出 Handle (33%) */}
      <Handle type="source" position={Position.Right} id="text" style={{ top: '33%', zIndex: 10 }} data-handletype="text" />
    </>
  );

  return (
    <BaseNodeWrapper 
      selected={!!selected} 
      loading={loading} 
      errorMessage={errorMessage}
      title="生成文本"
      minWidth={280}
      hoverContent={fullContent}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(TextNode);