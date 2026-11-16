// ---------- Pure helpers for SceneStage gestures (pinch zoom + pan) ----------
import type { Pt } from '../shared/types';

/** Clamp `v` into `[min, max]`. */
export const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

/** Size with width/height, used by clampPan. */
export interface GestureRect {
  w: number;
  h: number;
}

/**
 * Clamp a pan offset so the content always covers the viewport.
 *
 * - When the content is larger than the viewport on an axis, pan is limited so
 *   no empty edge appears on that axis (room / cover mode).
 * - When the content is smaller than the viewport on an axis (e.g. a contain
 *   mode close-up view), the axis is centered instead (pan = 0) since empty
 *   edges are unavoidable.
 */
export function clampPan(pan: Pt, content: GestureRect, viewport: GestureRect): Pt {
  const mx = (content.w - viewport.w) / 2;
  const my = (content.h - viewport.h) / 2;
  return {
    x: mx >= 0 ? clamp(pan.x, -mx, mx) : 0,
    y: my >= 0 ? clamp(pan.y, -my, my) : 0,
  };
}

/** Distance between two points. */
export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Centroid of a list of points. */
export const centroid = (pts: Pt[]): Pt => ({
  x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
  y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
});
