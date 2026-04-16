// Ref: §7.2 — SettingsPanel 5 Tab 结构（项目/模型/提示词/画布/系统）
// Ref: 原型 xshow-canvas-prototype.html 设置面板
import { useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { CanvasSettings } from '@/stores/useSettingsStore';
import type { PresetPrompt } from '@/types';
import { testComfyConnection, testRunninghubConnection, fetchComfyWorkflows, fetchComfyWorkflowJson, type ComfyConnectionTestResult } from '@/api/comfyApi';
import { FileText, Image, Video, Volume2, Plug, ChevronDown, ChevronUp, X, FolderOpen, Type, Grid3x3, Monitor, Eye, Moon, Sun, Workflow, RefreshCw, Loader2, Download, Upload, Box, Trash2, Plus, Save } from 'lucide-react';
import { useFlowStore } from '@/stores/useFlowStore';
import { importProjectFile } from '@/utils/projectManager';
import { fsManager } from '@/utils/fileSystemAccess';

type SettingsTab = 'project' | 'model' | 'prompt' | 'canvas' | 'system';
type ApiType = 'text' | 'image' | 'video' | 'audio' | '3d';

interface ApiSectionConfig {
  type: ApiType;
  icon: typeof FileText;
  label: string;
  channelIdKey: 'textChannelId' | 'imageChannelId' | 'videoChannelId' | 'audioChannelId' | 'model3DChannelId';
  modelKey: 'textModel' | 'drawingModel' | 'videoModel' | 'audioModel' | 'model3D';
}

const API_SECTIONS: ApiSectionConfig[] = [
  { type: 'text', icon: FileText, label: '语言模型', channelIdKey: 'textChannelId', modelKey: 'textModel' },
  { type: 'image', icon: Image, label: '图像模型', channelIdKey: 'imageChannelId', modelKey: 'drawingModel' },
  { type: 'video', icon: Video, label: '视频模型', channelIdKey: 'videoChannelId', modelKey: 'videoModel' },
  { type: 'audio', icon: Volume2, label: '音频模型', channelIdKey: 'audioChannelId', modelKey: 'audioModel' },
  { type: '3d', icon: Box, label: '3D模型', channelIdKey: 'model3DChannelId', modelKey: 'model3D' },
];

// =============================================================================
// 模型列表编辑器
// =============================================================================

function ModelListEditor({ channelId, modelType }: { channelId: string; modelType: string }) {
  const apiConfig = useSettingsStore((s) => s.apiConfig);
  const channels = apiConfig.channels;
  const channel = channels.find((c) => c.id === channelId);
  const modelEntries = apiConfig.modelEntries?.[modelType] ?? [];
  const addModelEntry = useSettingsStore((s) => s.addModelEntry);
  const removeModelEntry = useSettingsStore((s) => s.removeModelEntry);
  const setDefaultModel = useSettingsStore((s) => s.setDefaultModel);
  const updateModelSpeed = useSettingsStore((s) => s.updateModelSpeed);
  const addModelEntries = useSettingsStore((s) => s.addModelEntries);

  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');

  // 刷新模型列表
  const handleRefresh = useCallback(async () => {
    if (!channel) return;
    setFetching(true);
    setFetchError(null);
    try {
      const { fetchModelList } = await import('@/api/modelListApi');
      const models = await fetchModelList(channel);
      const entries = models.map((name) => ({
        id: `${channel.id}-${name}-${Date.now()}`,
        name,
        provider: channel.name || channel.id,
        isDefault: false,
      }));
      addModelEntries(modelType, entries);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : '获取模型列表失败');
    } finally {
      setFetching(false);
    }
  }, [channel, modelType, addModelEntries]);

  // 测试单个模型
  const handleTest = useCallback(async (entryId: string, modelName: string) => {
    if (!channel) return;
    setTestingId(entryId);
    try {
      const { testModelSpeed } = await import('@/api/modelListApi');
      const speed = await testModelSpeed(channel, modelName);
      updateModelSpeed(modelType, entryId, speed);
    } catch {
      updateModelSpeed(modelType, entryId, -1); // -1 表示失败
    } finally {
      setTestingId(null);
    }
  }, [channel, modelType, updateModelSpeed]);

  // 手动添加模型
  const handleAddManual = useCallback(() => {
    const name = manualInput.trim();
    if (!name || !channel) return;
    const entry = {
      id: `${channel.id}-${name}-${Date.now()}`,
      name,
      provider: channel.name || channel.id,
      isDefault: modelEntries.length === 0,
    };
    addModelEntry(modelType, entry);
    setManualInput('');
  }, [manualInput, channel, modelType, modelEntries.length, addModelEntry]);

  // 删除模型
  const handleRemove = useCallback((entryId: string) => {
    removeModelEntry(modelType, entryId);
  }, [modelType, removeModelEntry]);

  // 设置默认
  const handleSetDefault = useCallback((entryId: string) => {
    setDefaultModel(modelType, entryId);
  }, [modelType, setDefaultModel]);

  if (!channel) {
    return (
      <div className="text-[9px] text-text-muted italic py-2">
        请先在「渠道商」中添加供应商
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* 操作栏 */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          disabled={fetching}
          className="text-[9px] px-2 py-0.5 rounded bg-surface hover:bg-surface-hover disabled:opacity-50 text-text-secondary border border-border flex items-center gap-1"
        >
          {fetching ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          刷新模型
        </button>
        <div className="flex-1 flex items-center gap-1">
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
            placeholder="手动输入模型名"
            className="flex-1 bg-surface-hover text-text text-[9px] rounded px-1.5 py-0.5 border border-border focus:border-primary outline-none"
          />
          <button
            onClick={handleAddManual}
            disabled={!manualInput.trim()}
            className="text-[9px] px-2 py-0.5 rounded bg-surface hover:bg-surface-hover disabled:opacity-50 text-text-secondary border border-border"
          >
            添加
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {fetchError && (
        <div className="text-[9px] text-error bg-error/10 rounded px-2 py-1">
          {fetchError}
        </div>
      )}

      {/* 模型列表 */}
      {modelEntries.length > 0 ? (
        <div className="space-y-1 max-h-40 overflow-y-auto bg-surface-hover rounded p-2">
          {modelEntries.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-center gap-2 text-[9px] p-1 rounded ${
                entry.isDefault ? 'bg-primary/10 border border-primary/30' : 'bg-surface'
              }`}
            >
              {/* 默认勾选 */}
              <input
                type="radio"
                checked={entry.isDefault}
                onChange={() => handleSetDefault(entry.id)}
                className="accent-primary w-3 h-3"
                title="设为默认"
              />

              {/* 模型信息 */}
              <span className={`flex-1 truncate font-mono ${entry.isDefault ? 'text-primary' : 'text-text-secondary'}`}>
                {entry.provider}-{entry.name}
              </span>

              {/* 速度显示 */}
              {entry.speed !== undefined && (
                <span className={`text-[8px] ${entry.speed < 0 ? 'text-error' : 'text-green-400'}`}>
                  {entry.speed < 0 ? '失败' : `${entry.speed}ms`}
                </span>
              )}

              {/* 测试按钮 */}
              <button
                onClick={() => handleTest(entry.id, entry.name)}
                disabled={testingId === entry.id}
                className="text-[8px] px-1.5 py-0.5 rounded bg-surface hover:bg-surface-hover text-text-secondary border border-border disabled:opacity-50"
              >
                {testingId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '测试'}
              </button>

              {/* 删除按钮 */}
              <button
                onClick={() => handleRemove(entry.id)}
                className="text-error hover:text-error/80"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-[9px] text-text-muted italic py-2 text-center">
          暂无模型，请刷新或手动添加
        </div>
      )}
    </div>
  );
}

// =============================================================================
// 渠道商管理
// =============================================================================

function ChannelSection() {
  const channels = useSettingsStore((s) => s.apiConfig.channels);
  const addChannel = useSettingsStore((s) => s.addChannel);
  const updateChannel = useSettingsStore((s) => s.updateChannel);
  const removeChannel = useSettingsStore((s) => s.removeChannel);
  const [expanded, setExpanded] = useState(false);

  const handleAdd = useCallback(() => {
    addChannel({ id: Date.now().toString(), name: '', url: '', key: '', protocol: 'openai' });
  }, [addChannel]);

  return (
    <div className="bg-surface rounded-lg border border-border p-3">
      <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between text-sm font-medium text-text">
        <span className="flex items-center gap-2"><Plug className="w-4 h-4" />渠道商 ({channels.length})</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
      </button>
      {expanded && (
        <div className="mt-3 space-y-3">
          {channels.map((ch) => (
            <div key={ch.id} className="bg-surface-hover rounded p-2 border border-border space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input value={ch.name} onChange={(e) => updateChannel(ch.id, { name: e.target.value })} placeholder="名称" className="flex-1 bg-surface text-text text-[10px] rounded px-1.5 py-0.5 border border-border focus:border-primary outline-none" />
                <button onClick={() => removeChannel(ch.id)} className="text-error hover:text-error/80 text-xs px-1"><X className="w-3 h-3" /></button>
              </div>
              <input value={ch.url} onChange={(e) => updateChannel(ch.id, { url: e.target.value })} placeholder="API 端点地址" className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-0.5 border border-border focus:border-primary outline-none" />
              <input type="password" value={ch.key} onChange={(e) => updateChannel(ch.id, { key: e.target.value })} placeholder="API Key" className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-0.5 border border-border focus:border-primary outline-none" />
              <select value={ch.protocol} onChange={(e) => updateChannel(ch.id, { protocol: e.target.value as 'openai' | 'gemini' | 'anthropic' | 'custom' })} className="w-full bg-surface text-text text-[10px] rounded px-1.5 py-0.5 border border-border">
                <option value="openai">协议: OpenAI 兼容</option>
                <option value="gemini">协议: Gemini</option>
                <option value="anthropic">协议: Anthropic</option>
                <option value="custom">协议: 自定义</option>
              </select>
            </div>
          ))}
          <button onClick={handleAdd} className="w-full text-[10px] py-1.5 rounded border border-dashed border-border text-text-secondary hover:text-text hover:border-primary bg-surface-hover">+ 添加供应商</button>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ComfyUI 独立配置区段
// =============================================================================

function ComfyWorkflowSection() {
  const [expanded, setExpanded] = useState(false);
  const [testingLocal, setTestingLocal] = useState(false);
  const [testingCloud, setTestingCloud] = useState(false);
  const [testResultLocal, setTestResultLocal] = useState<ComfyConnectionTestResult | null>(null);
  const [testResultCloud, setTestResultCloud] = useState<ComfyConnectionTestResult | null>(null);
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [scanningWorkflows, setScanningWorkflows] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [workflowJson, setWorkflowJson] = useState<string | null>(null);
  const [loadingJson, setLoadingJson] = useState(false);
  const [wfListExpanded, setWfListExpanded] = useState(true);
  const comfyuiConfig = useSettingsStore((s) => s.comfyuiConfig);
  const updateComfyuiConfig = useSettingsStore((s) => s.updateComfyuiConfig);

  // 扫描工作流（独立于连接测试）
  const handleScanWorkflows = useCallback(async () => {
    const url = comfyuiConfig.localUrl;
    if (!url) {
      setScanError('请先填写 ComfyUI 地址');
      return;
    }
    
    setScanningWorkflows(true);
    setScanError(null);
    
    try {
      const list = await fetchComfyWorkflows(url);
      setWorkflows(list);
      updateComfyuiConfig({ localWorkflows: list });
      
      if (list.length === 0) {
        setScanError('未找到 API 格式工作流。请在 ComfyUI 中启用 Dev 模式后，使用"Save (API Format)"保存工作流');
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : '扫描失败，请确认 ComfyUI 服务已启动');
    } finally {
      setScanningWorkflows(false);
    }
  }, [comfyuiConfig.localUrl, updateComfyuiConfig]);

  // 测试本地 ComfyUI 连接
  const handleTestLocal = useCallback(async () => {
    setTestingLocal(true);
    setTestResultLocal(null);
    const url = comfyuiConfig.localUrl ?? '';
    const result = await testComfyConnection('local', url, '');
    setTestResultLocal(result);
    setTestingLocal(false);
  }, [comfyuiConfig.localUrl]);

  // 测试 Cloud ComfyUI
  const handleTestCloud = useCallback(async () => {
    setTestingCloud(true);
    setTestResultCloud(null);
    const url = comfyuiConfig.cloudUrl ?? '';
    const result = await testComfyConnection('cloud', url, '');
    setTestResultCloud(result);
    setTestingCloud(false);
  }, [comfyuiConfig.cloudUrl]);

  // 点击工作流项预览 JSON
  const handleSelectWorkflow = useCallback(async (wfPath: string) => {
    const url = comfyuiConfig.localUrl || comfyuiConfig.cloudUrl;
    if (!url) return;

    if (selectedWorkflow === wfPath) {
      setSelectedWorkflow(null);
      setWorkflowJson(null);
      return;
    }

    setSelectedWorkflow(wfPath);
    setLoadingJson(true);
    const json = await fetchComfyWorkflowJson(url, wfPath + '.json');
    setWorkflowJson(json);
    setLoadingJson(false);
  }, [comfyuiConfig.localUrl, comfyuiConfig.cloudUrl, selectedWorkflow]);

  return (
    <div className="bg-surface rounded-lg border border-border p-3">
      <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between text-sm font-medium text-text">
        <span className="flex items-center gap-2"><Workflow className="w-4 h-4" />ComfyUI 配置</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
      </button>
      {expanded && (
        <div className="mt-3 space-y-4">
          {/* ===== 本地 ComfyUI ===== */}
          <div className="space-y-1.5 p-2 bg-[#1a1a1a] rounded border border-[#444]">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-green-400 font-medium">本地 ComfyUI</label>
              <button
                onClick={handleTestLocal}
                disabled={testingLocal || !comfyuiConfig.localUrl}
                className="text-[9px] px-2 py-0.5 rounded bg-surface-hover hover:bg-surface text-text-secondary border border-border disabled:opacity-50 flex items-center gap-1"
              >
                {testingLocal ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                测试
              </button>
            </div>
            <input
              value={comfyuiConfig.localUrl ?? ''}
              onChange={(e) => updateComfyuiConfig({ localUrl: e.target.value })}
              placeholder="http://127.0.0.1:8188"
              className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-primary outline-none"
            />
            {testResultLocal && (
              <div className={`text-[9px] p-1.5 rounded ${testResultLocal.ok ? 'bg-green-500/10 text-green-400' : 'bg-error/10 text-error'}`}>
                {testResultLocal.message}
                {testResultLocal.ok && (
                  <div className="mt-1 text-[8px] text-text-secondary">
                    工作流目录：<span className="font-mono">user/default/workflows/</span>
                  </div>
                )}
              </div>
            )}
            
            {/* 扫描工作流按钮 */}
            <div className="pt-1.5 mt-1.5 border-t border-[#444]">
              <button
                onClick={handleScanWorkflows}
                disabled={scanningWorkflows || !comfyuiConfig.localUrl}
                className="text-[9px] px-2 py-0.5 rounded bg-surface-hover hover:bg-surface text-text-secondary border border-border disabled:opacity-50 flex items-center gap-1"
              >
                {scanningWorkflows ? <Loader2 className="w-3 h-3 animate-spin" /> : <FolderOpen className="w-3 h-3" />}
                扫描工作流
              </button>
              {scanError && (
                <div className="text-[8px] text-error bg-error/10 rounded p-1.5 mt-1">
                  {scanError}
                </div>
              )}
              {workflows.length > 0 && !scanError && (
                <div className="text-[8px] text-green-400 bg-green-500/10 rounded p-1.5 mt-1">
                  找到 {workflows.length} 个 API 格式工作流
                </div>
              )}
            </div>
            
            {/* 工作流列表 */}
            {workflows.length > 0 && (
              <div className="space-y-1 border-t border-[#444] pt-1.5 mt-1.5">
                <button
                  onClick={() => setWfListExpanded((e) => !e)}
                  className="w-full flex items-center justify-between"
                >
                  <span className="text-[9px] text-text-secondary font-medium">
                    工作流文件 ({workflows.length})
                  </span>
                  <span className="text-[8px] text-text-muted">（需 API 格式：ComfyUI 启用 Dev 模式 → Save (API Format)，含子目录）</span>
                  {wfListExpanded ? <ChevronUp className="w-3 h-3 text-text-secondary" /> : <ChevronDown className="w-3 h-3 text-text-secondary" />}
                </button>
                {wfListExpanded && (
                  <>
                    <div className="max-h-40 overflow-y-auto bg-surface-hover rounded p-1.5 space-y-0.5">
                      {workflows.map((w, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectWorkflow(w)}
                          className={`w-full text-left text-[9px] truncate font-mono px-1 py-0.5 rounded transition-colors ${
                            selectedWorkflow === w ? 'bg-primary/20 text-primary' : 'text-text-secondary hover:bg-surface hover:text-text'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                    {loadingJson && (
                      <div className="text-[9px] text-text-secondary flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> 加载工作流 JSON...
                      </div>
                    )}
                    {workflowJson && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] text-text-secondary font-medium truncate max-w-[200px]">
                            {selectedWorkflow}
                          </label>
                          <button
                            onClick={() => { navigator.clipboard.writeText(workflowJson); }}
                            className="text-[8px] px-1.5 py-0.5 rounded bg-surface-hover hover:bg-surface text-text-secondary border border-border"
                          >
                            复制 JSON
                          </button>
                        </div>
                        <pre className="text-[8px] text-text-secondary bg-[#111] rounded p-1.5 max-h-32 overflow-auto font-mono whitespace-pre-wrap break-all">
                          {workflowJson.length > 2000 ? workflowJson.slice(0, 2000) + '…' : workflowJson}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* ===== ComfyUI Cloud ===== */}
          <div className="space-y-1.5 p-2 bg-[#1a1a1a] rounded border border-[#444]">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-blue-400 font-medium">ComfyUI Cloud</label>
              <button
                onClick={handleTestCloud}
                disabled={testingCloud || !comfyuiConfig.cloudUrl}
                className="text-[9px] px-2 py-0.5 rounded bg-surface-hover hover:bg-surface text-text-secondary border border-border disabled:opacity-50 flex items-center gap-1"
              >
                {testingCloud ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                测试
              </button>
            </div>
            <input
              value={comfyuiConfig.cloudUrl ?? ''}
              onChange={(e) => updateComfyuiConfig({ cloudUrl: e.target.value })}
              placeholder="Cloud API 地址"
              className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-primary outline-none"
            />
            {testResultCloud && (
              <div className={`text-[9px] p-1.5 rounded ${testResultCloud.ok ? 'bg-green-500/10 text-green-400' : 'bg-error/10 text-error'}`}>
                {testResultCloud.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// RunningHub 独立配置区段
// =============================================================================

function RunningHubSection() {
  const [expanded, setExpanded] = useState(false);
  const [testingRH, setTestingRH] = useState(false);
  const [testingRHApp, setTestingRHApp] = useState(false);
  const [testResultRH, setTestResultRH] = useState<ComfyConnectionTestResult | null>(null);
  const [testResultRHApp, setTestResultRHApp] = useState<ComfyConnectionTestResult | null>(null);
  const comfyuiConfig = useSettingsStore((s) => s.comfyuiConfig);
  const updateComfyuiConfig = useSettingsStore((s) => s.updateComfyuiConfig);
  const addRunninghubApp = useSettingsStore((s) => s.addRunninghubApp);
  const removeRunninghubApp = useSettingsStore((s) => s.removeRunninghubApp);
  const addRunninghubWorkflow = useSettingsStore((s) => s.addRunninghubWorkflow);
  const removeRunninghubWorkflow = useSettingsStore((s) => s.removeRunninghubWorkflow);

  // 测试 RunningHub Workflow
  const handleTestRH = useCallback(async () => {
    setTestingRH(true);
    setTestResultRH(null);
    const result = await testRunninghubConnection(comfyuiConfig.runninghubApiKey ?? '');
    setTestResultRH(result);
    setTestingRH(false);
  }, [comfyuiConfig.runninghubApiKey]);

  // 测试 RunningHub APP
  const handleTestRHApp = useCallback(async () => {
    setTestingRHApp(true);
    setTestResultRHApp(null);
    const result = await testRunninghubConnection(comfyuiConfig.runninghubApiKey ?? '');
    setTestResultRHApp(result);
    setTestingRHApp(false);
  }, [comfyuiConfig.runninghubApiKey]);

  // 添加 APP
  const handleAddApp = useCallback(() => {
    const name = prompt('APP 名称：');
    if (!name) return;
    const id = prompt('APP ID：');
    if (!id) return;
    addRunninghubApp({ id, name });
  }, [addRunninghubApp]);

  // 添加 Workflow
  const handleAddWorkflow = useCallback(() => {
    const name = prompt('Workflow 名称（别名）：');
    if (!name) return;
    const id = prompt('Workflow ID：');
    if (!id) return;
    addRunninghubWorkflow({ id, name });
  }, [addRunninghubWorkflow]);

  return (
    <div className="bg-surface rounded-lg border border-border p-3">
      <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between text-sm font-medium text-text">
        <span className="flex items-center gap-2"><Workflow className="w-4 h-4" />RunningHub</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
      </button>
      {expanded && (
        <div className="mt-3 space-y-4">
          {/* ===== API Key（共用） ===== */}
          <div className="space-y-1.5 p-2 bg-[#1a1a1a] rounded border border-[#444]">
            <input
              type="password"
              value={comfyuiConfig.runninghubApiKey ?? ''}
              onChange={(e) => updateComfyuiConfig({ runninghubApiKey: e.target.value })}
              placeholder="RunningHub API Key"
              className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-primary outline-none"
            />
          </div>

          {/* ===== RunningHub Workflow ===== */}
          <div className="space-y-1.5 p-2 bg-[#1a1a1a] rounded border border-[#444]">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-orange-400 font-medium">RunningHub Workflow</label>
              <button
                onClick={handleTestRH}
                disabled={testingRH || !comfyuiConfig.runninghubApiKey}
                className="text-[9px] px-2 py-0.5 rounded bg-surface-hover hover:bg-surface text-text-secondary border border-border disabled:opacity-50 flex items-center gap-1"
              >
                {testingRH ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                测试
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[9px] text-text-secondary">Workflow 列表</label>
              <button
                onClick={handleAddWorkflow}
                className="text-[9px] px-2 py-0.5 rounded bg-surface-hover hover:bg-surface text-text-secondary border border-border"
              >
                + 添加 Workflow
              </button>
            </div>
            {(comfyuiConfig.runninghubWorkflows ?? []).length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto bg-surface-hover rounded p-1.5">
                {(comfyuiConfig.runninghubWorkflows ?? []).map((workflow, index) => (
                  <div key={workflow.id} className="flex items-center gap-2 text-[9px]">
                    <span className="text-primary font-mono w-5 shrink-0">{index + 1}.</span>
                    <span className="truncate text-text-secondary flex-1 min-w-0">
                      {workflow.name}
                    </span>
                    <span className="text-text-muted text-[8px] font-mono shrink-0">
                      ID:{workflow.id}
                    </span>
                    <button
                      onClick={() => removeRunninghubWorkflow(workflow.id)}
                      className="text-error hover:text-error/80 shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[9px] text-text-muted italic">暂无 Workflow，请点击添加</div>
            )}
            {testResultRH && (
              <div className={`text-[9px] p-1.5 rounded ${testResultRH.ok ? 'bg-green-500/10 text-green-400' : 'bg-error/10 text-error'}`}>
                {testResultRH.message}
              </div>
            )}
          </div>

          {/* ===== RunningHub APP ===== */}
          <div className="space-y-1.5 p-2 bg-[#1a1a1a] rounded border border-[#444]">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-purple-400 font-medium">RunningHub APP</label>
              <button
                onClick={handleTestRHApp}
                disabled={testingRHApp || !comfyuiConfig.runninghubApiKey}
                className="text-[9px] px-2 py-0.5 rounded bg-surface-hover hover:bg-surface text-text-secondary border border-border disabled:opacity-50 flex items-center gap-1"
              >
                {testingRHApp ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                测试
              </button>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[9px] text-text-secondary">APP 列表</label>
              <button
                onClick={handleAddApp}
                className="text-[9px] px-2 py-0.5 rounded bg-surface-hover hover:bg-surface text-text-secondary border border-border"
              >
                + 添加 APP
              </button>
            </div>
            {(comfyuiConfig.runninghubApps ?? []).length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto bg-surface-hover rounded p-1.5">
                {(comfyuiConfig.runninghubApps ?? []).map((app, index) => (
                  <div key={app.id} className="flex items-center gap-2 text-[9px]">
                    <span className="text-primary font-mono w-5 shrink-0">{index + 1}.</span>
                    <span className="truncate text-text-secondary flex-1 min-w-0">
                      {app.name}
                    </span>
                    <span className="text-text-muted text-[8px] font-mono shrink-0">
                      ID:{app.id}
                    </span>
                    <button
                      onClick={() => removeRunninghubApp(app.id)}
                      className="text-error hover:text-error/80 shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[9px] text-text-muted italic">暂无 APP，请点击添加</div>
            )}
            {testResultRHApp && (
              <div className={`text-[9px] p-1.5 rounded ${testResultRHApp.ok ? 'bg-green-500/10 text-green-400' : 'bg-error/10 text-error'}`}>
                {testResultRHApp.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// API 配置区段
// =============================================================================

function ApiConfigSection({ config }: { config: ApiSectionConfig }) {
  const [expanded, setExpanded] = useState(false);
  const apiConfig = useSettingsStore((s) => s.apiConfig);
  const setChannelId = useSettingsStore((s) => s.setChannelId);
  const channels = apiConfig.channels;
  const selectedChannelId = apiConfig[config.channelIdKey] as string;

  return (
    <div className="bg-surface rounded-lg border border-border p-3">
      <button onClick={() => setExpanded((e) => !e)} className="w-full flex items-center justify-between text-sm font-medium text-text">
        <span className="flex items-center gap-2"><config.icon className="w-4 h-4" /><span>{config.label}</span></span>
        {expanded ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] text-text-secondary">供应商</label>
            <select value={selectedChannelId} onChange={(e) => setChannelId(config.type, e.target.value)} className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border">
              {channels.map((ch) => (<option key={ch.id} value={ch.id}>{ch.name || ch.url || ch.id}</option>))}
            </select>
            <label className="text-[9px] text-text-secondary">模型列表</label>
            <ModelListEditor channelId={selectedChannelId} modelType={config.type} />
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Toggle 开关组件
// =============================================================================

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={`relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors ${value ? 'bg-primary' : 'bg-border'}`}>
      <span className={`inline-block h-[14px] w-[14px] rounded-full bg-white transition-transform ${value ? 'translate-x-[14px]' : 'translate-x-[2px]'}`} />
    </button>
  );
}

// =============================================================================
// 项目 Tab
// =============================================================================

function ProjectTab() {
  const projects = useSettingsStore((s) => s.projects);
  const currentProjectId = useSettingsStore((s) => s.currentProjectId);
  const addProject = useSettingsStore((s) => s.addProject);
  const renameProject = useSettingsStore((s) => s.renameProject);
  const removeProject = useSettingsStore((s) => s.removeProject);
  const setCurrentProject = useSettingsStore((s) => s.setCurrentProject);
  const importProjectFromFile = useSettingsStore((s) => s.importProjectFromFile);
  const systemSettings = useSettingsStore((s) => s.systemSettings);
  const updateSystemSettings = useSettingsStore((s) => s.updateSystemSettings);
  const hasUnsavedChanges = useFlowStore((s) => s.hasUnsavedChanges);
  const isSaving = useFlowStore((s) => s.isSaving);
  const saveProject = useFlowStore((s) => s.saveProject);
  const loadProject = useFlowStore((s) => s.loadProject);

  const [ioStatus, setIoStatus] = useState<string | null>(null);
  const [fsProjects, setFsProjects] = useState<string[]>([]);
  const currentProject = projects.find((p) => p.id === currentProjectId);

  // 刷新文件系统中的项目列表
  const refreshFsProjects = useCallback(async () => {
    if (fsManager.hasProjectDirectory()) {
      const list = await fsManager.listProjects();
      setFsProjects(list);
    } else {
      setFsProjects([]);
    }
  }, []);

  // 初始化时刷新项目列表
  useEffect(() => {
    refreshFsProjects();
  }, [refreshFsProjects]);

  // 打开/切换到项目（从文件系统加载）
  const handleOpenProject = useCallback(async (projectName: string) => {
    if (hasUnsavedChanges) {
      if (!confirm('有未保存的更改，确定要打开其他项目吗？')) return;
    }
    setIoStatus('正在加载...');
    try {
      const result = await fsManager.loadProject(projectName);
      if (result.success && result.data) {
        const data = JSON.parse(result.data.json);
        // 加载到画布
        loadProject(data.nodes, data.edges);
        // 如果项目列表中没有这个名字，添加到列表
        const existing = projects.find((p) => p.name === projectName);
        if (!existing) {
          const newId = Date.now().toString();
          addProject(projectName);
          setCurrentProject(newId);
        } else {
          setCurrentProject(existing.id);
        }
        setIoStatus(null);
      } else {
        setIoStatus(`加载失败: ${result.error}`);
      }
    } catch (err) {
      setIoStatus('加载失败');
    }
  }, [hasUnsavedChanges, loadProject, projects, addProject, setCurrentProject]);

  // 新建项目（在文件系统中创建文件夹）
  const handleNewProject = useCallback(async () => {
    const name = prompt('输入项目名称：');
    if (!name) return;
    
    if (fsManager.hasProjectDirectory()) {
      // 在文件系统中创建项目
      const safeName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();
      const exists = await fsManager.projectExists(safeName);
      if (exists) {
        alert('项目已存在');
        return;
      }
      // 创建项目（会创建空文件夹）
      await fsManager.saveProject(safeName, JSON.stringify({
        version: 1,
        id: Date.now().toString(),
        name,
        nodes: [],
        edges: [],
        savedAt: Date.now(),
      }), false);
      
      // 添加到 Zustand 并切换
      const newId = Date.now().toString();
      addProject(name);
      setCurrentProject(newId);
      await refreshFsProjects();
      setIoStatus(null);
    } else {
      // 没有设置目录时，只添加到内存
      const newId = Date.now().toString();
      addProject(name);
      setCurrentProject(newId);
      alert('提示：项目已添加到列表，但没有设置保存目录。请在系统设置中设置目录。');
    }
  }, [addProject, setCurrentProject, refreshFsProjects]);

  // 删除项目（从文件系统删除文件夹）
  const handleDeleteProject = useCallback(async (projectName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`确定要删除项目 "${projectName}" 吗？此操作不可恢复。`)) return;
    
    if (fsManager.hasProjectDirectory()) {
      await fsManager.deleteProject(projectName);
    }
    
    // 如果 Zustand 中有对应的项目，也删除它
    const existing = projects.find((p) => p.name === projectName);
    if (existing) {
      removeProject(existing.id);
    }
    
    await refreshFsProjects();
  }, [projects, removeProject, refreshFsProjects]);

  // 保存当前项目
  const handleSave = useCallback(async () => {
    if (!currentProject || isSaving) return;
    setIoStatus('正在保存...');
    
    if (fsManager.hasProjectDirectory()) {
      const success = await saveProject(currentProjectId, currentProject.name, systemSettings.embedBase64);
      if (success) {
        await refreshFsProjects();
      }
      setIoStatus(success ? null : '保存失败');
    } else {
      // 回退到浏览器下载
      await saveProject(currentProjectId, currentProject.name, systemSettings.embedBase64);
      setIoStatus(null);
    }
  }, [currentProject, currentProjectId, isSaving, saveProject, systemSettings.embedBase64, refreshFsProjects]);

  // 导入外部项目文件
  const handleImport = useCallback(async () => {
    if (hasUnsavedChanges) {
      if (!confirm('有未保存的更改，确定要导入吗？')) return;
    }
    setIoStatus('正在导入...');
    const result = await importProjectFile();
    if (result) {
      await importProjectFromFile(result.file);
      if (result.warnings.length > 0) {
        alert(result.warnings.join('\n'));
      }
    }
    setIoStatus(null);
  }, [hasUnsavedChanges, importProjectFromFile]);

  return (
    <div className="space-y-4">
      {/* 未设置目录提示 */}
      {!fsManager.hasProjectDirectory() && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3">
          <p className="text-xs text-yellow-300">请先在系统设置中选择保存目录，才能正常保存和加载项目。</p>
        </div>
      )}

      <div>
        <label className="block text-xs text-text-secondary mb-1">项目名称</label>
        <input
          type="text"
          value={currentProject?.name ?? ''}
          onChange={(e) => renameProject(currentProjectId, e.target.value)}
          className="w-full bg-surface text-text text-xs rounded px-2 py-1.5 border border-border focus:border-primary outline-none"
          placeholder="输入项目名称..."
        />
      </div>

      {/* Base64 嵌入开关 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <span className="text-sm text-text">导出含媒体</span>
          <p className="text-[10px] text-text-muted mt-0.5">
            {systemSettings.embedBase64 ? (
              <span className="text-green-400">✓ 已开启 — 图片/视频内嵌为 Base64，文件自包含</span>
            ) : (
              <span className="text-yellow-400">✗ 已关闭 — 仅保存工作流，文件更小</span>
            )}
          </p>
        </div>
        <Toggle value={systemSettings.embedBase64} onChange={(v) => updateSystemSettings({ embedBase64: v })} />
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <button
          onClick={handleNewProject}
          disabled={!!ioStatus}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-hover text-text text-xs rounded border border-border transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />新建项目
        </button>
        <button
          onClick={handleSave}
          disabled={!!ioStatus || isSaving || !currentProject}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-hover text-text text-xs rounded border border-border transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />{isSaving ? '保存中...' : '保存项目'}
        </button>
        <button
          onClick={handleImport}
          disabled={!!ioStatus}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface hover:bg-surface-hover text-text text-xs rounded border border-border transition-colors disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />导入
        </button>
      </div>

      {ioStatus && <p className="text-[10px] text-primary text-center">{ioStatus}</p>}
      {hasUnsavedChanges && <p className="text-[10px] text-yellow-400 text-center">当前有未保存的更改</p>}

      {/* 项目列表（来自文件系统） */}
      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs text-text-secondary">项目列表</label>
          <button
            onClick={refreshFsProjects}
            className="text-[10px] text-text-secondary hover:text-text"
            title="刷新列表"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
        {fsProjects.length === 0 ? (
          <p className="text-[10px] text-text-muted italic text-center py-4">
            {fsManager.hasProjectDirectory() ? '暂无项目，请新建' : '请先设置保存目录'}
          </p>
        ) : (
          <div className="space-y-1">
            {fsProjects.map((name) => (
              <div
                key={name}
                className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer ${
                  currentProject?.name === name ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-hover'
                }`}
                onClick={() => handleOpenProject(name)}
              >
                <FolderOpen className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                <span className="text-xs text-text flex-1 truncate">{name}</span>
                <button
                  onClick={(e) => handleDeleteProject(name, e)}
                  className="text-error hover:text-error/80 shrink-0"
                  title="删除项目"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// 提示词 Tab
// =============================================================================

function PromptTab() {
  const presetPrompts = useSettingsStore((s) => s.apiConfig.presetPrompts);
  const addPresetPrompt = useSettingsStore((s) => s.addPresetPrompt);
  const removePresetPrompt = useSettingsStore((s) => s.removePresetPrompt);
  const updatePresetPrompt = useSettingsStore((s) => s.updatePresetPrompt);

  const handleAdd = () => {
    addPresetPrompt({ title: '', prompt: '', type: 'all', enabled: true });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text">预设提示词</span>
        <button onClick={handleAdd} className="text-xs text-primary hover:text-primary-hover">+ 添加</button>
      </div>
      <p className="text-xs text-text-secondary">管理预设提示词，可用于图片生成和宫格处理</p>
      {presetPrompts.map((pp, i) => (
        <div key={i} className="bg-surface rounded-lg border border-border p-2.5 space-y-2">
          <div className="flex items-center gap-2">
            <input value={pp.title} onChange={(e) => updatePresetPrompt(i, { title: e.target.value })} placeholder="标题" className="flex-1 bg-surface-hover text-text text-[10px] px-1.5 py-0.5 rounded border border-border outline-none" />
            <select value={pp.type} onChange={(e) => updatePresetPrompt(i, { type: e.target.value as PresetPrompt['type'] })} className="bg-surface-hover text-text text-[10px] px-1.5 py-0.5 rounded border border-border">
              <option value="image">图片</option>
              <option value="text">文本</option>
              <option value="video">视频</option>
              <option value="all">通用</option>
            </select>
            <button onClick={() => removePresetPrompt(i)} className="text-error text-[10px]"><X className="w-3 h-3" /></button>
          </div>
          <textarea value={pp.prompt} onChange={(e) => updatePresetPrompt(i, { prompt: e.target.value })} placeholder="输入提示词内容..." rows={3} className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border resize-none focus:border-primary outline-none" />
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-[10px] text-text-secondary">启用</span>
            <Toggle value={pp.enabled} onChange={(v) => updatePresetPrompt(i, { enabled: v })} />
          </label>
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// 画布 Tab
// =============================================================================

function CanvasTab() {
  const cs = useSettingsStore((s) => s.canvasSettings);
  const update = useSettingsStore((s) => s.updateCanvasSettings);

  const SegmentedControl = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) => (
    <div className="flex gap-0.5 p-0.5 bg-surface-hover rounded-md">
      {options.map((opt) => (
        <button key={opt.value} onClick={() => onChange(opt.value)} className={`flex-1 px-2 py-1.5 text-[10px] rounded transition-colors ${value === opt.value ? 'bg-border text-text' : 'text-text-secondary hover:text-text'}`}>{opt.label}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 画布设置 */}
      <div className="bg-surface rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-text"><Type className="w-4 h-4" />画布设置</div>
        <div>
          <label className="text-[10px] text-text-secondary mb-1 block">字体大小</label>
          <SegmentedControl value={cs.fontSize} onChange={(v) => update({ fontSize: v as CanvasSettings['fontSize'] })} options={[{ label: '小', value: 'small' }, { label: '中', value: 'medium' }, { label: '大', value: 'large' }]} />
        </div>
        <div>
          <label className="text-[10px] text-text-secondary mb-1 block">平移模式</label>
          <SegmentedControl value={cs.panMode} onChange={(v) => update({ panMode: v as CanvasSettings['panMode'] })} options={[{ label: '空格 + 拖拽', value: 'space-drag' }, { label: '中键拖拽', value: 'middle-drag' }]} />
        </div>
        <div>
          <label className="text-[10px] text-text-secondary mb-1 block">缩放模式</label>
          <SegmentedControl value={cs.zoomMode} onChange={(v) => update({ zoomMode: v as CanvasSettings['zoomMode'] })} options={[{ label: 'Alt + 滚轮', value: 'alt-scroll' }, { label: 'Ctrl + 滚轮', value: 'ctrl-scroll' }]} />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-text-secondary block flex items-center gap-1"><Eye className="w-3 h-3" />显示选项</label>
          <label className="flex items-center justify-between cursor-pointer"><span className="text-xs text-text">显示网格</span><Toggle value={cs.showGrid} onChange={(v) => update({ showGrid: v })} /></label>
          <label className="flex items-center justify-between cursor-pointer"><span className="text-xs text-text">对齐到网格</span><Toggle value={cs.snapToGrid} onChange={(v) => update({ snapToGrid: v })} /></label>
          <label className="flex items-center justify-between cursor-pointer"><span className="text-xs text-text">减少动画</span><Toggle value={cs.reduceAnimations} onChange={(v) => update({ reduceAnimations: v })} /></label>
        </div>
        <div>
          <label className="text-[10px] text-text-secondary mb-1 block">小地图</label>
          <SegmentedControl value={cs.minimapPosition} onChange={(v) => update({ minimapPosition: v as CanvasSettings['minimapPosition'] })} options={[{ label: '右上', value: 'top-right' }, { label: '右下', value: 'bottom-right' }, { label: '关', value: 'off' }]} />
        </div>
      </div>

      {/* 节点默认值 */}
      <div className="bg-surface rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-text"><Grid3x3 className="w-4 h-4" />节点默认值</div>
        <div>
          <label className="text-[10px] text-text-secondary mb-1 block">LLM 温度</label>
          <div className="flex items-center gap-2">
            <input type="range" min="0" max="2" step="0.1" value={cs.llmDefaultTemperature} onChange={(e) => update({ llmDefaultTemperature: Number(e.target.value) })} className="flex-1 h-1 bg-border rounded accent-primary" />
            <span className="text-[10px] text-text-secondary w-8">{cs.llmDefaultTemperature}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-text-secondary mb-1 block">LLM Max Tokens</label>
          <div className="flex items-center gap-2">
            <input type="range" min="256" max="8192" step="256" value={cs.llmDefaultMaxTokens} onChange={(e) => update({ llmDefaultMaxTokens: Number(e.target.value) })} className="flex-1 h-1 bg-border rounded accent-primary" />
            <span className="text-[10px] text-text-secondary w-12 text-right">{cs.llmDefaultMaxTokens}</span>
          </div>
        </div>
        <div>
          <label className="text-[10px] text-text-secondary mb-1 block">视频时长</label>
          <select value={cs.videoDefaultDuration} onChange={(e) => update({ videoDefaultDuration: e.target.value })} className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border">
            <option>固定 5 秒</option><option>固定 10 秒</option><option>最长 15 秒</option><option>可配置</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] text-text-secondary mb-1 block">音频</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={cs.audioDefaultSplit} onChange={(e) => update({ audioDefaultSplit: e.target.checked })} className="accent-primary w-3 h-3" /><span className="text-[10px] text-text">语音分割</span></label>
            <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={cs.audioDefaultTTS} onChange={(e) => update({ audioDefaultTTS: e.target.checked })} className="accent-primary w-3 h-3" /><span className="text-[10px] text-text">TTS</span></label>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// 系统 Tab
// =============================================================================

function SystemTab() {
  const ss = useSettingsStore((s) => s.systemSettings);
  const update = useSettingsStore((s) => s.updateSystemSettings);
  const [settingsDirName, setSettingsDirName] = useState<string>('');
  const [selectingDir, setSelectingDir] = useState(false);
  const [ioMessage, setIoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 初始化：检查是否已有设置目录
  useEffect(() => {
    if (fsManager.hasSettingsDirectory()) {
      setSettingsDirName(fsManager.getSettingsDirectoryName());
    }
  }, []);

  // 显示操作结果消息
  const showMessage = useCallback((type: 'success' | 'error', text: string) => {
    setIoMessage({ type, text });
    setTimeout(() => setIoMessage(null), 3000);
  }, []);

  // 选择设置目录
  const handleSelectDirectory = useCallback(async () => {
    setSelectingDir(true);
    try {
      const { success, existingSettingsJson } = await fsManager.pickSettingsDirectory('XShow-Settings');
      if (success) {
        const dirName = fsManager.getSettingsDirectoryName();
        setSettingsDirName(dirName);

        if (existingSettingsJson) {
          // 目录中已有 settings.json → 确认后合并到内存
          if (window.confirm('该目录已存在配置文件，是否将其导入并合并到当前配置？\n（缺失字段自动用默认值填补，已有配置不会被覆盖）')) {
            useSettingsStore.getState().importSettingsFromFile(existingSettingsJson);
            showMessage('success', `已从目录恢复配置: ${dirName}`);
          } else {
            showMessage('success', `已选择目录: ${dirName}（保留当前配置）`);
          }
        } else {
          // 目录中无 settings.json → 首次使用，将当前内存配置写入
          showMessage('success', `已选择目录: ${dirName}（下次修改将自动同步）`);
        }

        // 无论是否导入，目录已选中，标记 fs 初始化完成以允许后续同步写入
        const { markFsInitialized } = await import('@/stores/useSettingsStore');
        markFsInitialized();
      }
    } finally {
      setSelectingDir(false);
    }
  }, [showMessage]);

  // 清除设置目录
  const handleClearDirectory = useCallback(async () => {
    await fsManager.clearSettingsDirectory();
    setSettingsDirName('');
    update({ saveDirectory: '' });
  }, [update]);

  // 导出配置：优先保存到目录，回退到浏览器下载
  const handleExport = useCallback(async () => {
    const json = useSettingsStore.getState().exportSettingsJson();
    if (!json) return;

    if (fsManager.hasSettingsDirectory()) {
      // 保存到已选目录
      const result = await fsManager.saveSettings(json);
      if (result.success) {
        showMessage('success', '配置已保存到指定目录');
      } else {
        showMessage('error', `保存失败: ${result.error}`);
      }
    } else {
      // 回退到浏览器下载
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `xshow-config-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showMessage('success', '配置已下载');
    }
  }, [showMessage]);

  // 导入配置：从已选目录读取
  const handleImport = useCallback(async () => {
    if (fsManager.hasSettingsDirectory()) {
      const result = await fsManager.loadSettings();
      if (result.success && result.data) {
        if (window.confirm('从目录导入将覆盖当前所有配置（缺失字段自动用默认值填补）。确定继续？')) {
          useSettingsStore.getState().importSettingsFromFile(result.data.json);
          showMessage('success', '配置已从目录恢复');
        }
      } else {
        showMessage('error', `读取失败: ${result.error}`);
      }
    } else {
      showMessage('error', '请先选择配置保存目录');
    }
  }, [showMessage]);

  // 选择配置文件：使用文件选择器选择特定 JSON 文件
  const handleSelectConfigFile = useCallback(async () => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{
          description: 'JSON 配置文件',
          accept: { 'application/json': ['.json'] },
        }],
        multiple: false,
      });
      if (!fileHandle) return;
      const file = await fileHandle.getFile();
      const content = await file.text();
      if (window.confirm('导入将覆盖当前所有配置（缺失字段自动用默认值填补）。确定继续？')) {
        useSettingsStore.getState().importSettingsFromFile(content);
        showMessage('success', `已从 ${file.name} 导入配置`);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        showMessage('error', '选择文件失败');
      }
    }
  }, [showMessage]);

  return (
    <div className="space-y-4">
      {/* 主题 */}
      <div className="bg-surface rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-text"><Monitor className="w-4 h-4" />主题 <span className="text-[10px] text-orange-400 font-normal">尚未开发</span></div>
        <div className="flex gap-2">
          <button onClick={() => update({ theme: 'dark' })} className={`flex-1 px-3 py-2 text-xs rounded border ${ss.theme === 'dark' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary bg-surface-hover'}`}><Moon className="w-3.5 h-3.5 inline mr-1" />深色 Dark</button>
          <button onClick={() => update({ theme: 'light' })} className={`flex-1 px-3 py-2 text-xs rounded border ${ss.theme === 'light' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-secondary bg-surface-hover'}`}><Sun className="w-3.5 h-3.5 inline mr-1" />浅色 Light</button>
        </div>
      </div>

      {/* 显示设置 */}
      <div className="bg-surface rounded-lg border border-border p-3 space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div><span className="text-sm text-text">节点显示模型设置</span><p className="text-[10px] text-text-muted">在节点中显示模型选择和参数配置</p></div>
          <Toggle value={ss.showNodeModelSettings} onChange={(v) => update({ showNodeModelSettings: v })} />
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <div><span className="text-sm text-text">显示小地图</span><p className="text-[10px] text-text-muted">画布右上角显示节点概览</p></div>
          <Toggle value={ss.showMinimap} onChange={(v) => update({ showMinimap: v })} />
        </label>
        <label className="flex items-center justify-between cursor-pointer">
          <div><span className="text-sm text-text">调试模式</span><p className="text-[10px] text-text-muted">显示节点调试信息，方便排查问题</p></div>
          <Toggle value={ss.debugMode} onChange={(v) => update({ debugMode: v })} />
        </label>
      </div>

      {/* 目录配置 */}
      <div className="bg-surface rounded-lg border border-border p-3 space-y-3">
        <div className="text-sm font-medium text-text">配置保存目录</div>
        <p className="text-[10px] text-text-muted">选择保存系统配置JSON文件的默认目录。设置后将自动同步配置到该目录。</p>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectDirectory}
            disabled={selectingDir}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded border border-border text-text-secondary bg-surface-hover hover:bg-surface hover:text-text transition-colors disabled:opacity-50"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            {selectingDir ? '选择中...' : '选择目录'}
          </button>
          {settingsDirName && (
            <div className="flex-1 flex items-center gap-2 px-2 py-1.5 bg-surface-hover rounded border border-border">
              <span className="text-xs text-text truncate flex-1">{settingsDirName}</span>
              <button
                onClick={handleClearDirectory}
                className="text-text-muted hover:text-error transition-colors"
                title="清除目录"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        {!settingsDirName && (
          <p className="text-[10px] text-yellow-400">尚未选择目录，配置将仅保存在浏览器存储中</p>
        )}
      </div>

      {/* 路径配置 */}
      <div className="bg-surface rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-text">配置备份</div>
          {ioMessage && (
            <span className={`text-[10px] ${ioMessage.type === 'success' ? 'text-green-400' : 'text-error'}`}>
              {ioMessage.text}
            </span>
          )}
        </div>
        <p className="text-[10px] text-text-muted">导出包含所有 API Key、供应商配置、项目设定、画布及系统设置。导入将覆盖当前配置。</p>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded border border-border text-text-secondary bg-surface-hover hover:bg-surface hover:text-text transition-colors"
          >
            <Download className="w-3.5 h-3.5" />保存配置
          </button>
          <button
            onClick={handleImport}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded border border-border text-text-secondary bg-surface-hover hover:bg-surface hover:text-text transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />读取配置
          </button>
          <button
            onClick={handleSelectConfigFile}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded border border-border text-text-secondary bg-surface-hover hover:bg-surface hover:text-text transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" />导入配置
          </button>
        </div>
      </div>

      {/* 清除浏览器缓存 */}
      <div className="bg-surface rounded-lg border border-border p-3 space-y-3">
        <div className="text-sm font-medium text-text">清除浏览器缓存</div>
        <p className="text-[10px] text-text-muted">
          清除本插件在浏览器中的所有本地数据，包括：设置配置、画布项目、API Key、目录权限等。文件系统中的项目文件不受影响。
        </p>
        <button
          onClick={async () => {
            if (!window.confirm('确定要清除所有浏览器缓存吗？此操作不可恢复（文件系统中的项目文件不受影响）。')) return;
            try {
              // 1. 清除 localStorage（xshow- 前缀的所有 key）
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && key.startsWith('xshow-')) {
                  localStorage.removeItem(key);
                }
              }
              // 2. 清除 chrome.storage.local
              if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await new Promise<void>((resolve) => {
                  chrome.storage.local.get(null, (result) => {
                    const keys = Object.keys(result).filter((k) => k.startsWith('xshow-'));
                    if (keys.length > 0) {
                      chrome.storage.local.remove(keys, () => resolve());
                    } else {
                      resolve();
                    }
                  });
                });
              }
              // 3. 清除 IndexedDB（idb-keyval 的 directory handles + localforage 画布状态）
              try {
                const dbsInfo = await indexedDB.databases();
                await Promise.all(
                  dbsInfo
                    .filter((db) => db.name && (db.name.includes('xshow') || db.name.includes('idb') || db.name.includes('localforage')))
                    .map(
                      (db) =>
                        new Promise<void>((resolve) => {
                          const req = indexedDB.open(db.name!);
                          // @ts-expect-error onversionchange 不在旧版 TS lib 中
                          req.onversionchange = () => { req.result?.close(); };
                          req.onsuccess = () => {
                            req.result?.close();
                            indexedDB.deleteDatabase(db.name!);
                            resolve();
                          };
                          req.onerror = () => resolve();
                        }),
                    ),
                );
              } catch {
                // indexedDB.databases() 不支持时静默忽略
              }
              showMessage('success', '缓存已清除，页面将重新加载');
              setTimeout(() => window.location.reload(), 1500);
            } catch (err) {
              showMessage('error', `清除失败: ${err instanceof Error ? err.message : String(err)}`);
            }
          }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded border border-error/30 text-error bg-error/10 hover:bg-error/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />清除所有浏览器缓存
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// 主设置面板 - 5 Tab 结构
// =============================================================================

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'project', label: '项目' },
  { id: 'model', label: '模型' },
  { id: 'prompt', label: '提示词' },
  { id: 'canvas', label: '画布' },
  { id: 'system', label: '系统' },
];

export default function SettingsPanel() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('model');

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Tab 栏 */}
      <div className="flex gap-1 p-2 border-b border-border shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${activeTab === tab.id ? 'bg-surface text-text font-medium' : 'text-text-secondary hover:text-text'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'project' && <ProjectTab />}
        {activeTab === 'model' && (
          <div className="space-y-4">
            <ChannelSection />
            <ComfyWorkflowSection />
            <RunningHubSection />
            {API_SECTIONS.map((config) => (<ApiConfigSection key={config.type} config={config} />))}
          </div>
        )}
        {activeTab === 'prompt' && <PromptTab />}
        {activeTab === 'canvas' && <CanvasTab />}
        {activeTab === 'system' && <SystemTab />}
      </div>
    </div>
  );
}
