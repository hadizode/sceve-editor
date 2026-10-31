import { describe, expect, it } from 'vitest';
import {
  apply, fitScale, frameBounds, hitTest, imageBounds, imageMatrix, imageNodeAttrs,
  mul, patchFromImageNode, rotate, scale, translate,
} from './geometry';

const frame = { x: 100, y: 100, width: 50, height: 50, rotation: 0 }; // centre (125,125)
const nat = { width: 400, height: 300 }; // much larger than the frame
const close = (a: number, b: number, d = 6) => expect(a).toBeCloseTo(b, d);

describe('sprite image geometry', () => {
  it('renders at natural size, centred on the frame, not clipped to it', () => {
    const b = imageBounds(frame, nat);
    close(b.width, 400); close(b.height, 300);
    close(b.x, -75); close(b.y, -25);
  });

  it('frame size does not affect rendered image size', () => {
    const b = imageBounds({ ...frame, width: 500, height: 10 }, nat);
    close(b.width, 400); close(b.height, 300);
  });

  it('rotate keeps natural size (bounds swap at 90°)', () => {
    const b = imageBounds({ ...frame, rotation: 90 }, nat);
    close(b.width, 300); close(b.height, 400);
    close(b.x, -25); close(b.y, -75);
  });

  it('scale + rotate = natural × scale', () => {
    const b = imageBounds({ ...frame, rotation: 90, scaleX: 0.5, scaleY: 0.5 }, nat);
    close(b.width, 150); close(b.height, 200);
  });

  it('flip mirrors the image without changing its size or clipping it', () => {
    const o = { ...frame, scaleX: -1 };
    const b = imageBounds(o, nat);
    close(b.width, 400); close(b.height, 300);
    const p = apply(imageMatrix(o, nat), { x: 0, y: 0 }); // image top-left lands on the right edge
    close(p.x, 325); close(p.y, -25);
  });

  it('offset moves the image, flip or not', () => {
    const b = imageBounds({ ...frame, imageOffsetX: 10, scaleX: -1 }, nat);
    close(b.x, -65); close(b.width, 400);
  });

  it('frame hit area ignores the overflowing image; image hit area includes it', () => {
    const outside = { x: -50, y: 125 }; // outside frame, inside image
    expect(hitTest(frame, nat, outside)).toBe(false);
    expect(hitTest({ ...frame, hitArea: 'image' }, nat, outside)).toBe(true);
    expect(hitTest(frame, nat, { x: 125, y: 125 })).toBe(true);
    expect(hitTest({ ...frame, hitArea: 'image' }, nat, { x: 700, y: 125 })).toBe(false);
  });

  it('image-shape hit area follows rotation', () => {
    const o = { ...frame, rotation: 90, hitArea: 'image' as const };
    expect(hitTest(o, nat, { x: 125, y: 300 })).toBe(true); // now tall: y reaches −75..325
    expect(hitTest(o, nat, { x: 300, y: 125 })).toBe(false); // x only reaches −25..275
  });

  it('Konva node attrs reproduce imageMatrix and round-trip through the patch', () => {
    const o = { ...frame, rotation: 33, scaleX: -0.7, scaleY: 1.3, imageOffsetX: 12, imageOffsetY: -7 };
    const a = imageNodeAttrs(o, nat);
    const konva = mul(mul(mul(translate(a.x, a.y), rotate(a.rotation)), scale(a.scaleX, a.scaleY)), translate(-a.offsetX, -a.offsetY));
    imageMatrix(o, nat).forEach((v, i) => close(konva[i], v));
    const patch = patchFromImageNode(o, a);
    close(patch.imageOffsetX, 12, 1); close(patch.imageOffsetY, -7, 1);
    close(patch.scaleX, -0.7, 2); close(patch.scaleY, 1.3, 2); close(patch.rotation, 33, 1);
  });

  it('fitScale restores the old fit-to-frame look', () => {
    const f = fitScale({ ...frame, width: 200, height: 150 }, nat);
    close(f.scaleX, 0.5); close(f.scaleY, 0.5);
    const b = imageBounds({ ...frame, width: 200, height: 150, ...f }, nat);
    close(b.width, 200); close(b.height, 150);
    expect(frameBounds(frame).width).toBe(50);
  });
});
