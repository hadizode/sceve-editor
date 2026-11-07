import { describe, expect, it } from 'vitest';
import { applyEffects, applyItemToObject, type EffectCtx } from './game-logic';
import { migrateTwoState, normalizeBundle, type Scene, type SceneObject, type SessionState } from './types';

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

const baseState: SessionState = {
  currentSceneId: 's1',
  discoveredObjects: {},
  inventory: [],
  completedScenes: [],
  transformsApplied: {},
  backgrounds: {},
  openDoors: [],
  usable: {},
  motionSteps: {},
};

const ctx = (scenesById: Record<string, Scene>): EffectCtx => ({ scenesById, visited: new Set(), messages: [] });

describe('migrateTwoState', () => {
  it('initial "a" (or missing): keeps spriteRef, appends a rule switching to "b" with fade + toggle', () => {
    const o = obj('o1', {
      spriteRef: 'sprite:a-img',
      twoState: { a: 'sprite:a-img', b: 'sprite:b-img', initial: 'a', anim: { duration: 300 }, toggleOnClick: true } as any,
    });
    const scenes = [scene('s1', [o])];
    migrateTwoState(scenes);
    expect((o as any).twoState).toBeUndefined();
    expect(o.spriteRef).toBe('sprite:a-img');
    expect(o.transforms).toEqual([{ requiresItem: '', newSpriteId: 'sprite:b-img', fade: { duration: 300 }, toggle: true }]);
  });

  it('initial "b": spriteRef becomes "b" and the rule switches back to "a"', () => {
    const o = obj('o1', { spriteRef: 'sprite:a-img', twoState: { a: 'sprite:a-img', b: 'sprite:b-img', initial: 'b' } as any });
    const scenes = [scene('s1', [o])];
    migrateTwoState(scenes);
    expect(o.spriteRef).toBe('sprite:b-img');
    expect(o.transforms).toEqual([{ requiresItem: '', newSpriteId: 'sprite:a-img' }]);
  });

  it('missing initial is treated as "a"', () => {
    const o = obj('o1', { twoState: { a: 'sprite:a-img', b: 'sprite:b-img', toggleOnClick: true } as any });
    const scenes = [scene('s1', [o])];
    migrateTwoState(scenes);
    // spriteRef stays whatever it was (state a); only a rule switching to b is appended
    expect(o.spriteRef).toBe('sprite:o1');
    expect(o.transforms![0].newSpriteId).toBe('sprite:b-img');
    expect(o.transforms![0].toggle).toBe(true);
  });

  it('toggleOnClick false leaves toggle unset', () => {
    const o = obj('o1', { twoState: { a: 'sprite:a-img', b: 'sprite:b-img', toggleOnClick: false } as any });
    const scenes = [scene('s1', [o])];
    migrateTwoState(scenes);
    expect(o.transforms![0].toggle).toBeUndefined();
  });

  it('converts legacy setSpriteState effects into transform effects on the migration rule', () => {
    const target = obj('tgt', {
      twoState: { a: 'sprite:a', b: 'sprite:b' },
      transforms: [{ requiresItem: '', effects: [
        { action: 'setSpriteState', objectId: 'tgt', spriteState: 'b' } as any,
        { action: 'setSpriteState', objectId: 'tgt', spriteState: 'a' } as any,
        { action: 'setSpriteState', objectId: 'tgt', spriteState: 'toggle' } as any,
      ] }],
    });
    const other = obj('oth', { twoState: { a: 'sprite:a', b: 'sprite:b' } as any });
    const src = obj('src', {
      transforms: [{ requiresItem: '', effects: [{ action: 'setSpriteState', sceneId: 's2', objectId: 'oth', spriteState: 'b' } as any] }],
    });
    const scenes = [scene('s1', [target, src]), scene('s2', [other])];
    migrateTwoState(scenes);

    const effs = scenes[0].objects[0].transforms![0].effects!;
    expect(effs).toEqual([
      { action: 'transform', objectId: 'tgt', ruleIndex: 1, mode: 'apply' },
      { action: 'transform', objectId: 'tgt', ruleIndex: 1, mode: 'revert' },
      { action: 'transform', objectId: 'tgt', ruleIndex: 1, mode: 'toggle' },
    ]);
    const cross = scenes[0].objects[1].transforms![0].effects![0];
    expect(cross).toEqual({ action: 'transform', sceneId: 's2', objectId: 'oth', ruleIndex: 0, mode: 'apply' });
  });

  it('is idempotent: a second pass changes nothing', () => {
    const o = obj('o1', { twoState: { a: 'sprite:a', b: 'sprite:b', initial: 'a', toggleOnClick: true } as any });
    const scenes = [scene('s1', [o])];
    migrateTwoState(scenes);
    migrateTwoState(scenes);
    expect((o as any).twoState).toBeUndefined();
    expect(o.transforms).toHaveLength(1);
  });
});

