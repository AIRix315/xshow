// Ref: §3.6 N2 — 图片/视频预览自适应高度
// Ref: node-banana 自适应高度实现 + ResizeObserver
import { useRef, useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@/stores/useSettingsStore';

/**
 * 图片/视频预览自适应高度 Hook
 *
 * 功能：
 * - 根据媒体自然宽高比和容器宽度动态计算高度
 * - ResizeObserver 监听容器尺寸变化
 * - 尊重 reduceAnimations 设置
 *
 * @param maxHeight 最大高度限制（默认 400）
 */
export function useAdaptiveHeight(maxHeight = 400) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);
  const reduceAnimations = useSettingsStore((s) => s.canvasSettings.reduceAnimations);

  // 图片/视频加载完成后计算适配高度
  const handleMediaLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement | HTMLVideoElement>) => {
      const el = e.currentTarget as HTMLImageElement | HTMLVideoElement;
      const container = containerRef.current;
      if (!container) return;

      // Determine if it's an image or video based on available properties
      const isImage = 'naturalWidth' in el && el.naturalWidth > 0;
      const isVideo = 'videoWidth' in el && el.videoWidth > 0;

      if (!isImage && !isVideo) return;

      const containerWidth = container.getBoundingClientRect().width;
      const naturalRatio = isImage
        ? (el as HTMLImageElement).naturalHeight / (el as HTMLImageElement).naturalWidth
        : (el as HTMLVideoElement).videoHeight / (el as HTMLVideoElement).videoWidth;
      setPreviewHeight(Math.min(containerWidth * naturalRatio, maxHeight));
    },
    [maxHeight]
  );

  // 监听容器宽度变化（侧边栏拖拽、窗口 resize 等）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const img = container.querySelector('img');
      const video = container.querySelector('video');

      // Determine if it's an image or video based on available properties
      const isImage = img && 'naturalWidth' in img && img.naturalWidth > 0;
      const isVideo = video && 'videoWidth' in video && video.videoWidth > 0;
      const media = (isImage ? img : isVideo ? video : null) as HTMLImageElement | HTMLVideoElement | null;

      if (!media) return;

      const containerWidth = container.getBoundingClientRect().width;
      const naturalRatio = isImage
        ? (media as HTMLImageElement).naturalHeight / (media as HTMLImageElement).naturalWidth
        : (media as HTMLVideoElement).videoHeight / (media as HTMLVideoElement).videoWidth;
      setPreviewHeight(Math.min(containerWidth * naturalRatio, maxHeight));
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [maxHeight]);

  const containerStyle: React.CSSProperties = {
    height: previewHeight ?? 'auto',
    minHeight: 120, // 回退最小高度
    transition: reduceAnimations ? 'none' : 'height 200ms ease',
  };

  return { containerRef, previewHeight, handleMediaLoad, containerStyle };
}
