// Ref: 宫格拆图/合图 Canvas 工具函数
// Ref: node-banana gridSplitter.ts — 保留原图宽高比分割

/**
 * 将图片分割为 rows × cols 网格。
 * 使用 Canvas API 裁切，返回每个单元格的 DataURL。
 * 单元格输出保持原图宽高比（cellWidth × cellHeight），
 * cellSize 仅作为上限制缩放。
 */
export function splitImageToGrid(
  sourceImage: HTMLImageElement,
  rows: number,
  cols: number,
  cellSize?: number,
): string[] {
  const results: string[] = [];
  const srcCellWidth = sourceImage.naturalWidth / cols;
  const srcCellHeight = sourceImage.naturalHeight / rows;

  // 输出尺寸：保持原图单元格宽高比，cellSize 作为上限
  let outWidth = Math.round(srcCellWidth);
  let outHeight = Math.round(srcCellHeight);
  if (cellSize && cellSize > 0) {
    const scaleW = cellSize / srcCellWidth;
    const scaleH = cellSize / srcCellHeight;
    const scale = Math.min(scaleW, scaleH, 1); // 只缩小不放大
    outWidth = Math.round(srcCellWidth * scale);
    outHeight = Math.round(srcCellHeight * scale);
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const canvas = document.createElement('canvas');
      canvas.width = outWidth;
      canvas.height = outHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D context 不可用');
      }
      ctx.drawImage(
        sourceImage,
        Math.round(col * srcCellWidth),
        Math.round(row * srcCellHeight),
        Math.round(srcCellWidth),
        Math.round(srcCellHeight),
        0,
        0,
        outWidth,
        outHeight,
      );
      results.push(canvas.toDataURL('image/png'));
    }
  }

  return results;
}

/**
 * 将多张图片合并为 rows × cols 网格大图。
 * 用空单元格填充缺失的图片。
 */
export async function mergeImagesFromGrid(
  cellImages: Array<string | undefined>,
  rows: number,
  cols: number,
  cellSize: number,
): Promise<string> {
  const canvasWidth = cols * cellSize;
  const canvasHeight = rows * cellSize;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context 不可用');

  // 先加载所有有效图片
  const loaders = cellImages.map((imgUrl, idx) => {
    if (!imgUrl) return Promise.resolve<{ img: HTMLImageElement; idx: number } | null>(null);
    return new Promise<{ img: HTMLImageElement; idx: number } | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve({ img, idx });
      img.onerror = () => {
        console.warn(`[mergeImagesFromGrid] Failed to load image at index ${idx}`);
        resolve(null);
      };
      img.src = imgUrl;
    });
  });

  const loaded = await Promise.all(loaders);

  ctx.fillStyle = '#1c1c1c'; // 背景色 = surface 色
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const item of loaded) {
    if (!item) continue;
    const { img, idx } = item;
    const row = Math.floor(idx / cols);
    const col = idx % cols;
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