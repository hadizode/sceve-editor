import type { Scene, SceneObject, SessionState, TransformCondition, TransformRule } from '../types';

/**
 * Check a transform rule's conditions against the current session state.
 * Returns true when there are no conditions or every condition is satisfied.
 */
export function checkTransformCondition(
  conditions: TransformCondition | undefined,
  state: SessionState,
  scenesById?: Record<string, Scene>
): boolean {
  if (!conditions) return true;

  if (conditions.hasItems && !conditions.hasItems.every(item => state.inventory.includes(item))) {
    return false;
  }

  if (conditions.completedScenes && !conditions.completedScenes.every(id => state.completedScenes.includes(id))) {
    return false;
  }

  if (conditions.discoveredObjects) {
    const allDiscovered = Object.values(state.discoveredObjects).flat();
    if (!conditions.discoveredObjects.every(id => allDiscovered.includes(id))) {
      return false;
    }
  }

  if (conditions.crossSceneObjects) {
    if (!scenesById) return false; // cannot verify cross-scene refs without the scene index
    const discoveredInScene = (sceneId: string, objectId: string) =>
      (state.discoveredObjects[sceneId] || []).includes(objectId);
    const found = conditions.crossSceneObjects.every(objectId =>
      Object.values(scenesById).some(scene =>
        scene.objects.some(o => o.id === objectId) && discoveredInScene(scene.id, objectId)
      )
    );
    if (!found) return false;
  }

  return true;
}

/**
 * Indexes of every transform rule that has fired for an object.
 * Backward-compat: old saves only stored `transformsApplied[id] = k` (the
 * highest fired index), which is expanded to [0..k].
 */
export const firedOf = (s: SessionState, id: string): number[] => {
  const explicit = s.rulesFired?.[id];
  if (explicit) return explicit;
  const k = s.transformsApplied?.[id];
  if (typeof k === 'number' && k >= 0) {
    return Array.from({ length: k + 1 }, (_, i) => i);
  }
  return [];
};

/**
 * Mark rules `idxs` as fired for object `id`. Pure — returns a new state.
 * Maintains both representations:
 *   rulesFired[id] = sorted union of fired indexes
 *   transformsApplied[id] = highest fired index
 */
export function markFired(s: SessionState, id: string, idxs: number[]): SessionState {
  const all = [...new Set([...firedOf(s, id), ...idxs])].sort((a, b) => a - b);
  return {
    ...s,
    rulesFired: { ...s.rulesFired, [id]: all },
    transformsApplied: { ...s.transformsApplied, [id]: all[all.length - 1] },
  };
}

/**
 * Every rule on `obj` that is currently eligible to fire:
 *  - it has not fired yet,
 *  - it is not auto-applied,
 *  - its item requirement matches `itemId` (free rules match only when no item is used),
 *  - its conditions hold against the session state.
 */
export function pendingRules(
  obj: SceneObject,
  state: SessionState,
  itemId: string | null,
  scenesById?: Record<string, Scene>
): { rule: TransformRule; i: number }[] {
  const fired = firedOf(state, obj.id);
  const out: { rule: TransformRule; i: number }[] = [];
  (obj.transforms ?? []).forEach((rule, i) => {
    if (fired.includes(i)) return;
    if (rule.conditions?.autoApply) return;
    const itemOk = rule.requiresItem ? rule.requiresItem === itemId : itemId === null;
    if (!itemOk) return;
    if (!checkTransformCondition(rule.conditions, state, scenesById)) return;
    out.push({ rule, i });
  });
  return out;
}
