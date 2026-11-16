import { describe, expect, it } from 'vitest';
import { clamp, clampPan } from './gestures';

describe('clamp', () => {
  it('clamps values below min to min', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });
  it('clamps values above max to max', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
  it('returns the value unchanged when inside the range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps to the boundaries themselves', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('clampPan', () => {
  const viewport = { w: 800, h: 600 };

  it('centers content smaller than the viewport on both axes', () => {
    expect(clampPan({ x: 90, y: -40 }, { w: 400, h: 300 }, viewport)).toEqual({ x: 0, y: 0 });
  });
  it('centers each axis where the content is smaller than the viewport', () => {
    // wide content: x stays clamped-in-range, y is centered
    expect(clampPan({ x: 10, y: 100 }, { w: 1600, h: 300 }, viewport)).toEqual({ x: 10, y: 0 });
    // tall content: x is centered, y stays clamped-in-range
    expect(clampPan({ x: 10, y: 100 }, { w: 300, h: 1600 }, viewport)).toEqual({ x: 0, y: 100 });
  });
  it('clamps pan so large content covers the viewport with no empty edges', () => {
    expect(clampPan({ x: 900, y: 0 }, { w: 1600, h: 1200 }, viewport)).toEqual({ x: 400, y: 0 });
    expect(clampPan({ x: -900, y: 0 }, { w: 1600, h: 1200 }, viewport)).toEqual({ x: -400, y: 0 });
    expect(clampPan({ x: 0, y: 900 }, { w: 1600, h: 1200 }, viewport)).toEqual({ x: 0, y: 300 });
  });
  it('clamps each axis independently', () => {
    expect(clampPan({ x: 500, y: 500 }, { w: 1400, h: 1000 }, viewport)).toEqual({ x: 300, y: 200 });
  });
  it('keeps a centered pan unchanged', () => {
    expect(clampPan({ x: 0, y: 0 }, { w: 1600, h: 1200 }, viewport)).toEqual({ x: 0, y: 0 });
  });
});
