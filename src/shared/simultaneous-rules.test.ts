import { describe, expect, it } from 'vitest';
import { applyItemToObject, firedOf } from './game-logic';
import { createObject, type SessionState } from './types';

const baseState: SessionState = {
  currentSceneId: 'sc',
  discoveredObjects: {},
  inventory: [],
  completedScenes: [],
  transformsApplied: {},
};

const free = (spriteId: string) => ({ requiresItem: '', newSpriteId: spriteId });
const gated = (item: string, spriteId: string) => ({
  requiresItem: item,
  newSpriteId: spriteId,
});

describe('simultaneous rules on one click', () => {
  it('one click on 3 free rules sets rulesFired = [0,1,2]', () => {
    const o = createObject({
      id: 'x',
      name: 'X',
      spriteRef: 'sprite:x',
      transforms: [free('sprite:a'), free('sprite:b'), free('sprite:c')],
    });
    const res = applyItemToObject(baseState, 'sc', 'x', null, [o]);
    expect(res.success).toBe(true);
    expect(res.transformed).toBe(true);
    expect(res.newState.transformsApplied?.['x']).toBe(2);
    expect(res.newState.rulesFired?.['x']).toEqual([0, 1, 2]);
  });

  it('item-gated + free rule: no-item click fires only the free one', () => {
    const o = createObject({
      id: 'g',
      name: 'Gated',
      spriteRef: 'sprite:g',
      transforms: [free('sprite:a'), gated('key', 'sprite:b')],
    });
    const res = applyItemToObject(baseState, 'sc', 'g', null, [o]);
    expect(res.success).toBe(true);
    expect(res.newState.transformsApplied?.['g']).toBe(0);
    expect(res.newState.rulesFired?.['g']).toEqual([0]);
    // gated rule (index 1) has not fired; item still present
    expect(firedOf(res.newState, 'g')).not.toContain(1);
    expect(res.newState.inventory).toEqual([]);
  });

  it('item-gated + free rule: item click fires the gated one and consumes exactly one item', () => {
    const o = createObject({
      id: 'g',
      name: 'Gated',
      spriteRef: 'sprite:g',
      transforms: [free('sprite:a'), gated('key', 'sprite:b')],
    });
    // First click (no item) fires the free rule.
    const first = applyItemToObject(baseState, 'sc', 'g', null, [o]);
    expect(first.newState.transformsApplied?.['g']).toBe(0);
    expect(first.newState.rulesFired?.['g']).toEqual([0]);

    // Click with the key: fires the gated rule and consumes exactly one item.
    const second = applyItemToObject(
      { ...first.newState, inventory: ['key'] },
      'sc',
      'g',
      'key',
      [o],
    );
    expect(second.success).toBe(true);
    expect(second.newState.transformsApplied?.['g']).toBe(1);
    expect(second.newState.rulesFired?.['g']).toEqual([0, 1]);
    expect(second.newState.inventory).toEqual([]); // exactly one 'key' consumed
  });

  it('rule B with minRule: 0 on itself waits until rule A fired, then fires on next action', () => {
    const o = createObject({
      id: 'chain',
      name: 'Chain',
      spriteRef: 'sprite:chain',
      transforms: [
        free('sprite:a'), // rule A
        {
          requiresItem: '',
          newSpriteId: 'sprite:b',
          conditions: { transformedObjects: [{ objectId: 'chain', minRule: 0 }] }, // rule B
        },
      ],
    });

    // Rule B's precondition is not met yet: nothing can fire it on the first click beyond A.
    const first = applyItemToObject(baseState, 'sc', 'chain', null, [o]);
    expect(first.success).toBe(true);
    expect(first.newState.transformsApplied?.['chain']).toBe(0);
    expect(first.newState.rulesFired?.['chain']).toEqual([0]);
    expect(firedOf(first.newState, 'chain')).not.toContain(1);

    // On the next action, rule A has fired so rule B's condition holds → B fires.
    const second = applyItemToObject(first.newState, 'sc', 'chain', null, [o]);
    expect(second.success).toBe(true);
    expect(second.newState.transformsApplied?.['chain']).toBe(1);
    expect(second.newState.rulesFired?.['chain']).toEqual([0, 1]);
  });

  it('legacy state with only transformsApplied: {o: 1} is treated as [0,1] fired', () => {
    const legacy = { ...baseState, transformsApplied: { o: 1 } };
    expect(firedOf(legacy, 'o')).toEqual([0, 1]);

    // The next action continues after the highest fired index: rule 2 fires.
    const o = createObject({
      id: 'o',
      name: 'O',
      spriteRef: 'sprite:o',
      transforms: [free('sprite:a'), free('sprite:b'), free('sprite:c')],
    });
    const res = applyItemToObject(legacy, 'sc', 'o', null, [o]);
    expect(res.success).toBe(true);
    expect(res.newState.transformsApplied?.['o']).toBe(2);
    expect(res.newState.rulesFired?.['o']).toEqual([0, 1, 2]);
  });
});
