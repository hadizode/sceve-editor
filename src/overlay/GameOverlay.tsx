import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NumberPad } from './NumberPad';
import { useGameOverlay, useOverlayConfig } from './useGameOverlay';
import { defaultMaxDigits, type OverlayConfig } from './types';

/**
 * The modal overlay itself. Render it exactly once inside `<GameOverlayProvider>`:
 *
 * ```tsx
 * <GameOverlayProvider>
 *   <YourGame />
 *   <GameOverlay />
 * </GameOverlayProvider>
 * ```
 *
 * Behaviour:
 * - `unlock`: collects up to `maxDigits` (default 4). Enter/Submit compares with
 *   `correctCode`; match → `onSuccess`, mismatch → shake animation + clear + `onFailure`.
 * - `roll`: the first digit press (1–9) immediately calls `onSuccess(value)` and closes.
 * - Physical keyboard: 1–9 digits, Backspace, Enter (submit), Escape (close).
 * - Clicking the backdrop closes; clicking inside the panel does not.
 */
export function GameOverlay() {
  const { close } = useGameOverlay();
  const config = useOverlayConfig();

  return config ? createPortal(<OverlayPanel key={config.itemId + config.mode} config={config} onClose={close} />, document.body) : null;
}

interface OverlayPanelProps {
  config: OverlayConfig;
  onClose: () => void;
}

function OverlayPanel({ config, onClose }: OverlayPanelProps) {
  const maxDigits = config.maxDigits ?? defaultMaxDigits(config.mode);
  const [value, setValue] = useState('');
  const [shaking, setShaking] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const shakeTimer = useRef<number | undefined>(undefined);

  // Reset input whenever a new item opens the overlay.
  useEffect(() => {
    setValue('');
    setShaking(false);
  }, [config]);

  useEffect(() => () => window.clearTimeout(shakeTimer.current), []);

  const triggerShake = useCallback(() => {
    setShaking(true);
    window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShaking(false), 500);
  }, []);

  const submitUnlock = useCallback(
    (current: string) => {
      if (current.length === 0) return;
      const correct = config.correctCode !== undefined && current === config.correctCode;
      if (correct) {
        config.onSuccess?.(current);
        onClose();
      } else {
        // Wrong code: shake, clear the dots, report failure. Keep overlay open.
        triggerShake();
        setValue('');
        config.onFailure?.(current);
      }
    },
    [config, onClose, triggerShake],
  );

  const handleDigit = useCallback(
    (digit: string) => {
      if (config.mode === 'roll') {
        // Single press resolves the roll immediately.
        config.onSuccess?.(digit);
        onClose();
        return;
      }
      setValue((prev) => {
        if (prev.length >= maxDigits) return prev;
        const next = prev + digit;
        // Auto-submit once the full code has been entered.
        if (next.length === maxDigits) {
          // Defer so state update stays side-effect free.
          window.setTimeout(() => submitUnlock(next), 0);
        }
        return next;
      });
    },
    [config, maxDigits, onClose, submitUnlock],
  );

  const handleBackspace = useCallback(() => {
    setValue((prev) => prev.slice(0, -1));
  }, []);

  const handleSubmit = useCallback(() => {
    if (config.mode === 'unlock') submitUnlock(value);
  }, [config.mode, submitUnlock, value]);

  // Physical keyboard support while the overlay is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDigit, handleBackspace, handleSubmit, onClose]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const title = config.title ?? (config.mode === 'roll' ? 'Make your roll' : 'Enter the code');

  return (
    <div
      dir="ltr"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 animate-fade-in"
      onMouseDown={onClose}
    >
      {/* Panel — stop propagation so clicks inside never hit the backdrop */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        className={
          'relative w-[320px] max-w-[92vw] rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-2xl outline-none ' +
          (shaking ? 'overlay-shake border-red-500/70' : '')
        }
      >
        <button
          type="button"
          aria-label="Close overlay"
          onClick={onClose}
          className="absolute left-3 top-3 h-8 w-8 rounded-lg text-lg leading-none text-slate-400 hover:bg-slate-700 hover:text-white"
        >
          ✕
        </button>

        <h2 className="mb-1 text-center text-lg font-bold text-white">{title}</h2>
        <p className="mb-4 text-center text-xs uppercase tracking-widest text-slate-400">
          {config.mode === 'roll' ? 'Roll mode' : shakableHint(config)}
        </p>

        <NumberPad
          mode={config.mode}
          value={value}
          maxDigits={maxDigits}
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}

function shakableHint(config: OverlayConfig): string {
  return config.correctCode !== undefined ? 'Unlock mode' : 'Code entry';
}
