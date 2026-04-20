/**
 * ZIP Extract Node
 *
 * 解压 ZIP 文件，提取媒体资源供下游节点消费。
 * 三种输入方式：
 * - 上游节点连线传入 ZIP URL（如 RH APP 节点输出）
 * - 手动粘贴 ZIP URL
 * - 本地上传 ZIP 文件
 *
 * 不做分类——分类由路由节点负责。
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { RhZipNodeType } from '@/types';
import { useFlowStore } from '@/stores/useFlowStore';
import BaseNodeWrapper from './BaseNode';
import { executeRhZipLocal, executeRhZipNode } from '@/execution/rhZipExecutor';
import { revokeMediaUrls } from '@/utils/zipExtractor';
import { getConnectedInputs } from '@/utils/connectedInputs';

function RhZipNodeComponent({ id, data, selected }: NodeProps<RhZipNodeType>) {
  const {
    label,
    outputUrl,
    outputUrls,
    outputUrlTypes,
    extractedInfo,
    loading,
    errorMessage,
  } = data;

  const updateNodeData = useFlowStore((s) => s.updateNodeData);
  const nodes = useFlowStore((s) => s.nodes);
  const edges = useFlowStore((s) => s.edges);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevZipUrlRef = useRef<string | undefined>(undefined);

  // 手动输入 ZIP URL
  const [manualUrl, setManualUrl] = useState('');

  const handleUrlSubmit = useCallback(() => {
    if (!manualUrl.trim()) return;
    updateNodeData(id, { zipUrl: manualUrl.trim() });
  }, [id, manualUrl, updateNodeData]);

  // 监听 zipUrl 变化，自动触发解压（URL 输入或上游传入）
  useEffect(() => {
    const currentZipUrl = data.zipUrl;
    // 跳过首次渲染（prevZipUrlRef 初始为 undefined）
    if (prevZipUrlRef.current === undefined && !currentZipUrl) return;
    // 只有 zipUrl 真正变化且有值时才触发
    if (currentZipUrl && currentZipUrl !== prevZipUrlRef.current) {
      prevZipUrlRef.current = currentZipUrl;
      // 调用画布级执行器处理远程 URL
      const currentNode = nodes.find((n) => n.id === id);
      if (!currentNode) return;
      executeRhZipNode({
        node: { ...currentNode, data: { ...currentNode.data, zipUrl: currentZipUrl } },
        nodes,
        edges,
        updateNodeData,
        getFreshNode: () => nodes.find((n) => n.id === id),
        getConnectedInputs: (nodeId: string) => getConnectedInputs(nodeId, nodes, edges),
        signal: new AbortController().signal,
      }).catch(() => {
        // executor 内部已设置 errorMessage
      });
    }
  }, [data.zipUrl, id, data, nodes, edges, updateNodeData]);

  // 本地文件上传解压
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.name.endsWith('.zip')) {
        updateNodeData(id, { errorMessage: '请选择 ZIP 文件' });
        return;
      }
      try {
        await executeRhZipLocal(id, file, (nodeId, patch) =>
          useFlowStore.getState().updateNodeData(nodeId, patch)
        );
      } catch {
        // executor 内部已设置 errorMessage
      }
    },
    [id, updateNodeData]
  );

  // 拖拽上传
  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.name.endsWith('.zip')) return;
      try {
        await executeRhZipLocal(id, file, (nodeId, patch) =>
          useFlowStore.getState().updateNodeData(nodeId, patch)
        );
      } catch {
        // executor 内部已设置 errorMessage
      }
    },
    [id]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // 清除结果
  const handleClear = useCallback(() => {
    const currentNode = useFlowStore.getState().nodes.find(n => n.id === id);
    const prevData = currentNode?.data as Record<string, unknown> | undefined;
    if (prevData?.outputUrls) revokeMediaUrls(prevData.outputUrls as string[]);
    if (prevData?.outputUrl && (prevData.outputUrl as string).startsWith('blob:')) revokeMediaUrls([prevData.outputUrl as string]);

    updateNodeData(id, {
      outputUrl: undefined,
      outputUrls: undefined,
      outputUrlTypes: undefined,
      extractedInfo: undefined,
      zipUrl: undefined,
      zipFileName: undefined,
      errorMessage: '',
    });
  }, [id, updateNodeData]);

  // 判断主要输出类型用于预览
  const primaryType = outputUrlTypes?.[0];
  const isImage = primaryType === 'image' || (!primaryType && /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(outputUrl ?? ''));
  const isVideo = primaryType === 'video' || (!primaryType && /\.(mp4|webm|mov)(\?|$)/i.test(outputUrl ?? ''));
  const isAudio = primaryType === 'audio' || (!primaryType && /\.(mp3|wav|ogg)(\?|$)/i.test(outputUrl ?? ''));
  const isBlob = outputUrl?.startsWith('blob:');

  // 有结果时的预览内容
  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center gap-2 text-neutral-500">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-[10px]">解压中...</span>
        </div>
      );
    }

    if (errorMessage) {
      return <span className="text-[10px] text-error px-2 text-center">{errorMessage}</span>;
    }

    if (!outputUrl) {
      return <span className="text-[10px] text-text-muted">等待输入</span>;
    }

    // 多文件预览
    if (outputUrls && outputUrls.length > 1) {
      const isAllImage = isImage || isBlob;
      return (
        <div className="flex flex-col gap-1 w-full">
          {extractedInfo && (
            <div className="text-[9px] text-text-muted text-center">{extractedInfo}</div>
          )}
          {isAllImage ? (
            <div className="grid grid-cols-2 gap-1 p-1 max-h-full overflow-auto">
              {outputUrls.map((url, i) => {
                const t = outputUrlTypes?.[i];
                if (t === 'video' || /\.(mp4|webm)(\?|$)/i.test(url)) {
                  return <video key={i} src={url} controls className="w-full h-auto rounded" />;
                }
                if (t === 'audio' || /\.(mp3|wav)(\?|$)/i.test(url)) {
                  return <audio key={i} src={url} controls className="w-full" />;
                }
                return <img key={i} src={url} alt={`文件 ${i + 1}`} className="w-full h-auto object-contain rounded" />;
              })}
            </div>
          ) : (
            <div className="flex flex-col gap-1 p-1 overflow-auto">
              {outputUrls.map((url, i) => {
                const t = outputUrlTypes?.[i];
                if (t === 'image' || /\.(png|jpg|jpeg|gif|webp)(\?|$)/i.test(url)) {
                  return <img key={i} src={url} alt={`文件 ${i + 1}`} className="w-full h-auto object-contain rounded" />;
                }
                if (t === 'video' || /\.(mp4|webm)(\?|$)/i.test(url)) {
                  return <video key={i} src={url} controls className="w-full max-h-[120px]" />;
                }
                if (t === 'audio' || /\.(mp3|wav)(\?|$)/i.test(url)) {
                  return <audio key={i} src={url} controls className="w-full max-w-[200px]" />;
                }
                return <span key={i} className="text-[8px] text-text-muted truncate">{url}</span>;
              })}
            </div>
          )}
        </div>
      );
    }

    // 单文件预览
    return (
      <div className="flex flex-col items-center gap-1 w-full">
        {extractedInfo && (
          <div className="text-[9px] text-text-muted text-center">{extractedInfo}</div>
        )}
        {isImage || (isBlob && !isVideo && !isAudio) ? (
          <img src={outputUrl} alt="输出" className="max-w-full max-h-full object-contain" />
        ) : isVideo ? (
          <video src={outputUrl} controls className="max-w-full max-h-full" />
        ) : isAudio ? (
          <audio src={outputUrl} controls className="w-full max-w-[200px]" />
        ) : (
          <span className="text-[8px] text-text-muted truncate">{outputUrl}</span>
        )}
      </div>
    );
  };

  return (
    <BaseNodeWrapper
      selected={selected ?? false}
      title={label || 'ZIP 解压'}
      loading={loading}
      errorMessage={undefined}
      minHeight={180}
      minWidth={180}
      showHoverHeader
      onRun={handleUrlSubmit}
    >
      <div className="flex flex-col h-full min-h-[160px]">
        {/* 输入区域 — 仅在无结果时显示 */}
        {!outputUrl && !loading && (
          <div className="flex flex-col gap-2 p-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={handleFileChange}
              className="hidden"
            />
            {/* 上传按钮 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-surface hover:bg-surface-hover text-text text-[10px] py-1.5 rounded border border-border transition-colors"
            >
              上传 ZIP 文件
            </button>
            {/* URL 输入 */}
            <div className="flex gap-1">
              <input
                type="text"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUrlSubmit(); }}
                placeholder="粘贴 ZIP URL..."
                className="flex-1 bg-surface-hover text-text text-[8px] rounded px-1.5 py-1 border border-border outline-none min-w-0"
              />
              <button
                onClick={handleUrlSubmit}
                disabled={!manualUrl.trim()}
                className="bg-primary/80 hover:bg-primary text-text text-[8px] px-2 py-1 rounded border border-border disabled:opacity-40 transition-colors"
              >
                解压
              </button>
            </div>
            {/* 拖拽区域 */}
            <div
              role="button"
              tabIndex={0}
              aria-label="拖拽 ZIP 文件"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="w-full h-12 flex flex-col items-center justify-center cursor-pointer hover:bg-surface-hover transition-colors bg-[#1a1a1a] rounded border border-dashed border-border"
            >
              <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-[8px] text-text-muted mt-0.5">拖拽 ZIP 到此处</span>
            </div>
          </div>
        )}

        {/* 预览区域 */}
        <div className="flex-1 min-h-0 flex items-center justify-center bg-[#1a1a1a] rounded mx-1">
          {renderPreview()}
        </div>

        {/* 底部操作 */}
        {outputUrl && !loading && (
          <div className="flex gap-1 px-1 py-1">
            <button
              onClick={handleClear}
              className="flex-1 text-[8px] bg-surface hover:bg-surface-hover text-text-muted py-1 rounded border border-border transition-colors"
            >
              清除
            </button>
          </div>
        )}
      </div>

      {/* 输入 Handle — any-input：接收上游任何输出（URL、文本等） */}
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

      {/* 输出 Handle — 输出解压后的媒体 */}
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

export default memo(RhZipNodeComponent);