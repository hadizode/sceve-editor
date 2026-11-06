// ============ Player slice: toast & item selection ============
import type { StateCreator } from 'zustand';
import type { PlayerState } from './state';

/** Show a toast message for `ms` milliseconds, then clear it. */
export function toastFor(set: (partial: Partial<PlayerState>) => void, msg: string | null, ms: number) {
  set({ toast: msg });
  setTimeout(() => set({ toast: null }), ms);
}

export interface UiSlice {
  selectItem: (itemId: string | null) => void;
  setToast: (msg: string | null) => void;
}

export const createUiSlice: StateCreator<PlayerState, [], [], UiSlice> =
  (set) => ({
    selectItem: (itemId) => set({ selectedItem: itemId }),
    setToast: (msg) => set({ toast: msg }),
  });
