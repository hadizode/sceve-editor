import { useCallback, useState } from 'react';
import { GameItem } from '../demo/GameItem';
import { GameOverlay } from '../GameOverlay';
import { GameOverlayProvider } from '../GameOverlayProvider';

/**
 * Sample scene showing how interactive game items connect to the overlay
 * system. Mounted at the route `#/overlay-demo` (see App.tsx).
 */
export function OverlayDemo() {
  return (
    <GameOverlayProvider>
      <OverlayScene />
      {/* One overlay instance for the whole scene — items talk to it via context. */}
      <GameOverlay />
    </GameOverlayProvider>
  );
}

interface LogEntry {
  id: number;
  text: string;
  tone: 'ok' | 'fail' | 'info';
}

function OverlayScene() {
  const [lockUnlocked, setLockUnlocked] = useState(false);
  const [chestOpen, setChestOpen] = useState(false);
  const [pencilRoll, setPencilRoll] = useState<string | null>(null);
  const [diceRoll, setDiceRoll] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const pushLog = useCallback((text: string, tone: LogEntry['tone']) => {
    setLog((prev) => [{ id: Date.now() + Math.random(), text, tone }, ...prev].slice(0, 6));
  }, []);

  return (
    <div dir="ltr" className="mx-auto flex min-h-full max-w-3xl flex-col items-center gap-8 px-6 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-extrabold text-white">🎮 Interactive Overlay Demo</h1>
        <p className="mt-2 text-sm text-slate-400">
          Click an item to open the number pad. Keyboard:{' '}
          <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">1–9</kbd>{' '}
          <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">Backspace</kbd>{' '}
          <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">Enter</kbd>{' '}
          <kbd className="rounded bg-slate-700 px-1.5 py-0.5 text-xs">Esc</kbd>.{' '}
          Click outside the panel to close.
        </p>
      </header>

      <section className="flex flex-wrap items-start justify-center gap-5">
        {/* Lock → unlock mode, 4-digit code */}
        <GameItem
          itemId="lock-front-door"
          emoji={lockUnlocked ? '🔓' : '🔒'}
          label="Door Lock"
          action={{ kind: 'unlock', correctCode: '4821' }}
          onSuccess={(code) => {
            setLockUnlocked(true);
            pushLog(`Door lock opened with code ${code}.`, 'ok');
          }}
          onFailure={() => pushLog('Wrong code — the lock rattles.', 'fail')}
        >
          {lockUnlocked ? 'Unlocked ✓' : 'Code: 4821'}
        </GameItem>

        {/* Pencil → roll mode (single digit picks its tip size) */}
        <GameItem
          itemId="pencil-magic"
          emoji="✏️"
          label="Magic Pencil"
          action={{ kind: 'roll', title: 'Roll a pencil thickness' }}
          onSuccess={(value) => {
            setPencilRoll(value);
            pushLog(`Pencil rolled: ${value} mm tip.`, 'ok');
          }}
        >
          {pencilRoll ? `Last roll: ${pencilRoll}` : 'Roll 1–9'}
        </GameItem>

        {/* Dice → roll mode */}
        <GameItem
          itemId="dice-6"
          emoji="🎲"
          label="Dice"
          action={{ kind: 'roll', title: 'Roll the dice' }}
          onSuccess={(value) => {
            setDiceRoll(value);
            pushLog(`Dice landed on ${value}.`, 'ok');
          }}
        >
          {diceRoll ? `Last roll: ${diceRoll}` : 'Roll 1–9'}
        </GameItem>

        {/* Chest → unlock mode with a 3-digit code, gated by the lock */}
        <GameItem
          itemId="chest-gold"
          emoji={chestOpen ? '🪙' : '🧰'}
          label="Gold Chest"
          action={{ kind: 'unlock', correctCode: '777', maxDigits: 3, title: 'Chest combination' }}
          onSuccess={() => {
            setChestOpen(true);
            pushLog('The chest creaks open!', 'ok');
          }}
          onFailure={() => pushLog('The chest stays shut.', 'fail')}
        >
          {chestOpen ? 'Opened ✓' : 'Code: 777 (3 digits)'}
        </GameItem>
      </section>

      <section className="w-full max-w-md">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">Event log</h2>
        <ul className="min-h-[120px] space-y-1 rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-sm">
          {log.length === 0 && <li className="text-slate-500">No events yet — click an item above.</li>}
          {log.map((e) => (
            <li
              key={e.id}
              className={
                e.tone === 'ok' ? 'text-emerald-400' : e.tone === 'fail' ? 'text-red-400' : 'text-slate-300'
              }
            >
              {e.text}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
