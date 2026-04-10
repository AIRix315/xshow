// Ref: §3.2 + §6.14 — 资源中转站 Zustand store
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TransitResource } from '@/types';

function createChromeStorage(): Storage | undefined {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const storage = {
      getItem: (name: string): string | null => {
        let result: string | null = null;
        try {
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

interface TransitState {
  resources: TransitResource[];
}

interface TransitActions {
  addResource: (resource: TransitResource) => void;
  removeResource: (id: string) => void;
  toggleFavorite: (id: string) => void;
  clearNonFavorites: () => void;
}

type TransitStore = TransitState & TransitActions;

export const useTransitResources = create<TransitStore>()(
  persist(
    (set) => ({
      resources: [],

      addResource: (resource) =>
        set((s) => ({
          resources: [resource, ...s.resources.filter((r) => r.id !== resource.id)],
        })),

      removeResource: (id) =>
        set((s) => ({
          resources: s.resources.filter((r) => r.id !== id),
        })),

      toggleFavorite: (id) =>
        set((s) => ({
          resources: s.resources.map((r) =>
            r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
          ),
        })),

      clearNonFavorites: () =>
        set((s) => ({
          resources: s.resources.filter((r) => r.isFavorite === true),
        })),
    }),
    {
      name: 'xshow-transit-resources',
      storage: createJSONStorage(() => createChromeStorage() ?? localStorage),
    }
  )
);