// Game logic entry point. Historically a single file; the implementation now
// lives in ./game/*. This module re-exports everything so both import paths —
// `../shared/game-logic` and `../shared/game` — keep working.
export * from './game';
