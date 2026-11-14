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
