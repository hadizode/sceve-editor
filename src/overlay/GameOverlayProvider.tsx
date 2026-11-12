import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';
import type { GameOverlayContextValue, OverlayConfig } from './types';

/**
 * Context holding the current overlay state. Consume it through `useGameOverlay()`
 * (public API) or `useOverlayConfig()` (used by the overlay panel itself).
 */
export const GameOverlayContext = createContext<GameOverlayContextValue | null>(null);

/** Internal context carrying the active `OverlayConfig` to `<GameOverlay />`. */
export const OverlayConfigContext = createContext<OverlayConfig | null>(null);

interface GameOverlayProviderProps {
  children: ReactNode;
}

/**
 * Wrap your game (or the whole app) with this provider so any interactive item
 * can open the number-pad overlay via `useGameOverlay().open(config)` —
 * no prop drilling required. Render `<GameOverlay />` once inside the provider.
 */
export function GameOverlayProvider({ children }: GameOverlayProviderProps) {
  const [config, setConfig] = useState<OverlayConfig | null>(null);

  const open = useCallback((next: OverlayConfig) => {
    setConfig(next);
  }, []);

  const close = useCallback(() => {
    setConfig(null);
  }, []);

  const value = useMemo<GameOverlayContextValue>(
    () => ({ open, close, isOpen: config !== null }),
    [open, close, config],
  );

  return (
    <GameOverlayContext.Provider value={value}>
      <OverlayConfigContext.Provider value={config}>
        {children}
      </OverlayConfigContext.Provider>
    </GameOverlayContext.Provider>
  );
}
