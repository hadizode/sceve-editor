import type { Point } from './corners';

/**
 * Point-in-polygon test (ray casting). Used to build accurate hit areas
 * so transparent image pixels don't swallow clicks on objects behind them.
 */
export function pointInPolygon(px: number, py: number, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersects = (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Build a Konva `hitFunc` for a clickable region of an object.
 *
 * Konva invokes `hitFunc` with the canvas context already transformed into
 * the shape's LOCAL coordinate space (position/rotation/scale applied), and
 * then performs its own point-in-path containment test. Tracing the desired
 * polygon here therefore gives an exact hit area for the object:
 *  - no custom `hitArea`  -> full width×height rectangle
 *  - custom `hitArea`     -> the flattened polygon [x1,y1,x2,y2,...]
 * This fixes the previous behavior where the whole bounding box of rotated
 * or irregularly-shaped art was clickable (and decorative overlays could
 * swallow clicks meant for objects behind them).
 */
export function createObjectHitFunc(width: number, height: number, hitArea?: number[]) {
  if (hitArea && hitArea.length >= 6) {
    const pts = hitArea;
    return (ctx: any) => {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
    };
  }
  return (ctx: any) => {
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.closePath();
  };
}
