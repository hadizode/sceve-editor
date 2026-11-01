import type { Pt, SceneObject } from './types';

export type { Pt };

export interface Size { width: number; height: number }
export interface Rect { x: number; y: number; width: number; height: number }
/** 2D affine [a,b,c,d,e,f]: x' = a·x + c·y + e, y' = b·x + d·y + f (same as canvas / CSS matrix()). */
export type Mat = readonly [number, number, number, number, number, number];

/**
 * THE geometry model: every object is ONE box. The image always fills the box, so sizing the
 * object == sizing the box. Rotation pivots on the box centre; flips mirror around the centre.
 * The click shape (`hit`) is stored normalized (0..1) relative to the box, so it survives resizing.
 */
export type Box = Pick<SceneObject, 'x' | 'y' | 'width' | 'height' | 'rotation'> &
  Partial<Pick<SceneObject, 'flipX' | 'flipY' | 'hit'>>;

const rad = (d: number) => (d * Math.PI) / 180;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ---------- matrix helpers ----------
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

// ---------- the box ----------
export const boxCenter = (o: Box): Pt => ({ x: o.x + o.width / 2, y: o.y + o.height / 2 });

/** box-local (0..w, 0..h) → scene, WITHOUT flip (for things that must never mirror, e.g. badges). */
export function placementMatrix(o: Box): Mat {
  const c = boxCenter(o);
  return mul(mul(translate(c.x, c.y), rotate(o.rotation)), translate(-o.width / 2, -o.height / 2));
}

/**
 * box-local (0..w, 0..h) → scene. T(centre) · R(rotation) · S(flip) · T(−w/2, −h/2).
 * The ONE matrix used by Konva (Studio/Preview), CSS (Player) and hit-testing.
 */
export function boxMatrix(o: Box): Mat {
  const c = boxCenter(o);
  return mul(
    mul(mul(translate(c.x, c.y), rotate(o.rotation)), scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1)),
    translate(-o.width / 2, -o.height / 2)
  );
}

export function boundsOf(pts: Pt[]): Rect {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
export const boxCorners = (o: Box): Pt[] => {
  const m = boxMatrix(o);
  return [
    { x: 0, y: 0 }, { x: o.width, y: 0 }, { x: o.width, y: o.height }, { x: 0, y: o.height },
  ].map((p) => apply(m, p));
};
export const boxBounds = (o: Box): Rect => boundsOf(boxCorners(o));

/** Same box resized to an image's natural size, keeping the centre fixed. */
export const fitBox = (o: Box, nat: Size) => ({
  width: r1(nat.width),
  height: r1(nat.height),
  x: r1(o.x + o.width / 2 - nat.width / 2),
  y: r1(o.y + o.height / 2 - nat.height / 2),
});

// ---------- hit shape ----------
/** Polygon in box-local pixels (normalized points × box size), or null for the default box hit shape. */
export function polygonLocal(o: Box): Pt[] | null {
  const h = o.hit;
  if (!h || h.kind !== 'polygon' || h.points.length < 3) return null;
  return h.points.map((p) => ({ x: p.x * o.width, y: p.y * o.height }));
}

/** Polygon in scene coordinates (follows rotation / flip / resize). */
export function polygonScene(o: Box): Pt[] {
  const poly = polygonLocal(o);
  if (!poly) return [];
  const m = boxMatrix(o);
  return poly.map((p) => apply(m, p));
}

/** Ray-cast point-in-polygon. */
export function pointInPolygon(pts: Pt[], p: Pt): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Is the scene point `p` a click on this object? (polygon hit shape, else the box). */
export function hitTest(o: Box, p: Pt): boolean {
  const inv = invert(boxMatrix(o));
  if (!inv) return false;
  const l = apply(inv, p);
  if (l.x < 0 || l.y < 0 || l.x > o.width || l.y > o.height) return false;
  const poly = polygonLocal(o);
  return poly ? pointInPolygon(poly, l) : true;
}

/** Regular n-gon inscribed in the unit box (normalized points). */
export function regularPolygon(n: number): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2; // first vertex at the top
    return { x: r3(0.5 + 0.5 * Math.cos(a)), y: r3(0.5 + 0.5 * Math.sin(a)) };
  });
}

