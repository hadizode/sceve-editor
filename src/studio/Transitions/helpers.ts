import { useStudioStore } from '../../stores/store';
import type { SceneObject, SpriteFilter, TransformCondition, TransformRule } from '../../shared/types';

export type SetFn = (p: Partial<SceneObject>, key?: string) => void;
export type Trigger = 'click' | 'item' | 'auto';

export const st = () => useStudioStore.getState();

/** Truncate a name with an ellipsis, keeping it short for cramped UI. */
export const short = (s?: string, n = 26) =>
  (s ?? '').length > n ? `${s!.slice(0, n - 2)}…` : s ?? '';

export const shortName = short;

export const hasLists = (c?: TransformCondition) =>
  !!c && (!!c.transformedObjects?.length || !!c.itemsInInventory?.length || !!c.positions?.length);

export const condCount = (c?: TransformCondition) =>
  (c?.transformedObjects?.length ?? 0) +
  (c?.itemsInInventory?.length ?? 0) +
  (c?.positions?.length ?? 0);

/** Merge a patch into the condition; collapse to undefined only when nothing at all is left. */
export function mergeCond(
  c: TransformCondition | undefined,
  patch: Partial<TransformCondition>
): TransformCondition | undefined {
  const next: TransformCondition = { ...c, ...patch };
  (['transformedObjects', 'itemsInInventory', 'positions'] as const).forEach((k) => {
    if (!next[k]?.length) delete next[k];
  });
  if (!next.autoApply) delete next.autoApply;
  return hasLists(next) || next.autoApply ? next : undefined;
}

export function filterOrUndef(f: SpriteFilter): SpriteFilter | undefined {
  const o: SpriteFilter = {};
  if (f.invert) o.invert = f.invert;
  if (f.grayscale) o.grayscale = f.grayscale;
  if (f.hueRotate) o.hueRotate = f.hueRotate;
  if (f.brightness !== undefined && f.brightness !== 1) o.brightness = f.brightness;
  return Object.keys(o).length ? o : undefined;
}

export const triggerOf = (t: TransformRule): Trigger =>
  t.conditions?.autoApply && !t.requiresItem ? 'auto' : t.requiresItem ? 'item' : 'click';
