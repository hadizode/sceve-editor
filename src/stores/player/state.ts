// ============ Player Store — state shape & actions ============
import type { Scene, Session, SessionState } from '../../shared/types';

export interface PlayerState {
  session: Session | null;
  scenes: Record<string, Scene>;
  currentSceneId: string;
  sessionState: SessionState;
  toast: string | null;
  selectedItem: string | null;
  gameStarted: boolean;
  gameComplete: boolean;
  lockInput: string;
  /** Num pad overlay state */
  numpadOpen: boolean;
  numpadObjectId: string | null;
  // Actions
  initSession: (session: Session, scenes: Record<string, Scene>) => void;
  clickObject: (objectId: string) => void;
  useItemOnObject: (itemId: string, objectId: string) => void;
  pickupObject: (objectId: string) => void;
  selectItem: (itemId: string | null) => void;
  openNumpad: (objectId: string) => void;
  closeNumpad: () => void;
  setToast: (msg: string | null) => void;
  startGame: () => void;
  setPlayerReady: () => void;
  enterLockDigit: (d: string) => void;
  clearLockDigit: () => void;
  submitLock: () => void;
  switchScene: (sceneId: string) => void;
}
