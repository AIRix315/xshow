// Ref: §6.7 + §6.8 — 九宫格拆图/合图 Canvas 工具函数

/**
 * 将图片分割为 N×N 网格。
 * 使用 Canvas API 裁切，返回每个单元格的 DataURL。
 */
export function splitImageToGrid(
  sourceImage: HTMLImageElement,
  gridCount: number,
  cellSize: number,
): string[] {
  const results: string[] = [];
  const cellWidth = sourceImage.naturalWidth / gridCount;
  const cellHeight = sourceImage.naturalHeight / gridCount;

  for (let row = 0; row < gridCount; row++) {
    for (let col = 0; col < gridCount; col++) {
      const canvas = document.createElement('canvas');
      canvas.width = cellSize;
      canvas.height = cellSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.drawImage(
        sourceImage,
        col * cellWidth,
        row * cellHeight,
        cellWidth,
        cellHeight,
        0,
        0,
        cellSize,
        cellSize,
      );
      results.push(canvas.toDataURL('image/png'));
    }
  }

  return results;
}

/**
 * 将多张图片合并为 N×N 网格大图。
 * 用空单元格填充缺失的图片。
 */
export async function mergeImagesFromGrid(
  cellImages: Array<string | undefined>,
  gridCount: number,
  cellSize: number,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = gridCount * cellSize;
  canvas.height = gridCount * cellSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context 不可用');

  // 先加载所有有效图片
  const loaders = cellImages.map((imgUrl, idx) => {
    if (!imgUrl) return Promise.resolve<{ img: HTMLImageElement; idx: number } | null>(null);
    return new Promise<{ img: HTMLImageElement; idx: number } | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve({ img, idx });
      img.onerror = () => resolve(null);
      img.src = imgUrl;
    });
  });

  const loaded = await Promise.all(loaders);

  ctx.fillStyle = '#1c1c1c'; // 背景色 = surface 色
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const item of loaded) {
    if (!item) continue;
    const { img, idx } = item;
    const row = Math.floor(idx / gridCount);
    const col = idx % gridCount;
    ctx.drawImage(img, col * cellSize, row * cellSize, cellSize, cellSize);
  }

  return canvas.toDataURL('image/png');
}

/**
 * 加载图片为 HTMLImageElement。
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}