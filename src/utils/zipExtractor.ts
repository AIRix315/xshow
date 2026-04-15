/**
 * ZIP 解压工具
 *
 * 用于处理 RunningHub 返回的 ZIP 压缩包
 * 提取所有媒体文件（图片、视频、音频）
 * 
 * 使用浏览器内置的 Compression Streams API 解压 DEFLATE 数据
 */

/**
 * 从 ZIP 文件中提取的单个媒体文件
 */
export interface ExtractedMedia {
  /** 文件名 */
  name: string;
  /** 文件 URL（blob URL 或远程 URL） */
  url: string;
  /** 文件类型 */
  type: 'image' | 'video' | 'audio' | 'unknown';
  /** 文件大小（字节） */
  size: number;
  /** 是否为 blob URL（需要手动 revoke 以避免内存泄漏） */
  isBlobUrl?: boolean;
}

/**
 * 根据文件名判断媒体类型
 */
export function getMediaType(filename: string): ExtractedMedia['type'] {
  const lower = filename.toLowerCase();
  if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i.test(lower)) return 'image';
  if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(lower)) return 'video';
  if (/\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i.test(lower)) return 'audio';
  return 'unknown';
}

/**
 * 根据扩展名获取 MIME 类型
 */
function getMimeType(filename: string): string {
  const lower = filename.toLowerCase();
  if (/\.png$/i.test(lower)) return 'image/png';
  if (/\.jpe?g$/i.test(lower)) return 'image/jpeg';
  if (/\.gif$/i.test(lower)) return 'image/gif';
  if (/\.webp$/i.test(lower)) return 'image/webp';
  if (/\.svg$/i.test(lower)) return 'image/svg+xml';
  if (/\.bmp$/i.test(lower)) return 'image/bmp';
  if (/\.mp4$/i.test(lower)) return 'video/mp4';
  if (/\.webm$/i.test(lower)) return 'video/webm';
  if (/\.mov$/i.test(lower)) return 'video/quicktime';
  if (/\.avi$/i.test(lower)) return 'video/x-msvideo';
  if (/\.mkv$/i.test(lower)) return 'video/x-matroska';
  if (/\.mp3$/i.test(lower)) return 'audio/mpeg';
  if (/\.wav$/i.test(lower)) return 'audio/wav';
  if (/\.ogg$/i.test(lower)) return 'audio/ogg';
  if (/\.m4a$/i.test(lower)) return 'audio/mp4';
  if (/\.flac$/i.test(lower)) return 'audio/flac';
  if (/\.aac$/i.test(lower)) return 'audio/aac';
  return 'application/octet-stream';
}

/**
 * 使用 Compression Streams API 解压 DEFLATE 数据
 */
async function decompressDeflate(data: Uint8Array): Promise<Uint8Array> {
  // Compression Streams API (Chrome 102+, Edge 102+, Firefox 112+, Safari 16.4+)
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    writer.write(data);
    writer.close();
    const result = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(result);
  }
  
  // Fallback: return compressed data as-is
  console.warn('[zipExtractor] DecompressionStream not available, returning raw data');
  return data;
}

/**
 * 简单的 ZIP 解析器（仅支持存储和 DEFLATE 压缩）
 * 基于 ZIP 文件格式规范
 */
