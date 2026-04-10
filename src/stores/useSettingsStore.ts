// Ref: Zustand v5 persist + flowcraft lib/store/
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  DEFAULT_API_CONFIG,
  DEFAULT_PROJECT,
} from '@/types';
import type {
  ApiConfig,
  ChannelConfig,
  Project,
  CustomNodeTemplate,
  GlobalTask,
  PresetPrompt,
} from '@/types';

// Chrome storage.local adapter
function createChromeStorage(): Storage | undefined {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const storage = {
      getItem: (name: string): string | null => {
        let result: string | null = null;
        try {
          // Synchronous fallback — persist middleware uses async getStorage
          chrome.storage.local.get(name, (r) => { result = r[name] ?? null; });
        } catch { /* fallback to localStorage */ }
        return result;
      },
      setItem: (name: string, value: string): void => {
        try {
          chrome.storage.local.set({ [name]: value });
        } catch { /* fallback */ }
      },
      removeItem: (name: string): void => {
        try {
          chrome.storage.local.remove(name);
        } catch { /* fallback */ }
      },
    };
    return storage as unknown as Storage;
  }
  return undefined;
}

interface SettingsState {
  apiConfig: ApiConfig;
  projects: Project[];
  currentProjectId: string;
  customNodeTemplates: CustomNodeTemplate[];
  globalTasks: GlobalTask[];
}

interface SettingsActions {
  addChannel: (channel: ChannelConfig) => void;
  updateChannel: (id: string, patch: Partial<ChannelConfig>) => void;
  removeChannel: (id: string) => void;
  setChannelId: (type: 'image' | 'video' | 'text' | 'audio', channelId: string) => void;
  setModel: (type: 'drawingModel' | 'videoModel' | 'textModel' | 'audioModel' | 'ttsVoice' | 'videoDurations', value: string) => void;
  addProject: (name: string) => void;
  removeProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  setCurrentProject: (id: string) => void;
  addTemplate: (template: CustomNodeTemplate) => void;
  removeTemplate: (id: string) => void;
  addGlobalTask: (task: GlobalTask) => void;
  updateGlobalTask: (id: string, patch: Partial<GlobalTask>) => void;
  removeGlobalTask: (id: string) => void;
  addPresetPrompt: (prompt: PresetPrompt) => void;
  removePresetPrompt: (index: number) => void;
  updatePresetPrompt: (index: number, patch: Partial<PresetPrompt>) => void;
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
    }),
    {
      name: 'xshow-settings',
      storage: createJSONStorage(() => createChromeStorage() ?? localStorage),
    }
  )
);