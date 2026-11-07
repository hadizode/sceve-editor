import { describe, expect, it } from 'vitest';
import {
  normalizeOpacityAnim,
  opacityTransitionCss,
  twoStateOpacities,
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

describe('twoStateOpacities', () => {
  it('state a shows A, hides B', () => {
    expect(twoStateOpacities('a')).toEqual({ a: 1, b: 0 });
  });
  it('state b hides A, shows B', () => {
    expect(twoStateOpacities('b')).toEqual({ a: 0, b: 1 });
  });
});
