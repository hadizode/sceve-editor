# Interactive Game Overlay System

A modal number-pad overlay for game interactions, built with **React + TypeScript + TailwindCSS** (LTR, English).

Any interactive game item (lock ✏️ pencil 🎲 dice 🧰 chest…) can open the overlay through context — **no prop drilling**.

## Architecture

```
src/overlay/
├── types.ts                  # OverlayMode, OverlayConfig, GameOverlayContextValue
├── GameOverlayProvider.tsx   # Context + Provider (holds active config)
├── useGameOverlay.ts         # Public hook: { open, close, isOpen }
├── NumberPad.tsx             # 1–9 pad + PIN dot display + Del/Enter keys
├── GameOverlay.tsx           # Modal panel, keyboard handling, shake logic
├── index.ts                  # Barrel exports
└── demo/
    ├── GameItem.tsx          # Sample interactive item wired to the overlay
    └── OverlayDemo.tsx       # Sample scene (lock / pencil / dice / chest)
```

### Wiring

```tsx
<GameOverlayProvider>
  <YourGame />        {/* items call useGameOverlay().open(config) */}
  <GameOverlay />     {/* rendered once; portals to document.body */}
</GameOverlayProvider>
```

The demo is mounted in the app at hash route **`#/overlay-demo`** (button “Overlay Demo →” in the top nav).

## Modes

| Mode | Behaviour |
|---|---|
| `unlock` | Collects up to `maxDigits` (default **4**) digits shown as filled/empty dots. Auto-submits when full, or on **Enter**. Match `correctCode` → `onSuccess(value)` + close. Mismatch → **shake animation**, clear input, `onFailure(value)`, overlay stays open. |
| `roll` | First digit press (1–9) immediately calls `onSuccess(value)` and closes. `maxDigits` default **1**. |

## Interfaces

```ts
type OverlayMode = 'unlock' | 'roll';

interface OverlayConfig {
  mode: OverlayMode;
  itemId: string;
  title?: string;
  maxDigits?: number;        // default: unlock=4, roll=1
  correctCode?: string;      // only for unlock
  onSuccess?: (value: string) => void;
  onFailure?: (value: string) => void;
}

interface GameOverlayContextValue {
  open: (config: OverlayConfig) => void;
  close: () => void;
  isOpen: boolean;
}
```

## Physical keyboard

While the overlay is open (window-level listener):

- `1`–`9` → enter a digit (roll mode resolves instantly)
- `Backspace` → delete last digit
- `Enter` → submit code (unlock mode)
- `Escape` → close overlay

## Backdrop behaviour

Clicking the dark backdrop closes the overlay (`mousedown` on the backdrop); clicks inside the panel stop propagation, so interacting with the pad never dismisses it. A ✕ button in the panel header also closes it.

## Shake animation

Defined in `src/index.css` as `@keyframes overlayShake` / `.overlay-shake`, applied to the panel for 500 ms after a wrong code (panel border turns red during the shake).

## Example usage

```tsx
function Lock() {
  const { open } = useGameOverlay();
  return (
    <button onClick={() =>
      open({
        mode: 'unlock',
        itemId: 'lock-front-door',
        correctCode: '4821',
        onSuccess: (code) => console.log('unlocked with', code),
        onFailure: (code) => console.log('wrong:', code),
      })
    }>🔒 Door Lock</button>
  );
}

function Pencil() {
  const { open } = useGameOverlay();
  return (
    <button onClick={() =>
      open({ mode: 'roll', itemId: 'pencil-magic', onSuccess: (v) => console.log('rolled', v) })
    }>✏️ Magic Pencil</button>
  );
}
```

## Demo codes

- Door Lock: `4821` (4 digits) · Gold Chest: `777` (3 digits via `maxDigits`)
- Pencil / Dice: press any single digit 1–9
