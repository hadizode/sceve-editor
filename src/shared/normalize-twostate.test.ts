import { describe, expect, it } from 'vitest';
import { normalizeScene, SpriteRegistry } from './types';

const reg = new SpriteRegistry({}, '', {});

const baseObject: any = {
  id: 'o1',
  name: 'O',
  spriteRef: 'sprite:o1',
  twoState: {
    a: 'sprite:a-img',
    b: 'sprite:b-img',
    initial: 'b',
    anim: { duration: 300, easing: 'ease-in-out', delay: 10 },
    toggleOnClick: true,
  },
  transforms: [
    {
      requiresItem: '',
      newSpriteId: 'sprite:x',
      fade: { duration: 250, easing: 'linear', delay: 40 },
      effects: [
        { action: 'setSpriteState', objectId: 'o2', spriteState: 'toggle' },
        { action: 'setSpriteState', objectId: 'o2', spriteState: 'bogus' },
      ],
    },
  ],
};

const baseScene: any = {
  id: 's1',
  projectId: 'p',
  title: 'Room',
  width: 400,
  height: 300,
  backgroundUrl: '',
  backgroundLayers: [],
  objects: [baseObject, { id: 'o2', name: 'O2', spriteRef: 'sprite:o2' }],
  clueChain: [],
  exitNumber: 1,
};

describe('normalizeScene keeps twoState / fade / setSpriteState through reload', () => {
  it('round-trips all three fields (normalize then normalize again)', () => {
    const once = normalizeScene(baseScene, 'p', reg);
    const twice = normalizeScene(once, 'p', reg);
    expect(twice).toEqual(once);

    const o: any = once.objects[0];
    expect(o.twoState).toEqual({
      a: 'sprite:a-img',
      b: 'sprite:b-img',
      initial: 'b',
      anim: { duration: 300, easing: 'ease-in-out', delay: 10 },
      toggleOnClick: true,
    });
    expect(o.transforms![0].fade).toEqual({ duration: 250, easing: 'linear', delay: 40 });

    const effs: any = o.transforms![0].effects;
    expect(effs).toEqual([
      { action: 'setSpriteState', objectId: 'o2', spriteState: 'toggle' },
      { action: 'setSpriteState', objectId: 'o2' },
    ]);
    expect(effs[1].spriteState).toBeUndefined();
  });

  it('drops twoState when it is not an object', () => {
    const once = normalizeScene(
      { ...baseScene, objects: [{ ...baseObject, twoState: 'not-an-object' }] },
      'p',
      reg,
    );
    expect((once.objects[0] as any).twoState).toBeUndefined();
  });

  it('drops fade when it is not an object', () => {
    const scene: any = { ...baseScene };
    scene.objects = [{ ...baseObject, transforms: [{ ...baseObject.transforms[0], fade: 42 }] }];
    const once = normalizeScene(scene, 'p', reg);
    expect(once.objects[0].transforms![0].fade).toBeUndefined();
  });

  it('normalizes initial and drops non-object anim / non-true toggleOnClick', () => {
    const scene: any = { ...baseScene };
    scene.objects = [{
      ...baseObject,
      twoState: { a: 'sprite:a-img', b: 'sprite:b-img', anim: 'nope', toggleOnClick: 1 },
    }];
    const once = normalizeScene(scene, 'p', reg);
    expect((once.objects[0] as any).twoState).toEqual({
      a: 'sprite:a-img',
      b: 'sprite:b-img',
      initial: 'a',
    });
  });
});
