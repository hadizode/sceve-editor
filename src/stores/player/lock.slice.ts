// ============ Player slice: final lock keypad ============
import type { StateCreator } from 'zustand';
import type { PlayerState } from './state';

export interface LockSlice {
  enterLockDigit: (d: string) => void;
  clearLockDigit: () => void;
  submitLock: () => void;
}

export const createLockSlice: StateCreator<PlayerState, [], [], LockSlice> =
  (set, get) => ({
    enterLockDigit: (d) => {
      const { lockInput } = get();
      if (lockInput.length < 10) {
        set({ lockInput: lockInput + d });
      }
    },

    clearLockDigit: () => {
      const { lockInput } = get();
      set({ lockInput: lockInput.slice(0, -1) });
    },

    submitLock: () => {
      const { scenes, lockInput } = get();
      const allScenes = Object.values(scenes);
      const expected = allScenes.map(s => s.exitNumber.toString()).join('');

      if (lockInput === expected) {
        set({ gameComplete: true, toast: '🎊 Congratulations! You won!' });
      } else {
        set({ lockInput: '', toast: '❌ Wrong code. Try again.' });
        setTimeout(() => set({ toast: null }), 5000);
      }
    },
  });
