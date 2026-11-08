// ============ Opacity animation (two-state sprite cross-fade) ============
/** Easing keywords mirrored from CSS transitions. */
export type OpacityEasing = 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface OpacityAnim {
  /** Duration in ms. `0` means no animation (instant swap). */
  duration?: number;
  easing?: OpacityEasing;
  /** Delay before starting, in ms. */
  delay?: number;
}

export const OPACITY_ANIM_DEFAULT: Required<OpacityAnim> = {
  duration: 500,
  easing: 'ease',
  delay: 0,
};

export function normalizeOpacityAnim(a?: OpacityAnim): Required<OpacityAnim> {
  const d = a?.duration;
  return {
    duration: d !== undefined && Number.isFinite(d) ? Math.max(0, Math.floor(d)) : OPACITY_ANIM_DEFAULT.duration,
    easing: a?.easing ?? OPACITY_ANIM_DEFAULT.easing,
    delay: a?.delay !== undefined && Number.isFinite(a.delay) ? Math.max(0, Math.floor(a.delay)) : OPACITY_ANIM_DEFAULT.delay,
  };
}

/** CSS `transition` value for opacity. Empty string when duration is 0 (instant). */
export function opacityTransitionCss(anim?: OpacityAnim): string {
  const n = normalizeOpacityAnim(anim);
  if (n.duration <= 0) return '';
  const delay = n.delay ? ` ${n.delay}ms` : '';
  return `opacity ${n.duration}ms ${n.easing}${delay}`;
}

/**
 * Pick the fade to use when moving between two rule indexes of the same object.
 * - Applying (i → j where j > i):  use rules[j]?.fade (the rule being applied).
 * - Reverting  (i → j where j < i): use rules[i]?.fade (the rule being left).
 * - Same index or missing fade: undefined.
 * - Out-of-range / negative indexes: undefined (safe).
 */
export function swapFade(
  rules: ReadonlyArray<{ fade?: OpacityAnim } | undefined | null>,
  fromIdx: number,
  toIdx: number,
): OpacityAnim | undefined {
  if (fromIdx < 0 || toIdx < 0) return undefined;
  if (fromIdx >= rules.length || toIdx >= rules.length) return undefined;
  if (toIdx > fromIdx) return rules[toIdx]?.fade;
  if (toIdx < fromIdx) return rules[fromIdx]?.fade;
  return undefined;
}


