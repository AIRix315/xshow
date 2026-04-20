// Ref: node-banana GenerateImageNode.tsx + 悬停展开模式
// Ref: §4.2 — 节点数据回写 Store（数据流闭环）
// 模式：默认只显示图片预览，hover 显示标题栏（带切换和运行按钮）+ 完整参数
import React, { memo, useCallback, useMemo, useEffect } from 'react';
import { Handle, Position, type NodeProps, type Node, type Edge, useUpdateNodeInternals } from '@xyflow/react';
import type { ImageNodeType, CustomInputHandle } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { executeImageNode } from '@/execution/generateNodeExecutors';
import type { NodeExecutionContext } from '@/execution/types';
import { getConnectedInputs } from '@/utils/connectedInputs';
import { useAdaptiveHeight } from '@/hooks/useAdaptiveHeight';
import BaseNodeWrapper from './BaseNode';
import ProviderModelSelector from './ProviderModelSelector';
import type { ImageProtocol } from '@/api/imageApi';

// 获取当前 channel
function useCurrentChannel(channelId: string | undefined) {
  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const imageChannelId = useSettingsStore((s) => s.apiConfig.imageChannelId);
  const currentChannelId = channelId || imageChannelId;
  return channels.find((c) => c.id === currentChannelId);
}

// 根据协议和模型获取动态参数选项
function getImageParamsForModel(protocol: ImageProtocol | undefined, model: string) {
  if (protocol === 'rhapi') {
    // RH API 模型参数
    if (model.includes('official')) {
      // 官方稳定版
      return {
        aspectRatioOptions: null,  // 不使用 aspectRatio
        sizeOptions: ['1024*1024', '1024*1536', '1536*1024'],
        qualityOptions: ['low', 'medium', 'high'],
        defaultSize: '1024*1024',
        defaultQuality: 'medium',
        supportedModes: ['text-to-image', 'image-to-image'] as const,
      };
    } else {
      // 低价渠道版
      return {
        aspectRatioOptions: ['auto', '1:1', '2:3', '3:2'],
        sizeOptions: null,
        qualityOptions: null,
        defaultAspectRatio: 'auto',
        supportedModes: ['text-to-image', 'image-to-image'] as const,
      };
    }
  }
  // OpenAI / Gemini 默认参数
  return {
    aspectRatioOptions: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    sizeOptions: ['1K', '2K', '4K'],
    defaultAspectRatio: '1:1',
    defaultSize: '1K',
    supportedModes: null,
  };
}

