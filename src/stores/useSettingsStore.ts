// Ref: Zustand v5 persist + flowcraft lib/store/ + §7.3 — 双层持久化
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_API_CONFIG,
  DEFAULT_PROJECT,
} from '@/types';
import { saveCanvasState } from '@/utils/canvasState';
import { useFlowStore } from '@/stores/useFlowStore';
import { fsManager } from '@/utils/fileSystemAccess';
import type {
  ApiConfig,
  ChannelConfig,
  Project,
  CustomNodeTemplate,
  GlobalTask,
  PresetPrompt,
  ComfyUIConfig,
  RunningHubApp,
  RunningHubWorkflow,
  ModelEntry,
} from '@/types';
import { createPersistStorage } from '@/utils/chromeStorage';

/**
 * 将 settings state 序列化为 Zustand persist 格式的 JSON 字符串。
 * 供 syncSettingsToFs（自动备份）和 exportSettingsJson（手动导出）共用。
 */
function serializeSettingsState(state: SettingsState): string {
  return JSON.stringify({
    state: {
      apiConfig: state.apiConfig,
      projects: state.projects,
      currentProjectId: state.currentProjectId,
      customNodeTemplates: state.customNodeTemplates,
      globalTasks: state.globalTasks,
      canvasSettings: state.canvasSettings,
      systemSettings: state.systemSettings,
      comfyuiConfig: state.comfyuiConfig,
    },
    version: 0,
  });
}

/**
 * 深层合并两个对象（用于导入时用 defaults 填补缺失字段）。
 * target 被 source 的非 undefined 值覆盖。
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const sk = key as keyof T;
    const sv = source[sk];
    if (sv === undefined) continue;
    const tv = result[key];
    if (
      tv !== undefined &&
      typeof tv === 'object' &&
      !Array.isArray(tv) &&
      tv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      sv !== null
    ) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result as T;
}

/**
 * 将当前 settings 状态同步写入 fsManager（静默备份到设置目录）。
  * 每次 settings mutation 后调用，确保设置目录中的 settings.json 与 chrome.storage 保持同步。
  */
function syncSettingsToFs(state: SettingsState & SettingsActions): void {
  if (!fsManager.hasSettingsDirectory()) return;
  fsManager.saveSettings(serializeSettingsState(state));
}

interface SettingsState {
  apiConfig: ApiConfig;
  projects: Project[];
  currentProjectId: string;
  customNodeTemplates: CustomNodeTemplate[];
  globalTasks: GlobalTask[];
  // 画布设置
  canvasSettings: CanvasSettings;
  // 系统设置
  systemSettings: SystemSettings;
  // ComfyUI 配置
  comfyuiConfig: ComfyUIConfig;
}

/** 画布设置 */
export interface CanvasSettings {
  fontSize: 'small' | 'medium' | 'large';
  panMode: 'space-drag' | 'middle-drag';
  zoomMode: 'alt-scroll' | 'ctrl-scroll';
  showGrid: boolean;
  snapToGrid: boolean;
  reduceAnimations: boolean;
  // 节点默认值
  llmDefaultTemperature: number;
  llmDefaultMaxTokens: number;
  imageDefaultModel: string;
  videoDefaultDuration: string;
  audioDefaultSplit: boolean;
  audioDefaultTTS: boolean;
}

/** 系统设置 */
export interface SystemSettings {
  theme: 'dark' | 'light';
  showNodeModelSettings: boolean;
  showMinimap: boolean;
  envConfigPath: string;
  configSavePath: string;
  embedBase64: boolean;
  saveDirectory: string;
  /** 调试模式 - 显示节点调试信息 */
  debugMode: boolean;
  /** 自动保存开关（默认关闭，需先设置项目目录） */
  autoSave: boolean;
}

const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  fontSize: 'medium',
  panMode: 'space-drag',
  zoomMode: 'alt-scroll',
  showGrid: true,
  snapToGrid: false,
  reduceAnimations: false,
  llmDefaultTemperature: 0.7,
  llmDefaultMaxTokens: 4096,
  imageDefaultModel: '',
  videoDefaultDuration: '固定 5 秒',
  audioDefaultSplit: true,
  audioDefaultTTS: false,
};

const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  theme: 'dark',
  showNodeModelSettings: true,
  showMinimap: true,
  envConfigPath: '',
  configSavePath: '',
  embedBase64: false,
  saveDirectory: '',
  debugMode: true, // 默认开启，生产发布时改为 false
  autoSave: false, // 默认关闭
};

const DEFAULT_COMFYUI_CONFIG: ComfyUIConfig = {
  localUrl: 'http://127.0.0.1:8188',
  localWorkflows: [],
  cloudUrl: '',
  cloudWorkflows: [],
  runninghubApiKey: '',
  runninghubWorkflows: [],
  runninghubApps: [],
};

