/**
 * RunningHub APP Node
 *
 * 专门处理 RunningHub APP（快捷创作）的配置和执行
 *
 * 设计规则：
 * - any-input: 智能映射 text→STRING, image→第一个IMAGE, video→VIDEO, audio→AUDIO
 * - image-N handles: 超过2个IMAGE字段时，多出的每个字段单独暴露一个 image handle
 * - 选择 APP 后自动获取 nodeInfoList 并渲染编辑界面
 * - 支持 STRING(文本框)、LIST(下拉)、IMAGE/AUDIO/VIDEO(文件上传) 字段类型
 * - 响应可能是 ZIP 包（多图/多种媒体），自动解压
 */

import { memo, useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import type { RhAppNodeType, RhAppNodeConfig } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';
import { fetchRhAppNodeInfo } from '@/api/rhApi';
import type { RhNodeInfo } from '@/api/rhApi';
import { getConnectedInputs } from '@/utils/connectedInputs';

const OUTPUT_TYPE_OPTIONS = [
  { value: 'auto', label: 'Auto（自动）' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'text', label: '文本' },
];

function RhAppNodeComponent({ id, data, selected }: NodeProps<RhAppNodeType>) {
  const {
    label,
    configMode,
    config,
    loading,
    progress,
    outputUrl,
    outputUrls,
    textOutput,
    errorMessage,
  } = data;

  const abortRef = useRef<AbortController | null>(null);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const updateNodeInternals = useUpdateNodeInternals();

  // 从 settings 获取 APP 列表
  const runninghubApps = useSettingsStore((s) => s.comfyuiConfig.runninghubApps ?? []);
  const apiKey = useSettingsStore((s) => s.comfyuiConfig.runninghubApiKey);

  // APP 节点信息（从 API 获取）
  const [fetchedNodeInfoList, setFetchedNodeInfoList] = useState<RhNodeInfo[]>([]);
  const [fetchingInfo, setFetchingInfo] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // 计算 IMAGE 字段数量（用于决定是否显示额外 image handles）
  const imageFieldCount = useMemo(() => {
    return fetchedNodeInfoList.filter(n => n.fieldType === 'IMAGE').length;
  }, [fetchedNodeInfoList]);

  // 对齐 OmniNode: 仅当 IMAGE 字段数量 > 1 时，才显示额外 handle（默认 any handle 在 50% 位置，多图时需要分散）
  const extraImageHandleCount = imageFieldCount > 1 ? imageFieldCount : 0;

  // 监听 handles 变化 + 配置模式切换（内容高度变化导致 Handle 位置偏移）
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, extraImageHandleCount, configMode]);

  const updateConfig = useCallback(
    (patch: Partial<RhAppNodeConfig>) => {
      // 从 store 实时读取最新 config，避免 stale closure
      const freshConfig = (useFlowStore.getState().nodes.find(n => n.id === id)?.data?.config ?? {}) as RhAppNodeConfig;
      updateNodeData(id, { config: { ...freshConfig, ...patch } });
    },
    [id, updateNodeData]
  );

  // 切换配置模式
  const toggleConfigMode = useCallback(() => {
    updateNodeData(id, { configMode: !configMode });
  }, [id, configMode, updateNodeData]);

  // 选择 APP 并获取节点信息
  const handleSelectApp = useCallback(async (appId: string) => {
    const app = runninghubApps.find((a) => a.id === appId);
    updateConfig({ appId, appName: app?.name ?? appId });
    setFetchedNodeInfoList([]);
    setFetchError('');

    if (!appId) return;
    if (!apiKey) {
      setFetchError('请先在设置中配置 RunningHub API Key');
      return;
    }

    setFetchingInfo(true);
    try {
      const result = await fetchRhAppNodeInfo(apiKey, appId);
      setFetchedNodeInfoList(result.nodeInfoList);
      // 同步更新 config.nodeInfoList
      updateConfig({
        nodeInfoList: result.nodeInfoList.map(n => ({
          nodeId: n.nodeId,
          nodeName: n.nodeName,
          fieldName: n.fieldName,
          fieldValue: n.fieldValue,
          fieldType: n.fieldType,
          description: n.description,
          fieldData: n.fieldData,
          descriptionEn: n.descriptionEn,
        })),
      });
      // 更新 handles
      updateNodeInternals(id);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : '获取APP信息失败');
    } finally {
      setFetchingInfo(false);
    }
  }, [runninghubApps, apiKey, updateConfig, updateNodeInternals, id]);

  // 更新 nodeInfoList 中某个字段的值
  const handleFieldValueChange = useCallback((nodeId: string, fieldName: string, newValue: string) => {
    const currentList = config.nodeInfoList ?? [];
    const updatedList = currentList.map(n =>
      n.nodeId === nodeId && n.fieldName === fieldName
        ? { ...n, fieldValue: newValue }
        : n
    );
    updateConfig({ nodeInfoList: updatedList });
  }, [config.nodeInfoList, updateConfig]);

  // 验证运行（单节点执行）
  const handleExecute = useCallback(async () => {
    if (loading) return;
    if (!config.appId) {
      updateNodeData(id, { errorMessage: '请先选择 APP' });
      return;
    }
    if (!apiKey) {
      updateNodeData(id, { errorMessage: '请先在设置中配置 RunningHub API Key' });
      return;
    }

    abortRef.current = new AbortController();

    // 动态导入 executor，构造执行上下文
    const { executeRhAppNode } = await import('@/store/execution/rhAppExecutor');
    const currentNodes = useFlowStore.getState().nodes;
    const currentEdges = useFlowStore.getState().edges;
    const freshNode = currentNodes.find(n => n.id === id);
    if (!freshNode) return;

    const ctx = {
      node: freshNode,
      nodes: currentNodes,
      edges: currentEdges,
      getConnectedInputs: (nodeId: string) => getConnectedInputs(nodeId, currentNodes, currentEdges),
      updateNodeData: (nodeId: string, patch: Record<string, unknown>) => {
        useFlowStore.getState().updateNodeData(nodeId, patch);
      },
      getFreshNode: (nodeId: string) => useFlowStore.getState().nodes.find(n => n.id === nodeId),
      signal: abortRef.current.signal,
    };

    try {
      await executeRhAppNode(ctx);
    } catch (err) {
      // executor 内部已处理 errorMessage，此处忽略
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.warn('[RhAppNode] 验证运行失败:', err);
      }
    }
  }, [loading, config.appId, apiKey, id, updateNodeData]);

  // 判断输出类型 — 对齐 OmniNode OutputPreview 逻辑
  const effectiveOutputType = config.outputType ?? 'auto';
  const outputUrlTypes = data.outputUrlTypes as string[] | undefined;
  // blob URL type from metadata (ZIP extraction result), fallback to URL extension inference
  const blobMediaType = outputUrl?.startsWith('blob:') && outputUrlTypes?.[0]
    ? outputUrlTypes[0] : undefined;
  const isMediaUrl =
    !!blobMediaType ||
    outputUrl?.startsWith('blob:') ||
    outputUrl?.includes('/view?') ||
    /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav)(\?|$)/i.test(outputUrl ?? '');
  const displayOutputType =
    effectiveOutputType === 'auto'
      ? isMediaUrl
        ? blobMediaType && ['video', 'audio', 'image'].includes(blobMediaType) ? blobMediaType
          : /\.(mp4|webm|mov)(\?|$)/i.test(outputUrl ?? '') ? 'video'
          : /\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(outputUrl ?? '') ? 'audio'
          : 'image'
        : 'text'
      : effectiveOutputType;

  // 渲染单个字段编辑器
  const renderFieldEditor = (nodeInfo: RhNodeInfo & { fieldData?: string; descriptionEn?: string }) => {
    const { fieldType, fieldValue, fieldName, nodeId } = nodeInfo;
    const currentList = config.nodeInfoList ?? [];
    const currentValue = currentList.find(n => n.nodeId === nodeId && n.fieldName === fieldName)?.fieldValue ?? fieldValue;

    // LIST 字段：下拉选择
    if (fieldType === 'LIST' && nodeInfo.fieldData) {
      let options: Array<{ name: string; index: string; description?: string }> = [];
      try {
        options = JSON.parse(nodeInfo.fieldData);
      } catch { /* ignore parse errors */ }

      return (
        <select
          value={currentValue}
          onChange={(e) => handleFieldValueChange(nodeId, fieldName, e.target.value)}
          className="w-full bg-surface-hover text-text text-[8px] rounded px-1 py-0.5 border border-border outline-none"
        >
          {options.map((opt) => (
            <option key={opt.index} value={opt.index}>
              {opt.name}{opt.description ? ` - ${opt.description}` : ''}
            </option>
          ))}
        </select>
      );
    }

    // IMAGE/AUDIO/VIDEO 字段：通过 Handle 传入，显示当前值
    if (['IMAGE', 'AUDIO', 'VIDEO'].includes(fieldType)) {
      const hasValue = currentValue && currentValue !== fieldValue;
      return (
        <div className="flex items-center gap-1">
          <span className="text-[7px] text-text-muted truncate flex-1">{fieldName}</span>
          {hasValue ? (
            <span className="text-[7px] text-green-400 truncate max-w-[80px]">✓ {String(currentValue).slice(-20)}</span>
          ) : (
            <span className="text-[7px] text-text-muted italic">通过 {fieldType} 接口传入</span>
          )}
        </div>
      );
    }

    // STRING 字段：文本输入框
    return (
      <textarea
        value={currentValue}
        onChange={(e) => handleFieldValueChange(nodeId, fieldName, e.target.value)}
        className="w-full bg-surface-hover text-text text-[8px] rounded px-1 py-0.5 border border-border outline-none resize-none font-mono"
        rows={2}
      />
    );
  };

  // 预览内容
  const previewContent = (
    <div className="flex-1 min-h-0 flex flex-col">
      {config.appName && (
        <div className="text-[9px] text-primary truncate mb-1 px-1">{config.appName}</div>
      )}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[#1a1a1a] rounded mx-1">
        {loading ? (
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[10px]">运行中...</span>
          </div>
        ) : errorMessage ? (
          <span className="text-[10px] text-error px-2 text-center">{errorMessage}</span>
        ) : outputUrl ? (
          displayOutputType === 'image' ? (
            outputUrls && outputUrls.length > 1 ? (
              <div className="grid grid-cols-2 gap-1 p-1 max-h-full overflow-auto">
                {outputUrls.map((url, i) => (
                  <img key={i} src={url} alt={`结果 ${i + 1}`} className="w-full h-auto object-contain rounded" />
                ))}
              </div>
            ) : (
              <img src={outputUrl} alt="输出" className="max-w-full max-h-full object-contain" />
            )
          ) : displayOutputType === 'video' ? (
            <video src={outputUrl} controls className="max-w-full max-h-full" />
          ) : displayOutputType === 'audio' ? (
            <audio src={outputUrl} controls className="w-full max-w-[200px]" />
          ) : (
            <pre className="text-[8px] text-text-secondary bg-surface p-1 rounded max-w-full overflow-auto whitespace-pre-wrap break-all">
              {outputUrl.length > 200 ? outputUrl.slice(0, 200) + '...' : outputUrl}
            </pre>
          )
        ) : textOutput ? (
          <pre className="text-[9px] text-text-secondary p-1.5 whitespace-pre-wrap break-all font-mono max-h-full overflow-auto">
            {textOutput}
          </pre>
        ) : (
          <span className="text-[10px] text-text-muted">运行配置</span>
        )}
      </div>
      {loading && progress && progress > 0 && (
        <div className="w-full bg-surface rounded-full h-1 mt-1 mx-1">
          <div className="bg-blue-500 h-1 rounded-full transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </div>
  );

  return (
    <BaseNodeWrapper
      selected={selected ?? false}
      title={label}
      loading={loading}
      errorMessage={errorMessage}
      settingsPanel={undefined}
      minHeight={200}
      minWidth={200}
      showHoverHeader
      onRun={handleExecute}
      onToggle={toggleConfigMode}
    >
      <div className="flex flex-col h-full min-h-[180px]">
        {/* 配置模式内容区 - 可滚动 */}
        {configMode && (
          <div className="flex-1 min-h-0 overflow-y-auto px-1 flex flex-col gap-2">
            {/* 输出类型 */}
            <select
              value={config.outputType ?? 'auto'}
              onChange={(e) =>
                updateConfig({ outputType: e.target.value as RhAppNodeConfig['outputType'] })
              }
              className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border"
            >
              {OUTPUT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* APP 选择 */}
            <select
              value={config.appId ?? ''}
              onChange={(e) => handleSelectApp(e.target.value)}
              className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border"
            >
              <option value="">— 选择 APP —</option>
              {runninghubApps.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.name}
                </option>
              ))}
            </select>

            {runninghubApps.length === 0 && (
              <div className="text-[9px] text-yellow-400">
                请在设置中添加 RunningHub APP
              </div>
            )}

            {!apiKey && (
              <div className="text-[9px] text-yellow-400">请在设置中配置 API Key</div>
            )}

            {/* 获取节点信息中 */}
            {fetchingInfo && (
              <div className="text-[9px] text-neutral-400">获取APP信息中...</div>
            )}

            {/* 获取错误 */}
            {fetchError && (
              <div className="text-[9px] text-error">{fetchError}</div>
            )}

            {/* 节点参数编辑 */}
            {fetchedNodeInfoList.length > 0 && (
              <div className="flex flex-col gap-0.5 bg-[#1a1a1a] rounded p-1 border border-border">
                {fetchedNodeInfoList.map((nodeInfo) => (
                  <div key={`${nodeInfo.nodeId}.${nodeInfo.fieldName}`} className="flex flex-col gap-0.5 p-1 bg-surface rounded">
                    <div className="flex items-center gap-1">
                      <span className={`text-[7px] font-mono px-1 rounded ${
                        nodeInfo.fieldType === 'IMAGE' ? 'text-green-500 bg-green-500/10' :
                        nodeInfo.fieldType === 'VIDEO' ? 'text-orange-500 bg-orange-500/10' :
                        nodeInfo.fieldType === 'AUDIO' ? 'text-purple-500 bg-purple-500/10' :
                        nodeInfo.fieldType === 'LIST' ? 'text-cyan-500 bg-cyan-500/10' :
                        'text-text-muted bg-text-muted/10'
                      }`}>
                        {nodeInfo.fieldType}
                      </span>
                      <span className="text-[8px] text-primary font-mono truncate">
                        {nodeInfo.nodeName}
                      </span>
                      <span className="text-[7px] text-text-muted truncate">
                        .{nodeInfo.fieldName}
                      </span>
                    </div>
                    {nodeInfo.description && (
                      <span className="text-[7px] text-text-secondary">{nodeInfo.description}</span>
                    )}
                    {renderFieldEditor(nodeInfo)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 预览模式 - 最大化填充 */}
        {!configMode && (
          <div className="flex-1 min-h-0 flex flex-col">
            {previewContent}
          </div>
        )}
      </div>
      <Handle
        type="target"
        position={Position.Left}
        id="any-input"
        data-handletype="any"
        style={{
          top: '50%',
          zIndex: 10,
          backgroundColor: '#525252',
          width: 10,
          height: 10,
          border: '2px solid #1e1e1e',
        }}
      />
      <div
        className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right"
        data-type="any"
        style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}
      >
        Any
      </div>

      {/* 多图模式：仅当 IMAGE 字段数量 > 2 时，额外显示 image handles */}
      {extraImageHandleCount > 0 && (
        <>
          {Array.from({ length: extraImageHandleCount }, (_, i) => {
            const totalSlots = extraImageHandleCount + 1;
            let position = ((i + 1) / totalSlots) * 100;
            if (Math.abs(position - 50) < 15) {
              position = position < 50 ? position - 10 : position + 10;
            }
            return (
              <Handle
                key={`image-${i}`}
                type="target"
                position={Position.Left}
                id={`image-${i}`}
                data-handletype="image"
                style={{ top: `${position}%`, zIndex: 10, backgroundColor: '#10b981', width: 10, height: 10, border: '2px solid #1e1e1e' }}
              />
            );
          })}
          {Array.from({ length: extraImageHandleCount }, (_, i) => {
            const totalSlots = extraImageHandleCount + 1;
            let position = ((i + 1) / totalSlots) * 100;
            if (Math.abs(position - 50) < 15) {
              position = position < 50 ? position - 10 : position + 10;
            }
              return (
                <div
                  key={`image-label-${i}`}
                  className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right"
                  data-type="image"
                  style={{ right: 'calc(100% + 8px)', top: `calc(${position}% - 8px)`, zIndex: 10 }}
                >
                  Img {i}
                </div>
            );
          })}
        </>
      )}

      {/* 输出 Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="any-output"
        data-handletype="any"
        style={{
          top: '50%',
          zIndex: 10,
          backgroundColor: '#525252',
          width: 12,
          height: 12,
          border: '2px solid #1e1e1e',
        }}
      />
      <div
        className="handle-label absolute text-[9px] font-medium whitespace-nowrap pointer-events-none"
        data-type="any"
        style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}
      >
        Any
      </div>
    </BaseNodeWrapper>
  );
}

export default memo(RhAppNodeComponent);