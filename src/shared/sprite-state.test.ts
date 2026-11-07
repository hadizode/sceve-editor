import { describe, expect, it } from 'vitest';
import { applyEffects, resolveSpriteState, type EffectCtx } from './game-logic';
import type { SessionState, SceneObject, TransformEffect } from './types';

const objA: SceneObject = {
  id: 'spr-a',
  name: 'Box A',
  type: 'sprite',
  spriteRef: 'sprite:spr-a',
  x: 0, y: 0, width: 50, height: 50, rotation: 0,
  visible: true, locked: false, oneTimeUse: false,
  twoState: { a: 'sprite:spr-a-img-a', b: 'sprite:spr-a-img-b', initial: 'a', toggleOnClick: true },
};
const objNoTwoState: SceneObject = { ...objA, id: 'spr-plain', twoState: undefined };

const ctx: EffectCtx = {
  scenesById: { 'scene-1': { id: 'scene-1', projectId: 'p', title: 'Room', width: 400, height: 300, backgroundUrl: '', backgroundLayers: [], objects: [objA, objNoTwoState], clueChain: [], exitNumber: 1 } },
  visited: new Set<string>(),
  messages: [],
};

const baseState: SessionState = {
  currentSceneId: 'scene-1',
  discoveredObjects: {},
  inventory: [],
  completedScenes: [],
  transformsApplied: {},
  backgrounds: {},
  openDoors: [],
  usable: {},
  motionSteps: {},
  spriteStates: {},
};

const one = (eff: TransformEffect) => applyEffects(baseState, [eff], 'scene-1', ctx);

describe('resolveSpriteState', () => {
  it('defaults to a when nothing stored and no initial', () => {
    const plain = { ...objA, twoState: { ...objA.twoState!, initial: undefined as 'a' | 'b' | undefined } };
    expect(resolveSpriteState(baseState, plain)).toBe('a');
  });
  it('respects twoState.initial', () => {
    expect(resolveSpriteState(baseState, objA)).toBe('a');
    const bInit = { ...objA, twoState: { ...objA.twoState!, initial: 'b' as const } };
    expect(resolveSpriteState(baseState, bInit)).toBe('b');
  });
  it('respects stored spriteStates override', () => {
    const state = { ...baseState, spriteStates: { 'spr-a': 'b' as const } };
    expect(resolveSpriteState(state, objA)).toBe('b');
  });
  it('returns a for objects without twoState', () => {
    expect(resolveSpriteState(baseState, objNoTwoState)).toBe('a');
  });
});

describe('applyEffects setSpriteState', () => {
  it('toggles a -> b when spriteState is toggle', () => {
    const eff: TransformEffect = { action: 'setSpriteState', objectId: 'spr-a' };
    const res = one(eff);
    expect(res.state.spriteStates?.[ 'spr-a' ]).toBe('b');
  });
  it('toggles b -> a on second click (idempotent toggle)', () => {
    const state = { ...baseState, spriteStates: { 'spr-a': 'b' as const } };
    const eff: TransformEffect = { action: 'setSpriteState', objectId: 'spr-a' };
    const res = applyEffects(state, [eff], 'scene-1', ctx);
    expect(res.state.spriteStates?.[ 'spr-a' ]).toBe('a');
  });
  it('explicit a sets to a even when currently b', () => {
    const state = { ...baseState, spriteStates: { 'spr-a': 'b' as const } };
    const eff: TransformEffect = { action: 'setSpriteState', objectId: 'spr-a', spriteState: 'a' };
    const res = applyEffects(state, [eff], 'scene-1', ctx);
    expect(res.state.spriteStates?.[ 'spr-a' ]).toBe('a');
  });
  it('is idempotent: returns same state ref when nothing changes', () => {
    const state = { ...baseState, spriteStates: { 'spr-a': 'a' as const } };
    const eff: TransformEffect = { action: 'setSpriteState', objectId: 'spr-a', spriteState: 'a' };
    const res = applyEffects(state, [eff], 'scene-1', ctx);
    expect(res.state).toBe(state);
  });
  it('no-ops when target has no twoState', () => {
    const eff: TransformEffect = { action: 'setSpriteState', objectId: 'spr-plain' };
    const res = one(eff);
    expect(res.state).toBe(baseState);
    expect(res.state.spriteStates).toEqual({});
  });
  it('no-ops when target object does not exist', () => {
    const eff: TransformEffect = { action: 'setSpriteState', objectId: 'missing' };
    const res = one(eff);
    expect(res.state).toBe(baseState);
  });
});
