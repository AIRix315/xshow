// Ref: §七 — 顶部栏布局（对标原型三段式：左Logo+项目+新建/保存 | 中空 | 右节点+设置+快捷键）
// Ref: 原型 — 顶部栏三段式布局 + 节点/设置按钮
import { useState, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Settings, Plus, Save, Keyboard, Upload } from 'lucide-react';
import FlowCanvas from './components/canvas/FlowCanvas';
import NodeSidebar from './components/canvas/NodeSidebar';
import SettingsPanel from './components/settings/SettingsPanel';
import KeyboardShortcutsDialog from './components/settings/KeyboardShortcutsDialog';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { importProjectFile } from '@/utils/projectManager';

// Vite 注入 package.json 版本号
const APP_VERSION = __APP_VERSION__;

type TabId = 'canvas' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('canvas');
  const [nodeSidebarOpen, setNodeSidebarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const projects = useSettingsStore((s) => s.projects);
  const currentProjectId = useSettingsStore((s) => s.currentProjectId);
  const addProject = useSettingsStore((s) => s.addProject);
  const importProjectFromFile = useSettingsStore((s) => s.importProjectFromFile);
  const systemSettings = useSettingsStore((s) => s.systemSettings);
  const canvasSettings = useSettingsStore((s) => s.canvasSettings);
  const currentProject = projects.find((p) => p.id === currentProjectId);

  const hasUnsavedChanges = useFlowStore((s) => s.hasUnsavedChanges);
  const lastSavedAt = useFlowStore((s) => s.lastSavedAt);
  const isSaving = useFlowStore((s) => s.isSaving);
  const saveProject = useFlowStore((s) => s.saveProject);

  /** 新建项目 */
  const handleNew = () => {
    if (hasUnsavedChanges) {
      if (!confirm('有未保存的更改，确定要新建项目吗？')) return;
    }
    addProject('新项目');
  };

  /** 保存当前项目 */
  const handleSave = async () => {
    if (!currentProject || isSaving) return;
    setSavingStatus('正在导出...');
    await saveProject(currentProjectId, currentProject.name, systemSettings.embedBase64);
    setSavingStatus(null);
  };

  /** 导入项目 */
  const handleImport = async () => {
    if (hasUnsavedChanges) {
      if (!confirm('有未保存的更改，确定要导入吗？')) return;
    }
    setSavingStatus('正在导入...');
    const result = await importProjectFile();
    if (result) {
      await importProjectFromFile(result.file);
      if (result.warnings.length > 0) {
        alert(result.warnings.join('\n'));
      }
    }
    setSavingStatus(null);
  };

  // 同步全局字体缩放 + 减少动画 CSS 变量到 <html>
  useEffect(() => {
    const scale = canvasSettings.fontSize === 'small' ? 0.85 : canvasSettings.fontSize === 'large' ? 1.15 : 1;
    document.documentElement.style.setProperty('--font-scale', String(scale));
    document.documentElement.style.setProperty('--reduce-anim', canvasSettings.reduceAnimations ? 'all 0s !important' : 'inherit');
  }, [canvasSettings.fontSize, canvasSettings.reduceAnimations]);

  // 全局快捷键：? 打开快捷键对话框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框内的按键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '?' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        setShortcutsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-background flex-col font-sans text-text">
      {/* 顶部栏 — 对标原型三段式布局 */}
      <header className="bg-background border-b border-border flex items-center justify-between px-4 h-11 shrink-0 z-20">
        {/* 左: Logo + 项目名 + 未保存 + | + 新建/保存 */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 hover:opacity-80">
            <div className="w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center font-bold text-black text-sm">X</div>
            <h1 className="text-xl font-semibold text-text">XShow</h1>
            <span className="text-[10px] text-text-muted ml-1">v{APP_VERSION}</span>
          </button>
          <div className="flex items-center gap-2 ml-3 pl-3 border-l border-border">
            <span className="text-xs text-text-secondary truncate max-w-[120px]">{currentProject?.name ?? '未命名项目'}</span>
            <span className="text-text-muted">·</span>
            <span className={`text-xs ${hasUnsavedChanges ? 'text-yellow-400' : 'text-text-muted'}`}>
              {savingStatus ?? (hasUnsavedChanges ? '未保存' : lastSavedAt ? `已保存 ${new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '已保存')}
            </span>
          </div>
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
            <button onClick={handleImport} className="px-2 py-1 text-[11px] font-medium text-text-secondary rounded hover:text-text hover:bg-surface-hover transition-colors flex items-center gap-1" title="导入项目">
              <Upload className="w-3.5 h-3.5" />导入
            </button>
            <button onClick={handleNew} className="px-2 py-1 text-[11px] font-medium text-text-secondary rounded hover:text-text hover:bg-surface-hover transition-colors flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />新建
            </button>
            <button onClick={handleSave} disabled={isSaving} className="px-2 py-1 text-[11px] font-medium text-text-secondary rounded hover:text-text hover:bg-surface-hover transition-colors flex items-center gap-1 disabled:opacity-50" title="保存项目">
              <Save className="w-3.5 h-3.5" />{isSaving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>

        {/* 中: 空（原型无中间内容） */}

        {/* 右: 节点 + 设置 + 快捷键 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNodeSidebarOpen(!nodeSidebarOpen)}
            className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
              nodeSidebarOpen ? 'text-primary bg-primary/10' : 'text-text-secondary hover:text-text hover:bg-surface-hover'
            }`}
          >
            节点
          </button>
          <button
            onClick={() => setActiveTab(activeTab === 'settings' ? 'canvas' : 'settings')}
            className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
              activeTab === 'settings' ? 'text-primary bg-primary/10' : 'text-text-secondary hover:text-text hover:bg-surface-hover'
            }`}
          >
            <Settings className="w-4 h-4" />
          </button>
          <span className="text-border">·</span>
          <button className="text-text-secondary hover:text-text transition-colors" title="快捷键设置" onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'canvas' && (
          <>
            <ReactFlowProvider>
              <FlowCanvas />
            </ReactFlowProvider>
            <NodeSidebar
              open={nodeSidebarOpen}
              onClose={() => setNodeSidebarOpen(false)}
            />
          </>
        )}
        {activeTab === 'settings' && (
          <SettingsPanel />
        )}
      </div>

      <KeyboardShortcutsDialog isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

export default App;
