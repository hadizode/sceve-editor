// ============ Studio slice: camera & grid settings ============
import type { StateCreator } from 'zustand';
import type { StudioState } from './state';

export interface ViewSlice {
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  toggleGrid: () => void;
  setGridSize: (s: number) => void;
  toggleSnap: () => void;
}

export const createViewSlice: StateCreator<StudioState, [], [], ViewSlice> =
  (set) => ({
    setZoom: (z) => set({ zoom: Math.max(0.25, Math.min(3, z)) }),
    setPan: (x, y) => set({ panX: x, panY: y }),
    toggleGrid: () => set(state => ({ showGrid: !state.showGrid })),
    setGridSize: (s) => set({ gridSize: s }),
    toggleSnap: () => set(state => ({ snapToGrid: !state.snapToGrid })),
  });
