import type { SceneObject } from './types';

export interface Pt { x: number; y: number }
export interface Size { width: number; height: number }
export interface Rect { x: number; y: number; width: number; height: number }
/** 2D affine [a,b,c,d,e,f]: x' = a·x + c·y + e, y' = b·x + d·y + f (same as canvas / CSS matrix()). */
export type Mat = readonly [number, number, number, number, number, number];

export type Xf = Pick<SceneObject, 'x' | 'y' | 'width' | 'height' | 'rotation'> &
  Partial<Pick<SceneObject, 'scaleX' | 'scaleY' | 'imageOffsetX' | 'imageOffsetY' | 'hitArea'>>;

const rad = (d: number) => (d * Math.PI) / 180;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
export const translate = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
export const scale = (sx: number, sy: number): Mat => [sx, 0, 0, sy, 0, 0];
export const rotate = (deg: number): Mat => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return [c, s, -s, c, 0, 0];
};
export const apply = (m: Mat, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
export function invert(m: Mat): Mat | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
export const cssMatrix = (m: Mat) => `matrix(${m.map((n) => +n.toFixed(6)).join(',')})`;

// ---------- sprite transform ----------
const sx = (o: Xf) => o.scaleX ?? 1;
const sy = (o: Xf) => o.scaleY ?? 1;
const ox = (o: Xf) => o.imageOffsetX ?? 0;
const oy = (o: Xf) => o.imageOffsetY ?? 0;

export const frameCenter = (o: Xf): Pt => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 });

/** Natural size, falling back to the frame when the image has no usable size. */
export const natural = (o: Xf, nat: Size | null): Size =>
  nat && nat.width > 0 && nat.height > 0 ? nat : { width: o.width, height: o.height };

/** frame-local (0..w, 0..h) → scene. The frame pivots on its centre. */
export const frameMatrix = (o: Xf): Mat =>
  mul(mul(translate(frameCenter(o).x, frameCenter(o).y), rotate(o.rotation)), translate(-o.width / 2, -o.height / 2));

/**
 * image-local (0..nw, 0..nh) → scene.
 * T(frameCentre) · R(rotation) · T(offset) · S(scale, flip) · T(−nw/2, −nh/2)
 * The image is NEVER fitted to the frame: its size is natural size × scale.
 */
export function imageMatrix(o: Xf, nat: Size): Mat {
  const n = natural(o, nat);
  const c = frameCenter(o);
  return mul(mul(mul(mul(translate(c.x, c.y), rotate(o.rotation)), translate(ox(o), oy(o))), scale(sx(o), sy(o))), translate(-n.width / 2, -n.height / 2));
}

const quad = (m: Mat, w: number, h: number): Pt[] => [
  apply(m, { x: 0, y: 0 }), apply(m, { x: w, y: 0 }), apply(m, { x: w, y: h }), apply(m, { x: 0, y: h }),
];
export const frameCorners = (o: Xf): Pt[] => quad(frameMatrix(o), o.width, o.height);
export const imageCorners = (o: Xf, nat: Size): Pt[] => {
  const n = natural(o, nat);
  return quad(imageMatrix(o, nat), n.width, n.height);
};
export function boundsOf(pts: Pt[]): Rect {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
export const frameBounds = (o: Xf) => boundsOf(frameCorners(o));
export const imageBounds = (o: Xf, nat: Size) => boundsOf(imageCorners(o, nat));
/** What the user sees: the rendered image if there is one, else the frame. */
export const visualBounds = (o: Xf, nat: Size | null) => (nat ? imageBounds(o, nat) : frameBounds(o));

function inLocalRect(m: Mat, w: number, h: number, p: Pt): boolean {
  const inv = invert(m);
  if (!inv) return false;
  const l = apply(inv, p);
  return l.x >= 0 && l.x <= w && l.y >= 0 && l.y <= h;
}

/** Default hit area is the frame; `hitArea: 'image'` uses the rendered image's rotated rectangle. */
export function hitTest(o: Xf, nat: Size | null, p: Pt): boolean {
  if (o.hitArea === 'image' && nat) {
    const n = natural(o, nat);
    return inLocalRect(imageMatrix(o, nat), n.width, n.height, p);
  }
  return inLocalRect(frameMatrix(o), o.width, o.height, p);
}

/** Scale/offset that makes the image exactly fill the frame (the old "fit" look). */
export const fitScale = (o: Xf, nat: Size) => {
  const n = natural(o, nat);
  return { scaleX: r3(o.width / n.width), scaleY: r3(o.height / n.height), imageOffsetX: 0, imageOffsetY: 0 };
};

// ---------- Konva bridging (pure, so Studio and Preview agree) ----------
/** Attrs for a Konva node whose transform equals imageMatrix(): T(x,y)·R·S·T(−offset). */
export function imageNodeAttrs(o: Xf, nat: Size) {
  const n = natural(o, nat);
  const c = frameCenter(o), r = rad(o.rotation);
  return {
    x: c.x + ox(o) * Math.cos(r) - oy(o) * Math.sin(r),
    y: c.y + ox(o) * Math.sin(r) + oy(o) * Math.cos(r),
    rotation: o.rotation, scaleX: sx(o), scaleY: sy(o),
    offsetX: n.width / 2, offsetY: n.height / 2, width: n.width, height: n.height,
  };
}
/** Inverse of imageNodeAttrs: Transformer / drag result → object patch. */
export function patchFromImageNode(o: Xf, node: { x: number; y: number; rotation: number; scaleX: number; scaleY: number }) {
  const c = frameCenter(o), r = rad(node.rotation);
  const dx = node.x - c.x, dy = node.y - c.y;
  return {
    rotation: r1(node.rotation), scaleX: r3(node.scaleX), scaleY: r3(node.scaleY),
    imageOffsetX: r1(dx * Math.cos(r) + dy * Math.sin(r)),
    imageOffsetY: r1(-dx * Math.sin(r) + dy * Math.cos(r)),
  };
}
/** Frame as a Konva node pivoting on its centre. */
export const frameNodeAttrs = (o: Xf) => {
  const c = frameCenter(o);
  return { x: c.x, y: c.y, offsetX: o.width / 2, offsetY: o.height / 2, width: o.width, height: o.height, rotation: o.rotation };
};
export function patchFromFrameNode(node: { x: number; y: number; width: number; height: number; scaleX: number; scaleY: number; rotation: number }) {
  const w = Math.max(1, Math.round(Math.abs(node.width * node.scaleX)));
  const h = Math.max(1, Math.round(Math.abs(node.height * node.scaleY)));
  return { x: Math.round(node.x - w / 2), y: Math.round(node.y - h / 2), width: w, height: h, rotation: r1(node.rotation) };
}
