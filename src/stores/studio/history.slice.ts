// ============ Studio slice: undo/redo history ============
import type { StateCreator } from 'zustand';
import type { Scene } from '../../shared/types';
import type { StudioState } from './state';

export interface HistorySlice {
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

export const createHistorySlice: StateCreator<StudioState, [], [], HistorySlice> =
  (set, get) => ({
    pushUndo: () => {
      const { currentSceneId, scenes, undoStack } = get();
      if (!currentSceneId) return;
      set({
        undoStack: [...undoStack.slice(-20), JSON.parse(JSON.stringify(scenes[currentSceneId]))],
        redoStack: [],
      });
    },

    undo: () => {
      const { undoStack, currentSceneId, scenes, redoStack } = get();
      if (undoStack.length === 0 || !currentSceneId) return;
      const prev = undoStack[undoStack.length - 1];
      const saved = JSON.parse(JSON.stringify(scenes[currentSceneId]));
      const newScenes = { ...scenes } as Record<string, Scene>;
      newScenes[currentSceneId] = prev;
      set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, saved], scenes: newScenes });
    },

    redo: () => {
      const { redoStack, currentSceneId, scenes, undoStack } = get();
      if (redoStack.length === 0 || !currentSceneId) return;
      const next = redoStack[redoStack.length - 1];
      const saved = JSON.parse(JSON.stringify(scenes[currentSceneId]));
      const newScenes = { ...scenes } as Record<string, Scene>;
      newScenes[currentSceneId] = next;
      set({ redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, saved], scenes: newScenes });
    },
  });
