import type {
  Scene,
  SceneObject,
  SessionState,
  TransformCondition,
  TransformEffect,
  TransformRule,
} from '../types';

/** Extra context threaded through the rules engine (all fields optional for back-compat). */
export interface RulesContext {
  scenesById?: Record<string, Scene>;
  /** All objects of the scene the interaction happens in (used by prereqVisible / positions). */
  sceneObjects?: SceneObject[];
}

/**
 * Remove exactly one occurrence of `itemId` from the inventory (pure).
 * Unlike a blanket filter, duplicates survive a single consumption.
 */
export const removeOne = (inventory: string[], itemId: string): string[] => {
  const idx = inventory.indexOf(itemId);
  if (idx === -1) return [...inventory];
  return [...inventory.slice(0, idx), ...inventory.slice(idx + 1)];
};

/**
 * Fold a list of rule effects into a session state in one pass (pure).
 * Fired-index bookkeeping is NOT done here — callers use markFired separately.
 */
export function applyEffects(s: SessionState, effects: TransformEffect[]): SessionState {
  if (!effects.length) return s;
  const out: SessionState = { ...s, inventory: [...s.inventory], completedScenes: [...s.completedScenes] };
  for (const e of effects) {
    if (e.removeItem !== undefined) out.inventory = removeOne(out.inventory, e.removeItem);
    if (e.grantItem !== undefined && !out.inventory.includes(e.grantItem)) out.inventory.push(e.grantItem);
    if (e.completeSceneId !== undefined && !out.completedScenes.includes(e.completeSceneId)) {
      out.completedScenes.push(e.completeSceneId);
    }
    if (e.discoverObjectId !== undefined) {
      const sceneId = e.sceneId ?? out.currentSceneId;
      const list = out.discoveredObjects[sceneId] || [];
      if (!list.includes(e.discoverObjectId)) {
        out.discoveredObjects = { ...out.discoveredObjects, [sceneId]: [...list, e.discoverObjectId] };
      }
    }
  }
  return out;
}

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

  // transformedObjects: exact rule indexes must have FIRED (firedOf), not merely
  // "highest fired index >= minRule". This lets authors chain rules explicitly:
  // rule B with {transformedObjects:[{objectId: self, minRule: 0}]}.
  if (conditions.transformedObjects) {
    const ok = conditions.transformedObjects.every(req =>
      firedOf(state, req.objectId).includes(req.minRule ?? 0)
    );
    if (!ok) return false;
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

/**
 * Human-readable reason why a rule's conditions are not met yet, or null when
 * they already hold. Used for the "conditions not met" hint in applyItemToObject.
 */
export function conditionFailMessage(
  conditions: TransformCondition | undefined,
  state: SessionState,
  scenesById?: Record<string, Scene>
): string | null {
  if (!conditions) return null;
  if (checkTransformCondition(conditions, state, scenesById)) return null;

  if (conditions.hasItems && !conditions.hasItems.every(item => state.inventory.includes(item))) {
    const missing = conditions.hasItems.filter(item => !state.inventory.includes(item));
    return `برای فعال شدن این مورد به آیتم‌های زیر نیاز دارید: ${missing.join('، ')}`;
  }

  if (conditions.completedScenes && !conditions.completedScenes.every(id => state.completedScenes.includes(id))) {
    return 'ابتدا باید اتاق‌های لازم را کامل کنید';
  }

  if (conditions.discoveredObjects) {
    const allDiscovered = Object.values(state.discoveredObjects).flat();
    if (!conditions.discoveredObjects.every(id => allDiscovered.includes(id))) {
      return 'ابتدا باید موارد لازم را کشف کنید';
    }
  }

  if (conditions.crossSceneObjects) {
    if (!scenesById) return 'این شرط فعلاً قابل بررسی نیست';
    const discoveredInScene = (sceneId: string, objectId: string) =>
      (state.discoveredObjects[sceneId] || []).includes(objectId);
    const found = conditions.crossSceneObjects.every(objectId =>
      Object.values(scenesById).some(scene =>
        scene.objects.some(o => o.id === objectId) && discoveredInScene(scene.id, objectId)
      )
    );
    if (!found) return 'موارد مرتبط در سایر اتاق‌ها هنوز کشف نشده‌اند';
  }

  // transformedObjects now checks EXACT fired indexes via firedOf, so an
  // out-of-order save (e.g. only rule 1 fired) correctly fails a minRule:0 req.
  if (conditions.transformedObjects) {
    const failedReq = conditions.transformedObjects.find(
      req => !firedOf(state, req.objectId).includes(req.minRule ?? 0)
    );
    if (failedReq) {
      return `ابتدا باید مرحله قبلی (${failedReq.objectId}) انجام شود`;
    }
  }

  return 'شرط‌های این مورد هنوز برقرار نیست';
}

/**
 * Whether a prerequisite object should be considered "visible/shown":
 *  - the exact rule index required by `req.minRule` must have fired (firedOf),
 *  - the "shown rule" lookup uses the HIGHEST fired index of that object —
 *    its newImageUrl/newName override what the prerequisite displays.
 * Returns false when nothing has fired yet.
 */
export function prereqVisible(
  req: { objectId: string; minRule?: number },
  state: SessionState,
  objects: SceneObject[]
): boolean {
  const fired = firedOf(state, req.objectId);
  if (!fired.includes(req.minRule ?? 0)) return false;
  // Highest fired index selects the shown rule output (as before).
  const highest = fired[fired.length - 1];
  const obj = objects.find(o => o.id === req.objectId);
  const shownRule = obj?.transforms?.[highest];
  // If the shown rule exists, it counts as visible; a fired rule with no entry
  // (defensive) still counts as visible since something fired at/after it.
  return shownRule !== undefined || fired.length > 0;
}

/**
 * Position gate used by the auto-transform evaluator: every object referenced
 * by the rule's discoveredObjects/crossSceneObjects prerequisites must exist
 * and be visible in the scene graph. With no position data available this is
 * permissive (returns true) so existing behaviour is unchanged.
 */
function checkPositions(rule: TransformRule, state: SessionState, ctx?: RulesContext): boolean {
  const objects = ctx?.sceneObjects ?? [];
  const scenesById = ctx?.scenesById;
  if (!objects.length && !scenesById) return true;
  const cond = rule.conditions;
  if (!cond?.discoveredObjects?.length && !cond?.crossSceneObjects?.length) return true;
  const ids = [...(cond?.discoveredObjects ?? []), ...(cond?.crossSceneObjects ?? [])];
  return ids.every(id => {
    const existsHere = objects.some(o => o.id === id && o.visible);
    const existsElsewhere = scenesById
      ? Object.values(scenesById).some(sc => sc.objects.some(o => o.id === id && o.visible))
      : false;
    return existsHere || existsElsewhere;
  });
}

/**
 * Fire every applicable auto-apply rule until the state stabilises.
 * There is no sequential index gate (no `applied + 1` check): a rule fires as
 * soon as it has not fired yet, is auto-applied, is not a toggle, needs no
 * item, and its prereqs hold — so several satisfiable auto rules fire in one
 * pass. The outer loop repeats until nothing new fires (chained rules).
 */
export function evaluateAutoTransforms(
  s: SessionState,
  scene: Scene,
  ctx?: RulesContext
): { newState: SessionState; messages: string[]; updatedObjects: SceneObject[] } {
  const scenesById = ctx?.scenesById ?? { [scene.id]: scene };
  let state = s;
  let objects = scene.objects;
  const messages: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const obj of objects) {
      const fired = firedOf(state, obj.id);
      const hits = (obj.transforms ?? [])
        .map((rule, i) => ({ rule, i }))
        .filter(
          ({ rule, i }) =>
            !fired.includes(i) && // not fired yet
            !!rule.conditions?.autoApply && // auto-applied
            !rule.toggle && // toggles are click-driven, never automatic
            !rule.requiresItem && // free rules only
            (rule.conditions?.hasItems ?? []).every(item => state.inventory.includes(item)) &&
            (rule.conditions?.transformedObjects ?? []).every(req => prereqVisible(req, state, objects)) &&
            checkPositions(rule, state, { ...ctx, scenesById, sceneObjects: objects }) &&
            checkTransformCondition(rule.conditions, state, scenesById)
        );
      if (!hits.length) continue;
      changed = true;

      // Evaluate every hit against the SAME starting state.
      const base = state;
      const grants: (string | undefined)[] = [];
      const discoveries: string[] = [];
      const effects: TransformEffect[] = [];
      for (const { rule } of hits) {
        if (rule.newMessage) messages.push(rule.newMessage);
        grants.push(rule.grantsItem);
        if (rule.triggersDiscovery) discoveries.push(obj.id);
        if (rule.effects) effects.push(...rule.effects);
      }

      state = markFired(base, obj.id, hits.map(h => h.i));
      for (const g of grants) {
        if (g && !state.inventory.includes(g)) state = { ...state, inventory: [...state.inventory, g] };
      }
      for (const d of discoveries) {
        const list = state.discoveredObjects[scene.id] || [];
        if (!list.includes(d)) {
          state = { ...state, discoveredObjects: { ...state.discoveredObjects, [scene.id]: [...list, d] } };
        }
      }
      state = applyEffects(state, effects);

      // Reflect the highest fired rule's output on the object itself.
      const shownIdx = Math.max(...firedOf(state, obj.id));
      const shown = obj.transforms?.[shownIdx];
      if (shown) {
        objects = objects.map(o => {
          if (o.id !== obj.id) return o;
          const next = { ...o };
          if (shown.newImageUrl) next.imageUrl = shown.newImageUrl;
          if (shown.newName) next.name = shown.newName;
          next.currentTransform = shownIdx;
          return next;
        });
      }
    }
  }
  return { newState: state, messages, updatedObjects: objects };
}
