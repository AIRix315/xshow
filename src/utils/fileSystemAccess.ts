// Ref: Chrome File System Access API + Excalidraw 持久化模式
// Ref: §3.16 — 目录句柄持久化管理 + 文件读写
// 管理 settingsDirHandle 的生命周期：
// 1. showDirectoryPicker 让用户选择根目录（仅一次）
// 2. 句柄存入 IndexedDB（idb-keyval）
// 3. 每次加载时验证权限，必要时请求（不弹出目录选择器）
// 4. 项目存储在 {根目录}/projects/{项目名}/ 下

import { get, set, del } from 'idb-keyval';

// ============================================================================
// 常量
// ============================================================================

const SETTINGS_DIR_KEY = 'xshow-settings-dir';

/** settings.json 文件名 */
export const SETTINGS_FILENAME = 'settings.json';
/** project.xshow 文件名（不含媒体） */
export const PROJECT_FILENAME = 'project.xshow';
/** project_with_media.xshow 文件名（含 base64 媒体） */
export const PROJECT_WITH_MEDIA_FILENAME = 'project_with_media.xshow';
/** projects 子目录名 */
export const PROJECTS_DIRNAME = 'projects';
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
  projectName: string;    // 所属项目名称
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

  // ==========================================================================
  // 初始化（页面加载时调用）
  // ==========================================================================

  /**
   * 初始化：尝试从 IndexedDB 恢复目录句柄
   * @returns 恢复状态
   */
  async initialize(): Promise<{
    settingsDirOk: boolean;
  }> {
    try {
      const savedSettings = await get<FileSystemDirectoryHandle>(SETTINGS_DIR_KEY);

      if (savedSettings) {
        this.settingsDirHandle = savedSettings;
        if (!(await verifyPermission(savedSettings, 'readwrite'))) {
          this.settingsDirHandle = null;
        }
      }

      return {
        settingsDirOk: this.settingsDirHandle !== null,
      };
    } catch (err) {
      console.error('[FileSystemAccessManager] 初始化失败:', err);
      return { settingsDirOk: false };
    }
  }

  // ==========================================================================
  // 目录选择
  // ==========================================================================

  /**
   * 让用户选择设置目录（根目录，项目将保存在其下的 projects 子目录）
   * @param suggestedName 建议的文件夹名
   */
  async pickSettingsDirectory(suggestedName = 'XShow'): Promise<boolean> {
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

  /** 清除设置目录 */
  async clearSettingsDirectory(): Promise<void> {
    this.settingsDirHandle = null;
    await del(SETTINGS_DIR_KEY);
  }

  // ==========================================================================
  // 文件读写工具
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

  /** 获取子目录句柄 */
  private async getSubDirectory(name: string, create = false): Promise<FileSystemDirectoryHandle | null> {
    if (!this.settingsDirHandle) return null;
    try {
      return await this.settingsDirHandle.getDirectoryHandle(name, { create });
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // Settings 目录操作
  // ==========================================================================

  /** 验证设置目录句柄是否仍然有效（如权限被撤销） */
  async verifySettingsDirectory(): Promise<boolean> {
    // 优先使用内存中的句柄（pickSettingsDirectory 已设置好，不需要等 IndexedDB）
    let handle = this.settingsDirHandle;

    // 内存为空时，尝试从 IndexedDB 恢复（仅首次初始化时）
    if (!handle) {
      try {
        const savedSettings = await get<FileSystemDirectoryHandle>(SETTINGS_DIR_KEY);
        if (savedSettings) {
          this.settingsDirHandle = savedSettings;
          handle = savedSettings;
        }
      } catch {
        // 读取失败，handle 保持 null
      }
    }

    if (!handle) return false;
    const valid = await verifyPermission(handle, 'readwrite');
    if (!valid) {
      this.settingsDirHandle = null;
      await del(SETTINGS_DIR_KEY);
    }
    return valid;
  }

  /** 是否有有效的设置目录句柄 */
  hasSettingsDirectory(): boolean {
    return this.settingsDirHandle !== null;
  }

  /** 获取设置目录名 */
  getSettingsDirectoryName(): string {
    return this.settingsDirHandle?.name ?? '';
  }

  /** 保存 settings.json */
  async saveSettings(settingsJson: string): Promise<FileSystemResult> {
    const isValid = await this.verifySettingsDirectory();
    if (!isValid) {
      return { success: false, error: '目录权限已失效，请重新选择目录' };
    }
    const ok = await this.writeText(this.settingsDirHandle!, SETTINGS_FILENAME, settingsJson);
    return { success: ok, error: ok ? undefined : '写入失败' };
  }

  /** 加载 settings.json */
  async loadSettings(): Promise<FileSystemResult<{ json: string; timestamp: number }>> {
    const isValid = await this.verifySettingsDirectory();
    if (!isValid) {
      return { success: false, error: '目录权限已失效，请重新选择目录' };
    }
    const json = await this.readText(this.settingsDirHandle!, SETTINGS_FILENAME);
    if (!json) {
      return { success: false, error: '设置文件不存在' };
    }
    try {
      const parsed = JSON.parse(json);
      return { success: true, data: { json, timestamp: parsed._savedAt ?? Date.now() } };
    } catch {
      return { success: true, data: { json, timestamp: Date.now() } };
    }
  }

  // ==========================================================================
  // 项目目录操作（基于设置目录的 projects 子目录）
  // ==========================================================================

  /** 是否有有效的设置目录（项目操作的先决条件） */
  hasProjectDirectory(): boolean {
    return this.settingsDirHandle !== null;
  }

  /** 获取项目目录名 */
  getProjectDirectoryName(): string {
    return this.settingsDirHandle?.name ?? '';
  }

  /** 获取 projects 子目录句柄 */
  private async getProjectsDir(): Promise<FileSystemDirectoryHandle | null> {
    return this.getSubDirectory(PROJECTS_DIRNAME, true);
  }

  /** 获取项目文件夹句柄 */
  private async getProjectDir(projectName: string): Promise<FileSystemDirectoryHandle | null> {
    const projectsDir = await this.getProjectsDir();
    if (!projectsDir) return null;
    try {
      return await projectsDir.getDirectoryHandle(projectName, { create: true });
    } catch {
      return null;
    }
  }

  /** 列出所有项目（读取 projects 下的子文件夹） */
  async listProjects(): Promise<string[]> {
    const projectsDir = await this.getProjectsDir();
    if (!projectsDir) return [];
    
    const projects: string[] = [];
    try {
      for await (const [name, handle] of projectsDir.entries()) {
        if (handle.kind === 'directory') {
          projects.push(name);
        }
      }
    } catch (err) {
      console.error('[FileSystemAccessManager] 列出项目失败:', err);
    }
    return projects.sort();
  }

  /** 保存项目文件
   * @param projectName 项目名称（文件夹名）
   * @param projectJson 项目 JSON 内容
   * @param embedBase64 是否嵌入 base64 媒体
   */
  async saveProject(projectName: string, projectJson: string, embedBase64: boolean): Promise<FileSystemResult> {
    const isValid = await this.verifySettingsDirectory();
    if (!isValid) {
      return { success: false, error: '目录权限已失效，请重新选择目录' };
    }
    const projectDir = await this.getProjectDir(projectName);
    if (!projectDir) {
      return { success: false, error: '无法创建项目目录' };
    }
    
    const filename = embedBase64 ? PROJECT_WITH_MEDIA_FILENAME : PROJECT_FILENAME;
    const ok = await this.writeText(projectDir, filename, projectJson);
    return { success: ok, error: ok ? undefined : '写入失败' };
  }

  /** 加载项目文件
   * @param projectName 项目名称
   * @returns 项目 JSON 和时间戳
   */
  async loadProject(projectName: string): Promise<FileSystemResult<{ json: string; timestamp: number; hasMedia: boolean }>> {
    const isValid = await this.verifySettingsDirectory();
    if (!isValid) {
      return { success: false, error: '目录权限已失效，请重新选择目录' };
    }
    const projectDir = await this.getProjectDir(projectName);
    if (!projectDir) {
      return { success: false, error: '项目目录不存在' };
    }
    
    // 优先加载带媒体版本
    let json = await this.readText(projectDir, PROJECT_WITH_MEDIA_FILENAME);
    let hasMedia = true;
    if (!json) {
      json = await this.readText(projectDir, PROJECT_FILENAME);
      hasMedia = false;
    }
    
    if (!json) {
      return { success: false, error: '项目文件不存在' };
    }
    try {
      const parsed = JSON.parse(json);
      return { success: true, data: { json, timestamp: parsed.savedAt ?? Date.now(), hasMedia } };
    } catch {
      return { success: true, data: { json, timestamp: Date.now(), hasMedia } };
    }
  }

  /** 删除项目文件夹 */
  async deleteProject(projectName: string): Promise<FileSystemResult> {
    const isValid = await this.verifySettingsDirectory();
    if (!isValid) {
      return { success: false, error: '目录权限已失效，请重新选择目录' };
    }
    const projectsDir = await this.getProjectsDir();
    if (!projectsDir) {
      return { success: false, error: '项目目录不存在' };
    }
    try {
      await projectsDir.removeEntry(projectName, { recursive: true });
      return { success: true };
    } catch (err) {
      console.error('[FileSystemAccessManager] 删除项目失败:', projectName, err);
      return { success: false, error: '删除失败' };
    }
  }

  /** 检查项目是否存在 */
  async projectExists(projectName: string): Promise<boolean> {
    const projectsDir = await this.getProjectsDir();
    if (!projectsDir) return false;
    try {
      await projectsDir.getDirectoryHandle(projectName);
      return true;
    } catch {
      return false;
    }
  }

  /** 重命名项目文件夹（文件系统层，使用 moveTo 原子操作）
   * @param oldName 原文件夹名
   * @param newName 新文件夹名
   * @returns 是否成功
   */
  async renameProjectDirectory(oldName: string, newName: string): Promise<boolean> {
    if (!this.settingsDirHandle) return false;
    if (oldName === newName) return true;

    const projectsDir = await this.getProjectsDir();
    if (!projectsDir) return false;

    try {
      // 获取旧目录句柄
      let oldDirHandle: FileSystemDirectoryHandle;
      try {
        oldDirHandle = await projectsDir.getDirectoryHandle(oldName, { create: false });
      } catch {
        // 旧目录不存在（从未保存过文件系统），直接跳过
        return true;
      }

      // 使用 moveTo 直接重命名（原子操作）
      // @ts-expect-error moveTo 是 FileSystemDirectoryHandle 的标准方法，但 TS lib 类型未包含
      await oldDirHandle.moveTo(projectsDir, newName);
      return true;
    } catch (err) {
      console.error('[FileSystemAccessManager] 重命名项目文件夹失败:', oldName, '->', newName, err);
      return false;
    }
  }

  // ==========================================================================
  // generations 子目录操作
  // ==========================================================================

  /** 获取 generations 目录句柄（不存在则创建） */
  private async getGenerationsDir(): Promise<FileSystemDirectoryHandle | null> {
    if (!this.settingsDirHandle) return null;
    try {
      return await this.settingsDirHandle.getDirectoryHandle(GENERATIONS_DIRNAME, { create: true });
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
   * 读取 projects/{项目}/ 目录下所有非 .xshow 的媒体资源
   * @param projectName 可选，不传则读所有项目，传项目名则只读该项目
   */
  async listProjectResources(projectName?: string): Promise<DirectoryResource[]> {
    const projectsDir = await this.getProjectsDir();
    if (!projectsDir) return [];

    const resources: DirectoryResource[] = [];
    try {
      for await (const [projName, handle] of projectsDir.entries()) {
        if (handle.kind !== 'directory') continue;
        // 过滤：如果指定了 projectName，跳过不匹配的
        if (projectName && projName !== projectName) continue;

        const projDir = handle as FileSystemDirectoryHandle;
        for await (const [name, fileHandle] of projDir.entries()) {
          if (fileHandle.kind !== 'file') continue;
          // 跳过 .xshow 文件
          if (name.endsWith('.xshow')) continue;

          const file = await (fileHandle as FileSystemFileHandle).getFile();
          const { type, mimeType } = this.classifyFile(name, file.type);
          if (type === 'other') continue;

          const blobUrl = URL.createObjectURL(file);

          resources.push({
            name,
            path: `${PROJECTS_DIRNAME}/${projName}/${name}`,
            projectName: projName,
            type,
            mimeType,
            size: file.size,
            lastModified: file.lastModified,
            blobUrl,
          });
        }
      }
    } catch (err) {
      console.error('[FileSystemAccessManager] 列出项目资源失败:', err);
    }
    return resources;
  }

  /** 兼容旧接口：读取 generations 目录（已废弃，统一走 projects/） */
  async listGenerations(): Promise<DirectoryResource[]> {
    return this.listProjectResources();
  }

  // ==========================================================================
  // 媒体文件读写（项目资源管理）
  // ==========================================================================

  /**
   * 将 blob 保存到项目目录（覆盖同名文件）
   * @param projectName 项目名称
   * @param blob Blob 数据
   * @param filename 保存的文件名
   * @returns 相对路径（如 "img001.jpg"）或 null
   */
  async saveMediaToProject(projectName: string, blob: Blob, filename: string): Promise<string | null> {
    const projectDir = await this.getProjectDir(projectName);
    if (!projectDir) return null;
    try {
      const fileHandle = await projectDir.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return filename;
    } catch (err) {
      console.error('[FileSystemAccessManager] 保存媒体文件失败:', filename, err);
      return null;
    }
  }

  /**
   * 从项目目录读取文件并转换为 blob URL
   * @param projectName 项目名称
   * @param filename 文件名（相对路径）
   * @returns blob URL 或 null
   */
  async loadMediaAsBlobUrl(projectName: string, filename: string): Promise<string | null> {
    const projectDir = await this.getProjectDir(projectName);
    if (!projectDir) return null;
    try {
      const fileHandle = await projectDir.getFileHandle(filename);
      const file = await fileHandle.getFile();
      return URL.createObjectURL(file);
    } catch (err) {
      console.error('[FileSystemAccessManager] 读取媒体文件失败:', filename, err);
      return null;
    }
  }

  /**
   * 删除项目目录下的单个资源文件
   * @param projectName 项目名称
   * @param filename 文件名
   * @returns 是否成功
   */
  async deleteProjectResource(projectName: string, filename: string): Promise<boolean> {
    const projectDir = await this.getProjectDir(projectName);
    if (!projectDir) return false;
    try {
      await projectDir.removeEntry(filename);
      return true;
    } catch (err) {
      console.error('[FileSystemAccessManager] 删除资源文件失败:', filename, err);
      return false;
    }
  }

  /**
   * 批量删除项目目录下的资源文件
   * @param projectName 项目名称
   * @param filenames 文件名列表
   */
  async deleteProjectResources(projectName: string, filenames: string[]): Promise<void> {
    await Promise.all(filenames.map((f) => this.deleteProjectResource(projectName, f)));
  }

  // ==========================================================================
  // 工具
  // ==========================================================================

  /** 根据文件名和 MIME 类型分类（扩展名大小写不敏感） */
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
