import { describe, expect, it } from 'vitest';
import {
  apply, boxBounds, boxMatrix, fitBox, hitClipPath, hitTest, konvaNodeAttrs, livePoint, migrateLegacyGeometry,
  motionAngle, mul, patchFromNode, pivotScene, placementMatrix, regularPolygon, rotate, scale, translate,
} from './geometry';

const box = { x: 100, y: 100, width: 50, height: 50, rotation: 0 }; // centre (125,125)
const close = (a: number, b: number, d = 6) => expect(a).toBeCloseTo(b, d);

describe('box geometry', () => {
  it('bounds of an unrotated box are the box', () => {
    const b = boxBounds(box);
    close(b.x, 100); close(b.y, 100); close(b.width, 50); close(b.height, 50);
  });

  it('rotation pivots on the centre (bounds swap at 90°)', () => {
    const b = boxBounds({ x: 85, y: 105, width: 80, height: 40, rotation: 90 });
    close(b.width, 40); close(b.height, 80);
    close(b.x, 105); close(b.y, 85);
  });

  it('flipX mirrors around the centre without changing the bounds', () => {
    const o = { ...box, flipX: true };
    const b = boxBounds(o);
    close(b.x, 100); close(b.width, 50);
    const p = apply(boxMatrix(o), { x: 0, y: 0 }); // top-left of the image lands on the right edge
    close(p.x, 150); close(p.y, 100);
  });

  it('placementMatrix never mirrors', () => {
    const p = apply(placementMatrix({ ...box, flipX: true }), { x: 0, y: 0 });
    close(p.x, 100); close(p.y, 100);
  });

  it('Konva node attrs reproduce boxMatrix and round-trip through patchFromNode', () => {
    const o = { x: 100, y: 100, width: 50, height: 50, rotation: 33, flipX: true as const };
    const a = konvaNodeAttrs(o);
    const k = mul(mul(mul(translate(a.x, a.y), rotate(a.rotation)), scale(a.scaleX, a.scaleY)), translate(-a.offsetX, -a.offsetY));
    boxMatrix(o).forEach((v, i) => close(k[i], v));
    const p = patchFromNode(a);
    close(p.x, 100, 1); close(p.y, 100, 1); close(p.width, 50, 1); close(p.height, 50, 1);
    close(p.rotation, 33, 1);
    expect(p.flipX).toBe(true);
    expect(p.flipY).toBeUndefined();
  });

  it('Transformer scale is folded into width/height', () => {
    const a = konvaNodeAttrs(box);
    const p = patchFromNode({ ...a, scaleX: 2, scaleY: 0.5 });
    close(p.width, 100, 1); close(p.height, 25, 1);
  });

  it('fitBox keeps the centre', () => {
    const f = fitBox(box, { width: 400, height: 300 });
    close(f.x + f.width / 2, 125, 1); close(f.y + f.height / 2, 125, 1);
  });
});

