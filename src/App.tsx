// Ref: §七 — 顶部栏布局（对标原型三段式：左Logo+项目+新建/保存 | 中空 | 右节点+设置+快捷键）
import { useState, useEffect, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Settings, Plus, Save, Keyboard, Upload, FolderOpen, ChevronDown, Check } from 'lucide-react';
import FlowCanvas from './components/canvas/FlowCanvas';
import NodeSidebar from './components/canvas/NodeSidebar';
import SettingsPanel from './components/settings/SettingsPanel';
import KeyboardShortcutsDialog from './components/settings/KeyboardShortcutsDialog';
import ResourcesMenu from '@/components/ResourcesMenu';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useFlowStore } from '@/stores/useFlowStore';
import { importProjectFile } from '@/utils/projectManager';
import { listProjectsFromFs, loadProjectFromFs } from '@/utils/patchManager';
import { fsManager } from '@/utils/fileSystemAccess';
import { loadCanvasState } from '@/utils/canvasState';
import { markFsInitialized } from '@/stores/useSettingsStore';

// Vite 注入 package.json 版本号
const APP_VERSION = __APP_VERSION__;

type TabId = 'canvas' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('canvas');
  const [nodeSidebarOpen, setNodeSidebarOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false);
  const [fsProjects, setFsProjects] = useState<string[]>([]); // projects/ 下的真实文件夹列表
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projects = useSettingsStore((s) => s.projects);
  const currentProjectId = useSettingsStore((s) => s.currentProjectId);
  const addProject = useSettingsStore((s) => s.addProject);
  const setCurrentProject = useSettingsStore((s) => s.setCurrentProject);
  const renameProject = useSettingsStore((s) => s.renameProject);
  const removeProject = useSettingsStore((s) => s.removeProject);
  const importProjectFromFile = useSettingsStore((s) => s.importProjectFromFile);
  const systemSettings = useSettingsStore((s) => s.systemSettings);
  const canvasSettings = useSettingsStore((s) => s.canvasSettings);
  const currentProject = projects.find((p) => p.id === currentProjectId);

  const hasUnsavedChanges = useFlowStore((s) => s.hasUnsavedChanges);
  const lastSavedAt = useFlowStore((s) => s.lastSavedAt);
  const isSaving = useFlowStore((s) => s.isSaving);
  const saveProject = useFlowStore((s) => s.saveProject);

  const hasProjectDir = fsManager.hasProjectDirectory();

  /** 初始化文件系统管理器（页面加载时验证已保存的目录句柄） */
  const initRef = useRef(false);
  useEffect(() => {
    fsManager.initialize().then(async ({ settingsDirOk }) => {
      if (settingsDirOk) {
        // 尝试从磁盘加载已有配置
        const result = await fsManager.loadSettings();
        if (result.success && result.data) {
          useSettingsStore.getState().importSettingsFromFile(result.data.json);
        }
        // 有工作路径 → 读取 projects/ 文件夹列表
        const fsProjs = await listProjectsFromFs();
        setFsProjects(fsProjs);
      }
      // 无论目录是否 OK，标记初始化完成，允许后续写入
      // 如果没有目录，syncSettingsToFs 会因 hasSettingsDirectory() 跳过
      // 如果有目录且已加载，配置已合并，后续写入是安全的
      markFsInitialized();
      // 初始化完成后，加载当前项目的画布数据
      initRef.current = true;
      await loadCurrentProjectCanvas();
    });
  }, []);

  /** 加载当前项目的画布数据（优先从文件系统读，无则从 IndexedDB 读） */
  const loadCurrentProjectCanvas = async () => {
    const projectId = useSettingsStore.getState().currentProjectId;
    const project = useSettingsStore.getState().projects.find((p) => p.id === projectId);
    const safeName = project?.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'project';

    if (fsManager.hasProjectDirectory()) {
      // 有工作路径 → 优先从文件系统读
      const fsResult = await loadProjectFromFs(safeName);
      if (fsResult) {
        useFlowStore.getState().loadProject(fsResult.file.nodes, fsResult.file.edges, fsResult.file.savedAt);
        return;
      }
    }
    // 无文件系统记录 → 从 IndexedDB 读
    const data = await loadCanvasState(projectId);
    if (data) {
      useFlowStore.getState().loadProject(data.nodes, data.edges, data.timestamp);
    } else {
      useFlowStore.getState().clearCanvas();
    }
  };

  /** 监听 currentProjectId 变化（项目切换时），加载对应项目的画布数据 */
  useEffect(() => {
    if (!initRef.current) return;
    loadCurrentProjectCanvas();
    // 切换后刷新下拉列表（以防新建了项目）
    if (fsManager.hasProjectDirectory()) {
      listProjectsFromFs();
    }
  }, [currentProjectId]);

  /** 点击外部关闭下拉框 */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProjectDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /** 新建项目（二次验证：检查 projects/ 是否已有同名） */
  const handleNew = async () => {
    if (!fsManager.hasProjectDirectory()) {
      // 无工作路径 → 内存新建（不检查文件系统）
      const newId = Date.now().toString();
      addProject('新项目');
      setCurrentProject(newId);
      useFlowStore.getState().clearCanvas();
      return;
    }

    const name = prompt('请输入项目名称：');
    if (!name) return;

    // 检查 projects/ 是否已有同名项目
    const existing = await listProjectsFromFs();
    if (existing.includes(name)) {
      alert(`项目「${name}」已存在，请换一个名称。`);
      return;
    }

    const newId = Date.now().toString();
    addProject(name);
    setCurrentProject(newId);
    setFsProjects(await listProjectsFromFs());
    useFlowStore.getState().clearCanvas();
  };

  /** 切换到指定项目（按名称，从 fsProjects 列表选择） */
  const handleSwitchProjectByName = async (projectName: string) => {
    if (projectName === currentProject?.name) {
      setProjectDropdownOpen(false);
      return;
    }
    if (hasUnsavedChanges) {
      if (!confirm('有未保存的更改，确定要切换项目吗？')) return;
    }
    // 查找 store 中是否有同名项目
    const existing = useSettingsStore.getState().projects.find((p) => p.name === projectName);
    if (existing) {
      setCurrentProject(existing.id);
    } else {
      // 文件夹存在但 store 无记录 → 新建 store 条目并切换
      const newId = Date.now().toString();
      addProject(projectName);
      setCurrentProject(newId);
    }
    setProjectDropdownOpen(false);
  };

  /** 删除项目（按名称，从 fsProjects 列表操作） */
  const handleDeleteProjectByName = async (e: React.MouseEvent, projectName: string) => {
    e.stopPropagation();
    if (!confirm(`确定要删除项目「${projectName}」吗？此操作不可恢复。`)) return;
    // 从 store 找到对应项目
    const storeProject = useSettingsStore.getState().projects.find((p) => p.name === projectName);
    if (fsManager.hasProjectDirectory()) {
      const { deleteProjectFromFs } = await import('@/utils/patchManager');
      await deleteProjectFromFs(projectName);
    }
    if (storeProject) {
      removeProject(storeProject.id);
    }
    // 如果删的是当前项目，切换到 fsProjects 列表中的第一个
    if (projectName === currentProject?.name) {
      const remaining = useSettingsStore.getState().projects;
      const first = remaining.find((_, i) => i === 0);
      if (first) {
        setCurrentProject(first.id);
      } else {
        // 没有任何项目了，新建默认项目
        const newId = Date.now().toString();
        addProject('新项目');
        setCurrentProject(newId);
      }
    }
    setFsProjects(await listProjectsFromFs());
  };

  /** 保存当前项目 */
  const handleSave = async () => {
    if (!currentProject || isSaving) return;
    setSavingStatus('正在保存...');
    const success = await saveProject(currentProjectId, currentProject.name, systemSettings.embedBase64);
    if (success && fsManager.hasProjectDirectory()) {
      setFsProjects(await listProjectsFromFs());
    }
    setSavingStatus(success ? null : '保存失败');
  };

  /** 处理项目名称编辑完成 */
  const handleProjectNameSubmit = () => {
    setEditingProjectName(false);
  };

  /** 处理项目名称键盘事件 */
  const handleProjectNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleProjectNameSubmit();
    } else if (e.key === 'Escape') {
      setEditingProjectName(false);
    }
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

  // 全局快捷键：? 打开快捷键对话框；Ctrl+S 保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === '?' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      }
      if (e.key === 's' && e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <div className="flex h-screen bg-background flex-col font-sans text-text">
      {/* 顶部栏 */}
      <header className="bg-background border-b border-border flex items-center justify-between px-4 h-11 shrink-0 z-20">
        {/* 左: Logo + 项目下拉 + 未保存 + 新建/保存 */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 hover:opacity-80">
            <div className="w-6 h-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center font-bold text-black text-sm">X</div>
            <h1 className="text-xl font-semibold text-text">XShow</h1>
            <span className="text-[10px] text-text-muted ml-1">v{APP_VERSION}</span>
          </button>

          <div className="flex items-center gap-2 ml-3 pl-3 border-l border-border">
            {/* 项目下拉选择器 */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProjectDropdownOpen((v) => !v)}
                className="flex items-center gap-1 max-w-[140px] hover:bg-surface-hover rounded px-1.5 py-0.5 transition-colors"
                disabled={!hasProjectDir}
                title={hasProjectDir ? '切换项目' : '请先在设置中选择工作目录'}
              >
                {editingProjectName ? (
                  <input
                    type="text"
                    value={currentProject?.name ?? ''}
                    onChange={(e) => renameProject(currentProjectId, e.target.value)}
                    onBlur={handleProjectNameSubmit}
                    onKeyDown={handleProjectNameKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                    className="bg-surface text-xs text-text rounded px-1.5 py-0.5 border border-primary outline-none max-w-[100px]"
                  />
                ) : (
                  <>
                    <span className="text-xs text-text-secondary truncate">{currentProject?.name ?? '未命名项目'}</span>
                    <ChevronDown className={`w-3 h-3 text-text-muted shrink-0 transition-transform ${projectDropdownOpen ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>

              {/* 下拉菜单：读 projects/ 文件夹真实列表 */}
              {projectDropdownOpen && hasProjectDir && (
                <div className="absolute top-full left-0 mt-1 w-[200px] bg-surface border border-border rounded-lg shadow-xl z-50 max-h-[300px] overflow-y-auto">
                  <div className="py-1">
                    {fsProjects.length === 0 && (
                      <div className="px-3 py-2 text-xs text-text-muted">无项目</div>
                    )}
                    {fsProjects.map((name) => (
                      <div
                        key={name}
                        onClick={() => handleSwitchProjectByName(name)}
                        className={`flex items-center justify-between px-3 py-1.5 cursor-pointer hover:bg-surface-hover text-xs ${
                          name === currentProject?.name ? 'text-primary bg-primary/10' : 'text-text-secondary'
                        }`}
                      >
                        <span className="truncate flex-1">{name}</span>
                        {name === currentProject?.name && <Check className="w-3 h-3 shrink-0 ml-1" />}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteProjectByName(e, name); }}
                          className="ml-2 text-text-muted hover:text-red-400 shrink-0 text-[10px]"
                          title="删除项目"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 编辑名称按钮 */}
            {currentProject && (
              <button
                onClick={() => setEditingProjectName(true)}
                className="text-[10px] text-text-muted hover:text-text"
                title="修改项目名称"
              >
                ✎
              </button>
            )}

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

        {/* 右: 节点 + 资源 + 设置 + 快捷键 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setNodeSidebarOpen((v) => !v); setResourcesOpen(false); }}
            className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
              nodeSidebarOpen ? 'text-primary bg-primary/10' : 'text-text-secondary hover:text-text hover:bg-surface-hover'
            }`}
          >
            节点
          </button>
          <button
            onClick={() => { setResourcesOpen((v) => !v); setNodeSidebarOpen(false); }}
            className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
              resourcesOpen ? 'text-primary bg-primary/10' : 'text-text-secondary hover:text-text hover:bg-surface-hover'
            }`}
            title="资源库"
          >
            <FolderOpen className="w-4 h-4" />
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

      <ResourcesMenu open={resourcesOpen} onClose={() => setResourcesOpen(false)} />
      <KeyboardShortcutsDialog isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

export default App;
