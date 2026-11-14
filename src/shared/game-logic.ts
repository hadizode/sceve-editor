import type { Scene, SceneObject, SessionState, TransformEffect, TransformRule } from '../types';

// ============ Context & rule bookkeeping ============

/** Optional lookup context so rules can reference objects in other scenes. */
export interface TransformContext {
  scenesById?: Record<string, Scene>;
}

/** All transform-rule indexes that have fired for `objectId`. */
export function firedOf(state: SessionState, objectId: string): number[] {
  return state.rulesFired?.[objectId] ?? [];
}

/** Mark the given rule indexes as fired for `objectId` (immutable, sorted, unique). */
export function markFired(state: SessionState, objectId: string, indexes: number[]): SessionState {
  const prev = firedOf(state, objectId);
  const next = [...new Set([...prev, ...indexes])].sort((a, b) => a - b);
  return { ...state, rulesFired: { ...(state.rulesFired ?? {}), [objectId]: next } };
}

/** Remove exactly one occurrence of `itemId` from the inventory (immutable). */
function removeOne(inventory: string[], itemId: string): string[] {
  const idx = inventory.indexOf(itemId);
  if (idx === -1) return inventory;
  const next = [...inventory];
  next.splice(idx, 1);
  return next;
}

/** Apply side-effect objects from fired rules. Unknown kinds are recorded, not executed here. */
export function applyEffects(state: SessionState, effects: TransformEffect[]): SessionState {
  if (!effects || effects.length === 0) return state;
  // Effects are consumed by the UI layer (sounds, particles, …). We keep them
  // attached to the session state so callers/slices can react to the newest batch.
  const prevApplied = (state as { appliedEffects?: TransformEffect[] }).appliedEffects ?? [];
  return { ...state, appliedEffects: [...prevApplied, ...effects] } as SessionState;
}

// ============ Object resolution across scenes ============

interface ResolvedObject {
  object: SceneObject;
  sceneId: string;
  objects: SceneObject[]; // objects of the scene containing it
}

function resolveObject(
  refId: string,
  ctx: TransformContext | undefined,
  fallbackSceneId: string,
  fallbackObjects: SceneObject[],
  currentObjectId: string,
): ResolvedObject | null {
  if (refId === 'self') {
    const obj = fallbackObjects.find(o => o.id === currentObjectId);
    if (obj) return { object: obj, sceneId: fallbackSceneId, objects: fallbackObjects };
  }
  // First look in the current scene / provided objects list.
  const local = fallbackObjects.find(o => o.id === refId);
  if (local) return { object: local, sceneId: fallbackSceneId, objects: fallbackObjects };
  // Then search all known scenes.
  if (ctx?.scenesById) {
    for (const scene of Object.values(ctx.scenesById)) {
      const found = scene.objects.find(o => o.id === refId);
      if (found) return { object: found, sceneId: scene.id, objects: scene.objects };
    }
  }
  return null;
}

// ============ Condition checks ============

/** Do the rule's conditions hold against `state`? Returns true when no conditions are set. */
export function checkTransformCondition(
  state: SessionState,
  rule: TransformRule,
  objectId: string,
  objects: SceneObject[],
  sceneId: string,
  ctx?: TransformContext,
): boolean {
  const c = rule.conditions;
  if (!c) return true;

  if (c.itemsInInventory && !c.itemsInInventory.every(item => state.inventory.includes(item))) {
    return false;
  }

  if (c.transformedObjects) {
    for (const req of c.transformedObjects) {
      const target = resolveObject(req.objectId, ctx, sceneId, objects, objectId);
      if (!target) return false;
      // Fired-index semantics: the required rule index must actually have fired.
      // This lets authors chain rules explicitly via { objectId: 'self', minRule: n }.
      if (!firedOf(state, target.object.id).includes(req.minRule ?? 0)) return false;
      if (c.prereqVisible && !prereqVisible(state, target.object.id, req.minRule ?? 0)) return false;
    }
  }

  if (c.checkPositions) {
    const self = resolveObject('self', ctx, sceneId, objects, objectId);
    if (!self) return false;
    for (const key of ['belowObjectId', 'aboveObjectId'] as const) {
      const refId = c.checkPositions[key];
      if (!refId) continue;
      const anchor = resolveObject(refId, ctx, sceneId, objects, objectId);
      if (!anchor) return false;
      const belowOk = anchor.object.y + anchor.object.height <= self.object.y;
      const aboveOk = self.object.y + self.object.height <= anchor.object.y;
      if (key === 'belowObjectId' && !belowOk) return false;
      if (key === 'aboveObjectId' && !aboveOk) return false;
    }
  }

  return true;
}

