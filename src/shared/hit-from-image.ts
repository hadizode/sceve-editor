/**
 * Pure image-alpha → hit polygon.
 *
 * Given an alpha channel (Uint8Array, 0..255) and its dimensions, trace the
 * outer contour of the largest opaque connected component, simplify it with
 * Douglas-Peucker, and return normalized points (x, y in 0..1) relative to the
 * image box. Returns null when nothing is opaque or when the result covers more
 * than 95% of the unit box (a full rectangle — caller should use hit: undefined).
 *
 * No DOM access. Pure function of plain data.
 */

export interface TraceOpts {
  threshold?: number; // alpha >= threshold counts as opaque (default 20)
  maxPoints?: number; // simplified point cap (default 24)
  includeAllParts?: boolean; // if true, convex hull of all opaque pixels
}

type Pt = { x: number; y: number };

// 8 neighbors, clockwise starting from East
const NDX = [1, 1, 0, -1, -1, -1, 0, 1];
const NDY = [0, 1, 1, 1, 0, -1, -1, -1];

// 4 neighbors for component labeling
const FDX = [1, -1, 0, 0];
const FDY = [0, 0, 1, -1];

function inBounds(x: number, y: number, w: number, h: number): boolean {
  return x >= 0 && x < w && y >= 0 && y < h;
}

/** Connected-component labeling (4-connectivity). Returns component id per pixel and sizes. */
function labelComponents(mask: Uint8Array, w: number, h: number): { id: Int32Array; sizes: number[] } {
  const id = new Int32Array(w * h).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (mask[i] !== 1 || id[i] !== -1) continue;
    const cid = sizes.length;
    let size = 0;
    const stack: number[] = [i];
    id[i] = cid;
    while (stack.length) {
      const cur = stack.pop()!;
      size++;
      const cx = cur % w;
      const cy = (cur - cx) / w;
      for (let d = 0; d < 4; d++) {
        const nx = cx + FDX[d];
        const ny = cy + FDY[d];
        if (inBounds(nx, ny, w, h)) {
          const ni = ny * w + nx;
          if (mask[ni] === 1 && id[ni] === -1) {
            id[ni] = cid;
            stack.push(ni);
          }
        }
      }
    }
    sizes.push(size);
  }
  return { id, sizes };
}

/** Trace the outer boundary of a component using Moore neighborhood following. Ignores holes. */
function traceOuterBoundary(comp: Uint8Array, w: number, h: number): Pt[] | null {
  let sx = -1, sy = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (comp[y * w + x] === 1) { sx = x; sy = y; break; }
    }
    if (sx !== -1) break;
  }
  if (sx === -1) return null;

  const contour: Pt[] = [];
  let cx = sx, cy = sy;
  let prevDir = 4; // index of W in NDX/NDY
  const maxSteps = w * h * 4 + 8;

  for (let step = 0; step < maxSteps; step++) {
    contour.push({ x: cx, y: cy });
    let found = false;
    for (let k = 0; k < 8; k++) {
      const d = (prevDir + 1 + k) % 8;
      const nx = cx + NDX[d];
      const ny = cy + NDY[d];
      if (inBounds(nx, ny, w, h) && comp[ny * w + nx] === 1) {
        prevDir = (d + 4) % 8;
        cx = nx;
        cy = ny;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy) break;
  }

  if (contour.length < 3) return null;
  return contour;
}

/** Douglas-Peucker simplification. Returns a subset of pts. */
function douglasPeucker(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length <= 2) return pts.slice();
  const start = pts[0];
  const end = pts[pts.length - 1];
  let maxDist = 0;
  let maxIdx = 0;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len2 = dx * dx + dy * dy;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    let d: number;
    if (len2 === 0) {
      d = Math.hypot(p.x - start.x, p.y - start.y);
    } else {
      const t = ((p.x - start.x) * dx + (p.y - start.y) * dy) / len2;
      const tc = Math.max(0, Math.min(1, t));
      const nx = start.x + tc * dx;
      const ny = start.y + tc * dy;
      d = Math.hypot(p.x - nx, p.y - ny);
    }
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }
  if (maxDist <= epsilon) return [start, end];
  const left = douglasPeucker(pts.slice(0, maxIdx + 1), epsilon);
  const right = douglasPeucker(pts.slice(maxIdx), epsilon);
  return left.slice(0, -1).concat(right);
}

/** Simplify pts to at most maxPoints (and at least 3) by increasing epsilon. */
function simplifyToMax(pts: Pt[], maxPoints: number): Pt[] {
  if (pts.length <= maxPoints) return pts;
  let lo = 0;
  let hi = 0;
  for (const p of pts) {
    hi = Math.max(hi, Math.abs(p.x), Math.abs(p.y));
  }
  hi *= 2;
  let best: Pt[] = pts;
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2;
    const s = douglasPeucker(pts, mid);
    if (s.length <= maxPoints) {
      best = s;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  if (best.length < 3) return pts.slice(0, 3);
  return best;
}

/** Convex hull of a set of points (Monotone chain). Removes collinear points. */
function convexHull(pts: Pt[]): Pt[] {
  if (pts.length <= 2) return pts.slice();
  const sorted = [...pts].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Shoelace area (absolute). */
function polygonArea(pts: Pt[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

export function traceHitPolygon(
  alpha: Uint8Array,
  w: number,
  h: number,
  opts: TraceOpts = {},
): Pt[] | null {
  const threshold = opts.threshold ?? 20;
  const maxPoints = opts.maxPoints ?? 24;
  const includeAllParts = opts.includeAllParts ?? false;

  const n = w * h;
  const mask = new Uint8Array(n);
  let anyOpaque = false;
  for (let i = 0; i < alpha.length && i < n; i++) {
    if (alpha[i] >= threshold) { mask[i] = 1; anyOpaque = true; }
  }
  if (!anyOpaque) return null;

  let raw: Pt[] | null = null;

  if (includeAllParts) {
    const pts: Pt[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (mask[y * w + x] === 1) pts.push({ x, y });
      }
    }
    if (pts.length < 3) return null;
    raw = convexHull(pts);
  } else {
    const { id, sizes } = labelComponents(mask, w, h);
    let largestId = -1, largestSize = 0;
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] > largestSize) { largestSize = sizes[i]; largestId = i; }
    }
    if (largestId === -1) return null;
    const comp = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (id[i] === largestId) comp[i] = 1;
    raw = traceOuterBoundary(comp, w, h);
  }

  if (!raw || raw.length < 3) return null;

  // Normalize to 0..1 (pixel centers → [0,1])
  const nxScale = w > 1 ? w - 1 : 1;
  const nyScale = h > 1 ? h - 1 : 1;
  const norm: Pt[] = raw.map(p => ({ x: p.x / nxScale, y: p.y / nyScale }));

  // Simplify
  const simple = simplifyToMax(norm, maxPoints);
  if (simple.length < 3) return null;

  // Area check: > 95% of unit box → it's a rectangle
  const area = polygonArea(simple);
  if (area > 0.95) return null;

  return simple;
}