// Ref: node-banana ResourceBrowser.tsx — 资源浏览器面板
// Ref: Excalidraw - Sidebar 资源拖拽模式
// 左侧收纳栏：展示 projects/ 目录下所有项目的媒体资源，支持筛选和拖拽复用
// 对标 NodeSidebar 的 fixed overlay 实现模式

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
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { fsManager, type DirectoryResource } from '@/utils/fileSystemAccess';
import { createNode } from '@/utils/nodeFactory';
import { useFlowStore } from '@/stores/useFlowStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

type ResourceFilter = 'all' | 'image' | 'video' | 'audio' | 'text';
type ResourceScope = 'current' | 'all';

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

interface ResourcesMenuProps {
  open: boolean;
  onClose: () => void;
}

function ResourcesMenu({ open, onClose }: ResourcesMenuProps) {
  const [resources, setResources] = useState<DirectoryResource[]>([]);
  const resourcesRef = useRef<DirectoryResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ResourceFilter>('all');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ResourceScope>('all');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // 当前项目信息
  const currentProjectId = useSettingsStore((s) => s.currentProjectId);
  const projects = useSettingsStore((s) => s.projects);
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const hasProjectDir = fsManager.hasProjectDirectory();

  // 同步 resources 到 ref，保证 cleanup 总能访问到最新数据
  useEffect(() => {
    resourcesRef.current = resources;
  }, [resources]);

  // 清空选中态：资源列表变化时自动取消所有勾选
  useEffect(() => {
    setSelectedPaths(new Set());
  }, [resources]);

  const loadResources = async () => {
    if (!hasProjectDir) return;
    // ✅ 先释放旧的 blob URL，防止内存泄漏
    fsManager.releaseBlobUrls(resourcesRef.current);
    setSelectedPaths(new Set());
    setLoading(true);
    setError(null);
    try {
      // 全部模式：读所有项目；当前项目模式：只读当前项目
      const list = await fsManager.listProjectResources(scope === 'current' ? currentProject?.name : undefined);
      setResources(list);
    } catch {
      setError('读取资源失败');
    } finally {
      setLoading(false);
    }
  };

  // 首次打开 + 切换 scope 时自动加载
  useEffect(() => {
    if (open && hasProjectDir) loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hasProjectDir, scope]);

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

  // 点击插入到画布
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

  // 全选/取消全选
  const allSelected = filtered.length > 0 && filtered.every((r) => selectedPaths.has(r.path));
  const someSelected = filtered.some((r) => selectedPaths.has(r.path)) && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filtered.map((r) => r.path)));
    }
  };

  // 单项勾选
  const toggleSelect = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  // 批量删除选中资源
  const handleDeleteSelected = async () => {
    if (selectedPaths.size === 0) return;
    // 按项目分组
    const byProject = new Map<string, string[]>();
    for (const r of resourcesRef.current) {
      if (selectedPaths.has(r.path)) {
        const list = byProject.get(r.projectName) ?? [];
        list.push(r.name);
        byProject.set(r.projectName, list);
      }
    }
    setDeleting(true);
    try {
      for (const [projectName, names] of byProject) {
        await fsManager.deleteProjectResources(projectName, names);
      }
      setSelectedPaths(new Set());
      await loadResources();
    } catch {
      setError('删除失败');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* 遮罩层 - 点击关闭（不覆盖顶部栏，对标 NodeSidebar） */}
      {open && (
        <div
          className="fixed top-11 left-0 right-0 bottom-0 z-40 bg-black/30 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* 侧边栏面板 - fixed overlay，top: 44px 不覆盖顶部栏 */}
      <div
        className={`fixed top-11 left-0 bottom-0 w-[356px] z-50 bg-surface border-r border-border flex flex-col transition-transform duration-250 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* 头部 */}
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
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text transition-colors"
              title="收起"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 未设置项目目录 */}
        {!hasProjectDir ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
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

            {/* 范围切换：全部 / 当前项目 */}
            <div className="flex gap-1 px-3 py-1.5 border-b border-border shrink-0">
              <button
                onClick={() => setScope('current')}
                className={`flex-1 px-2 py-1 rounded text-[10px] transition-colors ${
                  scope === 'current'
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-text-muted hover:text-text border border-transparent'
                }`}
              >
                当前项目{currentProject ? `: ${currentProject.name}` : ''}
              </button>
              <button
                onClick={() => setScope('all')}
                className={`flex-1 px-2 py-1 rounded text-[10px] transition-colors ${
                  scope === 'all'
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'text-text-muted hover:text-text border border-transparent'
                }`}
              >
                全部
              </button>
            </div>

            {/* 筛选标签 */}
            <div className="flex gap-1 px-2 py-1.5 border-b border-border shrink-0 overflow-x-auto scrollbar-none">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] shrink-0 transition-colors ${
                    filter === tab.key
                      ? 'bg-primary/20 text-primary border border-primary/30'
                      : 'text-text-muted hover:text-text hover:bg-surface-hover border border-transparent'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.key !== 'all' && (
                    <span className="ml-0.5 text-[9px] opacity-60">
                      {filtered.filter((r) => r.type === tab.key).length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* 批量操作栏 */}
            {filtered.length > 0 && (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0 bg-surface-hover/50">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text transition-colors"
                >
                  {allSelected ? (
                    <CheckSquare className="w-3 h-3 text-primary" />
                  ) : someSelected ? (
                    <CheckSquare className="w-3 h-3 text-primary/50" />
                  ) : (
                    <Square className="w-3 h-3" />
                  )}
                  <span>{allSelected ? '取消全选' : '全选'}</span>
                </button>
                {selectedPaths.size > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    disabled={deleting}
                    className="flex items-center gap-1 text-[10px] text-error/80 hover:text-error transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>删除选中 ({selectedPaths.size})</span>
                  </button>
                )}
              </div>
            )}

            {/* 资源列表 */}
            <div className="flex-1 overflow-y-auto px-2 py-1.5 scrollbar-thin scrollbar-thumb-neutral-600 scrollbar-track-transparent hover:scrollbar-thumb-neutral-500">
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
                        selectedPaths.has(resource.path)
                          ? 'bg-primary/10'
                          : resource.blobUrl
                          ? 'hover:bg-surface-hover'
                          : 'opacity-40 cursor-not-allowed'
                      }`}
                      title={`拖拽到画布或点击插入「${resource.name}」`}
                    >
                      {/* 勾选框 */}
                      <div
                        onClick={(e) => toggleSelect(e, resource.path)}
                        className="shrink-0"
                      >
                        {selectedPaths.has(resource.path) ? (
                          <CheckSquare className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-text-muted" />
                        )}
                      </div>

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
                        <p className="text-[9px] text-text-muted flex gap-1">
                          <span className="text-primary/60 truncate">{resource.projectName}</span>
                          <span>·</span>
                          <span>{formatSize(resource.size)}</span>
                        </p>
                      </div>

                      {/* 操作提示 */}
                      <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        {resource.blobUrl ? '插入' : '加载中'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default memo(ResourcesMenu);