describe('hit shape', () => {
  const tri = [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

  it('default hit shape is the whole box', () => {
    expect(hitTest(box, { x: 125, y: 125 })).toBe(true);
    expect(hitTest(box, { x: 99, y: 125 })).toBe(false);
  });

  it('polygon hit shape only matches inside the polygon', () => {
    const o = { x: 0, y: 0, width: 100, height: 100, rotation: 0, hit: { kind: 'polygon' as const, points: tri } };
    expect(hitTest(o, { x: 50, y: 60 })).toBe(true);
    expect(hitTest(o, { x: 5, y: 5 })).toBe(false);
  });

  it('polygon scales with the box (normalized)', () => {
    const o = { x: 0, y: 0, width: 200, height: 100, rotation: 0, hit: { kind: 'polygon' as const, points: tri } };
    expect(hitTest(o, { x: 95, y: 10 })).toBe(true);
    expect(hitTest(o, { x: 10, y: 10 })).toBe(false);
  });

  it('polygon follows rotation', () => {
    const o = { x: 0, y: 0, width: 100, height: 100, rotation: 180, hit: { kind: 'polygon' as const, points: tri } };
    expect(hitTest(o, { x: 50, y: 40 })).toBe(true); // apex is now at the bottom
    expect(hitTest(o, { x: 5, y: 95 })).toBe(false);
  });

  it('clip-path uses percentages of the box', () => {
    const o = { ...box, hit: { kind: 'polygon' as const, points: tri } };
    expect(hitClipPath(o)).toBe('polygon(50% 0%, 100% 100%, 0% 100%)');
    expect(hitClipPath(box)).toBeUndefined();
  });

  it('regularPolygon yields n points inside the unit box', () => {
    const p = regularPolygon(6);
    expect(p).toHaveLength(6);
    p.forEach((q) => { expect(q.x).toBeGreaterThanOrEqual(0); expect(q.x).toBeLessThanOrEqual(1); });
  });
});

describe('motion (click-to-rotate)', () => {
  // A 100×20 hand standing at x:100..200, y:100, hinged at its LEFT edge (pivot = 0, 0.5 → scene (100,110)).
  const hand = { x: 100, y: 100, width: 100, height: 20, rotation: 0 };

  it('livePoint rotates the anchor around the pivot (90° clockwise)', () => {
    const m = { kind: 'rotate' as const, pivot: { x: 0, y: 0.5 }, angle: 90 };
    const p = livePoint({ ...hand, motion: m }, 1, { x: 1, y: 0.5 }); // right tip (200,110)
    close(p.x, 110); close(p.y, 120); // swings down around the hinge (100,110)
    expect(livePoint({ ...hand, motion: m }, 0)).toEqual(apply(boxMatrix(hand), { x: 50, y: 10 })); // no steps = plain box point
    expect(livePoint(hand, 3)).toEqual(apply(boxMatrix(hand), { x: 50, y: 10 })); // no motion = plain box point
  });

  it('pivotScene maps the normalized pivot into scene coordinates', () => {
    const pv = pivotScene(hand, { x: 0, y: 0.5 });
    close(pv.x, 100); close(pv.y, 110);
  });

  it('toggle flips between 0 and angle on every click', () => {
    const lever = { angle: 45, toggle: true };
    expect(motionAngle(lever, 0)).toBe(0);
    expect(motionAngle(lever, 1)).toBe(45);
    expect(motionAngle(lever, 2)).toBe(0);
    expect(motionAngle(lever, 7)).toBe(45);
    const m = { kind: 'rotate' as const, pivot: { x: 0.5, y: 0.5 }, angle: 45, toggle: true };
    const p = livePoint({ ...hand, motion: m }, 2); // even step = back at the start
    expect(p).toEqual(apply(boxMatrix(hand), { x: 50, y: 10 }));
  });

  it('maxSteps caps the accumulated angle (clock hand)', () => {
    const clock = { angle: 30, maxSteps: 12 };
    expect(motionAngle(clock, 3)).toBe(90);
    expect(motionAngle(clock, 12)).toBe(360);
    expect(motionAngle(clock, 15)).toBe(360); // never passes the cap
    expect(motionAngle({ angle: 30 }, 4)).toBe(120); // unlimited when maxSteps is missing
  });
});

describe('legacy migration', () => {
  const frame = { x: 100, y: 100, width: 50, height: 50, rotation: 0 };

  it('image at natural size × scale becomes the box', () => {
    const m = migrateLegacyGeometry({ ...frame, scaleX: 2 }, { width: 400, height: 300 });
    close(m.width, 800, 1); close(m.height, 300, 1);
    close(m.x, -275, 1); close(m.y, -25, 1);
    expect(m.flipX).toBeUndefined();
  });

  it('old frame click area is preserved as a normalized polygon', () => {
    const m = migrateLegacyGeometry({ ...frame, scaleX: 2 }, { width: 400, height: 300 });
    expect(m.hit?.kind).toBe('polygon');
    if (m.hit?.kind === 'polygon') {
      close(m.hit.points[0].x, 375 / 800, 2);
      close(m.hit.points[0].y, 125 / 300, 2);
    }
  });

  it('hitArea=image becomes the plain box', () => {
    const m = migrateLegacyGeometry({ ...frame, scaleX: 2, hitArea: 'image' }, { width: 400, height: 300 });
    expect(m.hit).toBeUndefined();
  });

  it('frame == image gives no extra hit polygon', () => {
    const m = migrateLegacyGeometry({ ...frame, scaleX: 1 }, null);
    expect(m.hit).toBeUndefined();
    close(m.width, 50, 1);
  });

  it('negative scale becomes flip', () => {
    const m = migrateLegacyGeometry({ ...frame, scaleX: -0.5 }, null);
    expect(m.flipX).toBe(true);
    close(m.width, 25, 1);
  });

  it('custom polygon frame is converted into the new box space', () => {
    const m = migrateLegacyGeometry({ ...frame, framePolygon: [{ x: 25, y: 0 }, { x: 50, y: 50 }, { x: 0, y: 50 }] }, null);
    expect(m.hit).toEqual({ kind: 'polygon', points: [{ x: 0.5, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] });
  });
});
