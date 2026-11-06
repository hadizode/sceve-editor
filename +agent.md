# Agent Instructions — Escape Room Studio

You are working on **Escape Room Studio**, a single-page escape-room designer + player.

## Project at a glance

- **Repo:** `/home/caffe/Projects/sceve-editor`
- **Tech:** React 18 + TypeScript (strict), Vite 6, TailwindCSS 4, Konva.js + react-konva, Zustand, vitest. No Zod, no backend (frontend-only; sessions/Telegram integration live in `API.md` as a contract).
- **UI language:** English. **Game content:** Persian/Farsi, RTL layout (`src/index.css`).

## Commands (run from repo root)

| Command | Purpose |
|---------|---------|
| `npm install` | install dependencies |
| `npm run dev` | Vite dev server |
| `npm run build` | production build |
| `npm run typecheck` | `tsc --noEmit` — always run before finishing |
| `npm test` | `vitest run` (tests live next to source, e.g. `src/shared/geometry.test.ts`) |

## Key files & conventions

### Data model (`src/shared/types.ts`)
- **One object kind only:** `type: 'sprite'`. Do not invent `decoration` / `inventory` / `container` categories — behavior comes from properties (`pickupable`, `transforms`, `door`, `motion`, `digit`, …).
- **Image refs:** assets are `asset:<id>`; sprites are `sprite:<id>`. Use `assetRef`, `spriteRef`, `transformRef`, `resolveUrl`, `resolveSprite`. Never inline base64 in scene data.
- **Geometry:** `SceneObject` has only `x`, `y`, `width`, `height`, `rotation` (+ `flipX/Y`, `hit`). The image always fills the box. Draw order = array position in `scene.objects` — there is no separate `zIndex`.
- **Views:** `SceneObject.view` is a nestable close-up scene (own background + objects + transforms).
- **Effects:** `TransformEffect.action` ∈ `transform \| background \| unlockDoor \| setUsable \| completeRoom`.
- **Bundle format:** `escape-studio`, version 3 (`ProjectBundle`). `normalizeBundle` migrates legacy `imageUrl` exports.
- Exports/imports go through `useStudioStore.exportBundle` / `importBundle`.

### State (`src/stores/store.ts`)
- `useStudioStore` — projects, scenes, assets, sprites, editor UI (selection, grid, undo/redo stacks), export/import.
- `usePlayerStore` — runtime session state (current scene, discoveries, inventory, transforms applied, open doors, …).
- Hooks: `useScene()`, `useCtx()`, `useCurrentProject()`, `useProjectAssets()`, `useSprites()`, `useSpriteSrc(ref)`.

### Game logic (`src/shared/game-logic.ts`)
- `discoverObject`, `pickupObject`, `applyItemToObject`, `tryEnterDoor`, `canUseDoor`, `validateFinalLock`, `evaluateAutoTransforms`, `allRoomsComplete`.

### Validation (`src/shared/validation.ts`)
- `validateProject(project, scenes, assets, sprites)` returns `Issue[]` (error/warning). Rules include: ≥1 room, digit in every room, clue-chain targets exist, obtainable items, sprite/asset references resolve, bounds warnings.

### Persistence
- Studio: `idbStorage` (IndexedDB) via Zustand `persist` middleware.
- Player: persistence inside `usePlayerStore` (IndexedDB save & resume).

## When editing code

1. Keep TypeScript strict happy — run `npm run typecheck`.
2. Add/update tests in `*.test.ts` next to the changed module; run `npm test`.
3. If you change `types.ts`, update `DATA_MODEL.md` and `README.md` accordingly.
4. Prefer pure functions in `game-logic.ts`; keep UI components thin.
5. Persian content must be RTL-friendly; test with Farsi strings where applicable.
6. Do not add dependencies without checking `package.json` first.
7. New files match existing naming (kebab-case for files, PascalCase for components).

## Related docs

- `README.md` — project overview, features, structure, running, controls.
- `DATA_MODEL.md` — full type reference (sprites, assets, scenes, projects, transforms, effects, session state, validation).
- `API.md` — session/scene REST + WebSocket contract (for the Telegram bot/backend integration).