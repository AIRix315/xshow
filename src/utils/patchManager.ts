// Ref: RFC 6902 JSON Patch + fast-json-patch
// Ref: §3.16 — 差量存储：项目名+时间戳 patch 文件管理
// 机制：
// 1. 首次保存：写入完整 project.xshow 作为基准
// 2. 后续保存：计算 diff，写入 {项目名}.{时间戳}.xshow.patch
// 3. 内存中跟踪每个项目的 lastSavedState，用于下次 diff 计算

import * as jsonpatch from 'fast-json-patch';
import { fsManager, PROJECT_FILENAME } from './fileSystemAccess';
import type { XShowWorkflowFile } from '@/types';
import type { AppNode } from '@/types';
import type { Edge } from '@xyflow/react';

// ============================================================================
// 类型
// ============================================================================

export interface PatchFileMeta {
  /** patch 文件名（含扩展名） */
  filename: string;
  /** 时间戳（从文件名解析） */
  timestamp: number;
  /** 相对于项目目录的路径 */
  path: string;
}

export interface ProjectVersionInfo {
  /** 最新 patch 的时间戳（毫秒） */
  latestTimestamp: number;
  /** 最新 patch 的文件名 */
  latestFilename: string;
  /** 所有 patch 版本列表（按时间戳升序） */
  patches: PatchFileMeta[];
  /** 是否有完整基准文件 */
  hasBase: boolean;
}

// ============================================================================
// 内存状态：跟踪每个项目的上次保存状态
// ============================================================================

/** 每个项目最近一次保存的完整状态（用于计算下次 diff） */
const lastSavedStates = new Map<string, XShowWorkflowFile>();

/** 每个项目最近一次 patch 的时间戳（用于生成文件名） */
const lastPatchTimestamps = new Map<string, number>();

// ============================================================================
// 工具
// ============================================================================

/** 生成安全的文件名（去除不合法字符） */
function safeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'project';
}

/** 从 patch 文件名中解析时间戳 */
function parseTimestampFromFilename(filename: string): number | null {
  // 格式: {safeName}.{timestamp}.xshow.patch
  const match = filename.match(/^(.+)\.(\d+)\.xshow\.patch$/);
  if (!match) return null;
  const ts = Number.parseInt(match[2]!, 10);
  return Number.isNaN(ts) ? null : ts;
}

// ============================================================================
// 核心：差量保存
// ============================================================================

/**
 * 保存项目（差量模式）。
 * - 首次保存（内存中无基准）：写入完整 project.xshow
 * - 后续保存：计算 diff，写入 {项目名}.{时间戳}.xshow.patch
 *
 * @param projectId   项目 ID
 * @param projectName 项目名称（用于文件名）
 * @param nodes       当前节点数据
 * @param edges       当前边数据
 * @param embedBase64 是否嵌入 Base64
 * @returns 是否成功
 */
