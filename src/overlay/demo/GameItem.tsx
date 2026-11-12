import type { ReactNode } from 'react';
import { useGameOverlay } from '../useGameOverlay';

export interface GameItemProps {
  /** Unique id of the interactive item, e.g. `'lock-1'`. */
  itemId: string;
  emoji: string;
  label: string;
  /** Interaction kind wired to an overlay mode. */
  action:
    | { kind: 'unlock'; title?: string; correctCode: string; maxDigits?: number }
    | { kind: 'roll'; title?: string };
  onSuccess: (value: string) => void;
  onFailure?: (value: string) => void;
  /** Optional status line rendered under the item (e.g. last roll result). */
  children?: ReactNode;
}

/**
 * Sample interactive game item. Clicking it opens the number-pad overlay via
 * `useGameOverlay()` — no props threaded through the game tree.
 */
export function GameItem({ itemId, emoji, label, action, onSuccess, onFailure, children }: GameItemProps) {
  const { open } = useGameOverlay();

  const handleClick = () => {
    if (action.kind === 'unlock') {
      open({
        mode: 'unlock',
        itemId,
        title: action.title ?? `Unlock the ${label.toLowerCase()}`,
        maxDigits: action.maxDigits,
        correctCode: action.correctCode,
        onSuccess,
        onFailure,
      });
    } else {
      open({
        mode: 'roll',
        itemId,
        title: action.title ?? `Roll for the ${label.toLowerCase()}`,
        onSuccess,
      });
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`${action.kind === 'unlock' ? 'Unlock' : 'Roll'} — ${label}`}
      className="flex w-36 flex-col items-center gap-2 rounded-2xl border-2 border-slate-700 bg-slate-800 p-4 text-white transition-all hover:-translate-y-1 hover:border-indigo-400 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
    >
      <span className="text-5xl leading-none" aria-hidden="true">
        {emoji}
      </span>
      <span className="text-sm font-bold">{label}</span>
      <span className="text-[11px] uppercase tracking-wider text-slate-400">
        {action.kind === 'unlock' ? '🔒 Code lock' : '🎲 Roll 1–9'}
      </span>
      {children && <span className="text-xs font-semibold text-amber-300">{children}</span>}
    </button>
  );
}
