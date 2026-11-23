Project: Escape Room Studio (React 18, TypeScript strict, Vite 6, Tailwind 4, zustand). Read +agent.md first.
Scope: the game Player UI only. Editable files: src/player/**, src/shared/NumPadKeys.tsx, src/App.tsx (game tab only), src/index.css (rules scoped under .player-root only), src/studio/icons.tsx (adding icons only), and usePlayerStore in src/stores/store.ts when a task names it.
Off-limits unless a task names the file: Studio behavior, src/stores/studio/*, src/stores/player/*, src/shared/types.ts, src/shared/game-logic.ts.
Already done (do not redo): @telegram-apps/telegram-ui installed, AppRoot with platform="ios" around Player, .player-root class, useCompact() in src/player/useCompact.ts, new icons (bag, backspace, chevronUp, chevronDown, check, alert), GameSnackbar driven by say() in the store, InventoryOverlay with library IconButton, Badge, Image and Tappable.
Rules that apply to EVERY UI element you touch:
- Platform is always "ios"; colors come from Telegram theme params with a dark fallback.
- All Persian text is centered (text-align:center).
- No emoji in UI chrome; use Icon from src/studio/icons.tsx.
- Everything is an overlay and MUST NOT change the scene viewport size.
- Compact means landscape phone, detected with useCompact() (max-height: 480px).
- Read a library component's typings in node_modules before using it; use only exports and props that exist there.
- Add no dependency other than the one a task names.

Do exactly one task per session. Make the change, then run: npm run typecheck && npm test && npm run build. Report changed files and the command results, then stop. Leave the next task untouched.
