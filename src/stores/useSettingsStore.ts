// Ref: Zustand v5 persist + flowcraft lib/store/ + §7.3 — 双层持久化
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_API_CONFIG,
  DEFAULT_PROJECT,
} from '@/types';
import { saveCanvasState } from '@/utils/canvasState';
import { useFlowStore } from '@/stores/useFlowStore';
import type {
  ApiConfig,
  ChannelConfig,
  Project,
  CustomNodeTemplate,
  GlobalTask,
  PresetPrompt,
  ComfyUIConfig,
  RunningHubApp,
} from '@/types';
import { createPersistStorage } from '@/utils/chromeStorage';

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
  setChannelId: (type: 'image' | 'video' | 'text' | 'audio', channelId: string) => void;
  setModel: (type: 'drawingModel' | 'videoModel' | 'textModel' | 'audioModel' | 'ttsVoice' | 'videoDurations' | 'comfyuiLocalWorkflows' | 'comfyuiCloudWorkflows' | 'comfyuiRunninghubWorkflows', value: string) => void;
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
  /** 导出：返回当前完整配置的 JSON 字符串 */
  exportSettingsJson: () => string;
  /** 导入：用导入的配置替换当前完整状态 */
  importSettingsJson: (json: string) => void;
}

type SettingsStore = SettingsState & SettingsActions;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      apiConfig: DEFAULT_API_CONFIG,
      projects: [DEFAULT_PROJECT],
      currentProjectId: DEFAULT_PROJECT.id,
      customNodeTemplates: [],
      globalTasks: [],
      canvasSettings: DEFAULT_CANVAS_SETTINGS,
      systemSettings: DEFAULT_SYSTEM_SETTINGS,
      comfyuiConfig: DEFAULT_COMFYUI_CONFIG,

      addChannel: (channel) =>
        set((s) => ({
          apiConfig: { ...s.apiConfig, channels: [...s.apiConfig.channels, channel] },
        })),

      updateChannel: (id, patch) =>
        set((s) => ({
          apiConfig: {
            ...s.apiConfig,
            channels: s.apiConfig.channels.map((c) =>
              c.id === id ? { ...c, ...patch } : c
            ),
          },
        })),

      removeChannel: (id) =>
        set((s) => ({
          apiConfig: {
            ...s.apiConfig,
            channels: s.apiConfig.channels.filter((c) => c.id !== id),
          },
        })),

      setChannelId: (type, channelId) =>
        set((s) => {
          const key =
            type === 'image' ? 'imageChannelId' :
            type === 'video' ? 'videoChannelId' :
            type === 'text' ? 'textChannelId' : 'audioChannelId';
          return { apiConfig: { ...s.apiConfig, [key]: channelId } };
        }),

      setModel: (type, value) =>
        set((s) => ({ apiConfig: { ...s.apiConfig, [type]: value } })),

  addProject: (name) =>
    set((s) => {
      const id = Date.now().toString();
      return { projects: [...s.projects, { id, name }] };
    }),

  removeProject: (id) =>
    set((s) => ({
      projects: s.projects.length <= 1 ? s.projects : s.projects.filter((p) => p.id !== id),
      currentProjectId: s.currentProjectId === id ? (s.projects.find((p) => p.id !== id) ?? s.projects[0]!).id : s.currentProjectId,
    })),

  renameProject: (id, name) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, name } : p)),
    })),

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

      setCurrentProject: (id) => set({ currentProjectId: id }),

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
        set((s) => ({
          canvasSettings: { ...s.canvasSettings, ...patch },
        })),

      updateSystemSettings: (patch) =>
        set((s) => ({
          systemSettings: { ...s.systemSettings, ...patch },
        })),

      updateComfyuiConfig: (patch) =>
        set((s) => ({
          comfyuiConfig: { ...s.comfyuiConfig, ...patch },
        })),

      addRunninghubApp: (app) =>
        set((s) => ({
          comfyuiConfig: {
            ...s.comfyuiConfig,
            runninghubApps: [...s.comfyuiConfig.runninghubApps, app],
          },
        })),

      removeRunninghubApp: (id) =>
        set((s) => ({
          comfyuiConfig: {
            ...s.comfyuiConfig,
            runninghubApps: s.comfyuiConfig.runninghubApps.filter((a) => a.id !== id),
          },
        })),

      exportSettingsJson: () => {
        const raw = localStorage.getItem('xshow-settings');
        return raw ?? '';
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