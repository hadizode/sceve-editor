// Barrel: canonical game logic lives in src/shared/game-logic.ts.
// This folder re-exports it (plus the split discovery/lock/clue modules) so
// both `../shared/game` and `../shared/game-logic` import paths keep working.
export * from './discovery';
export * from '../game-logic';
export * from './lock';
export * from './clue-chain';
