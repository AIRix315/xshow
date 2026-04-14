// Ref: node-banana ResourceBrowser.tsx — 资源浏览器面板
// Ref: Excalidraw - Sidebar 资源拖拽模式
// 右上角资源菜单：展示项目目录中的所有媒体资源，支持筛选和拖拽复用

import { useState, useEffect, useRef, memo } from 'react';
import {
  Image,
  Video,
  Volume2,
  FileText,
  Search,
  FolderOpen,
  X,
  RefreshCw,
  Loader2,
  MoreHorizontal,
} from 'lucide-react';
import { fsManager, type DirectoryResource } from '@/utils/fileSystemAccess';
import { createNode } from '@/utils/nodeFactory';
import { useFlowStore } from '@/stores/useFlowStore';

type ResourceFilter = 'all' | 'image' | 'video' | 'audio' | 'text';

const FILTER_TABS: { key: ResourceFilter; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: '全部', icon: <MoreHorizontal className="w-3 h-3" /> },
  { key: 'image', label: '图片', icon: <Image className="w-3 h-3" /> },
  { key: 'video', label: '视频', icon: <Video className="w-3 h-3" /> },
  { key: 'audio', label: '音频', icon: <Volume2 className="w-3 h-3" /> },
  { key: 'text', label: '文本', icon: <FileText className="w-3 h-3" /> },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface ResourcesMenuProps {
  onClose: () => void;
}

function ResourcesMenu({ onClose }: ResourcesMenuProps) {
  const [resources, setResources] = useState<DirectoryResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ResourceFilter>('all');
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const hasProjectDir = fsManager.hasProjectDirectory();

  // 点击外部关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const loadResources = async () => {
    if (!hasProjectDir) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fsManager.listGenerations();
      setResources(list);
    } catch (err) {
      setError('读取资源失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasProjectDir) loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProjectDir]);

  // 清理 blob URL
  useEffect(() => {
    return () => {
      fsManager.releaseBlobUrls(resources);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 过滤
  const filtered = resources.filter((r) => {
    const matchType = filter === 'all' || r.type === filter;
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  // 拖拽开始
  const handleDragStart = (e: React.DragEvent, resource: DirectoryResource) => {
    if (!resource.blobUrl) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('application/reactflow', 'textInputNode');
    e.dataTransfer.setData('text/uri-list', resource.blobUrl);
    e.dataTransfer.setData('text/plain', resource.name);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // 点击插入到画布（作为文本输入节点）
  const handleClick = (resource: DirectoryResource) => {
    if (!resource.blobUrl) return;
    const { addNode } = useFlowStore.getState();
    const pos = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };

    if (resource.type === 'image') {
      addNode(createNode('imageInputNode', pos, {
        imageUrl: resource.blobUrl,
        filename: resource.name,
      }));
    } else if (resource.type === 'video') {
      addNode(createNode('videoInputNode', pos, {
        videoUrl: resource.blobUrl,
        filename: resource.name,
      }));
    } else if (resource.type === 'audio') {
      addNode(createNode('audioInputNode', pos, {
        audioUrl: resource.blobUrl,
        audioName: resource.name,
      }));
    } else if (resource.type === 'text') {
      // 读取文本内容
      fetch(resource.blobUrl)
        .then((r) => r.text())
        .then((text) => {
          addNode(createNode('textInputNode', pos, { text, filename: resource.name }));
        });
    }
    onClose();
  };

  const iconForType = (type: DirectoryResource['type']) => {
    switch (type) {
      case 'image': return <Image className="w-3.5 h-3.5 text-green-400" />;
      case 'video': return <Video className="w-3.5 h-3.5 text-purple-400" />;
      case 'audio': return <Volume2 className="w-3.5 h-3.5 text-pink-400" />;
      case 'text': return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      default: return null;
    }
  };

  return (
    <div
      ref={menuRef}
      className="absolute top-12 right-0 w-[420px] max-h-[520px] bg-surface border border-border rounded-lg shadow-2xl flex flex-col z-50 overflow-hidden"
      style={{ right: '16px', top: '52px' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-xs font-medium text-text">资源库</span>
        <div className="flex items-center gap-1">
          {hasProjectDir && (
            <button
              onClick={loadResources}
              disabled={loading}
              className="p-1 text-text-muted hover:text-text rounded transition-colors disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text rounded transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 未设置项目目录 */}
      {!hasProjectDir ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
          <FolderOpen className="w-8 h-8 text-text-muted" />
          <div>
            <p className="text-sm text-text-secondary mb-1">未设置项目目录</p>
            <p className="text-[10px] text-text-muted leading-relaxed">
              请在「设置」→「项目」中<br />选择项目目录以加载资源
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* 搜索框 */}
          <div className="px-3 py-2 border-b border-border shrink-0">
            <div className="flex items-center gap-2 bg-surface-hover rounded px-2 py-1.5">
              <Search className="w-3 h-3 text-text-muted shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索文件名..."
                className="flex-1 bg-transparent text-xs text-text placeholder:text-text-muted outline-none"
              />
            </div>
          </div>

          {/* 筛选标签 */}
          <div className="flex gap-1 px-3 py-1.5 border-b border-border shrink-0 overflow-x-auto">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] shrink-0 transition-colors ${
                  filter === tab.key
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-text-muted hover:text-text hover:bg-surface-hover border border-transparent'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.key !== 'all' && (
                  <span className="ml-0.5 text-[9px] opacity-60">
                    {resources.filter((r) => r.type === tab.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 资源列表 */}
          <div className="flex-1 overflow-y-auto px-2 py-1.5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
              </div>
            ) : error ? (
              <div className="text-xs text-error text-center py-4">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="text-xs text-text-muted text-center py-6">
                {resources.length === 0 ? '目录为空，暂无资源' : '无匹配资源'}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((resource) => (
                  <div
                    key={resource.path}
                    draggable={!!resource.blobUrl}
                    onDragStart={(e) => handleDragStart(e, resource)}
                    onClick={() => handleClick(resource)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors group ${
                      resource.blobUrl
                        ? 'hover:bg-surface-hover'
                        : 'opacity-40 cursor-not-allowed'
                    }`}
                    title={`拖拽到画布或点击插入「${resource.name}」`}
                  >
                    {/* 图标 */}
                    <div className="shrink-0">{iconForType(resource.type)}</div>

                    {/* 预览缩略图 */}
                    {resource.type === 'image' && resource.blobUrl ? (
                      <img
                        src={resource.blobUrl}
                        alt={resource.name}
                        className="w-8 h-8 object-cover rounded border border-border shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-surface-hover rounded border border-border shrink-0" />
                    )}

                    {/* 信息 */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text truncate">{resource.name}</p>
                      <p className="text-[9px] text-text-muted">
                        {formatSize(resource.size)} · {formatDate(resource.lastModified)}
                      </p>
                    </div>

                    {/* 操作提示 */}
                    <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {resource.blobUrl ? '拖拽/点击' : '加载中'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default memo(ResourcesMenu);
