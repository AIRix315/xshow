// Ref: §3.2 + §6.14 — 资源中转站 Zustand store + 双层持久化
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TransitResource } from '@/types';
import { createPersistStorage } from '@/utils/chromeStorage';

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
      storage: createPersistStorage(),
    }
  )
);