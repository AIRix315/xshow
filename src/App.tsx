// Ref: §七 — 顶部栏布局（对标原型三段式：左Logo+项目+新建/保存 | 中空 | 右节点+设置+快捷键）
// Ref: 原型 — 顶部栏三段式布局 + 节点/设置按钮
import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { Settings, Plus, Save, Keyboard } from 'lucide-react';
import FlowCanvas from './components/canvas/FlowCanvas';
import NodeSidebar from './components/canvas/NodeSidebar';
import SettingsPanel from './components/settings/SettingsPanel';
import { useSettingsStore } from '@/stores/useSettingsStore';

// Vite 注入 package.json 版本号
const APP_VERSION = __APP_VERSION__;

type TabId = 'canvas' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('canvas');
  const [nodeSidebarOpen, setNodeSidebarOpen] = useState(false);
  const projects = useSettingsStore((s) => s.projects);
  const currentProjectId = useSettingsStore((s) => s.currentProjectId);
  const currentProject = projects.find((p) => p.id === currentProjectId);

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
            <span className="text-xs text-text-muted">未保存</span>
          </div>
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
            <button className="px-2 py-1 text-[11px] font-medium text-text-secondary rounded hover:text-text hover:bg-surface-hover transition-colors flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />新建
            </button>
            <button className="px-2 py-1 text-[11px] font-medium text-text-secondary rounded hover:text-text hover:bg-surface-hover transition-colors flex items-center gap-1">
              <Save className="w-3.5 h-3.5" />保存
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
          <button className="text-text-secondary hover:text-text transition-colors" title="快捷键设置">
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
    </div>
  );
}

export default App;