/**
 * Is the prerequisite object "shown"? With a specific `minRule`, the highest
 * fired index must be >= minRule. Without one, the object counts as shown when
 * discovered or when any of its rules has fired.
 */
export function prereqVisible(state: SessionState, objectId: string, minRule?: number): boolean {
  const fired = firedOf(state, objectId);
  if (typeof minRule === 'number') {
    const highest = fired.length > 0 ? Math.max(...fired) : -1;
    return highest >= minRule;
  }
  for (const ids of Object.values(state.discoveredObjects)) {
    if (ids.includes(objectId)) return true;
  }
  return fired.length > 0;
}

/** Human-readable reason why a rule did not fire (for hint messages), or null if satisfied. */
export function conditionFailMessage(
  state: SessionState,
  rule: TransformRule,
  objectId: string,
  objects: SceneObject[],
  sceneId: string,
  ctx?: TransformContext,
): string | null {
  const c = rule.conditions;
  if (!c) return null;

  if (c.itemsInInventory) {
    const missing = c.itemsInInventory.filter(item => !state.inventory.includes(item));
    if (missing.length > 0) return `شما به «${missing.join('، ')}» نیاز دارید`;
  }

  if (c.transformedObjects) {
    for (const req of c.transformedObjects) {
      const target = resolveObject(req.objectId, ctx, sceneId, objects, objectId);
      if (!target) return 'پیش‌نیاز یافت نشد';
      if (!firedOf(state, target.object.id).includes(req.minRule ?? 0)) {
        return `ابتدا باید تغییر قبلی اعمال شود (${target.object.name})`;
      }
      if (c.prereqVisible && !prereqVisible(state, target.object.id, req.minRule ?? 0)) {
        return `ابتدا باید ${target.object.name} فعال شود`;
      }
    }
  }

  if (c.checkPositions) {
    for (const refId of [c.checkPositions.belowObjectId, c.checkPositions.aboveObjectId]) {
      if (!refId) continue;
      const target = resolveObject(refId, ctx, sceneId, objects, objectId);
      if (!target) return 'پیش‌نیاز یافت نشد';
      if (!prereqVisible(state, target.object.id)) {
        return `ابتدا باید ${target.object.name} فعال شود`;
      }
    }
  }

  return null;
}

// ============ Pending rules ============

/**
 * All rules of `obj` that could fire right now against `state`:
 * not yet fired, matching the used item (or requiring none), and with all
 * conditions satisfied.
 */
export function pendingRules(
  obj: SceneObject,
  state: SessionState,
  itemId: string,
  objects: SceneObject[],
  sceneId: string,
  scenesById?: Record<string, Scene>,
): { index: number; rule: TransformRule }[] {
  const rules = obj.transforms ?? [];
  const ctx: TransformContext | undefined = scenesById ? { scenesById } : undefined;
  const hits: { index: number; rule: TransformRule }[] = [];
  rules.forEach((rule, index) => {
    if (firedOf(state, obj.id).includes(index)) return;
    if (rule.requiresItem && rule.requiresItem !== itemId) return;
    if (!checkTransformCondition(state, rule, obj.id, objects, sceneId, ctx)) return;
    hits.push({ index, rule });
  });
  return hits;
}

// ============ Auto transforms ============

/**
 * Fire every satisfiable autoApply rule (no item, not toggle) until stable.
 * Rules gate purely on their conditions/fired indexes — there is no
 * sequential next-index gate anymore, so several auto rules on one object
 * fire in a single pass.
 */
