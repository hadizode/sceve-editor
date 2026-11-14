import { describe, expect, it } from 'vitest';
import { applyItemToObject } from './game-logic';
import type { SceneObject, SessionState } from './types';
import { createObject } from './types';

const baseState: SessionState = {
  currentSceneId: 'sc',
  discoveredObjects: {},
  inventory: [],
  completedScenes: [],
  transformsApplied: {},
};

const lock = (requires: string[]): SceneObject =>
  createObject({
    id: 'lock',
    name: 'Lock',
    spriteRef: 'sprite:lock',
    transforms: requires.map((r) => ({ requiresItem: r, newSpriteId: 'sprite:opened' })),
  });

describe('applyItemToObject with numpad numbers (virtual items)', () => {
  it('treats a numeric item id as a virtual item that needs no inventory and is not consumed', () => {
    const obj = lock(['5']);
    const res = applyItemToObject(baseState, 'sc', 'lock', '5', [obj]);
    expect(res.success).toBe(true);
    expect(res.transformed).toBe(true);
    // The number was never in the inventory and is not consumed.
    expect(res.newState.inventory).toEqual([]);
    expect(res.newState.transformsApplied?.['lock']).toBe(0);
  });

  it('rejects a non-numeric item that is not in the inventory', () => {
    const obj = lock(['5']);
    const res = applyItemToObject(baseState, 'sc', 'lock', 'key', [obj]);
    expect(res.success).toBe(false);
    expect(res.message).toBe('شما این آیتم را ندارید');
  });

  it('fires numeric transform rules one by one and stops on a wrong digit', () => {
    const obj = lock(['1', '2', '3', '4']);
    let state = baseState;
    const apply = (d: string) => {
      const r = applyItemToObject(state, 'sc', 'lock', d, [obj]);
      state = r.newState;
      return r;
    };

    expect(apply('1').success).toBe(true);
    expect(apply('2').success).toBe(true);
    expect(state.transformsApplied?.['lock']).toBe(1);

    // A wrong digit shows a failure and does not advance the chain.
    const wrong = apply('9');
    expect(wrong.success).toBe(false);
    expect(state.transformsApplied?.['lock']).toBe(1);

    // The chain resumes at the next expected digit.
    expect(apply('3').success).toBe(true);
    expect(apply('4').success).toBe(true);
    expect(state.transformsApplied?.['lock']).toBe(3);
  });
});
