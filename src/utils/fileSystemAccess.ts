// Ref: Chrome File System Access API + Excalidraw 持久化模式
// Ref: §3.16 — 目录句柄持久化管理 + 文件读写
// 管理 settingsDirHandle 和 projectDirHandle 的生命周期：
// 1. showDirectoryPicker 让用户选择目录（仅一次）
// 2. 句柄存入 IndexedDB（idb-keyval）
// 3. 每次加载时验证权限，必要时请求（不弹出目录选择器）
// 4. 文件读写完全静默，无需用户交互

import { get, set, del } from 'idb-keyval';

// ============================================================================
// 常量
// ============================================================================

const SETTINGS_DIR_KEY = 'xshow-settings-dir';
const PROJECT_DIR_KEY = 'xshow-project-dir';

/** settings.json 文件名 */
export const SETTINGS_FILENAME = 'settings.json';
/** project.xshow 文件名 */
export const PROJECT_FILENAME = 'project.xshow';
/** generations 子目录名 */
export const GENERATIONS_DIRNAME = 'generations';

// ============================================================================
// 类型
// ============================================================================

export interface FileSystemResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DirectoryResource {
  name: string;
  path: string;           // 相对于目录的路径
  type: 'image' | 'video' | 'audio' | 'text' | 'other';
  mimeType: string;
  size: number;
  lastModified: number;
  /** blob URL（内存中），用于在画布上显示 */
  blobUrl?: string;
}

// ============================================================================
// 权限验证
// ============================================================================

/**
 * 验证目录句柄的读写权限，必要时请求
 * @param handle DirectoryHandle
 * @param mode 'read' | 'readwrite'
 * @returns true=有权限，false=无法获得权限
 */
async function verifyPermission(
  handle: FileSystemDirectoryHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  const options: FileSystemHandlePermissionDescriptor = { mode };
  // 先查询当前权限状态
  const currentPermission = await handle.queryPermission(options);
  if (currentPermission === 'granted') return true;
  if (currentPermission === 'denied') return false;

  // 'prompt' → 请求用户授权（不弹出目录选择器！）
  const requested = await handle.requestPermission(options);
  return requested === 'granted';
}

// ============================================================================
// 核心类
// ============================================================================

class FileSystemAccessManager {
  // 缓存的句柄（内存中，刷新丢失）
  private settingsDirHandle: FileSystemDirectoryHandle | null = null;
  private projectDirHandle: FileSystemDirectoryHandle | null = null;

  // ==========================================================================
  // 初始化（页面加载时调用）
  // ==========================================================================

  /**
   * 初始化：尝试从 IndexedDB 恢复目录句柄
   * @returns 恢复状态
   */
  async initialize(): Promise<{
    settingsDirOk: boolean;
    projectDirOk: boolean;
  }> {
    try {
      const savedSettings = await get<FileSystemDirectoryHandle>(SETTINGS_DIR_KEY);
      const savedProject = await get<FileSystemDirectoryHandle>(PROJECT_DIR_KEY);

      if (savedSettings) {
        this.settingsDirHandle = savedSettings;
        if (!(await verifyPermission(savedSettings, 'readwrite'))) {
          this.settingsDirHandle = null;
        }
      }

      if (savedProject) {
        this.projectDirHandle = savedProject;
        if (!(await verifyPermission(savedProject, 'readwrite'))) {
          this.projectDirHandle = null;
        }
      }

      return {
        settingsDirOk: this.settingsDirHandle !== null,
        projectDirOk: this.projectDirHandle !== null,
      };
    } catch (err) {
      console.error('[FileSystemAccessManager] 初始化失败:', err);
      return { settingsDirOk: false, projectDirOk: false };
    }
  }

  // ==========================================================================
  // 目录选择
  // ==========================================================================