/** CSS `clip-path` value for the hit polygon (percentages), or undefined for the box. */
export function hitClipPath(o: Box): string | undefined {
  const h = o.hit;
  if (!h || h.kind !== 'polygon' || h.points.length < 3) return undefined;
  return `polygon(${h.points.map((p) => `${r3(p.x * 100)}% ${r3(p.y * 100)}%`).join(', ')})`;
}

// ---------- Konva bridging (pure, so Studio and Preview agree) ----------
/** Attrs of a Konva node whose transform equals boxMatrix(): T(centre)·R·S(flip)·T(−offset). */
export function konvaNodeAttrs(o: Box) {
  const c = boxCenter(o);
  return {
    x: c.x,
    y: c.y,
    offsetX: o.width / 2,
    offsetY: o.height / 2,
    width: o.width,
    height: o.height,
    rotation: o.rotation,
    scaleX: o.flipX ? -1 : 1,
    scaleY: o.flipY ? -1 : 1,
  };
}

/** Konva hitFunc for the polygon hit shape (box-local coordinates). Undefined = default rect. */
export function konvaHitFunc(o: Box) {
  const poly = polygonLocal(o);
  if (!poly) return undefined;
  return function (this: any, ctx: any) {
    ctx.beginPath();
    poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStrokeShape(this);
  };
}

/** Transformer / drag result → object patch. Scale is folded into width/height; sign = flip. */
export function patchFromNode(n: { x: number; y: number; rotation: number; scaleX: number; scaleY: number; width: number; height: number }) {
  const w = Math.max(1, Math.abs(n.width * n.scaleX));
  const h = Math.max(1, Math.abs(n.height * n.scaleY));
  return {
    x: r1(n.x - w / 2),
    y: r1(n.y - h / 2),
    width: r1(w),
    height: r1(h),
    rotation: r1(n.rotation),
    flipX: n.scaleX < 0 ? true : undefined,
    flipY: n.scaleY < 0 ? true : undefined,
  };
}

// ---------- migration from the old frame + image-transform model ----------
export interface LegacyGeom {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  scaleX?: number;
  scaleY?: number;
  imageOffsetX?: number;
  imageOffsetY?: number;
  hitArea?: string;
  framePolygon?: Pt[];
}

/**
 * Old model: a logical frame plus an image drawn at natural size × scale + offset.
 * New model: the box IS the drawn image; the old click area becomes a normalized polygon.
 * `nat` = natural image size when known (falls back to the frame size).
 */
export function migrateLegacyGeometry(o: LegacyGeom, nat: Size | null) {
  const n = nat && nat.width > 0 && nat.height > 0 ? nat : { width: o.width, height: o.height };
  const sx = o.scaleX || 1;
  const sy = o.scaleY || 1;
  const w = Math.max(1, n.width * Math.abs(sx));
  const h = Math.max(1, n.height * Math.abs(sy));
  const c = { x: o.x + o.width / 2, y: o.y + o.height / 2 };
  const off = apply(rotate(o.rotation), { x: o.imageOffsetX ?? 0, y: o.imageOffsetY ?? 0 });
  const box: Box = {
    x: c.x + off.x - w / 2,
    y: c.y + off.y - h / 2,
    width: w,
    height: h,
    rotation: o.rotation,
    flipX: sx < 0 || undefined,
    flipY: sy < 0 || undefined,
  };

  let hit: Box['hit'];
  if (o.hitArea !== 'image') {
    const old: Pt[] =
      o.framePolygon && o.framePolygon.length >= 3
        ? o.framePolygon
        : [{ x: 0, y: 0 }, { x: o.width, y: 0 }, { x: o.width, y: o.height }, { x: 0, y: o.height }];
    const inv = invert(boxMatrix(box));
    if (inv) {
      const fm = placementMatrix(o);
      const pts = old.map((p) => {
        const q = apply(inv, apply(fm, p));
        return { x: r3(clamp01(q.x / w)), y: r3(clamp01(q.y / h)) };
      });
      const full = pts.length === 4 && pts.every((p) => (p.x < 0.005 || p.x > 0.995) && (p.y < 0.005 || p.y > 0.995));
      if (!full) hit = { kind: 'polygon', points: pts };
    }
  }
  return {
    x: r1(box.x),
    y: r1(box.y),
    width: r1(w),
    height: r1(h),
    rotation: o.rotation,
    flipX: box.flipX,
    flipY: box.flipY,
    hit,
  };
}
