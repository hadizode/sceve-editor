import { describe, expect, it } from 'vitest';
import { normalizeObject, normalizeScene, SpriteRegistry } from './types';
import type { SceneObject } from './types';

const reg = new SpriteRegistry({}, '', {});

const raw = (overrides: Record<string, unknown> = {}): any => ({
  id: 'o1',
  name: 'O',
  spriteRef: 'sprite:o1',
  x: 10,
  y: 10,
  width: 40,
  height: 40,
  rotation: 0,
  visible: true,
  locked: false,
  oneTimeUse: false,
  ...overrides,
});

describe('normalizeObject numpad fields', () => {
  it('persists every numpad field through normalizeObject', () => {
    const o = normalizeObject(
      raw({
        numpad: true,
        numpadTrigger: 'pickup',
        numpadMode: 'type',
        numpadMin: 3,
        numpadMax: 7,
        numpadFont: 'monospace',
        numpadColor: '#ff0000',
        numpadBg: '#00ff00',
        numpadSize: 48,
      }),
      reg,
    );
    expect(o.numpad).toBe(true);
    expect(o.numpadTrigger).toBe('pickup');
    expect(o.numpadMode).toBe('type');
    expect(o.numpadMin).toBe(3);
    expect(o.numpadMax).toBe(7);
    expect(o.numpadFont).toBe('monospace');
    expect(o.numpadColor).toBe('#ff0000');
    expect(o.numpadBg).toBe('#00ff00');
    expect(o.numpadSize).toBe(48);
  });

  it('applies defaults when numpad fields are missing', () => {
    const o = normalizeObject(raw({ numpad: true }), reg);
    expect(o.numpadTrigger).toBe('click');
    expect(o.numpadMode).toBe('pick');
    expect(o.numpadMin).toBe(1);
    expect(o.numpadMax).toBe(9);
    expect(o.numpadSize).toBe(40);
    expect(o.numpadFont).toBeUndefined();
    expect(o.numpadColor).toBeUndefined();
    expect(o.numpadBg).toBeUndefined();
  });

  it('clamps range to ints 0-99 and swaps min/max', () => {
    const swapped = normalizeObject(raw({ numpad: true, numpadMin: 9, numpadMax: 1 }), reg);
    expect(swapped.numpadMin).toBe(1);
    expect(swapped.numpadMax).toBe(9);

    const hi = normalizeObject(raw({ numpad: true, numpadMin: 200, numpadMax: 999 }), reg);
    expect(hi.numpadMin).toBe(99);
    expect(hi.numpadMax).toBe(99);
  });

  it('caps the range to at most 20 keys', () => {
    const wide = normalizeObject(raw({ numpad: true, numpadMin: 1, numpadMax: 50 }), reg);
    expect(wide.numpadMin).toBe(1);
    expect(wide.numpadMax).toBe(20); // 1 + 19
  });

  it('clamps key size to 24-96 and rejects non-hex colors', () => {
    const small = normalizeObject(raw({ numpad: true, numpadSize: 10 }), reg);
    expect(small.numpadSize).toBe(24);
    const big = normalizeObject(raw({ numpad: true, numpadSize: 200 }), reg);
    expect(big.numpadSize).toBe(96);

    const bad = normalizeObject(
      raw({ numpad: true, numpadColor: 'not-hex', numpadBg: 'also-not-hex' }),
      reg,
    );
    expect(bad.numpadColor).toBeUndefined();
    expect(bad.numpadBg).toBeUndefined();
  });
});

describe('normalizeScene numpad round trip', () => {
  const scene = (overrides: Record<string, unknown> = {}): any => ({
    id: 's1',
    projectId: 'p',
    title: 'Room',
    width: 400,
    height: 300,
    backgroundUrl: '',
    backgroundLayers: [],
    objects: [raw(overrides)],
    clueChain: [],
    exitNumber: 1,
  });

  it('keeps numpad fields through normalizeScene', () => {
    const once = normalizeScene(scene({ numpad: true, numpadMin: 2, numpadMax: 6 }), 'p', reg);
    const o = once.objects[0] as SceneObject;
    expect(o.numpad).toBe(true);
    expect(o.numpadMin).toBe(2);
    expect(o.numpadMax).toBe(6);
  });

  it('is idempotent: normalizing an already-normalized scene changes nothing', () => {
    const once = normalizeScene(scene({ numpad: true, numpadMode: 'type', numpadSize: 60 }), 'p', reg);
    const twice = normalizeScene(once, 'p', reg);
    expect(twice).toEqual(once);
    expect((twice.objects[0] as SceneObject).numpadSize).toBe(60);
    expect((twice.objects[0] as SceneObject).numpadMode).toBe('type');
  });
});
