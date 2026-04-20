// Ref: node-banana Generate Audio Node + 渠道商 API 实现
// 使用渠道商 API 进行 TTS 生成
import { memo, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import type { AudioNodeType, CustomInputHandle } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { executeAudioNode } from '@/execution/generateNodeExecutors';
import type { NodeExecutionContext } from '@/execution/types';
import { getConnectedInputs } from '@/utils/connectedInputs';
import type { Node, Edge } from '@xyflow/react';
import React from 'react';
import BaseNodeWrapper from './BaseNode';
import ProviderModelSelector from './ProviderModelSelector';

function GenerateAudioNode({ id, data, selected }: NodeProps<AudioNodeType>) {
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const edges = useFlowStore((s) => s.edges);
  const nodes = useFlowStore((s) => s.nodes);

  const updateNodeInternals = useUpdateNodeInternals();
  const customInputHandles = (data.customInputHandles as CustomInputHandle[] | undefined) ?? [];

  useEffect(() => {
    updateNodeInternals(id);
  }, [customInputHandles?.length, id, updateNodeInternals]);

  // 查找连入的 text Handle
  const incomingTextEdge = edges.find((e) => e.target === id && e.targetHandle === 'text');
  const textSourceNode = incomingTextEdge ? nodes.find((n) => n.id === incomingTextEdge.source) : undefined;
  const textFromHandle = textSourceNode?.data?.text as string | undefined;

  // Business data from store
  const text = data.text ?? '';
  const audioUrl = data.audioUrl ?? '';
  const loading = data.loading ?? false;
  const errorMessage = data.errorMessage ?? '';
  const selectedModel = data.selectedModel ?? '';
  const selectedChannelId = (data as { selectedChannelId?: string }).selectedChannelId;
  const audioDuration = data.audioDuration ?? '';

  // Settings store
  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const audioChannelId = useSettingsStore((s) => s.apiConfig.audioChannelId);
  const audioModel = useSettingsStore((s) => s.apiConfig.audioModel);
  const showNodeModelSettings = useSettingsStore((s) => s.systemSettings.showNodeModelSettings);

  const models = audioModel.split('\n').filter((m) => m.trim());
  const currentModel = selectedModel || models[0] || '';

  // 使用节点选择的 channel（如果有）否则用默认的
  const currentChannelId = selectedChannelId || audioChannelId;

  // 优先使用连线数据，其次用 textarea
  const effectiveText = textFromHandle || text;

  // 使用渠道商 API 生成音频
  const handleGenerate = useCallback(async () => {
    if (!effectiveText?.trim() || loading) return;
    const channel = channels.find((c) => c.id === currentChannelId);
    if (!channel) {
      updateNodeData(id, { errorMessage: '未选择音频供应商' });
      return;
    }
    const abortController = new AbortController();
    updateNodeData(id, { loading: true, errorMessage: '', selectedChannelId: currentChannelId, selectedModel: currentModel });
    try {
      const ctx: NodeExecutionContext = {
        node: { id, type: 'audioNode', position: { x: 0, y: 0 }, data } as Node,
        nodes: nodes as Node[],
        edges: edges as Edge[],
        getConnectedInputs: (nodeId: string) => getConnectedInputs(nodeId, nodes as Node[], edges as Edge[]),
        updateNodeData: (nodeId: string, patch: Record<string, unknown>) => {
          useFlowStore.getState().updateNodeData(nodeId, patch);
        },
        getFreshNode: (nodeId: string) => useFlowStore.getState().nodes.find((n) => n.id === nodeId),
        signal: abortController.signal,
      };
      await executeAudioNode(ctx);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '音频生成失败';
      updateNodeData(id, { loading: false, errorMessage: msg });
    }
  }, [effectiveText, loading, channels, currentChannelId, currentModel, id, updateNodeData, nodes, edges]);

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

      {/* 输入 Handle (50%) */}
      <Handle type="target" position={Position.Left} id="text" style={{ top: '50%', zIndex: 10 }} data-handletype="text" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right" data-type="text" style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Text</div>
 
      {/* 输出 Handle (50%) */}
      <Handle type="source" position={Position.Right} id="audio" style={{ top: '50%', zIndex: 10 }} data-handletype="audio" />
      <div className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none" data-type="audio" style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}>Audio</div>
    </>
  );

  // minimalContent - 最小预览模式，无边距
  const minimalContent = (
    <>
      {/* 音频预览 - 全屏无间隙 */}
      <div className="flex-1 flex items-center justify-center min-h-[80px]">
        {audioUrl && !loading ? (
          <div className="flex items-center gap-2 px-2">
            <span className="text-[10px] text-neutral-400 truncate block max-w-[150px]">
              {text.slice(0, 20)}{text.length > 20 ? '...' : ''}
            </span>
          </div>
        ) : loading ? (
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[10px]">生成中...</span>
          </div>
        ) : (
          <span className="text-neutral-500 text-[10px]">运行生成</span>
        )}
      </div>
    </>
  );

  // hoverContent - 悬停时显示完整参数，参数在底部
  const hoverContent = (
    <div className="flex flex-col h-full">
      {/* 预览区域 */}
      <div className="flex-1 min-h-0">
        {audioUrl && !loading && (
          <div className="w-full h-full min-h-[60px] bg-[#1a1a1a] rounded p-2 flex items-center justify-center">
            <span className="text-[10px] text-neutral-300 whitespace-pre-wrap break-words">
              {text.length > 150 ? text.substring(0, 150) + '...' : text}
            </span>
          </div>
        )}
      </div>

      {/* 参数区域 - 在底部 */}
      <div className="flex flex-col gap-1.5 pt-2 border-t border-[#333]">
        {/* 文本输入 - 增加高度 */}
        <textarea
          value={text}
          onChange={(e) => updateNodeData(id, { text: e.target.value })}
          placeholder="输入要转换为语音的文本..."
          className="w-full bg-[#1a1a1a] text-white text-xs rounded p-1.5 resize-none border border-[#333] focus:border-blue-500 outline-none"
          rows={3}
        />

        {showNodeModelSettings && (
          <ProviderModelSelector
            type="audio"
            selectedChannelId={selectedChannelId}
            selectedModel={selectedModel}
            onChannelChange={(channelId) => updateNodeData(id, { selectedChannelId: channelId })}
            onModelChange={(model) => updateNodeData(id, { selectedModel: model })}
          />
        )}

         {/* 时长选项 - 自行输入 */}
         <div className="flex items-center gap-1">
           <span className="text-[10px] text-neutral-400 whitespace-nowrap">时长：</span>
           <input
             type="text"
             value={audioDuration}
             onChange={(e) => updateNodeData(id, { audioDuration: e.target.value })}
             placeholder="输入秒数"
             className="w-20 bg-[#1a1a1a] text-white text-[10px] rounded p-1 border border-[#333] focus:border-blue-500 outline-none"
           />
           <span className="text-[10px] text-neutral-500">秒</span>
         </div>

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
    <BaseNodeWrapper selected={!!selected} loading={loading} errorMessage={errorMessage}
      title="生成音频"
      showHoverHeader
      onRun={handleGenerate}
      hoverContent={hoverContent}
      handles={handles}
    >
      {minimalContent}
    </BaseNodeWrapper>
  );
}

export default memo(GenerateAudioNode);
