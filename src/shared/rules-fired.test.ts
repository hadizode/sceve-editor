import { describe, expect, it } from 'vitest';
import { createSessionState } from './types';
import type { SceneObject, SessionState, TransformRule } from './types';
import { firedOf, markFired, pendingRules } from './game-logic';

const obj = (id: string, transforms: TransformRule[]): SceneObject => ({
  id,
  name: id,
  type: 'container',
  imageUrl: '',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  zIndex: 0,
  layerIndex: 0,
  visible: true,
  oneTimeUse: false,
  transforms,
});

describe('firedOf', () => {
  it('expands an old save with transformsApplied = 2 to [0,1,2]', () => {
    const oldSave: SessionState = {
      currentSceneId: 's1',
      discoveredObjects: {},
      inventory: [],
      completedScenes: [],
      transformsApplied: { box: 2 },
    };
    expect(firedOf(oldSave, 'box')).toEqual([0, 1, 2]);
  });

  it('prefers rulesFired when present', () => {
    const s: SessionState = {
      ...createSessionState(),
      rulesFired: { box: [0, 3] },
      transformsApplied: { box: 3 },
    };
    expect(firedOf(s, 'box')).toEqual([0, 3]);
  });

  it('returns [] for an object that never fired', () => {
    expect(firedOf(createSessionState(), 'box')).toEqual([]);
  });
});

describe('markFired', () => {
  it('unions indexes, keeps the max in transformsApplied, and does not mutate', () => {
    const base = createSessionState();
    const s1 = markFired(base, 'box', [0]);
    expect(s1.rulesFired?.box).toEqual([0]);
    expect(s1.transformsApplied?.box).toBe(0);

    const s2 = markFired(s1, 'box', [2, 5]);
    expect(s2.rulesFired?.box).toEqual([0, 2, 5]);
    expect(s2.transformsApplied?.box).toBe(5); // highest fired index

    // purity: earlier states untouched
    expect(base.rulesFired).toEqual({});
    expect(base.transformsApplied).toEqual({});
    expect(s1.rulesFired?.box).toEqual([0]);
    expect(s1.transformsApplied?.box).toBe(0);
  });

  it('seeds from the backward-compat path before unioning', () => {
    const oldSave: SessionState = {
      ...createSessionState(),
      transformsApplied: { box: 2 }, // no rulesFired — legacy save
    };
    const s = markFired(oldSave, 'box', [4]);
    expect(s.rulesFired?.box).toEqual([0, 1, 2, 4]);
    expect(s.transformsApplied?.box).toBe(4);
  });
});

describe('pendingRules', () => {
  it('returns 3 free rules together when nothing blocks them', () => {
    const o = obj('box', [
      { newMessage: 'a' },
      { newMessage: 'b' },
      { newMessage: 'c' },
    ]);
    const pending = pendingRules(o, createSessionState(), null);
    expect(pending.map(p => p.i)).toEqual([0, 1, 2]);
    expect(pending.map(p => p.rule.newMessage)).toEqual(['a', 'b', 'c']);
  });

  it('skips fired, auto-applied and item-mismatched rules', () => {
    const o = obj('box', [
      { newMessage: 'fired' },
      { newMessage: 'auto', conditions: { autoApply: true } },
      { requiresItem: 'key', newMessage: 'needs key' },
      { newMessage: 'free but blocked', conditions: { hasItems: ['gem'] } },
      { newMessage: 'pending' },
    ]);
    const state = markFired(createSessionState(), 'box', [0]);
    const pending = pendingRules(o, state, null);
    expect(pending.map(p => p.i)).toEqual([4]);
    expect(pending[0].rule.newMessage).toBe('pending');

    // with the right items, both gated rules become pending too
    const rich: SessionState = { ...state, inventory: ['key', 'gem'] };
    expect(pendingRules(o, rich, null).map(p => p.i)).toEqual([3, 4]);
    expect(pendingRules(o, rich, 'key').map(p => p.i)).toEqual([2]);
  });
});

// ============ Task 3: transformedObjects uses firedOf (exact indexes) ============
import { checkTransformCondition, conditionFailMessage, prereqVisible } from './game-logic';

describe('transformedObjects requirements (firedOf-based)', () => {
  it('fails a minRule:0 requirement when only rule index 1 has fired', () => {
    // Out-of-order save: rulesFired [1] with transformsApplied 1. Under the old
    // "applied < (minRule ?? 0)" gate this would have passed (1 >= 0); now the
    // exact-index check must reject it.
    const s: SessionState = {
      ...createSessionState(),
      rulesFired: { box: [1] },
      transformsApplied: { box: 1 },
    };
    const cond = { transformedObjects: [{ objectId: 'box', minRule: 0 }] };
    expect(checkTransformCondition(cond, s)).toBe(false);
    expect(conditionFailMessage(cond, s)).not.toBeNull();

    // once index 0 has actually fired, the same requirement passes
    const s2 = markFired(s, 'box', [0]);
    expect(checkTransformCondition(cond, s2)).toBe(true);
    expect(conditionFailMessage(cond, s2)).toBeNull();
  });

  it('backward-compat: legacy transformsApplied = 2 satisfies minRule 0..2 but not 3', () => {
    const legacy: SessionState = {
      currentSceneId: 's1',
      discoveredObjects: {},
      inventory: [],
      completedScenes: [],
      transformsApplied: { box: 2 },
    };
    expect(checkTransformCondition({ transformedObjects: [{ objectId: 'box', minRule: 2 }] }, legacy)).toBe(true);
    expect(checkTransformCondition({ transformedObjects: [{ objectId: 'box', minRule: 3 }] }, legacy)).toBe(false);
  });

  it('prereqVisible checks the exact fired index and looks up the shown rule at the highest fired index', () => {
    const o = obj('lamp', [
      { newMessage: 'on', newName: 'Lamp On' },
      { newMessage: 'bright', newName: 'Lamp Bright' },
    ]);
    const objects = [o];
    const nothing = createSessionState();
    expect(prereqVisible({ objectId: 'lamp', minRule: 0 }, nothing, objects)).toBe(false);

    // only rule 1 fired → minRule 0 fails, minRule 1 passes
    const onlyOne = markFired(nothing, 'lamp', [1]);
    expect(prereqVisible({ objectId: 'lamp', minRule: 0 }, onlyOne, objects)).toBe(false);
    expect(prereqVisible({ objectId: 'lamp', minRule: 1 }, onlyOne, objects)).toBe(true);

    // both fired → shown rule is the HIGHEST fired index (1)
    const both = markFired(onlyOne, 'lamp', [0]);
    expect(prereqVisible({ objectId: 'lamp', minRule: 0 }, both, objects)).toBe(true);
    const highest = Math.max(...firedOf(both, 'lamp'));
    expect(o.transforms![highest].newName).toBe('Lamp Bright');
  });
});
