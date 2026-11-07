// ============ Player slice: session lifecycle & navigation ============
import type { StateCreator } from 'zustand';
import type { Scene, Session } from '../../shared/types';
import type { PlayerState } from './state';

export interface SessionSlice {
  initSession: (session: Session, scenes: Record<string, Scene>) => void;
  startGame: () => void;
  setPlayerReady: () => void;
  switchScene: (sceneId: string) => void;
}

export const createSessionSlice: StateCreator<PlayerState, [], [], SessionSlice> =
  (set, get) => ({
    initSession: (session, scenes) => {
      set({
        session,
        scenes,
        currentSceneId: session.state.currentSceneId,
        sessionState: session.state,
      });
    },

    startGame: () => set({ gameStarted: true }),

    setPlayerReady: () => {
      const { session } = get();
      if (!session) return;
      const updatedPlayers = session.players.map(p =>
        p.telegramId === 'user-1' ? { ...p, ready: true } : p
      );
      set(state => ({
        session: state.session ? { ...state.session, players: updatedPlayers } : null,
      }));
    },

    switchScene: (sceneId) => {
      set({ currentSceneId: sceneId, selectedItem: null });
    },
  });
