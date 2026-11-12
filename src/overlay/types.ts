/** Shared types for the interactive game Overlay system. */

export type OverlayMode = 'unlock' | 'roll';

export interface OverlayConfig {
  /** `unlock` → multi-digit PIN entry; `roll` → single-digit press resolves immediately. */
  mode: OverlayMode;
  /** Id of the game item that opened the overlay (lock, pencil, dice, chest…). */
  itemId: string;
  title?: string;
  /** Max digits accepted. Defaults: unlock = 4, roll = 1. */
  maxDigits?: number;
  /** Expected code — only meaningful in `unlock` mode. */
  correctCode?: string;
  onSuccess?: (value: string) => void;
  onFailure?: (value: string) => void;
}

export interface GameOverlayContextValue {
  open: (config: OverlayConfig) => void;
  close: () => void;
  isOpen: boolean;
}

/** Default digit limits per mode. */
export function defaultMaxDigits(mode: OverlayMode): number {
  return mode === 'roll' ? 1 : 4;
}