export async function saveProjectWithPatch(
  projectId: string,
  projectName: string,
  nodes: AppNode[],
  edges: Edge[],
  embedBase64: boolean,
): Promise<boolean> {
  const safeName = safeFilename(projectName);
  const currentState: XShowWorkflowFile = {
    version: 1,
    id: projectId,
    name: projectName,
    embedBase64,
    nodes,
    edges,
    savedAt: Date.now(),
    xshowVersion: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.1.5',
  };

  const hasBase = lastSavedStates.has(projectId);
  let success = false;

  if (!hasBase) {
    // 首次保存：写入完整 project.xshow 作为基准
    const json = JSON.stringify(currentState, null, 2);
    const result = await fsManager.saveProject(json);
    success = result.success;
    if (success) {
      lastSavedStates.set(projectId, currentState);
      lastPatchTimestamps.set(projectId, currentState.savedAt);
      console.log(`[patchManager] 写入基准文件 ${PROJECT_FILENAME}`);
    }
  } else {
    // 后续保存：计算 diff
    const baseState = lastSavedStates.get(projectId)!;
    const patches = jsonpatch.compare(baseState, currentState);

    if (patches.length === 0) {
      // 无变化，跳过
      console.log('[patchManager] 无变化，跳过保存');
      return true;
    }

    const timestamp = Date.now();
    const patchFilename = `${safeName}.${timestamp}.xshow.patch`;
    const json = JSON.stringify(patches);

    // 直接写到 generations 父目录（项目根目录）
    try {
      if (!fsManager.hasProjectDirectory()) return false;
      const handle = (fsManager as unknown as { projectDirHandle: FileSystemDirectoryHandle }).projectDirHandle;
      if (!handle) return false;
      const fileHandle = await handle.getFileHandle(patchFilename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(json);
      await writable.close();

      // 更新内存基准
      lastSavedStates.set(projectId, currentState);
      lastPatchTimestamps.set(projectId, timestamp);
      success = true;
      console.log(`[patchManager] 写入 patch ${patchFilename} (${patches.length} 个操作)`);
    } catch (err) {
      console.error('[patchManager] 写入 patch 失败:', err);
      success = false;
    }
  }

  return success;
}

/**
 * 重置项目的基准状态（用于：用户手动保存后，重新建立基准）。
 * 调用后下一次 saveProjectWithPatch 会写入完整 project.xshow。
 */
export function resetBaseState(projectId: string): void {
  lastSavedStates.delete(projectId);
  lastPatchTimestamps.delete(projectId);
}

/**
 * 加载项目的最新版本（从 project.xshow 基准 + 后续所有 patch 重建）。
 * 目前仅返回 project.xshow 的数据（完整基准），patch 应用逻辑在加载流程中实现。
 */
export async function loadLatestProjectState(): Promise<XShowWorkflowFile | null> {
  const result = await fsManager.loadProject();
  if (!result.success) return null;
  try {
    return JSON.parse(result.data!.json) as XShowWorkflowFile;
  } catch {
    return null;
  }
}

// ============================================================================
// 版本管理：列表 / 删除
// ============================================================================

/**
 * 获取项目的所有版本信息。
 */
export async function getProjectVersionInfo(projectName: string): Promise<ProjectVersionInfo | null> {
  if (!fsManager.hasProjectDirectory()) return null;
  const safeName = safeFilename(projectName);

  try {
    const handle = (fsManager as unknown as { projectDirHandle: FileSystemDirectoryHandle }).projectDirHandle;
    if (!handle) return null;

    const patches: PatchFileMeta[] = [];
    let hasBase = false;

    for await (const [name, fileHandle] of handle.entries()) {
      if (fileHandle.kind !== 'file') continue;

      // 检查是否为基准文件
      if (name === PROJECT_FILENAME) {
        hasBase = true;
        continue;
      }

      // 检查是否为该项目名下的 patch 文件
      // 格式: {safeName}.{timestamp}.xshow.patch
      if (name.startsWith(`${safeName}.`) && name.endsWith('.xshow.patch')) {
        const ts = parseTimestampFromFilename(name);
        if (ts !== null) {
          patches.push({
            filename: name,
            timestamp: ts,
            path: name,
          });
        }
      }
    }

    // 按时间戳升序
    patches.sort((a, b) => a.timestamp - b.timestamp);

    if (!hasBase && patches.length === 0) {
      return null;
    }

    // 最新 = 最后一个 patch；或无 patch 时用基准时间
    const latest = patches.length > 0 ? patches[patches.length - 1]! : null;

    return {
      latestTimestamp: latest ? latest.timestamp : Date.now(),
      latestFilename: latest ? latest.filename : PROJECT_FILENAME,
      patches,
      hasBase,
    };
  } catch (err) {
    console.error('[patchManager] 获取版本信息失败:', err);
    return null;
  }
}

/**
 * 删除项目的所有 patch 文件（保留 generations/ 子目录和 project.xshow 基准）。
 */
export async function deleteProjectPatches(projectName: string): Promise<{ deleted: number }> {
  if (!fsManager.hasProjectDirectory()) return { deleted: 0 };
  const safeName = safeFilename(projectName);

  try {
    const handle = (fsManager as unknown as { projectDirHandle: FileSystemDirectoryHandle }).projectDirHandle;
    if (!handle) return { deleted: 0 };

    let deleted = 0;
    for await (const [name, fileHandle] of handle.entries()) {
      if (fileHandle.kind !== 'file') continue;
      if (name === PROJECT_FILENAME) continue;
      if (!name.startsWith(`${safeName}.`) || !name.endsWith('.xshow.patch')) continue;

      await handle.removeEntry(name);
      deleted++;
      console.log(`[patchManager] 删除 patch: ${name}`);
    }

    return { deleted };
  } catch (err) {
    console.error('[patchManager] 删除 patch 失败:', err);
    return { deleted: 0 };
  }
}
