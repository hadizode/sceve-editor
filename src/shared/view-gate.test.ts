import { describe, expect, it } from 'vitest';
import { canOpenView } from './game-logic';
import type { SceneObject, SessionState } from './types';

const baseObj = (overrides: Partial<SceneObject> = {}): SceneObject => ({
  id: 'obj-1',
  name: 'Box',
  type: 'sprite',
  spriteRef: 'sprite:spr-1',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  rotation: 0,
  visible: true,
  locked: false,
  oneTimeUse: false,
  ...overrides,
});

const baseState = (overrides: Partial<SessionState> = {}): SessionState => ({
  currentSceneId: 's1',
  discoveredObjects: {},
  inventory: [],
  completedScenes: [],
  transformsApplied: {},
  ...overrides,
});

describe('canOpenView', () => {
  it('no requirement is ok', () => {
    const state = baseState({ inventory: [] });
    const obj = baseObj();
    expect(canOpenView(state, obj, null)).toEqual({ ok: true });
  });

  it('item missing from the inventory fails', () => {
    const state = baseState({ inventory: [] });
    const obj = baseObj({ view: { id: 'v', title: 'V', backgroundUrl: '', width: 100, height: 100, objects: [], requiresItem: ['key-gold'] } });
    const res = canOpenView(state, obj, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toBe('برای باز کردن این مورد به آیتم نیاز دارید');
  });

  it('item in the inventory but not selected fails', () => {
    const state = baseState({ inventory: ['key-gold'] });
    const obj = baseObj({ view: { id: 'v', title: 'V', backgroundUrl: '', width: 100, height: 100, objects: [], requiresItem: ['key-gold'] } });
    const res = canOpenView(state, obj, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toBe('آیتم مناسب را از کیف خود انتخاب کنید');
  });

  it('wrong item selected fails', () => {
    const state = baseState({ inventory: ['key-gold', 'key-small'] });
    const obj = baseObj({ view: { id: 'v', title: 'V', backgroundUrl: '', width: 100, height: 100, objects: [], requiresItem: ['key-gold'] } });
    const res = canOpenView(state, obj, 'key-small');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toBe('آیتم مناسب را از کیف خود انتخاب کنید');
  });

  it('correct item selected is ok', () => {
    const state = baseState({ inventory: ['key-gold'] });
    const obj = baseObj({ view: { id: 'v', title: 'V', backgroundUrl: '', width: 100, height: 100, objects: [], requiresItem: ['key-gold'] } });
    expect(canOpenView(state, obj, 'key-gold')).toEqual({ ok: true });
  });

  it('already-unlocked is ok even with nothing selected and an empty inventory', () => {
    const state = baseState({ inventory: [], unlockedViews: ['obj-1'] });
    const obj = baseObj({ view: { id: 'v', title: 'V', backgroundUrl: '', width: 100, height: 100, objects: [], requiresItem: ['key-gold'] } });
    expect(canOpenView(state, obj, null)).toEqual({ ok: true });
  });

  it('obj.requiresItem and view.requiresItem are combined', () => {
    const state = baseState({ inventory: ['key-gold', 'key-small'] });
    const obj = baseObj({
      requiresItem: ['key-gold'],
      view: { id: 'v', title: 'V', backgroundUrl: '', width: 100, height: 100, objects: [], requiresItem: ['key-small'] },
    });
    // either required item selected → ok
    expect(canOpenView(state, obj, 'key-gold')).toEqual({ ok: true });
    expect(canOpenView(state, obj, 'key-small')).toEqual({ ok: true });
    // missing one of the combined requirements from the inventory → fail
    const poor = baseState({ inventory: ['key-gold'] });
    const res = canOpenView(poor, obj, 'key-gold');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toBe('برای باز کردن این مورد به آیتم نیاز دارید');
  });

  it('does not mutate the state', () => {
    const state = baseState({ inventory: ['key-gold'], unlockedViews: [] });
    const obj = baseObj({ view: { id: 'v', title: 'V', backgroundUrl: '', width: 100, height: 100, objects: [], requiresItem: ['key-gold'] } });
    const before = JSON.stringify(state);
    canOpenView(state, obj, 'key-small');
    canOpenView(state, obj, null);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.unlockedViews).toEqual([]);
    expect(state.inventory).toEqual(['key-gold']);
  });
});