interface SettingsActions {
  addChannel: (channel: ChannelConfig) => void;
  updateChannel: (id: string, patch: Partial<ChannelConfig>) => void;
  removeChannel: (id: string) => void;
  setChannelId: (type: 'image' | 'video' | 'text' | 'audio' | '3d', channelId: string) => void;
  setModel: (type: 'drawingModel' | 'videoModel' | 'textModel' | 'audioModel' | 'model3D' | 'ttsVoice' | 'videoDurations' | 'comfyuiLocalWorkflows' | 'comfyuiCloudWorkflows' | 'comfyuiRunninghubWorkflows', value: string) => void;
  // 模型列表管理
  addModelEntry: (type: string, entry: ModelEntry) => void;
  removeModelEntry: (type: string, entryId: string) => void;
  setDefaultModel: (type: string, entryId: string) => void;
  updateModelSpeed: (type: string, entryId: string, speed: number) => void;
  addModelEntries: (type: string, entries: ModelEntry[]) => void;
  addProject: (name: string) => void;
  removeProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setCurrentProject: (id: string) => void;
  /** 从 .xshow 文件导入项目：创建新项目 + 加载画布数据 */
  importProjectFromFile: (projectFile: import('@/types').XShowWorkflowFile) => Promise<{ projectId: string; warnings: string[] }>;
  addTemplate: (template: CustomNodeTemplate) => void;
  removeTemplate: (id: string) => void;
  addGlobalTask: (task: GlobalTask) => void;
  updateGlobalTask: (id: string, patch: Partial<GlobalTask>) => void;
  removeGlobalTask: (id: string) => void;
  addPresetPrompt: (prompt: PresetPrompt) => void;
  removePresetPrompt: (index: number) => void;
  updatePresetPrompt: (index: number, patch: Partial<PresetPrompt>) => void;
  // 画布设置
  updateCanvasSettings: (patch: Partial<CanvasSettings>) => void;
  // 系统设置
  updateSystemSettings: (patch: Partial<SystemSettings>) => void;
  // ComfyUI 配置
  updateComfyuiConfig: (patch: Partial<ComfyUIConfig>) => void;
  addRunninghubApp: (app: RunningHubApp) => void;
  removeRunninghubApp: (id: string) => void;
  addRunninghubWorkflow: (workflow: RunningHubWorkflow) => void;
  removeRunninghubWorkflow: (id: string) => void;
  /** 导出：返回当前完整配置的 JSON 字符串 */
  exportSettingsJson: () => string;
  /** 导入（文件）：从 settings.json 读取并合并到 store，缺失字段用 defaults 填补 */
  importSettingsFromFile: (json: string) => void;
}

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (set, get: () => SettingsStore) => ({
      apiConfig: DEFAULT_API_CONFIG,
      projects: [DEFAULT_PROJECT],
      currentProjectId: DEFAULT_PROJECT.id,
      customNodeTemplates: [],
      globalTasks: [],
      canvasSettings: DEFAULT_CANVAS_SETTINGS,
      systemSettings: DEFAULT_SYSTEM_SETTINGS,
      comfyuiConfig: DEFAULT_COMFYUI_CONFIG,

      addChannel: (channel) =>
        set((s) => {
          syncSettingsToFs({ ...s, apiConfig: { ...s.apiConfig, channels: [...s.apiConfig.channels, channel] } } as SettingsState & SettingsActions);
          return {
            apiConfig: { ...s.apiConfig, channels: [...s.apiConfig.channels, channel] },
          };
        }),

      updateChannel: (id, patch) =>
        set((s) => {
          const next = { apiConfig: { ...s.apiConfig, channels: s.apiConfig.channels.map((c) => c.id === id ? { ...c, ...patch } : c) } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      removeChannel: (id) =>
        set((s) => {
          const next = { apiConfig: { ...s.apiConfig, channels: s.apiConfig.channels.filter((c) => c.id !== id) } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      setChannelId: (type, channelId) =>
        set((s) => {
          const key = type === 'image' ? 'imageChannelId' : type === 'video' ? 'videoChannelId' : type === 'text' ? 'textChannelId' : type === 'audio' ? 'audioChannelId' : 'model3DChannelId';
          const next = { apiConfig: { ...s.apiConfig, [key]: channelId } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      setModel: (type, value) =>
        set((s) => {
          const next = { apiConfig: { ...s.apiConfig, [type]: value } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      addModelEntry: (type, entry) =>
        set((s) => {
          const entries = s.apiConfig.modelEntries[type] ?? [];
          // 如果该类型还没有任何模型，设置第一个为默认
          const newEntry = entries.length === 0 ? { ...entry, isDefault: true } : entry;
          const next = {
            apiConfig: {
              ...s.apiConfig,
              modelEntries: {
                ...s.apiConfig.modelEntries,
                [type]: [...entries, newEntry],
              },
            },
          };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      removeModelEntry: (type, entryId) =>
        set((s) => {
          const entries = s.apiConfig.modelEntries[type] ?? [];
          const filtered = entries.filter((e) => e.id !== entryId);
          // 如果删除的是默认模型，且还有剩余模型，将第一个设为默认
          const newEntries = filtered.length > 0 && !filtered.some((e) => e.isDefault)
            ? filtered.map((e, i) => (i === 0 ? { ...e, isDefault: true } : e))
            : filtered;
          const next = {
            apiConfig: {
              ...s.apiConfig,
              modelEntries: {
                ...s.apiConfig.modelEntries,
                [type]: newEntries,
              },
            },
          };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      setDefaultModel: (type, entryId) =>
        set((s) => {
          const entries = s.apiConfig.modelEntries[type] ?? [];
          const next = {
            apiConfig: {
              ...s.apiConfig,
              modelEntries: {
                ...s.apiConfig.modelEntries,
                [type]: entries.map((e) => ({ ...e, isDefault: e.id === entryId })),
              },
            },
          };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      updateModelSpeed: (type, entryId, speed) =>
        set((s) => {
          const entries = s.apiConfig.modelEntries[type] ?? [];
          const next = {
            apiConfig: {
              ...s.apiConfig,
              modelEntries: {
                ...s.apiConfig.modelEntries,
                [type]: entries.map((e) => (e.id === entryId ? { ...e, speed } : e)),
              },
            },
          };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      addModelEntries: (type, newEntries) =>
        set((s) => {
          const existing = s.apiConfig.modelEntries[type] ?? [];
          // 合并：如果同名模型已存在则跳过
          const existingNames = new Set(existing.map((e) => `${e.provider}-${e.name}`));
          const filtered = newEntries.filter((e) => !existingNames.has(`${e.provider}-${e.name}`));
          const merged = [...existing, ...filtered];
          // 如果该类型还没有任何模型，将第一个设为默认
          const finalEntries = existing.length === 0 && merged.length > 0
            ? merged.map((e, i) => (i === 0 ? { ...e, isDefault: true } : e))
            : merged;
          const next = {
            apiConfig: {
              ...s.apiConfig,
              modelEntries: {
                ...s.apiConfig.modelEntries,
                [type]: finalEntries,
              },
            },
          };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

  addProject: (name) =>
    set((s) => {
      const id = Date.now().toString();
      const next = { projects: [...s.projects, { id, name }] };
      syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
      return next;
    }),

  removeProject: (id) =>
    set((s) => {
      const next = {
        projects: s.projects.length <= 1 ? s.projects : s.projects.filter((p) => p.id !== id),
        currentProjectId: s.currentProjectId === id ? (s.projects.find((p) => p.id !== id) ?? s.projects[0]!).id : s.currentProjectId,
      };
      syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
      return next;
    }),

  renameProject: async (id, name) => {
    // 先拿到旧名称，以便重命名文件夹
    const oldProject = useSettingsStore.getState().projects.find((p) => p.id === id);
    const oldName = oldProject?.name ?? '';
    const safeNewName = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim();

    // 文件系统层重命名（如果旧目录存在的话）
    if (oldName && safeNewName && oldName !== safeNewName) {
      await fsManager.renameProjectDirectory(oldName, safeNewName);
    }

    set((s) => {
      const next = { projects: s.projects.map((p) => (p.id === id ? { ...p, name: safeNewName } : p)) };
      syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
      return next;
    });
  },

  /** 从 .xshow 文件导入项目：创建新项目 + 切换到该项目的画布 */
  importProjectFromFile: async (projectFile: import('@/types').XShowWorkflowFile): Promise<{ projectId: string; warnings: string[] }> => {
    const newId = Date.now().toString();
    const newProject: Project = { id: newId, name: projectFile.name || '导入项目' };
    set((s) => ({
      projects: [...s.projects, newProject],
    }));
    // 直接加载画布数据（避免 IndexedDB 异步竞态）
    useFlowStore.getState().loadProject(projectFile.nodes as never, projectFile.edges as never);
    // 保存到 IndexedDB（持久化备份）
    await saveCanvasState(newId, projectFile.nodes as never, projectFile.edges as never);
    // 切换到新项目（不影响已在内存中的画布）
    set({ currentProjectId: newId });
    return { projectId: newId, warnings: [] };
  },

      setCurrentProject: (id) => set((s) => {
        const next = { currentProjectId: id };
        syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
        return next;
      }),

      addTemplate: (template) =>
        set((s) => ({
          customNodeTemplates: [...s.customNodeTemplates, template],
        })),

      removeTemplate: (id) =>
        set((s) => ({
          customNodeTemplates: s.customNodeTemplates.filter((t) => t.id !== id),
        })),

      addGlobalTask: (task) =>
        set((s) => ({
          globalTasks: [...s.globalTasks, task],
        })),

      updateGlobalTask: (id, patch) =>
        set((s) => ({
          globalTasks: s.globalTasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      removeGlobalTask: (id) =>
        set((s) => ({
          globalTasks: s.globalTasks.filter((t) => t.id !== id),
        })),

      addPresetPrompt: (prompt) =>
        set((s) => ({
          apiConfig: { ...s.apiConfig, presetPrompts: [...s.apiConfig.presetPrompts, prompt] },
        })),

      removePresetPrompt: (index) =>
        set((s) => ({
          apiConfig: {
            ...s.apiConfig,
            presetPrompts: s.apiConfig.presetPrompts.filter((_, i) => i !== index),
          },
        })),

      updatePresetPrompt: (index, patch) =>
        set((s) => ({
          apiConfig: {
            ...s.apiConfig,
            presetPrompts: s.apiConfig.presetPrompts.map((p, i) =>
              i === index ? { ...p, ...patch } : p
            ),
          },
        })),

      updateCanvasSettings: (patch) =>
        set((s) => {
          const next = { canvasSettings: { ...s.canvasSettings, ...patch } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      updateSystemSettings: (patch) =>
        set((s) => {
          const next = { systemSettings: { ...s.systemSettings, ...patch } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      updateComfyuiConfig: (patch) =>
        set((s) => {
          const next = { comfyuiConfig: { ...s.comfyuiConfig, ...patch } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      addRunninghubApp: (app) =>
        set((s) => {
          const next = { comfyuiConfig: { ...s.comfyuiConfig, runninghubApps: [...s.comfyuiConfig.runninghubApps, app] } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      removeRunninghubApp: (id) =>
        set((s) => {
          const next = { comfyuiConfig: { ...s.comfyuiConfig, runninghubApps: s.comfyuiConfig.runninghubApps.filter((a) => a.id !== id) } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      addRunninghubWorkflow: (workflow: RunningHubWorkflow) =>
        set((s) => {
          const next = { comfyuiConfig: { ...s.comfyuiConfig, runninghubWorkflows: [...s.comfyuiConfig.runninghubWorkflows, workflow] } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      removeRunninghubWorkflow: (id: string) =>
        set((s) => {
          const next = { comfyuiConfig: { ...s.comfyuiConfig, runninghubWorkflows: s.comfyuiConfig.runninghubWorkflows.filter((w) => w.id !== id) } };
          syncSettingsToFs({ ...s, ...next } as SettingsState & SettingsActions);
          return next;
        }),

      exportSettingsJson: () => {
        // 使用 zustand 提供的 get() 获取当前 state，避免循环引用
        return serializeSettingsState(get());
      },

      importSettingsFromFile: (json: string) => {
        try {
          const parsed = JSON.parse(json);

          // Zustand persist 序列化格式：{ state: { ... }, version: number }
          // 直接导出格式（旧版或手动导出）：{ apiConfig: {}, canvasSettings: {}, ... }
          // 统一从 state 字段读取，如果直接是顶层则 fallback
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = (parsed as any).state ?? parsed;
          // 剥除元数据字段（文件写入时混入的）
          delete data._savedAt;

          // 深层合并：用 defaults 填补缺失字段（兼容旧版本备份）
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mergedApiConfig = deepMerge(DEFAULT_API_CONFIG as any, data.apiConfig ?? {});
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mergedCanvasSettings = deepMerge(DEFAULT_CANVAS_SETTINGS as any, data.canvasSettings ?? {});
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mergedSystemSettings = deepMerge(DEFAULT_SYSTEM_SETTINGS as any, data.systemSettings ?? {});
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mergedComfyuiConfig = deepMerge(DEFAULT_COMFYUI_CONFIG as any, data.comfyuiConfig ?? {});

          // 只导入用户配置数据，不导入瞬态状态（如 currentProjectId）
          set({
            apiConfig: mergedApiConfig,
            projects: data.projects ?? useSettingsStore.getState().projects,
            canvasSettings: mergedCanvasSettings,
            systemSettings: mergedSystemSettings,
            comfyuiConfig: mergedComfyuiConfig,
            customNodeTemplates: Array.isArray(data.customNodeTemplates)
              ? data.customNodeTemplates
              : [],
            globalTasks: Array.isArray(data.globalTasks)
              ? data.globalTasks
              : [],
          });
        } catch (err) {
          console.error('[SettingsStore] Failed to import settings from file:', err);
        }
      },

      importSettingsJson: (json: string) => {
        localStorage.setItem('xshow-settings', json);
        // 重新加载页面以触发 Zustand persist 重新读取 localStorage
        window.location.reload();
      },
    }),
    {
      name: 'xshow-settings',
      storage: createPersistStorage(),
    }
  )
);