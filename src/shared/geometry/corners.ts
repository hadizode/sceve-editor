// ============ Geometry helpers (hit areas & polygon frames) ============

export interface Point { x: number; y: number }

/** Minimal shape needed to compute corners — matches SceneObject & Konva nodes. */
export interface BoxLike {
  x: number; y: number; width: number; height: number; rotation?: number;
}

/**
 * Compute the 4 corners (polygon) of a rotated object's bounding box.
 * Rotation is around the object's center, matching Konva semantics.
 */
export function getObjectCorners(obj: BoxLike): Point[] {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const rad = ((obj.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const local: Point[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  return local.map(p => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
}

/**
 * Flatten corners into a Konva Polygon `points` array [x1,y1,x2,y2,...].
 */
export function getCornersAsPoints(obj: BoxLike): number[] {
  return getObjectCorners(obj).flatMap(p => [p.x, p.y]);
}

/**
 * Axis-aligned bounding box of the rotated object (used for label placement).
 */
export function getRotatedBounds(obj: BoxLike): { minX: number; minY: number; maxX: number; maxY: number } {
  const pts = getObjectCorners(obj);
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * Convert a flattened [x1,y1,x2,y2,...] array into Point[].
 */
export function toPoints(flat: number[]): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  return pts;
}
