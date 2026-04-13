// Ref: §7.2 — SettingsPanel 5 Tab 结构（项目/模型/提示词/画布/系统）
// Ref: 原型 xshow-canvas-prototype.html 设置面板
import { useState, useCallback } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';
import type { CanvasSettings } from '@/stores/useSettingsStore';
import type { ChannelConfig, PresetPrompt } from '@/types';
import { testComfyConnection, fetchComfyWorkflows, fetchComfyWorkflowJson, type ComfyConnectionTestResult } from '@/api/comfyApi';
import { FileText, Image, Video, Volume2, Plug, ChevronDown, ChevronUp, X, CheckCircle2, XCircle, FolderOpen, Type, Grid3x3, Monitor, Eye, Moon, Sun, Workflow, RefreshCw, Loader2 } from 'lucide-react';

type SettingsTab = 'project' | 'model' | 'prompt' | 'canvas' | 'system';
type ApiType = 'text' | 'image' | 'video' | 'audio';

interface ApiSectionConfig {
  type: ApiType;
  icon: typeof FileText;
  label: string;
  channelIdKey: 'textChannelId' | 'imageChannelId' | 'videoChannelId' | 'audioChannelId';
  modelKey: 'textModel' | 'drawingModel' | 'videoModel' | 'audioModel';
}

const API_SECTIONS: ApiSectionConfig[] = [
  { type: 'text', icon: FileText, label: '语言模型', channelIdKey: 'textChannelId', modelKey: 'textModel' },
  { type: 'image', icon: Image, label: '图像模型', channelIdKey: 'imageChannelId', modelKey: 'drawingModel' },
  { type: 'video', icon: Video, label: '视频模型', channelIdKey: 'videoChannelId', modelKey: 'videoModel' },
  { type: 'audio', icon: Volume2, label: '音频模型', channelIdKey: 'audioChannelId', modelKey: 'audioModel' },
];

// =============================================================================
// 测试连接按钮（逐行测试所有模型）
// =============================================================================

