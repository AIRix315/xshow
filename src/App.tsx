// Ref: §七 — 3 Tab 平级导航（AI画布 / 资源 / 设置）
import { useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import FlowCanvas from './components/canvas/FlowCanvas';

type TabId = 'canvas' | 'transit' | 'settings';

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('canvas');

  return (
    <div className="flex h-screen bg-background flex-col font-sans text-text">
      {/* Tab bar */}
      <div className="bg-surface border-b border-border flex shadow-md relative z-20 flex-shrink-0">
        {([
          { id: 'canvas' as TabId, label: 'AI画布', emoji: '🎨' },
          { id: 'transit' as TabId, label: '资源', emoji: '📦' },
          { id: 'settings' as TabId, label: '设置', emoji: '⚙️' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-4 text-base font-bold flex items-center justify-center gap-2 transition-none ${
              activeTab === tab.id
                ? 'text-blue-500 border-b-[3px] border-blue-500 bg-surface-hover'
                : 'text-text-secondary border-b-[3px] border-transparent hover:text-text hover:bg-[#222]'
            }`}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'canvas' && (
          <ReactFlowProvider>
            <FlowCanvas />
          </ReactFlowProvider>
        )}
        {activeTab === 'transit' && (
          <div className="flex items-center justify-center h-full text-text-muted">
            📦 资源中转站（Phase 5 实现）
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="flex items-center justify-center h-full text-text-muted">
            ⚙️ 设置面板（Phase 5 实现）
          </div>
        )}
      </div>
    </div>
  );
}

export default App;