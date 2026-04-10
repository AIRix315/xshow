// Ref: §6.14 — 资源中转站 TransitPanel（双向资源流转 + 收藏/清理）
import { useState } from 'react';
import { useTransitResources } from '@/hooks/useTransitResources';
import type { TransitResource } from '@/types';
import { sendToActiveTab } from '@/utils/chromeHelpers';

const TYPE_FILTERS = [
  { value: 'all' as const, label: '全部', icon: '🏷️' },
  { value: 'image' as const, label: '图片', icon: '🖼️' },
  { value: 'video' as const, label: '视频', icon: '🎬' },
  { value: 'audio' as const, label: '语音', icon: '🎙️' },
  { value: 'text' as const, label: '文本', icon: '📝' },
];

const TYPE_ICONS: Record<TransitResource['type'], string> = {
  image: '🖼️',
  video: '🎬',
  audio: '🎙️',
  text: '📝',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function truncateUrl(url: string, maxLen = 50): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + '...';
}

function ResourceCard({ resource }: { resource: TransitResource }) {
  const toggleFavorite = useTransitResources((s) => s.toggleFavorite);
  const removeResource = useTransitResources((s) => s.removeResource);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      await sendToActiveTab(resource);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '发送失败';
      alert(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-[#2a2a2a] rounded border border-[#444] p-2 hover:border-[#555] transition-colors">
      <div className="flex items-start gap-2">
        {/* 预览区域 */}
        {resource.type === 'image' && (
          <img
            src={resource.url}
            alt=""
            className="w-[60px] h-[60px] object-cover rounded flex-shrink-0 bg-[#333]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {resource.type !== 'image' && (
          <div className="w-[60px] h-[60px] flex items-center justify-center bg-[#333] rounded flex-shrink-0 text-2xl">
            {TYPE_ICONS[resource.type]}
          </div>
        )}

        {/* 信息区域 */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-white break-all leading-tight">
            {truncateUrl(resource.url)}
          </div>
          {resource.pageTitle && (
            <div className="text-[9px] text-gray-500 mt-0.5 truncate">{resource.pageTitle}</div>
          )}
          <div className="text-[9px] text-gray-600 mt-0.5">{formatTime(resource.timestamp)}</div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-[#444]">
        <button
          onClick={() => toggleFavorite(resource.id)}
          className="text-sm hover:scale-110 transition-transform"
          title={resource.isFavorite ? '取消收藏' : '收藏'}
        >
          {resource.isFavorite ? '⭐' : '☆'}
        </button>
        <button
          onClick={() => removeResource(resource.id)}
          className="text-[10px] text-red-400 hover:text-red-300 px-1"
          title="删除"
        >
          🗑️
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-50 px-1"
          title="发送到当前页面"
        >
          {sending ? '⏳' : '➡️'}
        </button>
      </div>
    </div>
  );
}

export default function TransitPanel() {
  const resources = useTransitResources((s) => s.resources);
  const clearNonFavorites = useTransitResources((s) => s.clearNonFavorites);
  const [typeFilter, setTypeFilter] = useState<'all' | TransitResource['type']>('all');

  const filteredResources = typeFilter === 'all'
    ? resources
    : resources.filter((r) => r.type === typeFilter);

  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">
      {/* 类型筛选 + 操作栏 */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 border-b border-[#333]">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`text-[10px] px-2 py-1 rounded transition-colors ${
              typeFilter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-[#333] text-gray-400 hover:text-white'
            }`}
          >
            {f.icon} {f.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={clearNonFavorites}
          className="text-[10px] text-red-400 hover:text-red-300 px-2 py-1 border border-red-500/30 rounded"
        >
          清理未收藏
        </button>
      </div>

      {/* 资源列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredResources.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 text-sm">
            <span className="text-3xl mb-2">📦</span>
            暂无资源
          </div>
        )}
        {filteredResources.map((r) => (
          <ResourceCard key={r.id} resource={r} />
        ))}
      </div>
    </div>
  );
}