function TestConnectionButton({ channel, model }: { channel: ChannelConfig | undefined; model: string }) {
  const [results, setResults] = useState<Array<{ model: string; ok: boolean }>>([]);
  const [testing, setTesting] = useState(false);

  const handleTest = useCallback(async () => {
    if (!channel) return;
    const models = model.split('\n').map((m) => m.trim()).filter(Boolean);
    if (models.length === 0) return;
    setTesting(true);
    setResults([]);
    const testResults = await Promise.all(
      models.map(async (m) => {
        try {
          const url = channel.protocol === 'gemini'
            ? `${channel.url.replace(/\/$/, '')}/v1beta/models/${m}:generateContent?key=${channel.key}`
            : `${channel.url.replace(/\/$/, '')}/v1/chat/completions`;
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };
          const body: Record<string, unknown> = { model: m, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 5 };
          if (channel.protocol !== 'gemini') { headers['Authorization'] = `Bearer ${channel.key}`; }
          const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
          return { model: m, ok: response.ok };
        } catch {
          return { model: m, ok: false };
        }
      })
    );
    setResults(testResults);
    setTesting(false);
  }, [channel, model]);

  return (
    <div className="space-y-1.5">
      <button onClick={handleTest} disabled={testing} className="text-[9px] px-2 py-0.5 rounded bg-surface hover:bg-surface-hover disabled:opacity-50 text-text-secondary border border-border">
        {testing ? '测试中...' : '测试全部'}
      </button>
      {results.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {results.map((r, i) => (
            <span key={i} className={`text-[9px] flex items-center gap-1 ${r.ok ? 'text-green-500' : 'text-error'}`}>
              {r.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              <span className="font-mono opacity-75">{i + 1}.</span> {r.model}
            </span>
          ))}
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
  const [testingRH, setTestingRH] = useState(false);
  const [testingRHApp, setTestingRHApp] = useState(false);
  const [testResultLocal, setTestResultLocal] = useState<ComfyConnectionTestResult | null>(null);
  const [testResultCloud, setTestResultCloud] = useState<ComfyConnectionTestResult | null>(null);
  const [testResultRH, setTestResultRH] = useState<ComfyConnectionTestResult | null>(null);
  const [testResultRHApp, setTestResultRHApp] = useState<ComfyConnectionTestResult | null>(null);
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [scanningWorkflows, setScanningWorkflows] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  const [workflowJson, setWorkflowJson] = useState<string | null>(null);
  const [loadingJson, setLoadingJson] = useState(false);
  const [wfListExpanded, setWfListExpanded] = useState(true);
  const comfyuiConfig = useSettingsStore((s) => s.comfyuiConfig);
  const updateComfyuiConfig = useSettingsStore((s) => s.updateComfyuiConfig);
  const addRunninghubApp = useSettingsStore((s) => s.addRunninghubApp);
  const removeRunninghubApp = useSettingsStore((s) => s.removeRunninghubApp);

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

  // 测试 RunningHub Workflow
  const handleTestRH = useCallback(async () => {
    setTestingRH(true);
    setTestResultRH(null);
    const result = await testComfyConnection('runninghub', '', comfyuiConfig.runninghubApiKey ?? '');
    setTestResultRH(result);
    setTestingRH(false);
  }, [comfyuiConfig.runninghubApiKey]);

  // 测试 RunningHub APP
  const handleTestRHApp = useCallback(async () => {
    setTestingRHApp(true);
    setTestResultRHApp(null);
    const result = await testComfyConnection('runninghubApp', '', comfyuiConfig.runninghubApiKey ?? '');
    setTestResultRHApp(result);
    setTestingRHApp(false);
  }, [comfyuiConfig.runninghubApiKey]);

  // 添加 APP
  const handleAddApp = useCallback(() => {
    const name = prompt('APP 名称：');
    if (!name) return;
    const id = prompt('APP ID：');
    if (!id) return;
    const quickCreateCode = prompt('quickCreateCode（可选）：') || undefined;
    addRunninghubApp({ id, name, quickCreateCode });
  }, [addRunninghubApp]);

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
            <input
              type="password"
              value={comfyuiConfig.runninghubApiKey ?? ''}
              onChange={(e) => updateComfyuiConfig({ runninghubApiKey: e.target.value })}
              placeholder="RunningHub API Key"
              className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-primary outline-none"
            />
            <textarea
              value={(comfyuiConfig.runninghubWorkflows ?? []).join('\n')}
              onChange={(e) => updateComfyuiConfig({ runninghubWorkflows: e.target.value.split('\n').filter(Boolean) })}
              placeholder="Workflow ID 列表（每行一个）"
              rows={2}
              className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border resize-none font-mono focus:border-primary outline-none"
            />
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
            <input
              type="password"
              value={comfyuiConfig.runninghubApiKey ?? ''}
              onChange={(e) => updateComfyuiConfig({ runninghubApiKey: e.target.value })}
              placeholder="RunningHub API Key（共用）"
              className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-primary outline-none"
            />
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
                {(comfyuiConfig.runninghubApps ?? []).map((app) => (
                  <div key={app.id} className="flex items-center gap-1 text-[9px]">
                    <span className="flex-1 truncate font-mono text-text-secondary">
                      {app.name} ({app.id}){app.quickCreateCode ? ` [${app.quickCreateCode}]` : ''}
                    </span>
                    <button
                      onClick={() => removeRunninghubApp(app.id)}
                      className="text-error hover:text-error/80 px-1"
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
  const setModel = useSettingsStore((s) => s.setModel);
  const channels = apiConfig.channels;
  const selectedChannelId = apiConfig[config.channelIdKey] as string;
  const modelValue = apiConfig[config.modelKey] as string;
  const selectedChannel = channels.find((c) => c.id === selectedChannelId);

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
            <label className="text-[9px] text-text-secondary">模型名（每行一个）</label>
            <textarea value={modelValue} onChange={(e) => setModel(config.modelKey, e.target.value)} placeholder="每行一个模型名" rows={2} className="w-full bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border resize-none font-mono focus:border-primary outline-none" />
            <TestConnectionButton channel={selectedChannel} model={modelValue} />
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
  const systemSettings = useSettingsStore((s) => s.systemSettings);
  const updateSystemSettings = useSettingsStore((s) => s.updateSystemSettings);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-text-secondary mb-1">项目名称</label>
        <input
          type="text"
          value={projects.find((p) => p.id === currentProjectId)?.name ?? ''}
          onChange={(e) => renameProject(currentProjectId, e.target.value)}
          className="w-full bg-surface text-text text-xs rounded px-2 py-1.5 border border-border focus:border-primary outline-none"
          placeholder="输入项目名称..."
        />
      </div>
      <div>
        <label className="block text-xs text-text-secondary mb-1">保存目录</label>
        <div className="flex gap-2">
          <input type="text" value={systemSettings.saveDirectory} onChange={(e) => updateSystemSettings({ saveDirectory: e.target.value })} placeholder="选择保存目录..." className="flex-1 bg-surface text-text text-xs rounded px-2 py-1.5 border border-border focus:border-primary outline-none" />
          <button className="px-3 py-1.5 bg-surface hover:bg-surface-hover text-text text-xs rounded border border-border"><FolderOpen className="w-3.5 h-3.5" /></button>
        </div>
        <p className="text-[10px] text-text-muted mt-1">不设置目录时，仅内存暂存</p>
      </div>
      <div className="border-t border-border pt-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <span className="text-sm text-text">图片嵌入 Base64</span>
            <p className="text-[10px] text-text-muted">图片直接存在流程文件中</p>
          </div>
          <Toggle value={systemSettings.embedBase64} onChange={(v) => updateSystemSettings({ embedBase64: v })} />
        </label>
      </div>
      <div className="border-t border-border pt-3">
        <label className="block text-xs text-text-secondary mb-1.5">项目列表</label>
        <div className="space-y-1">
          {projects.map((p) => (
            <div key={p.id} className={`flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer ${p.id === currentProjectId ? 'border-primary bg-primary/10' : 'border-border hover:bg-surface-hover'}`} onClick={() => setCurrentProject(p.id)}>
              <span className="text-xs text-text flex-1 truncate">{p.name}</span>
              {projects.length > 1 && <button onClick={(e) => { e.stopPropagation(); removeProject(p.id); }} className="text-error text-[10px]"><X className="w-3 h-3" /></button>}
            </div>
          ))}
          <button onClick={() => addProject('新项目')} className="w-full text-[10px] py-1.5 rounded border border-dashed border-border text-text-secondary hover:text-text hover:border-primary bg-surface-hover">+ 新建项目</button>
        </div>
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

  return (
    <div className="space-y-4">
      {/* 主题 */}
      <div className="bg-surface rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-text"><Monitor className="w-4 h-4" />主题</div>
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
      </div>

      {/* 路径配置 */}
      <div className="bg-surface rounded-lg border border-border p-3 space-y-3">
        <div>
          <label className="text-xs text-text-secondary mb-1 block">.env 配置文件路径</label>
          <div className="flex gap-2">
            <input type="text" value={ss.envConfigPath} onChange={(e) => update({ envConfigPath: e.target.value })} placeholder="选择 .env 配置保存目录..." className="flex-1 bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-primary outline-none" />
            <button className="px-2 py-1 bg-surface hover:bg-surface-hover text-text-secondary rounded border border-border"><FolderOpen className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-[10px] text-text-muted mt-1">API Key 等配置保存为 .env 文件</p>
        </div>
        <div>
          <label className="text-xs text-text-secondary mb-1 block">配置保存路径</label>
          <div className="flex gap-2">
            <input type="text" value={ss.configSavePath} onChange={(e) => update({ configSavePath: e.target.value })} placeholder="选择配置保存目录..." className="flex-1 bg-surface-hover text-text text-[10px] rounded px-1.5 py-1 border border-border focus:border-primary outline-none" />
            <button className="px-2 py-1 bg-surface hover:bg-surface-hover text-text-secondary rounded border border-border"><FolderOpen className="w-3.5 h-3.5" /></button>
          </div>
          <p className="text-[10px] text-text-muted mt-1">独立保存模型和渠道配置，升级不丢失</p>
        </div>
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