  /**
   * 让用户选择设置目录
   * @param suggestedName 建议的文件夹名
   */
  async pickSettingsDirectory(suggestedName = 'XShow-Settings'): Promise<boolean> {
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
        suggestedName,
      });
      this.settingsDirHandle = handle;
      await set(SETTINGS_DIR_KEY, handle);
      return true;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return false;
      console.error('[FileSystemAccessManager] 选择设置目录失败:', err);
      return false;
    }
  }

  /**
   * 让用户选择项目目录
   * @param suggestedName 建议的文件夹名
   */
  async pickProjectDirectory(suggestedName = 'XShow-Projects'): Promise<boolean> {
    try {
      const handle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'documents',
        suggestedName,
      });
      this.projectDirHandle = handle;
      await set(PROJECT_DIR_KEY, handle);
      return true;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return false;
      console.error('[FileSystemAccessManager] 选择项目目录失败:', err);
      return false;
    }
  }

  /** 清除设置目录 */
  async clearSettingsDirectory(): Promise<void> {
    this.settingsDirHandle = null;
    await del(SETTINGS_DIR_KEY);
  }

  /** 清除项目目录 */
  async clearProjectDirectory(): Promise<void> {
    this.projectDirHandle = null;
    await del(PROJECT_DIR_KEY);
  }

  // ==========================================================================
  // 文件读写
  // ==========================================================================

  /** 读文件为文本 */
  private async readText(handle: FileSystemDirectoryHandle, filename: string): Promise<string | null> {
    try {
      const fileHandle = await handle.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch {
      return null;
    }
  }

  /** 写文本文件 */
  private async writeText(handle: FileSystemDirectoryHandle, filename: string, content: string): Promise<boolean> {
    try {
      const fileHandle = await handle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (err) {
      console.error('[FileSystemAccessManager] 写文件失败:', filename, err);
      return false;
    }
  }

  // ==========================================================================
  // Settings 目录操作
  // ==========================================================================

  /** 是否有有效的设置目录句柄 */
  hasSettingsDirectory(): boolean {
    return this.settingsDirHandle !== null;
  }

  /** 获取设置目录句柄（用于显示路径） */
  getSettingsDirectoryName(): string {
    return this.settingsDirHandle?.name ?? '';
  }

  /** 保存 settings.json */
  async saveSettings(settingsJson: string): Promise<FileSystemResult> {
    if (!this.settingsDirHandle) {
      return { success: false, error: '未选择设置目录' };
    }
    const ok = await this.writeText(this.settingsDirHandle, SETTINGS_FILENAME, settingsJson);
    return { success: ok, error: ok ? undefined : '写入失败' };
  }

  /** 加载 settings.json */
  async loadSettings(): Promise<FileSystemResult<{ json: string; timestamp: number }>> {
    if (!this.settingsDirHandle) {
      return { success: false, error: '未选择设置目录' };
    }
    const json = await this.readText(this.settingsDirHandle, SETTINGS_FILENAME);
    if (!json) {
      return { success: false, error: '设置文件不存在' };
    }
    try {
      // 尝试解析获取时间戳
      const parsed = JSON.parse(json);
      return { success: true, data: { json, timestamp: parsed._savedAt ?? Date.now() } };
    } catch {
      return { success: true, data: { json, timestamp: Date.now() } };
    }
  }

  // ==========================================================================
  // Project 目录操作
  // ==========================================================================

  /** 是否有有效的项目目录句柄 */
  hasProjectDirectory(): boolean {
    return this.projectDirHandle !== null;
  }

  /** 获取项目目录名 */
  getProjectDirectoryName(): string {
    return this.projectDirHandle?.name ?? '';
  }

  /** 保存 project.xshow */
  async saveProject(projectJson: string): Promise<FileSystemResult> {
    if (!this.projectDirHandle) {
      return { success: false, error: '未选择项目目录' };
    }
    const ok = await this.writeText(this.projectDirHandle, PROJECT_FILENAME, projectJson);
    return { success: ok, error: ok ? undefined : '写入失败' };
  }

  /** 加载 project.xshow */
  async loadProject(): Promise<FileSystemResult<{ json: string; timestamp: number }>> {
    if (!this.projectDirHandle) {
      return { success: false, error: '未选择项目目录' };
    }
    const json = await this.readText(this.projectDirHandle, PROJECT_FILENAME);
    if (!json) {
      return { success: false, error: '项目文件不存在' };
    }
    try {
      const parsed = JSON.parse(json);
      return { success: true, data: { json, timestamp: parsed.savedAt ?? Date.now() } };
    } catch {
      return { success: true, data: { json, timestamp: Date.now() } };
    }
  }

  // ==========================================================================
  // generations 子目录操作
  // ==========================================================================

  /**
   * 获取 generations 目录句柄（不存在则创建）
   */
  private async getGenerationsDir(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.projectDirHandle) return null;
    try {
      return await this.projectDirHandle.getDirectoryHandle(GENERATIONS_DIRNAME, { create: true });
    } catch {
      return null;
    }
  }

  /**
   * 保存生成的媒体文件到 generations 目录
   * @param filename 文件名（含扩展名）
   * @param content Blob 内容
   * @returns 相对路径或 null
   */
  async saveGeneration(filename: string, content: Blob): Promise<string | null> {
    const genDir = await this.getGenerationsDir();
    if (!genDir) return null;
    try {
      const fileHandle = await genDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return `${GENERATIONS_DIRNAME}/${filename}`;
    } catch (err) {
      console.error('[FileSystemAccessManager] 保存生成文件失败:', filename, err);
      return null;
    }
  }

  /**
   * 读取 generations 目录下的所有媒体资源
   */
  async listGenerations(): Promise<DirectoryResource[]> {
    const genDir = await this.getGenerationsDir();
    if (!genDir) return [];

    const resources: DirectoryResource[] = [];
    try {
      for await (const [name, handle] of genDir.entries()) {
        if (handle.kind !== 'file') continue;
        const file = await (handle as FileSystemFileHandle).getFile();
        const { type, mimeType } = this.classifyFile(name, file.type);
        if (type === 'other') continue; // 只列出媒体文件

        // 生成 blob URL 供画布使用
        const blobUrl = URL.createObjectURL(file);

        resources.push({
          name,
          path: `${GENERATIONS_DIRNAME}/${name}`,
          type,
          mimeType,
          size: file.size,
          lastModified: file.lastModified,
          blobUrl,
        });
      }
    } catch (err) {
      console.error('[FileSystemAccessManager] 列出 generations 失败:', err);
    }
    return resources;
  }

  // ==========================================================================
  // 工具
  // ==========================================================================

  /** 根据文件名和 MIME 类型分类 */
  private classifyFile(filename: string, mimeType: string): { type: DirectoryResource['type']; mimeType: string } {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico'];
    const videoExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'wmv'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus'];
    const textExts = ['txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'py', 'sh'];

    if (imageExts.includes(ext)) return { type: 'image', mimeType };
    if (videoExts.includes(ext)) return { type: 'video', mimeType };
    if (audioExts.includes(ext)) return { type: 'audio', mimeType };
    if (textExts.includes(ext)) return { type: 'text', mimeType };
    return { type: 'other', mimeType: 'application/octet-stream' };
  }

  /** 释放所有 blob URL（组件卸载时调用） */
  releaseBlobUrls(resources: DirectoryResource[]): void {
    for (const r of resources) {
      if (r.blobUrl) URL.revokeObjectURL(r.blobUrl);
    }
  }
}

// 单例导出
export const fsManager = new FileSystemAccessManager();
