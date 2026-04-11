// Ref: node-banana GenerateImageNode.tsx + @xyflow/react 自定义节点文档 + §6.3
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ImageNode as ImageNodeType } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { generateImage } from '@/api/imageApi';
import BaseNodeWrapper from './BaseNode';

function ImageNode({ id, data, selected }: NodeProps<ImageNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const [prompt, setPrompt] = useState(data.prompt ?? '');
  const [imageUrl, setImageUrl] = useState(data.imageUrl ?? '');
  const [loading, setLoading] = useState(data.loading ?? false);
  const [errorMessage, setErrorMessage] = useState(data.errorMessage ?? '');
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio ?? '1:1');
  const [imageSize, setImageSize] = useState(data.imageSize ?? '1K');
  const [selectedModel, setSelectedModel] = useState(data.selectedModel ?? '');

  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const imageChannelId = useSettingsStore((s) => s.apiConfig.imageChannelId);
  const drawingModel = useSettingsStore((s) => s.apiConfig.drawingModel);

  const models = drawingModel.split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || models[0] || '';

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || loading) return;
    const channel = channels.find((c) => c.id === imageChannelId);
    if (!channel) {
      setErrorMessage('未选择图片供应商');
      updateNodeData(id, { errorMessage: '未选择图片供应商' });
      return;
    }
    setLoading(true);
    setErrorMessage('');
    updateNodeData(id, { loading: true, errorMessage: '', prompt: prompt.trim() });
    try {
      const dataUrl = await generateImage({
        channelUrl: channel.url,
        channelKey: channel.key,
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

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage}>
      <Handle type="target" position={Position.Left} id="image" style={{ top: '35%' }} className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222] hover:!bg-primary" />
      <div className="flex flex-col gap-2 p-2 min-w-[180px]">
        {/* 提示词输入 */}
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            updateNodeData(id, { prompt: e.target.value });
          }}
          placeholder="输入图片描述..."
          className="w-full bg-surface text-text text-xs rounded p-1.5 resize-none border border-border focus:border-primary outline-none"
          rows={2}
        />

        {/* 模型选择 */}
        {models.length > 1 && (
          <select
            value={currentModel}
            onChange={(e) => {
            setSelectedModel(e.target.value);
            updateNodeData(id, { selectedModel: e.target.value });
          }}
            className="w-full bg-surface text-text text-xs rounded p-1 border border-border"
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        )}

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
                aspectRatio === ar ? 'border-primary bg-primary/20 text-primary' : 'border-border text-text-secondary bg-surface hover:bg-surface-hover'
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
            className="bg-surface text-text text-[10px] rounded p-0.5 border border-border"
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
          className="w-full bg-primary hover:bg-primary-hover disabled:bg-surface-hover disabled:cursor-not-allowed text-text text-xs py-1.5 rounded font-medium"
        >
          {loading ? '生成中...' : '生成图片'}
        </button>

        {/* 图片预览 */}
        {imageUrl && !loading && (
          <div className="relative group">
            <img
              src={imageUrl}
              alt="生成结果"
              className="w-full rounded border border-border"
              style={{ maxHeight: '200px', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="image" className="!bg-handle-default !w-3 !h-3 !border-2 !border-[#222] hover:!bg-primary" />
    </BaseNodeWrapper>
  );
}

export default memo(ImageNode);