describe('normalizeTransform keeps fade/toggle through a JSON round-trip', () => {
  it('preserves fade (normalized) and toggle on the rule, and mode on its effects', () => {
    const bundle = JSON.stringify({
      format: 'escape-studio',
      version: 3,
      project: { id: 'p', name: 'T', scenes: ['s1'], assets: [], sprites: [] },
      scenes: [{
        id: 's1', title: 'Room', width: 400, height: 300, backgroundUrl: '', backgroundLayers: [], clueChain: [], exitNumber: 1,
        objects: [
          {
            id: 'o1', name: 'O', type: 'sprite', spriteRef: 'sprite:o1',
            x: 0, y: 0, width: 50, height: 50, rotation: 0, visible: true, locked: false, oneTimeUse: false,
            transforms: [{
              requiresItem: '', newSpriteId: 'sprite:x', fade: { duration: 250, easing: 'linear', delay: 40 }, toggle: true,
              effects: [{ action: 'transform', objectId: 'o2', mode: 'revert' }],
            }],
          },
          { id: 'o2', name: 'O2', type: 'sprite', spriteRef: 'sprite:o2', x: 100, y: 0, width: 50, height: 50, rotation: 0, visible: true, locked: false, oneTimeUse: false },
        ],
      }],
      assets: [],
      sprites: [],
    });
    const out = normalizeBundle(bundle);
    const rule = out.scenes[0].objects[0].transforms![0];
    expect(rule.fade).toEqual({ duration: 250, easing: 'linear', delay: 40 });
    expect(rule.toggle).toBe(true);
    expect(rule.effects![0].mode).toBe('revert');
  });
});

describe('applyEffect transform modes', () => {
  const target = obj('o', {
    transforms: [
      { requiresItem: '', newSpriteId: 'sprite:a' },
      { requiresItem: '', newSpriteId: 'sprite:b' },
    ],
  });
  const scenesById: Record<string, Scene> = { s1: scene('s1', [target]) };

  it('apply sets transformsApplied to the rule index', () => {
    const res = applyEffects(baseState, [{ action: 'transform', objectId: 'o', ruleIndex: 1 }], 's1', ctx(scenesById));
    expect(res.state.transformsApplied['o']).toBe(1);
  });

  it('revert steps back to min(current, ruleIndex - 1)', () => {
    const state = { ...baseState, transformsApplied: { o: 2 } };
    const res = applyEffects(state, [{ action: 'transform', objectId: 'o', ruleIndex: 1, mode: 'revert' }], 's1', ctx(scenesById));
    expect(res.state.transformsApplied['o']).toBe(0);
  });

  it('revert when nothing is applied returns the same state ref', () => {
    const res = applyEffects(baseState, [{ action: 'transform', objectId: 'o', ruleIndex: 1, mode: 'revert' }], 's1', ctx(scenesById));
    expect(res.state).toBe(baseState);
  });

  it('toggle applies when the rule is not applied yet', () => {
    const res = applyEffects(baseState, [{ action: 'transform', objectId: 'o', ruleIndex: 1, mode: 'toggle' }], 's1', ctx(scenesById));
    expect(res.state.transformsApplied['o']).toBe(1);
  });

  it('toggle reverts when the rule is already applied', () => {
    const state = { ...baseState, transformsApplied: { o: 1 } };
    const res = applyEffects(state, [{ action: 'transform', objectId: 'o', ruleIndex: 1, mode: 'toggle' }], 's1', ctx(scenesById));
    expect(res.state.transformsApplied['o']).toBe(0);
  });

  it('apply with nothing changed returns the same state ref', () => {
    const state = { ...baseState, transformsApplied: { o: 0 } };
    const res = applyEffects(state, [{ action: 'transform', objectId: 'o', ruleIndex: 0 }], 's1', ctx(scenesById));
    expect(res.state).toBe(state);
  });
});

describe('toggle click path (applyItemToObject)', () => {
  const objs = [obj('o', { transforms: [{ requiresItem: '', newSpriteId: 'sprite:b', toggle: true }] })];

  it('applies on click, reverts on the next click, applies again', () => {
    const base = { ...baseState, transformsApplied: {} };
    let res = applyItemToObject(base, 's1', 'o', null, objs);
    expect(res.success).toBe(true);
    expect(res.newState.transformsApplied['o']).toBe(0);

    res = applyItemToObject(res.newState, 's1', 'o', null, objs);
    expect(res.success).toBe(true);
    expect(res.newState.transformsApplied['o']).toBe(-1);

    res = applyItemToObject(res.newState, 's1', 'o', null, objs);
    expect(res.newState.transformsApplied['o']).toBe(0);
  });

  it('auto-apply rules ignore toggle', () => {
    const objsAuto = [obj('o', { transforms: [{ requiresItem: '', newSpriteId: 'sprite:b', toggle: true, conditions: { autoApply: true } }] })];
    const base = { ...baseState, transformsApplied: {} };
    const res = applyItemToObject(base, 's1', 'o', null, objsAuto);
    expect(res.success).toBe(true);
    expect(res.newState.transformsApplied['o']).toBe(0);

    const res2 = applyItemToObject(res.newState, 's1', 'o', null, objsAuto);
    expect(res2.success).toBe(false);
    expect(res2.newState.transformsApplied['o']).toBe(0);
  });
});