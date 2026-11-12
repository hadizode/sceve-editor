import { useState } from 'react';
import type { OverlayMode } from './types';

interface NumberPadProps {
  mode: OverlayMode;
  /** Current entered value (controlled by <GameOverlay />). */
  value: string;
  maxDigits: number;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onSubmit: () => void;
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/**
 * A 1–9 number pad with PIN-style dot display. Keys are real buttons so they
 * stay focusable/clickable; physical keyboard input is handled by the parent
 * overlay (`GameOverlay`) via a window `keydown` listener.
 */
export function NumberPad({ mode, value, maxDigits, onDigit, onBackspace, onSubmit }: NumberPadProps) {
  const [focusedKey, setFocusedKey] = useState<string | null>(null);

  const canSubmit = mode === 'unlock' && value.length > 0;

  return (
    <div dir="ltr" className="flex flex-col items-center gap-4 select-none">
      {/* PIN dots */}
      <div
        className="flex items-center justify-center gap-3 py-2"
        role="status"
        aria-label={value ? `${value.length} of ${maxDigits} digits entered` : 'No digits entered'}
      >
        {Array.from({ length: maxDigits }, (_, i) => {
          const filled = i < value.length;
          return (
            <span
              key={i}
              aria-hidden="true"
              className={
                'block h-4 w-4 rounded-full border-2 transition-colors duration-150 ' +
                (filled
                  ? 'border-amber-300 bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.7)]'
                  : 'border-slate-500 bg-transparent')
              }
            />
          );
        })}
      </div>

      {/* 1–9 keys + controls */}
      <div className="grid grid-cols-3 gap-3">
        {DIGITS.map((d) => (
          <button
            key={d}
            type="button"
            aria-label={`Digit ${d}`}
            onClick={() => onDigit(d)}
            onFocus={() => setFocusedKey(d)}
            onBlur={() => setFocusedKey(null)}
            className={
              'h-16 w-16 rounded-xl border-2 text-2xl font-bold text-white transition-all duration-100 ' +
              'active:scale-95 active:bg-indigo-500 ' +
              (focusedKey === d
                ? 'border-indigo-400 bg-slate-700 outline outline-1 outline-indigo-300'
                : 'border-slate-600 bg-slate-800 hover:bg-slate-700')
            }
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Backspace"
          onClick={onBackspace}
          disabled={value.length === 0}
          className="h-12 w-24 rounded-xl border-2 border-slate-600 bg-slate-800 text-sm font-semibold text-slate-200 hover:bg-slate-700 active:scale-95 disabled:opacity-40"
        >
          ⌫ Del
        </button>
        {mode === 'unlock' && (
          <button
            type="button"
            aria-label="Submit code"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="h-12 w-24 rounded-xl border-2 border-emerald-500 bg-emerald-600 text-sm font-bold text-white hover:bg-emerald-500 active:scale-95 disabled:opacity-40"
          >
            Enter ↵
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400" dir="ltr">
        {mode === 'roll'
          ? 'Press a number 1–9 to roll'
          : `Enter ${maxDigits}-digit code — or use your keyboard`}
      </p>
    </div>
  );
}