export function evaluateAutoTransforms(
  state: SessionState,
  scene: Scene,
  scenesById?: Record<string, Scene>,
): { newState: SessionState; transformed: boolean; messages: string[] } {
  let s = state;
  let transformedOverall = false;
  const messages: string[] = [];
  const ctx: TransformContext | undefined = scenesById ? { scenesById } : undefined;

  // Repeat until a full pass changes nothing (chained auto rules settle).
  for (let guard = 0; guard < 64; guard++) {
    let changedThisPass = false;

    for (const obj of scene.objects) {
      const rules = obj.transforms ?? [];
      const fired = firedOf(s, obj.id);
      const hits = rules
        .map((rule, index) => ({ index, rule }))
        .filter(({ index, rule }) =>
          !fired.includes(index) &&
          rule.conditions?.autoApply === true &&
          !rule.toggle &&
          !rule.requiresItem &&
          checkTransformCondition(s, rule, obj.id, scene.objects, scene.id, ctx),
        );
      if (hits.length === 0) continue;

      // Evaluate every hit against the same starting state `s`.
      let inv = s.inventory;
      let discoveredObjects = s.discoveredObjects;
      const collectedEffects: TransformEffect[] = [];
      const indexes: number[] = [];
      for (const { index, rule } of hits) {
        indexes.push(index);
        if (rule.grantsItem && !inv.includes(rule.grantsItem)) inv = [...inv, rule.grantsItem];
        if (rule.newMessage) messages.push(rule.newMessage);
        if (rule.effects) collectedEffects.push(...rule.effects);
      }
      s = markFired(s, obj.id, indexes);
      s = { ...s, inventory: inv };
      // Discovery is driven by triggersDiscovery (same as manual application).
      for (const { rule } of hits) {
        if (!rule.triggersDiscovery) continue;
        const disc = discoveredObjects[scene.id] || [];
        if (!disc.includes(obj.id)) {
          discoveredObjects = { ...discoveredObjects, [scene.id]: [...disc, obj.id] };
        }
      }
      s = { ...s, discoveredObjects };
      s = applyEffects(s, collectedEffects);
      changedThisPass = true;
      transformedOverall = true;
    }

    if (!changedThisPass) break;
  }

  return { newState: s, transformed: transformedOverall, messages };
}

// ============ Main entry: apply an item to an object ============

/**
 * Apply an inventory item to an object (with transform-rule support).
 * All pending (matching, unfired, condition-satisfied) rules fire at once
 * against the same starting state.
 */
