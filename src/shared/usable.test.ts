import { describe, expect, it } from 'vitest';
import { applyEffects, isUsable } from './game-logic';
import { type Scene, type SceneObject, type SessionState, type TransformEffect } from './types';

const obj = (id: string, overrides: Partial<SceneObject> & Record<string, any> = {}): SceneObject =>
  ({
    id,
    name: id,
    type: 'sprite',
    spriteRef: 'sprite:' + id,
    x: 0, y: 0, width: 50, height: 50, rotation: 0,
    visible: true, locked: false, oneTimeUse: false,
    ...overrides,
  }) as SceneObject;

const scene = (id: string, objs: SceneObject[]): Scene => ({
  id,
  projectId: 'p',
  title: 'Room',
  width: 400,
  height: 300,
  backgroundUrl: '',
  backgroundLayers: [],
  objects: objs,
  clueChain: [],
  exitNumber: 1,
});

const state = (): SessionState => ({
  currentSceneId: 's1',
  discoveredObjects: {},
  inventory: [],
  completedScenes: [],
  transformsApplied: {},
  backgrounds: {},
  openDoors: [],
  usable: {},
  motionSteps: {},
});

const scenesById = { s1: scene('s1', []) };

describe('isUsable', () => {
  it('defaults to usable when nothing locks it', () => {
    expect(isUsable(state(), obj('a'), scenesById)).toBe(true);
  });

  it('usable: false is not usable', () => {
    expect(isUsable(state(), obj('a', { usable: false }), scenesById)).toBe(false);
  });

  it('state.usable override wins over usable:false', () => {
    const s = state();
    s.usable = { a: true };
    expect(isUsable(s, obj('a', { usable: false }), scenesById)).toBe(true);
    s.usable = { a: false };
    expect(isUsable(s, obj('a', { usable: true }), scenesById)).toBe(false);
    delete s.usable.a;
    expect(isUsable(s, obj('a', { usable: true }), scenesById)).toBe(true);
  });

  it('unlockWhen with itemsInInventory becomes true once the item is held', () => {
    const o = obj('a', { usable: false, unlockWhen: { itemsInInventory: ['key'] } });
    expect(isUsable(state(), o, scenesById)).toBe(false);
    const s = state();
    s.inventory = ['key'];
    expect(isUsable(s, o, scenesById)).toBe(true);
  });

  it('a setUsable effect applied through applyEffects flips it', () => {
    const o = obj('a', { usable: false });
    const eff: TransformEffect = { action: 'setUsable', objectId: 'a', usable: true };
    const next = applyEffects(state(), [eff], 's1', scenesById).state;
    expect(next.usable?.[o.id]).toBe(true);
    expect(isUsable(next, o, scenesById)).toBe(true);

    const back = applyEffects(next, [{ action: 'setUsable', objectId: 'a', usable: false }], 's1', scenesById).state;
    expect(isUsable(back, o, scenesById)).toBe(false);
  });
});
