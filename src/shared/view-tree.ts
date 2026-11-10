import type { Scene, SceneObject } from './types';

// ============ View tree ============
// Views nest: any object can own a close-up view, and objects inside that view can own views themselves.
// Object ids are unique per project, so `viewId` always means the id of the object that OWNS the view.

/** Maximum nesting depth of views (view inside view inside …). Objects at depth 0..MAX_VIEW_DEPTH-1 may own a view. */
export const MAX_VIEW_DEPTH = 4;

/** Every object in `objects` plus every object inside any nested view, depth-first (parents before children). */
export function allObjectsDeep(objects: SceneObject[]): SceneObject[] {
  const out: SceneObject[] = [];
  const walk = (list: SceneObject[]): void => {
    for (const o of list) {
      out.push(o);
      if (o.view) walk(o.view.objects);
    }
  };
  walk(objects);
  return out;
}

/** Find an object by id at any nesting depth. */
export function findObject(objects: SceneObject[], id: string): SceneObject | undefined {
  for (const o of objects) {
    if (o.id === id) return o;
    if (o.view) {
      const found = findObject(o.view.objects, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Ids from the top-level object down to the object itself (the last element is `id`).
 * Empty array when the id is not found.
 */
export function objectPath(objects: SceneObject[], id: string): string[] {
  const path: string[] = [];
  const walk = (list: SceneObject[]): boolean => {
    for (const o of list) {
      path.push(o.id);
      if (o.id === id) return true;
      if (o.view && walk(o.view.objects)) return true;
      path.pop();
    }
    return false;
  };
  return walk(objects) ? path : [];
}

/**
 * Immutable deep update of the object with `id`.
 * Returns the SAME array reference when nothing changed (id missing or `fn` returned the same object).
 */
export function mapObject(
  objects: SceneObject[],
  id: string,
  fn: (o: SceneObject) => SceneObject
): SceneObject[] {
  let changed = false;
  const walk = (list: SceneObject[]): SceneObject[] => {
    let next: SceneObject[] | undefined = undefined;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      let updated = o;
      if (o.view) {
        const nested = walk(o.view.objects);
        if (nested !== o.view.objects) {
          changed = true;
          updated = { ...o, view: { ...o.view, objects: nested } };
        }
      }
      if (o.id === id) {
        const replaced = fn(updated);
        if (replaced !== updated) changed = true;
        updated = replaced;
      }
      if (updated !== o) {
        if (next === undefined) next = list.slice();
        next[i] = updated;
      }
    }
    return next ?? list;
  };
  return walk(objects);
}

/**
 * The objects currently being edited: the scene's top-level objects when `ownerId` is empty,
 * otherwise that owner's `view.objects` (deep lookup), or `[]` when the owner has no view.
 */
export function viewObjects(scene: Scene, ownerId = ''): SceneObject[] {
  if (!ownerId) return scene.objects;
  const owner = findObject(scene.objects, ownerId);
  return owner?.view?.objects ?? [];
}