export function applyItemToObject(
  state: SessionState,
  sceneId: string,
  objectId: string,
  itemId: string,
  objects: SceneObject[],
  ctx?: TransformContext,
): {
  newState: SessionState;
  success: boolean;
  message: string;
  transformed?: boolean;
  newObjectState?: Partial<SceneObject>;
} {
  const obj = objects.find(o => o.id === objectId);
  if (!obj) return { newState: state, success: false, message: 'مورد یافت نشد' };

  if (!state.inventory.includes(itemId)) {
    return { newState: state, success: false, message: 'شما این آیتم را ندارید' };
  }

  if (obj.transforms && obj.transforms.length > 0) {
    const fired = firedOf(state, obj.id);
    const hits = pendingRules(obj, state, itemId, objects, sceneId, ctx?.scenesById);

    if (hits.length > 0) {
      // Evaluate every hit against the same starting state.
      let newInventory = [...state.inventory];
      let newDiscoveredObjects = state.discoveredObjects;
      const newMessages: string[] = [];
      const allEffects: TransformEffect[] = [];
      const hitIndexes: number[] = [];

      for (const { index, rule } of hits) {
        hitIndexes.push(index);
        if (rule.requiresItem && rule.consumesItem !== false) {
          newInventory = removeOne(newInventory, rule.requiresItem);
        }
        if (rule.grantsItem && !newInventory.includes(rule.grantsItem)) {
          newInventory.push(rule.grantsItem);
        }
        if (rule.triggersDiscovery) {
          const sceneDiscovered = newDiscoveredObjects[sceneId] || [];
          if (!sceneDiscovered.includes(objectId)) {
            newDiscoveredObjects = {
              ...newDiscoveredObjects,
              [sceneId]: [...sceneDiscovered, objectId],
            };
          }
        }
        if (rule.newMessage) newMessages.push(rule.newMessage);
        if (rule.effects) allEffects.push(...rule.effects);
      }

      // Latest visual state wins: the highest-hit rule's overrides apply.
      const lastRule = hits[hits.length - 1].rule;
      const newObjectState: Partial<SceneObject> = {};
      if (lastRule.newImageUrl) newObjectState.imageUrl = lastRule.newImageUrl;
      if (lastRule.newName) newObjectState.name = lastRule.newName;

      let newState: SessionState = {
        ...state,
        inventory: newInventory,
        discoveredObjects: newDiscoveredObjects,
      };
      newState = markFired(newState, obj.id, hitIndexes);
      newState = applyEffects(newState, allEffects);

      const uniqueMessages = [...new Set(newMessages)];
      return {
        newState,
        success: true,
        message: uniqueMessages.length > 0 ? uniqueMessages.join(' • ') : 'با موفقیت استفاده شد',
        transformed: true,
        newObjectState,
      };
    }

    // Toggle branch: clicking again un-fires the last fired rule when it toggles.
    const lastFiredIndex = fired.length > 0 ? Math.max(...fired) : -1;
    const lastFiredRule = lastFiredIndex >= 0 ? obj.transforms[lastFiredIndex] : undefined;
    if (lastFiredRule?.toggle) {
      const remaining = fired.filter(i => i !== lastFiredIndex);
      // Revert visuals to the highest still-fired rule, or the original object.
      const rawVisuals: Partial<SceneObject> = {};
      if (remaining.length > 0) {
        const top = obj.transforms[Math.max(...remaining)];
        rawVisuals.imageUrl = top.newImageUrl ?? obj.imageUrl;
        rawVisuals.name = top.newName ?? obj.name;
      } else {
        rawVisuals.imageUrl = obj.imageUrl;
        rawVisuals.name = obj.name;
      }
      // transformsApplied == new max fired index (or -1); also mirrored in the
      // legacy currentTransform field so older consumers stay in sync.
      const maxRemaining = remaining.length > 0 ? Math.max(...remaining) : -1;
      const newObjectState: Partial<SceneObject> & { currentTransform?: number } = {
        ...rawVisuals,
        currentTransform: maxRemaining,
      };
      const newState: SessionState = {
        ...state,
        rulesFired: { ...(state.rulesFired ?? {}), [obj.id]: remaining },
      };
      return {
        newState,
        success: true,
        message: lastFiredRule.newMessage || 'با موفقیت استفاده شد',
        transformed: true,
        newObjectState,
      };
    }

    // Needs-item hint: some unfired rule wants an item we don't hold.
    const needsItem = obj.transforms.some(
      (rule, index) => !fired.includes(index) && !!rule.requiresItem,
    );

    // Conditions-not-met hint: first unfired rule whose item matches (or which
    // requires no item) and whose conditions fail.
    for (let index = 0; index < obj.transforms.length; index++) {
      if (fired.includes(index)) continue;
      const rule = obj.transforms[index];
      if (rule.requiresItem && rule.requiresItem !== itemId) continue;
      const fail = conditionFailMessage(state, rule, obj.id, objects, sceneId, ctx);
      if (fail) return { newState: state, success: false, message: fail };
    }

    if (needsItem) {
      return { newState: state, success: false, message: 'این آیتم اینجا کار نمی‌کند' };
    }
  }

  // Legacy fallback kept for compatibility with old container data: if the
  // object declares requiresItem (array) containing the used item and has no
  // transform rules at all, treat it as a one-shot container open.
  if (!obj.transforms || obj.transforms.length === 0) {
    if (obj.requiresItem && obj.requiresItem.includes(itemId)) {
      const sceneDiscovered = state.discoveredObjects[sceneId] || [];
      if (sceneDiscovered.includes(objectId)) {
        return { newState: state, success: false, message: 'این مورد قبلاً باز شده' };
      }
      let newInventory = [...state.inventory];
      if (obj.oneTimeUse) {
        newInventory = newInventory.filter((i: string) => i !== itemId);
      }
      if (obj.grantsItem && !newInventory.includes(obj.grantsItem)) {
        newInventory.push(obj.grantsItem);
      }
      const newState: SessionState = {
        ...state,
        inventory: newInventory,
        discoveredObjects: {
          ...state.discoveredObjects,
          [sceneId]: [...sceneDiscovered, objectId],
        },
      };
      return { newState, success: true, message: obj.message || 'مورد با موفقیت استفاده شد' };
    }
  }

  // Nothing matched: generic rejection.
  return { newState: state, success: false, message: 'این آیتم اینجا کار نمی‌کند' };
}
