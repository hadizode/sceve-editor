// ============ Studio slice: objects & selection ============
import type { StateCreator } from 'zustand';
import type { SceneObject } from '../../shared/types';
import type { StudioState } from './state';

export interface ObjectsSlice {
  addObject: (obj: SceneObject) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  deleteObject: (id: string) => void;
  selectObject: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
}

export const createObjectsSlice: StateCreator<StudioState, [], [], ObjectsSlice> =
  (set, get) => ({
    addObject: (obj) => {
      const { currentSceneId, scenes } = get();
      if (!currentSceneId) return;
      const scene = scenes[currentSceneId];
      const updatedScene = { ...scene, objects: [...scene.objects, obj] };
      set(state => ({ scenes: { ...state.scenes, [currentSceneId]: updatedScene } }));
    },

    updateObject: (id, updates) => {
      const { currentSceneId, scenes } = get();
      if (!currentSceneId) return;
      const scene = scenes[currentSceneId];
      const updatedScene = {
        ...scene,
        objects: scene.objects.map(o => o.id === id ? { ...o, ...updates } : o),
      };
      set(state => ({ scenes: { ...state.scenes, [currentSceneId]: updatedScene } }));
    },

    deleteObject: (id) => {
      const { currentSceneId, scenes } = get();
      if (!currentSceneId) return;
      const scene = scenes[currentSceneId];
      const updatedScene = {
        ...scene,
        objects: scene.objects.filter(o => o.id !== id),
        clueChain: scene.clueChain.filter(cid => cid !== id),
      };
      set(state => ({
        scenes: { ...state.scenes, [currentSceneId]: updatedScene },
        selectedObjectIds: state.selectedObjectIds.filter(sid => sid !== id),
      }));
    },

    selectObject: (id, multi = false) => {
      if (multi) {
        set(state => ({
          selectedObjectIds: state.selectedObjectIds.includes(id)
            ? state.selectedObjectIds.filter(sid => sid !== id)
            : [...state.selectedObjectIds, id],
        }));
      } else {
        set({ selectedObjectIds: [id] });
      }
    },

    clearSelection: () => set({ selectedObjectIds: [] }),
  });
