import React from 'react';
import { Button } from '@telegram-apps/telegram-ui';
import { useCompact } from '../player/useCompact';

/** Presentational key grid shared by the Studio preview and the Player num pad. */
export interface NumPadKeysProps {
  min: number;
  max: number;
  /** Currently selected number string (pick mode) or null. */
  selected: string | null;
  onPress: (n: string) => void;
  /** Key size in px. */
  size: number;
  /** Kept for caller compatibility; no longer applied to the rendering. */
  font: string;
  /** Kept for caller compatibility; no longer applied to the rendering. */
  color: string;
  /** Kept for caller compatibility; no longer applied to the rendering. */
  bg: string;
}

export function NumPadKeys({
  min,
  max,
  selected,
  onPress,
}: NumPadKeysProps) {
  const count = Math.max(0, max - min + 1);
  const compact = useCompact();

  return (
    <div
      className={
        compact
          ? 'flex gap-1 overflow-x-auto w-full min-w-[1px]'
          : 'flex flex-wrap gap-1 w-full min-w-[1px]'
      }
    >
      {[...Array(count).keys()].map((i) => {
        const n = min + i;
        const s = String(n);
        const active = selected === s;
        return (
          <Button
            key={n}
            size="s"
            mode={active ? 'filled' : 'gray'}
            className={compact ? 'shrink-0' : 'min-w-[32px]'}
            title={`عدد ${n}`}
            onClick={() => onPress(s)}
          >
            {s}
          </Button>
        );
      })}
    </div>
  );
}
