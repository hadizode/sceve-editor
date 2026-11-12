import { useContext } from 'react';
import { GameOverlayContext, OverlayConfigContext } from './GameOverlayProvider';
import type { GameOverlayContextValue, OverlayConfig } from './types';

/**
 * Public hook for game items: opens/closes the number-pad overlay.
 *
 * ```tsx
 * const { open } = useGameOverlay();
 * open({ mode: 'unlock', itemId: 'lock-1', correctCode: '4821' });
 * ```
 */
export function useGameOverlay(): GameOverlayContextValue {
  const ctx = useContext(GameOverlayContext);
  if (!ctx) {
    throw new Error('useGameOverlay must be used within a <GameOverlayProvider>.');
  }
  return ctx;
}

/** Internal hook used by `<GameOverlay />` to read the active config. */
export function useOverlayConfig(): OverlayConfig | null {
  return useContext(OverlayConfigContext);
}
