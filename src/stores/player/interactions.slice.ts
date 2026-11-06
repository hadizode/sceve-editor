// ============ Player slice: object interactions ============
// clickObject / pickupObject / useItemOnObject — delegates pure rules to shared/game.
import type { StateCreator } from 'zustand';
import { discoverObject, isRoomComplete, applyItemToObject, pickupObject } from '../../shared/game';
import type { PlayerState } from './state';

export interface InteractionsSlice {
  clickObject: (objectId: string) => void;
  useItemOnObject: (itemId: string, objectId: string) => void;
  pickupObject: (objectId: string) => void;
}

export const createInteractionsSlice: StateCreator<PlayerState, [], [], InteractionsSlice> =
  (set, get) => ({
    clickObject: (objectId) => {
      const { sessionState, currentSceneId, scenes, session } = get();
      const scene = scenes[currentSceneId];
      if (!scene || !session) return;

      const result = discoverObject(sessionState, currentSceneId, objectId, scene.objects);

      if (result.alreadyDiscovered) {
        set({ toast: 'Already discovered' });
        setTimeout(() => set({ toast: null }), 4000);
        return;
      }

      if (result.message) {
        set({ toast: result.message });
        setTimeout(() => set({ toast: null }), 7000);
      }

      let newState = result.newState;

      // Check room completion
      const updatedScene = { ...scene };
      if (isRoomComplete(newState, updatedScene)) {
        if (!newState.completedScenes.includes(currentSceneId)) {
          newState = {
            ...newState,
            completedScenes: [...newState.completedScenes, currentSceneId],
          };
          set({ toast: `🎉 Room "${scene.title}" complete! Digit: ${scene.exitNumber}` });
          setTimeout(() => set({ toast: null }), 6000);
        }
      }

      set(state => ({
        sessionState: newState,
        session: state.session ? { ...state.session, state: newState } : null,
      }));

      // Save to localStorage
      try {
        localStorage.setItem('escape-room-state', JSON.stringify(newState));
      } catch {}
    },

    useItemOnObject: (itemId, objectId) => {
      const { sessionState, currentSceneId, scenes, session } = get();
      const scene = scenes[currentSceneId];
      if (!scene || !session) return;

      const result = applyItemToObject(sessionState, currentSceneId, objectId, itemId, scene.objects);

      if (result.success) {
        // If transformed, update the object in the scene
        if (result.transformed && result.newObjectState) {
          const updatedScene = {
            ...scene,
            objects: scene.objects.map(o =>
              o.id === objectId ? { ...o, ...result.newObjectState } : o
            ),
          };
          set(state => ({
            sessionState: result.newState,
            selectedItem: null,
            toast: result.message,
            session: state.session ? { ...state.session, state: result.newState } : null,
            scenes: { ...state.scenes, [currentSceneId]: updatedScene },
          }));
        } else {
          set(state => ({
            sessionState: result.newState,
            selectedItem: null,
            toast: result.message,
            session: state.session ? { ...state.session, state: result.newState } : null,
          }));
        }
        setTimeout(() => set({ toast: null }), 6000);
      } else {
        set({ toast: result.message });
        setTimeout(() => set({ toast: null }), 4000);
      }
    },

    pickupObject: (objectId) => {
      const { sessionState, currentSceneId, scenes, session } = get();
      const scene = scenes[currentSceneId];
      if (!scene || !session) return;

      const result = pickupObject(sessionState, currentSceneId, objectId, scene.objects);

      if (result.success) {
        set(state => ({
          sessionState: result.newState,
          toast: result.message,
          session: state.session ? { ...state.session, state: result.newState } : null,
        }));
        setTimeout(() => set({ toast: null }), 5000);
      } else {
        set({ toast: result.message });
        setTimeout(() => set({ toast: null }), 3000);
      }
    },
  });
