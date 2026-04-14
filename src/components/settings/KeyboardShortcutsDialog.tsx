// Ref: node-banana KeyboardShortcutsDialog.tsx — 快捷键浮层
import { useEffect } from 'react';

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: ShortcutItem[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: '通用',
    shortcuts: [
      { keys: ['Delete'], description: '删除选中节点' },
      { keys: ['Ctrl', 'Z'], description: '撤销' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: '重做' },
      { keys: ['Ctrl', 'Y'], description: '重做' },
      { keys: ['Ctrl', 'C'], description: '复制选中节点' },
      { keys: ['Ctrl', 'V'], description: '粘贴节点' },
      { keys: ['?'], description: '显示快捷键' },
    ],
  },
  {
    title: '画布',
    shortcuts: [
      { keys: ['滚轮'], description: '缩放画布' },
      { keys: ['空格', '拖拽'], description: '平移画布（space-drag 模式）' },
      { keys: ['中键拖拽'], description: '平移画布（middle-drag 模式）' },
      { keys: ['Shift', '点击'], description: '多选节点' },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-medium text-text bg-surface-hover border border-border rounded shadow-sm">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface rounded-lg w-[480px] max-h-[80vh] border border-border shadow-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text">快捷键</h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text hover:bg-surface-hover rounded transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-4 py-3 space-y-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                {group.title}
              </h3>
              <div className="space-y-0.5">
                {group.shortcuts.map((shortcut, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-surface-hover transition-colors"
                  >
                    <span className="text-xs text-text-secondary">{shortcut.description}</span>
                    <div className="flex items-center gap-0.5 ml-4 shrink-0">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx} className="flex items-center gap-0.5">
                          {keyIdx > 0 && <span className="text-[10px] text-text-muted">+</span>}
                          <Kbd>{key}</Kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface-hover hover:bg-surface hover:text-text rounded transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
