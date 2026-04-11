// Ref: §6.14 — 资源中转站 TransitPanel（双向资源流转 + 收藏/清理）
import { useState } from 'react';
import { useTransitResources } from '@/hooks/useTransitResources';
import type { TransitResource } from '@/types';
import { sendToActiveTab } from '@/utils/chromeHelpers';
import { Tag, Image, Video, Volume2, FileText, Star, Trash2, Send, Loader2, Package } from 'lucide-react';

const TYPE_FILTERS = [
  { value: 'all' as const, label: '全部', icon: Tag },
  { value: 'image' as const, label: '图片', icon: Image },
  { value: 'video' as const, label: '视频', icon: Video },
  { value: 'audio' as const, label: '语音', icon: Volume2 },
  { value: 'text' as const, label: '文本', icon: FileText },
];

const TYPE_ICONS: Record<TransitResource['type'], typeof Image> = {
  image: Image,
  video: Video,
  audio: Volume2,
  text: FileText,
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

  const IconComponent = TYPE_ICONS[resource.type];

  return (
    <div className="bg-surface rounded border border-border p-2 hover:border-border-hover transition-colors">
      <div className="flex items-start gap-2">
        {/* 预览区域 */}
        {resource.type === 'image' && (
          <img
            src={resource.url}
            alt=""
            className="w-[60px] h-[60px] object-cover rounded flex-shrink-0 bg-surface-hover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        )}
        {resource.type !== 'image' && (
          <div className="w-[60px] h-[60px] flex items-center justify-center bg-surface-hover rounded flex-shrink-0">
            <IconComponent className="w-6 h-6 text-text-secondary" />
          </div>
        )}

        {/* 信息区域 */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-text break-all leading-tight">
            {truncateUrl(resource.url)}
          </div>
          {resource.pageTitle && (
            <div className="text-[9px] text-text-muted mt-0.5 truncate">{resource.pageTitle}</div>
          )}
          <div className="text-[9px] text-text-muted mt-0.5">{formatTime(resource.timestamp)}</div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border">
        <button
          onClick={() => toggleFavorite(resource.id)}
          className="text-text-secondary hover:scale-110 transition-transform"
          title={resource.isFavorite ? '取消收藏' : '收藏'}
        >
          {resource.isFavorite ? <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" /> : <Star className="w-4 h-4" />}
        </button>
        <button
          onClick={() => removeResource(resource.id)}
          className="text-[10px] text-error hover:text-error/80 px-1"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="text-[10px] text-primary hover:text-primary-hover disabled:opacity-50 px-1"
          title="发送到当前页面"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
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
    <div className="h-full flex flex-col bg-background">
      {/* 类型筛选 + 操作栏 */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 border-b border-border">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTypeFilter(f.value)}
            className={`text-[10px] px-2 py-1 rounded transition-colors flex items-center gap-1 ${
              typeFilter === f.value
                ? 'bg-primary text-text'
                : 'bg-surface text-text-secondary hover:text-text'
            }`}
          >
            <f.icon className="w-3 h-3" />
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={clearNonFavorites}
          className="text-[10px] text-error hover:text-error/80 px-2 py-1 border border-error/30 rounded"
        >
          清理未收藏
        </button>
      </div>

      {/* 资源列表 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredResources.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-text-muted text-sm">
            <Package className="w-10 h-10 mb-2" />
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