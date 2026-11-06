// ============ Player Store — merges all slices (zustand slice pattern) ============
import { create } from 'zustand';
import type { PlayerState } from './state';
import { createSessionSlice } from './session.slice';
import { createInteractionsSlice } from './interactions.slice';
import { createLockSlice } from './lock.slice';
import { createUiSlice } from './ui.slice';

const initialState: Pick<
  PlayerState,
  | 'session' | 'scenes' | 'currentSceneId' | 'sessionState'
  | 'toast' | 'selectedItem' | 'gameStarted' | 'gameComplete' | 'lockInput'
> = {
  session: null,
  scenes: {},
  currentSceneId: '',
  sessionState: {
    currentSceneId: '',
    discoveredObjects: {},
    inventory: [],
    completedScenes: [],
  },
  toast: null,
  selectedItem: null,
  gameStarted: false,
  gameComplete: false,
  lockInput: '',
};

export const usePlayerStore = create<PlayerState>()((...a) => ({
  ...initialState,
  ...createSessionSlice(...a),
  ...createInteractionsSlice(...a),
  ...createLockSlice(...a),
  ...createUiSlice(...a),
}));

export type { PlayerState };
