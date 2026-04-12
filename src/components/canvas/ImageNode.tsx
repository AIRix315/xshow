// Ref: node-banana GenerateImageNode.tsx + 悬停展开模式
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
// 模式：默认只显示图片预览，hover 显示完整参数
import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ImageNode as ImageNodeType } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { generateImage } from '@/api/imageApi';
import BaseNodeWrapper from './BaseNode';
import ProviderModelSelector from './ProviderModelSelector';

function ImageNode({ id, data, selected }: NodeProps<ImageNodeType>) {
  const nodeType = (data as { type?: string }).type;
  const isPromptNode = nodeType === 'promptNode';
  
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const [prompt, setPrompt] = useState(data.prompt ?? '');
  const [imageUrl, setImageUrl] = useState(data.imageUrl ?? '');
  const [loading, setLoading] = useState(data.loading ?? false);
  const [errorMessage, setErrorMessage] = useState(data.errorMessage ?? '');
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio ?? '1:1');
  const [imageSize, setImageSize] = useState(data.imageSize ?? '1K');
  const [selectedModel, setSelectedModel] = useState(data.selectedModel ?? '');
  const [selectedChannelId, setSelectedChannelId] = useState<string | undefined>((data as { selectedChannelId?: string }).selectedChannelId);

  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const imageChannelId = useSettingsStore((s) => s.apiConfig.imageChannelId);
  const drawingModel = useSettingsStore((s) => s.apiConfig.drawingModel);

  const models = drawingModel.split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || models[0] || '';

  // 使用节点选择的 channel（如果有）否则用默认的
  const currentChannelId = selectedChannelId || imageChannelId;

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    const channel = channels.find((c) => c.id === currentChannelId);
    if (!channel) {
      setErrorMessage('未选择图片供应商');
      updateNodeData(id, { errorMessage: '未选择图片供应商' });
      return;
    }
    setLoading(true);
    setErrorMessage('');
    updateNodeData(id, { loading: true, errorMessage: '', prompt: prompt.trim(), selectedChannelId: currentChannelId, selectedModel: currentModel });
    try {
      const dataUrl = await generateImage({
        channelUrl: channel.url,
        channelKey: channel.key,
        protocol: channel.protocol as 'openai' | 'gemini',
        model: currentModel,
        prompt: prompt.trim(),
        aspectRatio,
        imageSize,
      });
      setImageUrl(dataUrl);
      updateNodeData(id, { imageUrl: dataUrl, loading: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : '图片生成失败';
      setErrorMessage(msg);
      updateNodeData(id, { loading: false, errorMessage: msg });
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, channels, imageChannelId, currentModel, aspectRatio, imageSize, id, updateNodeData]);

  // 精简内容：只显示图片预览，无边距
  const minimalContent = (
    <>
      {/* 输入 Handle 1 - Image (33%) */}
      <Handle type="target" position={Position.Left} id="image" style={{ top: '33%', zIndex: 10 }} data-handletype="image" />
      
      {/* 图片预览区域 - 全屏无间隙 */}
      {imageUrl && !loading ? (
        <div className="relative w-full h-full min-h-[120px] flex items-center justify-center bg-[#1a1a1a]">
          <img
            src={imageUrl}
            alt="生成结果"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      ) : loading ? (
        <div className="w-full h-full min-h-[120px] flex items-center justify-center bg-[#1a1a1a]">
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[10px]">生成中...</span>
          </div>
        </div>
      ) : (
        <div className="w-full h-full min-h-[120px] flex items-center justify-center bg-[#1a1a1a]">
          <span className="text-neutral-500 text-[10px]">运行生成</span>
        </div>
      )}
      
      {/* 输出 Handle (67%) */}
      <Handle type="source" position={Position.Right} id="image" style={{ top: '67%', zIndex: 10 }} data-handletype="image" />
    </>
  );

  // 悬停完整参数内容 - 参数在底部
  const fullContent = (
    <>
      {/* 输入 Handle 1 - Image (33%) */}
      <Handle type="target" position={Position.Left} id="image" style={{ top: '33%', zIndex: 10 }} data-handletype="image" />
      {/* 输入 Handle 2 - Text (67%) */}
      <Handle type="target" position={Position.Left} id="text" style={{ top: '67%', zIndex: 10 }} data-handletype="text" />
      
      {/* 内容区域：图片预览在上，参数在底部 */}
      <div className="flex flex-col h-full">
        {/* 图片预览区域 */}
        <div className="flex-1 min-h-0">
          {imageUrl && !loading && (
            <div className="relative w-full h-full min-h-[80px] flex items-center justify-center bg-[#1a1a1a] rounded">
              <img
                src={imageUrl}
                alt="生成结果"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </div>
        
        {/* 参数区域 - 在底部 */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
          {/* 提示词输入 - 增加高度 */}
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              updateNodeData(id, { prompt: e.target.value });
            }}
            placeholder="输入图片描述..."
            className="w-full bg-[#1a1a1a] text-white text-xs rounded p-1.5 resize-none border border-[#333] focus:border-blue-500 outline-none"
            rows={3}
          />

          {/* 供应商+模型选择 */}
          <ProviderModelSelector
            type="image"
            selectedChannelId={selectedChannelId}
            selectedModel={selectedModel}
            onChannelChange={(channelId) => {
              setSelectedChannelId(channelId);
              updateNodeData(id, { selectedChannelId: channelId });
            }}
            onModelChange={(model) => {
              setSelectedModel(model);
              updateNodeData(id, { selectedModel: model });
            }}
          />

          {/* 尺寸选项 */}
          <div className="flex gap-1">
            {['1:1', '16:9', '9:16'].map((ar) => (
              <button
                key={ar}
                onClick={() => {
                  setAspectRatio(ar);
                  updateNodeData(id, { aspectRatio: ar });
                }}
                className={`px-1.5 py-0.5 text-[10px] rounded border ${
                  aspectRatio === ar ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-[#333] text-neutral-400 bg-[#1a1a1a] hover:bg-[#262626]'
                }`}
              >
                {ar}
              </button>
            ))}
            <select
              value={imageSize}
              onChange={(e) => {
                setImageSize(e.target.value);
                updateNodeData(id, { imageSize: e.target.value });
              }}
              className="bg-[#1a1a1a] text-white text-[10px] rounded p-0.5 border border-[#333]"
            >
              {['1K', '2K'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-[#333] disabled:cursor-not-allowed text-white text-xs py-1.5 rounded font-medium"
          >
            {loading ? '生成中...' : '生成图片'}
          </button>
        </div>
      </div>
      
      {/* 输出 Handle (67%) */}
      <Handle type="source" position={Position.Right} id="image" style={{ top: '67%', zIndex: 10 }} data-handletype="image" />
    </>
  );

  return (
    <BaseNodeWrapper 
      selected={!!selected} 
      loading={loading} 
      errorMessage={errorMessage}
      title={isPromptNode ? '提示词' : '生成图片'}
      minWidth={280}
      hoverContent={fullContent}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(ImageNode);