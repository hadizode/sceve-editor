import { describe, expect, it } from 'vitest';
import { traceHitPolygon } from './hit-from-image';

function alphaMask(w: number, h: number, opaque: (x: number, y: number) => boolean): Uint8Array {
  const a = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      a[y * w + x] = opaque(x, y) ? 255 : 0;
    }
  }
  return a;
}

function polygonArea(pts: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

describe('traceHitPolygon', () => {
  it('empty mask returns null', () => {
    const a = alphaMask(50, 50, () => false);
    expect(traceHitPolygon(a, 50, 50)).toBeNull();
  });

  it('fully opaque rect returns null (covers > 95%)', () => {
    const a = alphaMask(50, 50, () => true);
    expect(traceHitPolygon(a, 50, 50)).toBeNull();
  });

  it('triangle produces 3 to 6 points', () => {
    const w = 100, h = 100;
    const a = alphaMask(w, h, (x, y) => {
      // Triangle with vertices (50, 10), (10, 90), (90, 90)
      return y >= 10 && y <= 90 && x >= 10 + (y - 10) * 40 / 80 && x <= 90 - (y - 10) * 40 / 80;
    });
    const pts = traceHitPolygon(a, w, h, { maxPoints: 6 });
    expect(pts).not.toBeNull();
    if (pts) {
      expect(pts.length).toBeGreaterThanOrEqual(3);
      expect(pts.length).toBeLessThanOrEqual(6);
    }
  });

  it('filled circle produces <= maxPoints and area within 10% of circle', () => {
    const w = 200, h = 200;
    const cx = 100, cy = 100, r = 40;
    const a = alphaMask(w, h, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2);
    const pts = traceHitPolygon(a, w, h);
    expect(pts).not.toBeNull();
    if (pts) {
      expect(pts.length).toBeLessThanOrEqual(24);
      const area = polygonArea(pts);
      const circleArea = Math.PI * (r / 199) ** 2; // normalized area
      expect(area).toBeGreaterThan(circleArea * 0.9);
      expect(area).toBeLessThan(circleArea * 1.1);
    }
  });

  it('two separated blobs traces largest only by default', () => {
    const w = 100, h = 50;
    // Small blob top-left, larger blob bottom-right
    const a = alphaMask(w, h, (x, y) => (x < 20 && y < 20) || (x > 60 && y > 30));
    const pts = traceHitPolygon(a, w, h);
    expect(pts).not.toBeNull();
    if (pts) {
      // All points should be in the bottom-right region (larger blob)
      expect(pts.every((p) => p.x > 0.5)).toBe(true);
    }
  });

  it('two separated blobs with includeAllParts returns hull covering both', () => {
    const w = 100, h = 50;
    const a = alphaMask(w, h, (x, y) => (x < 20 && y < 20) || (x > 60 && y > 30));
    const pts = traceHitPolygon(a, w, h, { includeAllParts: true });
    expect(pts).not.toBeNull();
    if (pts) {
      // Hull should span both blobs: some points left, some right
      expect(pts.some((p) => p.x < 0.3)).toBe(true);
      expect(pts.some((p) => p.x > 0.7)).toBe(true);
    }
  });

  it('flip/rotation independence: same point count and area for flipped shape', () => {
    const w = 100, h = 100;
    // An asymmetric blob
    const a = alphaMask(w, h, (x, y) => (x - 30) ** 2 / 400 + (y - 50) ** 2 / 225 <= 1 && x > 20);
    const flipped = alphaMask(w, h, (x, y) => a[(h - 1 - y) * w + x] > 0); // vertical flip
    const p1 = traceHitPolygon(a, w, h);
    const p2 = traceHitPolygon(flipped, w, h);
    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();
    if (p1 && p2) {
      expect(Math.abs(p1.length - p2.length)).toBeLessThanOrEqual(1);
      const a1 = polygonArea(p1);
      const a2 = polygonArea(p2);
      expect(a1).toBeCloseTo(a2, 3);
    }
  });

  it('rotation independence: 180° rotated shape has same area and count', () => {
    const w = 100, h = 100;
    const a = alphaMask(w, h, (x, y) => (x - 30) ** 2 / 400 + (y - 50) ** 2 / 225 <= 1);
    const rotated = alphaMask(w, h, (x, y) => a[(w - 1 - x) * w + (h - 1 - y)] > 0);
    const p1 = traceHitPolygon(a, w, h);
    const p2 = traceHitPolygon(rotated, w, h);
    expect(p1).not.toBeNull();
    expect(p2).not.toBeNull();
    if (p1 && p2) {
      expect(Math.abs(p1.length - p2.length)).toBeLessThanOrEqual(1);
      expect(polygonArea(p1)).toBeCloseTo(polygonArea(p2), 3);
    }
  });

  it('maxPoints is respected', () => {
    const w = 200, h = 200;
    const cx = 100, cy = 100, r = 80;
    const a = alphaMask(w, h, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2);
    const pts = traceHitPolygon(a, w, h, { maxPoints: 8 });
    expect(pts).not.toBeNull();
    if (pts) {
      expect(pts.length).toBeLessThanOrEqual(8);
      expect(pts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('alpha threshold controls opacity', () => {
    const w = 50, h = 50;
    // Mostly transparent image with a small opaque square in the middle
    const a = alphaMask(w, h, (x, y) => x >= 20 && x < 30 && y >= 20 && y < 30);
    // Fill the square with alpha 150 (semi-opaque)
    for (let y = 20; y < 30; y++) for (let x = 20; x < 30; x++) a[y * w + x] = 150;
    // With threshold 200, the alpha-150 pixels are transparent → null
    expect(traceHitPolygon(a, w, h, { threshold: 200 })).toBeNull();
    // With threshold 20, the alpha-150 pixels are opaque → not null
    expect(traceHitPolygon(a, w, h, { threshold: 20 })).not.toBeNull();
  });
});