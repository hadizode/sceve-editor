import { describe, expect, it } from 'vitest';
import {
  normalizeOpacityAnim,
  opacityTransitionCss,
  swapFade,
  type OpacityAnim,
} from './opacity-anim';

describe('normalizeOpacityAnim', () => {
  it('fills defaults', () => {
    expect(normalizeOpacityAnim(undefined)).toEqual({ duration: 500, easing: 'ease', delay: 0 });
  });
  it('keeps provided values', () => {
    expect(normalizeOpacityAnim({ duration: 200, easing: 'linear', delay: 50 })).toEqual({
      duration: 200,
      easing: 'linear',
      delay: 50,
    });
  });
  it('clamps negative duration/delay to 0', () => {
    expect(normalizeOpacityAnim({ duration: -10, delay: -5 })).toEqual({ duration: 0, easing: 'ease', delay: 0 });
  });
  it('ignores non-finite duration', () => {
    expect(normalizeOpacityAnim({ duration: NaN as unknown as number })).toEqual({ duration: 500, easing: 'ease', delay: 0 });
  });
});

describe('opacityTransitionCss', () => {
  it('returns empty string for duration 0 (instant)', () => {
    expect(opacityTransitionCss({ duration: 0 })).toBe('');
    expect(opacityTransitionCss(undefined)).not.toBe(''); // default 500ms
  });
  it('builds a transition string with easing and delay', () => {
    expect(opacityTransitionCss({ duration: 300, easing: 'ease-in-out', delay: 100 })).toBe(
      'opacity 300ms ease-in-out 100ms'
    );
  });
  it('omits delay when 0', () => {
    expect(opacityTransitionCss({ duration: 500 })).toBe('opacity 500ms ease');
  });
});

describe('swapFade', () => {
  const rules = [
    { fade: { duration: 100, easing: 'linear' as const } },
    { fade: { duration: 200, easing: 'ease' as const } },
    { fade: { duration: 300, easing: 'ease-out' as const, delay: 50 } },
  ] as const;

  it('apply direction uses the target rule fade', () => {
    expect(swapFade(rules, 0, 1)).toEqual({ duration: 200, easing: 'ease' });
    expect(swapFade(rules, 0, 2)).toEqual({ duration: 300, easing: 'ease-out', delay: 50 });
  });

  it('revert direction uses the left rule fade', () => {
    expect(swapFade(rules, 2, 0)).toEqual({ duration: 300, easing: 'ease-out', delay: 50 });
    expect(swapFade(rules, 1, 0)).toEqual({ duration: 200, easing: 'ease' });
  });

  it('same index returns undefined', () => {
    expect(swapFade(rules, 1, 1)).toBeUndefined();
  });

  it('missing fade returns undefined', () => {
    const noFade = [{ fade: { duration: 100 } }, {}] as any;
    // applying to a rule with no fade → undefined
    expect(swapFade(noFade, 0, 1)).toBeUndefined();
    // reverting from a rule with no fade → undefined
    expect(swapFade(noFade, 1, 0)).toBeUndefined();
  });

  it('negative indexes are safe', () => {
    expect(swapFade(rules, -1, 1)).toBeUndefined();
    expect(swapFade(rules, 1, -1)).toBeUndefined();
    expect(swapFade(rules, -1, -1)).toBeUndefined();
  });

  it('out-of-range indexes are safe', () => {
    expect(swapFade(rules, 5, 1)).toBeUndefined();
    expect(swapFade(rules, 1, 5)).toBeUndefined();
    expect(swapFade(rules, 9, 9)).toBeUndefined();
  });

  it('empty rules array is safe', () => {
    expect(swapFade([], 0, 0)).toBeUndefined();
    expect(swapFade([], -1, 1)).toBeUndefined();
  });
});