function ImageNode({ id, data, selected }: NodeProps<ImageNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);

  const updateNodeInternals = useUpdateNodeInternals();
  const customInputHandles = (data.customInputHandles as CustomInputHandle[] | undefined) ?? [];
  const imageGenerationMode = data.imageGenerationMode ?? 'text-to-image';

  useEffect(() => {
    updateNodeInternals(id);
  }, [imageGenerationMode, customInputHandles?.length, id, updateNodeInternals]);

  // 查找连入的 text Handle
  const incomingTextEdge = edges.find((e) => e.target === id && e.targetHandle === 'text');
  const textSourceNode = incomingTextEdge ? nodes.find((n) => n.id === incomingTextEdge.source) : undefined;
  const textFromHandle = textSourceNode?.data?.text as string | undefined;

  // 直接从 data 读取业务数据
  const prompt = data.prompt ?? '';
  const imageUrl = data.imageUrl ?? '';
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const aspectRatio = data.aspectRatio ?? '1:1';
  const imageSize = data.imageSize ?? '1K';
  const customWidth = data.customWidth ?? '';
  const customHeight = data.customHeight ?? '';
  const selectedModel = data.selectedModel ?? '';
  
  // Read history when current index is set
  const imageHistory = (data.imageHistory as Array<{ imageUrl: string; prompt: string; timestamp: number }>) ?? [];
  const selectedHistoryIndex = data.selectedHistoryIndex ?? (imageHistory.length > 0 ? imageHistory.length - 1 : undefined);

  const selectedChannelId = (data as { selectedChannelId?: string }).selectedChannelId;

  const imageChannelId = useSettingsStore((s) => s.apiConfig.imageChannelId);
  const drawingModel = useSettingsStore((s) => s.apiConfig.drawingModel);
  const showNodeModelSettings = useSettingsStore((s) => s.systemSettings.showNodeModelSettings);

  const models = drawingModel.split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || models[0] || '';

  // 使用节点选择的 channel（如果有）否则用默认的
  const currentChannelId = selectedChannelId || imageChannelId;
  const channel = useCurrentChannel(currentChannelId);

  // 获取动态参数选项
  const paramsConfig = useMemo(() => {
    return getImageParamsForModel(channel?.protocol as ImageProtocol | undefined, currentModel);
  }, [channel?.protocol, currentModel]);

  // 优先使用连线数据，其次用 textarea
  const effectivePrompt = textFromHandle || prompt;

  const historyNav = (
    imageHistory && imageHistory.length > 1 && (
      <div className="history-nav flex items-center gap-1 justify-center py-1 bg-[#1a1a1a]">
        <button
          onClick={() => {
            const newIndex = (selectedHistoryIndex ?? imageHistory.length - 1) - 1;
            if (newIndex >= 0) {
              updateNodeData(id, { selectedHistoryIndex: newIndex, imageUrl: imageHistory[newIndex]!.imageUrl });
            }
          }}
          disabled={(selectedHistoryIndex ?? imageHistory.length - 1) === 0}
          className="px-2 py-1 text-neutral-400 hover:text-white disabled:opacity-30"
        >
          ◀
        </button>
        <span className="text-[10px] text-neutral-500">
          {(selectedHistoryIndex ?? imageHistory.length - 1) + 1}/{imageHistory.length}
        </span>
        <button
          onClick={() => {
            const currentIndex = selectedHistoryIndex ?? imageHistory.length - 1;
            if (currentIndex < imageHistory.length - 1) {
              const newIndex = currentIndex + 1;
              updateNodeData(id, { selectedHistoryIndex: newIndex, imageUrl: imageHistory[newIndex]!.imageUrl });
            }
          }}
          disabled={(selectedHistoryIndex ?? imageHistory.length - 1) >= imageHistory.length - 1}
          className="px-2 py-1 text-neutral-400 hover:text-white disabled:opacity-30"
        >
          ▶
        </button>
      </div>
    )
  );

  // 自适应高度 hook
  const { containerRef, handleMediaLoad, containerStyle } = useAdaptiveHeight(400);

  const handleGenerate = useCallback(async () => {
    if (!effectivePrompt?.trim() || loading) return;
    if (!channel) {
      updateNodeData(id, { errorMessage: '未选择图片供应商' });
      return;
    }
    const abortController = new AbortController();
    updateNodeData(id, { loading: true, errorMessage: '', prompt: effectivePrompt.trim(), selectedChannelId: currentChannelId, selectedModel: currentModel });
    try {
      const ctx: NodeExecutionContext = {
        node: { id, type: 'imageNode', position: { x: 0, y: 0 }, data } as Node,
        nodes: nodes as Node[],
        edges: edges as Edge[],
        getConnectedInputs: (nodeId: string) => getConnectedInputs(nodeId, nodes as Node[], edges as Edge[]),
        updateNodeData: (nodeId: string, patch: Record<string, unknown>) => {
          useFlowStore.getState().updateNodeData(nodeId, patch);
        },
        getFreshNode: (nodeId: string) => useFlowStore.getState().nodes.find((n) => n.id === nodeId),
        signal: abortController.signal,
      };
      await executeImageNode(ctx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '图片生成失败';
      updateNodeData(id, { loading: false, errorMessage: msg });
    }
  }, [effectivePrompt, loading, channel, currentChannelId, currentModel, aspectRatio, imageSize, imageGenerationMode, id, updateNodeData, nodes, edges]);

  // ---- Handles: 渲染在内容区域之外，避免重复导致连线漂移 ----
  const handles = (
    <>
      {/* 自定义输入 Handle */}
      {customInputHandles.map((ch, idx) => {
        const totalCustomHandles = customInputHandles.length;
        const position = ((idx + 1) / (totalCustomHandles + 1)) * 100;
        return (
          <React.Fragment key={ch.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={ch.id}
              style={{ top: `${position}%`, zIndex: 10 }}
              data-handletype={ch.type}
            />
            <div
              className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right"
              data-type={ch.type}
              style={{ right: 'calc(100% + 8px)', top: `calc(${position}% - 8px)`, zIndex: 10 }}
            >
              {ch.label || ch.type}
            </div>
          </React.Fragment>
        );
      })}

      {/* text-to-image: 仅 Text 输入 */}
      {imageGenerationMode === 'text-to-image' && (
        <>
          <Handle type="target" position={Position.Left} id="text" style={{ top: '50%', zIndex: 10 }} data-handletype="text" />
          <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="text" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Text</div>
        </>
      )}

      {/* image-to-image: Image + Text 输入 */}
      {imageGenerationMode === 'image-to-image' && (
        <>
          <Handle type="target" position={Position.Left} id="image" style={{ top: '33%', zIndex: 10 }} data-handletype="image" />
          <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="image" style={{ right: 'calc(100% + 8px)', top: 'calc(33% - 8px)', zIndex: 10 }}>Image</div>
          
          <Handle type="target" position={Position.Left} id="text" style={{ top: '67%', zIndex: 10 }} data-handletype="text" />
          <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="text" style={{ right: 'calc(100% + 8px)', top: 'calc(67% - 8px)', zIndex: 10 }}>Text</div>
        </>
      )}
  
      {/* 输出 Handle */}
      <Handle type="source" position={Position.Right} id="image" style={{ top: '50%', zIndex: 10 }} data-handletype="image" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="image" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Image</div>
    </>
  );

  // 精简内容：只显示图片预览，无边距
  const minimalContent = (
    <div className="flex flex-col h-full">
      {imageUrl && !loading ? (
        <div
          ref={containerRef}
          style={{ ...containerStyle, backgroundColor: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <img
            src={imageUrl}
            alt="生成结果"
            onLoad={handleMediaLoad}
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
      {historyNav}
    </div>
  );

  // 悬停完整参数内容 - 参数在底部（不含生成按钮）
  const fullContent = (
    <div className="flex flex-col h-full">
      {/* 图片预览区域 */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 relative h-full">
          {imageUrl && !loading && (
            <div
              ref={containerRef}
              style={{ ...containerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a1a', borderRadius: '8px' }}
            >
              <img
                src={imageUrl}
                alt="生成结果"
                onLoad={handleMediaLoad}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </div>
        {historyNav}
      </div>
      
      {/* 参数区域 - 在底部 */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
        {/* 提示词输入 - 增加高度 */}
        <textarea
          value={prompt}
          onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
          placeholder="输入图片描述..."
          className="w-full bg-[#1a1a1a] text-white text-xs rounded p-1.5 resize-none border border-[#333] focus:border-blue-500 outline-none"
          rows={3}
        />

        {showNodeModelSettings && (
          <ProviderModelSelector
            type="image"
            selectedChannelId={selectedChannelId}
            selectedModel={selectedModel}
            onChannelChange={(channelId) => updateNodeData(id, { selectedChannelId: channelId })}
            onModelChange={(model) => updateNodeData(id, { selectedModel: model })}
          />
        )}

        {/* 文生图/图生图切换 - runninghub 供应商时显示 */}
        {channel?.url?.includes('runninghub.cn') && paramsConfig.supportedModes && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-neutral-400 whitespace-nowrap">模式：</span>
            <select
              value={imageGenerationMode}
              onChange={(e) => updateNodeData(id, { imageGenerationMode: e.target.value as 'text-to-image' | 'image-to-image' })}
              className="flex-1 min-w-0 text-[10px] py-1 px-2 bg-surface-hover text-text rounded border border-border focus:outline-none focus:border-primary"
            >
              {paramsConfig.supportedModes.map((mode) => (
                <option key={mode} value={mode}>
                  {mode === 'text-to-image' ? '文生图' : '图生图'}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 画面比例 - 下拉框（rhapi 低价渠道版有值） */}
        {paramsConfig.aspectRatioOptions && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-neutral-400 whitespace-nowrap">画面比例：</span>
            <select
              value={aspectRatio}
              onChange={(e) => updateNodeData(id, { aspectRatio: e.target.value })}
              className="flex-1 min-w-0 text-[10px] py-1 px-2 bg-surface-hover text-text rounded border border-border focus:outline-none focus:border-primary"
            >
              {paramsConfig.aspectRatioOptions.map((ar) => (
                <option key={ar} value={ar}>{ar}</option>
              ))}
            </select>
          </div>
        )}

        {/* 尺寸/清晰度 - 下拉框（rhapi 官方版有值，或非 rhapi 默认） */}
        {paramsConfig.sizeOptions && (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-neutral-400 whitespace-nowrap">尺寸：</span>
            <select
              value={imageSize}
              onChange={(e) => updateNodeData(id, { imageSize: e.target.value })}
              className="flex-1 min-w-0 text-[10px] py-1 px-2 bg-surface-hover text-text rounded border border-border focus:outline-none focus:border-primary"
            >
              {paramsConfig.sizeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* 自定义尺寸 - 默认隐藏 */}
         {(customWidth || customHeight) && (
           <div className="flex items-center gap-1 flex-wrap">
             <span className="text-[10px] text-neutral-400 whitespace-nowrap">自定义：</span>
             <span className="text-[10px] text-neutral-500">W:</span>
             <input
               type="text"
               value={customWidth}
               onChange={(e) => updateNodeData(id, { customWidth: e.target.value, imageSize: '' })}
               placeholder="__"
               className="w-12 bg-[#1a1a1a] text-white text-[10px] rounded p-0.5 border border-[#333] focus:border-blue-500 outline-none"
             />
             <span className="text-[10px] text-neutral-500">H:</span>
             <input
               type="text"
               value={customHeight}
               onChange={(e) => updateNodeData(id, { customHeight: e.target.value, imageSize: '' })}
               placeholder="__"
               className="w-12 bg-[#1a1a1a] text-white text-[10px] rounded p-0.5 border border-[#333] focus:border-blue-500 outline-none"
             />
           </div>
         )}

         {/* 自定义输入管理 */}
         <div className="flex items-center gap-1 pt-1">
           <select
             value=""
             onChange={(e) => {
               if (!e.target.value) return;
               const type = e.target.value as CustomInputHandle['type'];
               const handles = [...customInputHandles];
               const handleId = `custom-${type}-${Date.now()}`;
               handles.push({ id: handleId, type, label: type === 'image' ? '图片' : type === 'audio' ? '音频' : type === 'video' ? '视频' : '文本' });
               updateNodeData(id, { customInputHandles: handles });
               e.target.value = '';
             }}
             className="bg-surface text-text text-[10px] rounded px-1 py-0.5 border border-border"
           >
             <option value="">+ 添加输入</option>
             <option value="image">图片</option>
             <option value="audio">音频</option>
             <option value="video">视频</option>
             <option value="text">文本</option>
           </select>
           {customInputHandles.length > 0 && (
             <button
               onClick={() => updateNodeData(id, { customInputHandles: [] })}
               className="text-text-muted hover:text-error text-[10px] px-1"
               title="清除所有自定义输入"
             >
               ✕
             </button>
           )}
         </div>
       </div>
     </div>
   );

  return (
    <BaseNodeWrapper
      selected={!!selected}
      loading={loading}
      errorMessage={errorMessage}
      title="生成图片"
      minWidth={280}
      showHoverHeader
      onRun={handleGenerate}
      hoverContent={fullContent}
      handles={handles}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(ImageNode);