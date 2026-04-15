/**
 * RunningHub Workflow Node
 *
 * 专门处理 RunningHub Workflow 的配置和执行
 * 支持：
 * - 获取工作流 JSON 并解析节点
 * - 动态 handles（image-*, video-*, audio-*, text/any）
 * - 节点字段编辑
 * - 上游数据自动填充
 * - 文件上传到 RunningHub
 * - ZIP 解压处理
 */

import { memo, useCallback, useRef, useState, useEffect, useMemo } from 'react';
import { Handle, Position, type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import type { RhWfNodeType, RhWfNodeConfig } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';
import { executeRhWorkflowApi, fetchRhWorkflowJson, uploadFileToRunningHub, parseRhWorkflowNodes } from '@/api/rhApi';
import type { RhWorkflowNode } from '@/api/rhApi';
import { getConnectedInputs, getInputsByHandle } from '@/utils/connectedInputs';
import { extractZipContents, classifyMedia } from '@/utils/zipExtractor';

const OUTPUT_TYPE_OPTIONS = [
  { value: 'auto', label: 'Auto（自动）' },
  { value: 'image', label: '图片' },
  { value: 'video', label: '视频' },
  { value: 'audio', label: '音频' },
  { value: 'text', label: '文本' },
];

function RhWfNodeComponent({ id, data, selected }: NodeProps<RhWfNodeType>) {
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const updateNodeInternals = useUpdateNodeInternals();

  const {
    label,
    configMode,
    config,
    loading,
    progress,
    outputUrl,
    textOutput,
    errorMessage,
    nodeValues,
  } = data;

  const abortRef = useRef<AbortController | null>(null);

  // 从 settings 获取 Workflow 列表
  const runninghubWorkflows = useSettingsStore((s) => s.comfyuiConfig.runninghubWorkflows ?? []);
  const apiKey = useSettingsStore((s) => s.comfyuiConfig.runninghubApiKey);

  // 工作流节点解析结果
  const [parsedNodes, setParsedNodes] = useState<RhWorkflowNode[]>([]);

  // 计算 IMAGE 字段的数量（所有节点，不仅 LoadImage）
  const imageFieldCount = useMemo(() => {
    return parsedNodes
      .flatMap((n) =>
        Object.entries(n.inputs)
          .filter(([, fi]) => fi?.type === 'IMAGE')
      ).length;
  }, [parsedNodes]);

  // 监听 handles 变化，通知 React Flow 更新
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals]);

  // 上游数据
  const upstreamData = useMemo(() => {
    return getConnectedInputs(id, nodes, edges);
  }, [id, nodes, edges]);

  // 按 handle 收集数据（用于多图填充）
  const inputsByHandle = useMemo(() => {
    return getInputsByHandle(id, nodes, edges);
  }, [id, nodes, edges]);

  // 初始化时如果已有 workflow，加载节点
  useEffect(() => {
    if (config.workflowId && !parsedNodes.length) {
      handleSelectWorkflow(config.workflowId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateConfig = useCallback(
    (patch: Partial<RhWfNodeConfig>) => {
      updateNodeData(id, { config: { ...config, ...patch } });
    },
    [id, config, updateNodeData]
  );

  // 切换配置模式
  const toggleConfigMode = useCallback(() => {
    updateNodeData(id, { configMode: !configMode });
  }, [id, configMode, updateNodeData]);

  // 选择 Workflow
  const handleSelectWorkflow = useCallback(async (workflowId: string) => {
    if (!workflowId) return;

    setParsedNodes([]);
    updateNodeData(id, { nodeValues: {} });

    const wf = runninghubWorkflows.find((w) => w.id === workflowId);
    updateConfig({ workflowId, workflowName: wf?.name ?? workflowId });

    if (!apiKey) {
      updateNodeData(id, { errorMessage: '请先在设置中配置 RunningHub API Key' });
      return;
    }

    try {
      // 获取工作流 JSON
      const jsonStr = await fetchRhWorkflowJson(apiKey, workflowId);
      updateConfig({ workflowJson: jsonStr });

      // 解析节点
      const parsed = parseRhWorkflowNodes(jsonStr);
      setParsedNodes(parsed);

      // 初始化 nodeValues
      const values: Record<string, Record<string, unknown>> = {};
      for (const node of parsed) {
        values[node.nodeId] = {};
        for (const [field, fieldInfo] of Object.entries(node.inputs)) {
          const val = fieldInfo?.value;
          // 跳过节点引用（数组格式：[" nodeId", index]）
          if (Array.isArray(val)) continue;
          if (val !== undefined && val !== null) {
            values[node.nodeId]![field] = val;
          }
        }
      }
      updateNodeData(id, { nodeValues: values });

    } catch (err) {
      updateNodeData(id, { errorMessage: err instanceof Error ? err.message : '获取工作流失败' });
    }
  }, [apiKey, runninghubWorkflows, id, updateNodeData, updateConfig]);

  // 节点字段值变化
  const handleNodeValueChange = useCallback((nodeId: string, field: string, value: unknown) => {
    const newValues = {
      ...(nodeValues ?? {}),
      [nodeId]: { ...(nodeValues?.[nodeId] ?? {}), [field]: value },
    };
    updateNodeData(id, { nodeValues: newValues });
  }, [id, nodeValues, updateNodeData]);

  // 从 nodeValues 生成 nodeInfoList
  const generateNodeInfoList = useCallback((): Array<{ nodeId: string; fieldName: string; fieldValue: string }> => {
    const list: Array<{ nodeId: string; fieldName: string; fieldValue: string }> = [];
    for (const [nodeId, fields] of Object.entries(nodeValues ?? {})) {
      for (const [fieldName, value] of Object.entries(fields)) {
        const strValue = String(value ?? '');
        // 跳过空值
        if (strValue.trim() !== '') {
          list.push({ nodeId, fieldName, fieldValue: strValue });
        }
      }
    }
    return list;
  }, [nodeValues]);

  // 执行
  const handleExecute = useCallback(async () => {
    if (loading) return;
    if (!config.workflowId) {
      updateNodeData(id, { errorMessage: '请先选择 Workflow' });
      return;
    }
    if (!apiKey) {
      updateNodeData(id, { errorMessage: '请先在设置中配置 RunningHub API Key' });
      return;
    }

    updateNodeData(id, { loading: true, errorMessage: '', progress: 0 });
    abortRef.current = new AbortController();

    try {
      // 1. 收集需要上传的文件
      const nodeInfoList = generateNodeInfoList();

      // 2. 如果有上游图片/视频/音频，需要上传到 RunningHub
      const processedNodeInfoList = [...nodeInfoList];

      // 获取所有 IMAGE 字段
      const imageFields = parsedNodes
        .flatMap((n) =>
          Object.entries(n.inputs)
            .filter(([, fi]) => fi?.type === 'IMAGE')
            .map(([field]) => ({ nodeId: n.nodeId, field }))
        );

      // 处理图片字段
      for (const [handleId, images] of Object.entries(inputsByHandle)) {
        if (!handleId.startsWith('image-')) continue;
        const handleIndex = parseInt(handleId.replace('image-', ''), 10);
        const targetField = imageFields[handleIndex];
        if (!targetField) continue;

        for (const imageUrl of images) {
          try {
            const fileName = await uploadFileToRunningHub(apiKey, imageUrl, 'input', abortRef.current?.signal);
            // 查找或添加条目
            const idx = processedNodeInfoList.findIndex(
              (n) => n.nodeId === targetField.nodeId && n.fieldName === targetField.field
            );
            if (idx >= 0) {
              processedNodeInfoList[idx]!.fieldValue = fileName;
            } else {
              processedNodeInfoList.push({ nodeId: targetField.nodeId, fieldName: targetField.field, fieldValue: fileName });
            }
          } catch (uploadErr) {
            throw new Error(`上传图片失败: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`);
          }
        }
      }

      // 处理上游文本（填入第一个 STRING 字段）
      if (upstreamData.text) {
        const stringField = parsedNodes
          .flatMap((n) =>
            Object.entries(n.inputs)
              .filter(([, fi]) => fi?.type === 'STRING')
              .map(([field]) => ({ nodeId: n.nodeId, field }))
          )[0];
        if (stringField) {
          const idx = processedNodeInfoList.findIndex(
            (n) => n.nodeId === stringField.nodeId && n.fieldName === stringField.field
          );
          if (idx >= 0) {
            processedNodeInfoList[idx]!.fieldValue = upstreamData.text;
          } else {
            processedNodeInfoList.push({ nodeId: stringField.nodeId, fieldName: stringField.field, fieldValue: upstreamData.text });
          }
        }
      }

      // 3. 执行工作流
      const result = await executeRhWorkflowApi(
        apiKey,
        config.workflowId!,
        processedNodeInfoList,
        (p) => updateNodeData(id, { progress: p }),
        abortRef.current.signal
      );

      // 4. 处理返回结果（可能是 ZIP）
      let finalOutputUrl = result.outputUrl;
      let finalOutputUrls = result.outputUrls;

      // 检查是否是 ZIP 文件
      if (result.outputUrl.endsWith('.zip') || result.outputUrl.includes('.zip?')) {
        try {
          const mediaFiles = await extractZipContents(result.outputUrl, abortRef.current.signal);
          const classified = classifyMedia(mediaFiles);

          // 生成所有文件的 URL
          const allUrls: string[] = [
            ...classified.images.map((f) => f.url),
            ...classified.videos.map((f) => f.url),
            ...classified.audio.map((f) => f.url),
          ];

          if (allUrls.length > 0) {
            finalOutputUrl = allUrls[0]!;
            finalOutputUrls = allUrls;
          }
        } catch (extractErr) {
          console.warn('[RhWfNode] ZIP 解压失败，使用原始 URL:', extractErr);
        }
      }

      // 5. 判断输出类型
      const effectiveOutputType = config.outputType ?? 'auto';
      const isMediaUrl =
        finalOutputUrl.includes('/view?') ||
        /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav)(\?|$)/i.test(finalOutputUrl);

      if (effectiveOutputType === 'text' || (!isMediaUrl && effectiveOutputType === 'auto')) {
        updateNodeData(id, {
          textOutput: finalOutputUrl,
          outputUrl: undefined,
          outputUrls: undefined,
          loading: false,
          progress: 0,
        });
      } else {
        updateNodeData(id, {
          outputUrl: finalOutputUrl,
          outputUrls: finalOutputUrls.length > 1 ? finalOutputUrls : undefined,
          textOutput: undefined,
          loading: false,
          progress: 0,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '执行失败';
      updateNodeData(id, { loading: false, errorMessage: msg, progress: 0 });
    }
  }, [loading, config, apiKey, id, updateNodeData, parsedNodes, generateNodeInfoList, inputsByHandle, upstreamData]);

  // 停止
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // 判断输出类型
  const effectiveOutputType = config.outputType ?? 'auto';
  const isMediaUrl =
    outputUrl?.includes('/view?') ||
    /\.(png|jpg|jpeg|gif|webp|mp4|webm|mp3|wav)(\?|$)/i.test(outputUrl ?? '');
  const displayOutputType =
    effectiveOutputType === 'auto'
      ? isMediaUrl
        ? 'image'
        : 'text'
      : effectiveOutputType;

  // 预览内容
  const previewContent = (
    <div className="flex-1 min-h-0 flex flex-col">
      {config.workflowName && (
        <div className="text-[9px] text-primary truncate mb-1 px-1">{config.workflowName}</div>
      )}
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[#1a1a1a] rounded mx-1">
        {loading ? (
          <div className="flex items-center gap-2 text-neutral-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[10px]">执行中...</span>
          </div>
        ) : errorMessage ? (
          <span className="text-[10px] text-error px-2 text-center">{errorMessage}</span>
        ) : outputUrl ? (
          displayOutputType === 'image' ? (
            <img src={outputUrl} alt="输出" className="max-w-full max-h-full object-contain" />
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
      onSettings={toggleConfigMode}
    >
      <div className="flex flex-col gap-2 min-h-0 flex-1">
        {/* 配置模式 */}
        {configMode && (
          <div className="flex flex-col gap-2 px-1">
            {/* 输出类型 */}
            <select
              value={config.outputType ?? 'auto'}
              onChange={(e) =>
                updateConfig({ outputType: e.target.value as RhWfNodeConfig['outputType'] })
              }
              className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border"
            >
              {OUTPUT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Workflow 选择 */}
            <select
              value={config.workflowId ?? ''}
              onChange={(e) => handleSelectWorkflow(e.target.value)}
              className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-1 border border-border"
            >
              <option value="">— 选择 Workflow —</option>
              {runninghubWorkflows.map((wf) => (
                <option key={wf.id} value={wf.id}>
                  {wf.name}
                </option>
              ))}
            </select>

            {runninghubWorkflows.length === 0 && (
              <div className="text-[9px] text-yellow-400">
                请在设置中添加 RunningHub Workflow
              </div>
            )}

            {!apiKey && (
              <div className="text-[9px] text-yellow-400">请在设置中配置 API Key</div>
            )}

            {/* 节点参数编辑 */}
            {parsedNodes.length > 0 && (
              <div className="flex flex-col gap-0.5 bg-[#1a1a1a] rounded p-1 border border-border max-h-40 overflow-y-auto">
                {parsedNodes.map((node) => (
                  <div key={node.nodeId} className="flex flex-col gap-0.5 p-1 bg-surface rounded">
                    <span className="text-[8px] text-primary font-mono">[{node.nodeId}] {node.classType}</span>
                    {Object.entries(node.inputs)
                      .filter(([, fieldInfo]) => !Array.isArray(fieldInfo?.value))
                      .slice(0, 8)
                      .map(([field, fieldInfo]) => (
                        <div key={field} className="flex items-center gap-1">
                          <span className={`text-[7px] w-16 truncate shrink-0 ${
                            fieldInfo?.type === 'IMAGE' ? 'text-green-500' :
                            fieldInfo?.type === 'VIDEO' ? 'text-orange-500' :
                            fieldInfo?.type === 'AUDIO' ? 'text-purple-500' :
                            fieldInfo?.type === 'INT' || fieldInfo?.type === 'FLOAT' ? 'text-blue-400' :
                            'text-text-muted'
                          }`}>
                            {field}
                          </span>
                          <input
                            value={String(nodeValues?.[node.nodeId]?.[field] ?? fieldInfo?.value ?? '')}
                            onChange={(e) => handleNodeValueChange(node.nodeId, field, e.target.value)}
                            className="flex-1 bg-surface-hover text-text text-[8px] rounded px-1 py-0.5 border border-border outline-none min-w-0"
                            placeholder={String(fieldInfo?.value ?? '')}
                          />
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 预览模式 */}
        {!configMode && previewContent}
      </div>

      {/* 默认 any handle — 始终保留，用于接收上游数据 */}
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
        className="absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right"
        data-type="any"
        style={{ right: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}
      >
        Any
      </div>

      {/* 多图模式：仅当 IMAGE 字段数量 > 2 时，显示额外的 image-* handles */}
      {imageFieldCount > 2 && (
        <>
          {Array.from({ length: imageFieldCount }, (_, i) => {
            // 计算位置：跳过 50% 的 any handle
            const totalSlots = imageFieldCount + 1; // +1 预留 any handle
            let position = ((i + 1) / totalSlots) * 100;
            // 如果位置接近 50%，向下偏移一点
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
          {/* 图片 handle 标签 */}
          {Array.from({ length: imageFieldCount }, (_, i) => {
            const totalSlots = imageFieldCount + 1;
            let position = ((i + 1) / totalSlots) * 100;
            if (Math.abs(position - 50) < 15) {
              position = position < 50 ? position - 10 : position + 10;
            }
            return (
              <div
                key={`image-label-${i}`}
                className="absolute text-[9px] font-medium whitespace-nowrap pointer-events-none text-right"
                data-type="image"
                style={{ right: 'calc(100% + 8px)', top: `calc(${position}% - 8px)`, zIndex: 10 }}
              >
                Image {i}
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
        className="absolute text-[9px] font-medium whitespace-nowrap pointer-events-none"
        data-type="any"
        style={{ left: 'calc(100% + 8px)', top: 'calc(50% - 8px)', zIndex: 10 }}
      >
        Any
      </div>

      {/* 执行按钮 */}
      <div className="shrink-0 p-2 border-t border-border bg-[#262626] rounded-b-lg">
        <div className="flex gap-1">
          <button
            onClick={handleExecute}
            disabled={loading}
            className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:bg-surface-hover text-text text-[10px] py-1.5 rounded font-medium"
          >
            {loading ? '执行中...' : '▶ 执行'}
          </button>
          {loading && (
            <button
              onClick={handleStop}
              className="flex-1 bg-error hover:bg-error/80 text-text text-[10px] py-1.5 rounded font-medium"
            >
              ⏹ 停止
            </button>
          )}
        </div>
      </div>
    </BaseNodeWrapper>
  );
}

export default memo(RhWfNodeComponent);
