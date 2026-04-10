// Ref: node-banana GenerateImageNode.tsx + @xyflow/react 自定义节点文档 + §6.3
import { memo, useState, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ImageNode as ImageNodeType } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { generateImage } from '@/api/imageApi';
import BaseNodeWrapper from './BaseNode';

function ImageNode({ data, selected }: NodeProps<ImageNodeType>) {
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
      return;
    }
    setLoading(true);
    setErrorMessage('');
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : '图片生成失败';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [prompt, loading, channels, imageChannelId, currentModel, aspectRatio, imageSize]);

  return (
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage}>
      <Handle type="target" position={Position.Left} id="image" style={{ top: '35%' }} className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222] hover:!bg-blue-500" />
      <div className="flex flex-col gap-2 p-2 min-w-[180px]">
        {/* 提示词输入 */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入图片描述..."
          className="w-full bg-[#2a2a2a] text-white text-xs rounded p-1.5 resize-none border border-[#444] focus:border-blue-500 outline-none"
          rows={2}
        />

        {/* 模型选择 */}
        {models.length > 1 && (
          <select
            value={currentModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full bg-[#2a2a2a] text-white text-xs rounded p-1 border border-[#444]"
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
              onClick={() => setAspectRatio(ar)}
              className={`px-1.5 py-0.5 text-[10px] rounded border ${
                aspectRatio === ar ? 'border-blue-500 bg-blue-500/20 text-blue-400' : 'border-[#444] text-gray-400 bg-[#222]'
              }`}
            >
              {ar}
            </button>
          ))}
          <select
            value={imageSize}
            onChange={(e) => setImageSize(e.target.value)}
            className="bg-[#2a2a2a] text-white text-[10px] rounded p-0.5 border border-[#444]"
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
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-xs py-1.5 rounded font-medium"
        >
          {loading ? '生成中...' : '生成图片'}
        </button>

        {/* 图片预览 */}
        {imageUrl && !loading && (
          <div className="relative group">
            <img
              src={imageUrl}
              alt="生成结果"
              className="w-full rounded border border-[#444]"
              style={{ maxHeight: '200px', objectFit: 'contain' }}
            />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="image" className="!bg-[#555] !w-3 !h-3 !border-2 !border-[#222] hover:!bg-blue-500" />
    </BaseNodeWrapper>
  );
}

export default memo(ImageNode);