async function parseZipSimple(arrayBuffer: ArrayBuffer): Promise<Map<string, { data: Uint8Array; size: number }>> {
  const files = new Map<string, { data: Uint8Array; size: number }>();
  const view = new DataView(arrayBuffer);
  const uint8 = new Uint8Array(arrayBuffer);

  // 检查 ZIP 签名
  if (uint8[0] !== 0x50 || uint8[1] !== 0x4b || uint8[2] !== 0x03 || uint8[3] !== 0x04) {
    throw new Error('Invalid ZIP file signature');
  }

  let offset = 0;
  const entries: Array<{ name: string; compSize: number; uncompSize: number; dataOffset: number; compression: number }> = [];

  // 扫描本地文件头
  while (offset < arrayBuffer.byteLength - 30) {
    const sig = view.getUint32(offset, true);

    if (sig === 0x04034b50) {
      // 本地文件头
      const compression = view.getUint16(offset + 8, true);
      const compSize = view.getUint32(offset + 18, true);
      const uncompSize = view.getUint32(offset + 22, true);
      const nameLen = view.getUint16(offset + 26, true);
      const extraLen = view.getUint16(offset + 28, true);
      const nameBytes = uint8.slice(offset + 30, offset + 30 + nameLen);
      const name = new TextDecoder('utf-8', { fatal: false }).decode(nameBytes);

      // 跳过目录
      if (!name.endsWith('/')) {
        entries.push({
          name,
          compSize,
          uncompSize: uncompSize || compSize,
          dataOffset: offset + 30 + nameLen + extraLen,
          compression,
        });
      }

      offset += 30 + nameLen + extraLen + compSize;
    } else {
      break;
    }
  }

  // 提取文件数据
  for (const entry of entries) {
    const compressedData = uint8.slice(entry.dataOffset, entry.dataOffset + entry.compSize);
    let uncompressed: Uint8Array;

    if (entry.compression === 0) {
      // 存储 - 无压缩
      uncompressed = compressedData;
    } else if (entry.compression === 8) {
      // DEFLATE - 使用 Compression Streams API
      try {
        uncompressed = await decompressDeflate(compressedData);
      } catch {
        console.warn(`[zipExtractor] Failed to decompress: ${entry.name}`);
        continue;
      }
    } else {
      console.warn(`[zipExtractor] Unsupported compression: ${entry.compression} for ${entry.name}`);
      continue;
    }

    files.set(entry.name, {
      data: uncompressed,
      size: entry.uncompSize || uncompressed.length,
    });
  }

  return files;
}

/**
 * 解压 ZIP 文件并提取所有媒体文件
 * @param zipUrl ZIP 文件 URL
 * @param signal 可选的 AbortSignal
 * @returns 提取的媒体文件列表
 */
export async function extractZipContents(
  zipUrl: string,
  signal?: AbortSignal,
): Promise<ExtractedMedia[]> {
  // 下载 ZIP 文件
  const response = await fetch(zipUrl, { signal });
  if (!response.ok) {
    throw new Error(`下载 ZIP 文件失败: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mediaFiles: ExtractedMedia[] = [];

  try {
    // 尝试解析 ZIP
    const files = await parseZipSimple(arrayBuffer);

    for (const [filename, file] of files) {
      const mediaType = getMediaType(filename);

      const blob = new Blob([file.data], { type: getMimeType(filename) });
      const url = URL.createObjectURL(blob);

      mediaFiles.push({
        name: filename,
        url,
        type: mediaType,
        size: file.size,
        isBlobUrl: true,  // blob URL 需要手动 revoke
      });
    }
  } catch {
    // ZIP 解析失败，返回原始 URL 作为单个文件
    const blob = new Blob([arrayBuffer], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    return [{
      name: 'output.zip',
      url,
      type: 'unknown',
      size: arrayBuffer.byteLength,
    }];
  }

  return mediaFiles;
}

/**
 * 根据媒体类型分类提取的文件
 */
export interface ClassifiedMedia {
  images: ExtractedMedia[];
  videos: ExtractedMedia[];
  audio: ExtractedMedia[];
  others: ExtractedMedia[];
}

/**
 * 分类提取的媒体文件
 */
export function classifyMedia(files: ExtractedMedia[]): ClassifiedMedia {
  const result: ClassifiedMedia = {
    images: [],
    videos: [],
    audio: [],
    others: [],
  };

  for (const file of files) {
    switch (file.type) {
      case 'image':
        result.images.push(file);
        break;
      case 'video':
        result.videos.push(file);
        break;
      case 'audio':
        result.audio.push(file);
        break;
      default:
        result.others.push(file);
    }
  }

  return result;
}

/**
 * 从 ZIP 提取的媒体生成 outputUrls 数组
 * 优先返回图片，然后视频，然后音频
 */
export function mediaToOutputUrls(files: ExtractedMedia[]): string[] {
  const urls: string[] = [];

  // 按图片、视频、音频排序
  const classified = classifyMedia(files);

  for (const file of [...classified.images, ...classified.videos, ...classified.audio]) {
    urls.push(file.url);
  }

  return urls;
}

/**
 * 释放 blob URL 占用的内存
 * 在节点重新执行或组件卸载时调用
 */
export function revokeMediaUrls(urls: string[]): void {
  for (const url of urls) {
    if (url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // 忽略已释放的 URL
      }
    }
  }
}