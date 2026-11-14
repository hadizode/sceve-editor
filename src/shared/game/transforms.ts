import type { Scene, SceneObject, SessionState, TransformEffect } from '../types';
import {
  applyEffects,
  checkTransformCondition,
  conditionFailMessage,
  firedOf,
  markFired,
  pendingRules,
  removeOne,
  type RulesContext,
} from './rules-fired';

/** Extra context for applyItemToObject (all optional for backward compat). */
export interface ApplyItemContext extends RulesContext {}

/**
 * Apply an inventory item to an object (with transform support).
 * All currently-pending rules fire at once; toggles un-fire the last rule.
 */
export function applyItemToObject(
  state: SessionState,
  sceneId: string,
  objectId: string,
  itemId: string,
  objects: SceneObject[],
  ctx?: ApplyItemContext
): {
  newState: SessionState;
  success: boolean;
  message: string;
  transformed?: boolean;
  needsItem?: boolean;
  newObjectState?: Partial<SceneObject>;
} {
  const obj = objects.find(o => o.id === objectId);
  if (!obj) return { newState: state, success: false, message: 'مورد یافت نشد' };

  if (!state.inventory.includes(itemId)) {
    return { newState: state, success: false, message: 'شما این آیتم را ندارید' };
  }

  const scenesById: Record<string, Scene> | undefined = ctx?.scenesById;

  // ---- Multi-rule transform path ----
  if (obj.transforms && obj.transforms.length > 0) {
    const hits = pendingRules(obj, state, itemId, scenesById);

    if (hits.length) {
      // Evaluate every hit against the SAME starting state.
      let newInventory = [...state.inventory];
      let newDiscoveredObjects = state.discoveredObjects;
      const messages: string[] = [];
      const effects: TransformEffect[] = [];
      let imageUrl: string | undefined;
      let name: string | undefined;
      let maxIdx = -1;

      for (const { rule, i } of hits) {
        // Consume the used item once per rule that requires and consumes it.
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
        if (rule.newMessage) messages.push(rule.newMessage);
        if (rule.effects) effects.push(...rule.effects);
        if (rule.newImageUrl) imageUrl = rule.newImageUrl;
        if (rule.newName) name = rule.newName;
        if (i > maxIdx) maxIdx = i;
      }

      // Mark all fired indexes in one go, then fold effects into the state.
      let newState: SessionState = markFired(state, obj.id, hits.map(h => h.i));
      newState = {
        ...newState,
        inventory: newInventory,
        discoveredObjects: newDiscoveredObjects,
      };
      newState = applyEffects(newState, effects);

      const newObjectState: Partial<SceneObject> = { currentTransform: maxIdx };
      if (imageUrl !== undefined) newObjectState.imageUrl = imageUrl;
      if (name !== undefined) newObjectState.name = name;

      const unique = [...new Set(messages)];
      return {
        newState,
        success: true,
        message: unique.join(' • ') || 'با موفقیت استفاده شد',
        transformed: true,
        newObjectState,
      };
    }

    // Nothing fired. Does any unfired rule match this item at all?
    const fired = firedOf(state, obj.id);
    const unfiredMatching = obj.transforms.filter((rule, i) => {
      if (fired.includes(i)) return false;
      if (rule.conditions?.autoApply) return false;
      return rule.requiresItem ? rule.requiresItem === itemId : true;
    });
    const needsItem = unfiredMatching.length > 0;

    // "Conditions not met" hint: first unfired rule whose item matches (or is
    // empty/free) and whose conditions fail → explain why.
    const blocked = obj.transforms.find((rule, i) => {
      if (fired.includes(i)) return false;
      if (rule.conditions?.autoApply) return false;
      const itemOk = rule.requiresItem ? rule.requiresItem === itemId : true;
      if (!itemOk) return false;
      return !checkTransformCondition(rule.conditions, state, scenesById);
    });
    if (blocked) {
      return {
        newState: state,
        success: false,
        message: conditionFailMessage(blocked.conditions, state, scenesById) ?? 'شرط‌های این مورد هنوز برقرار نیست',
        needsItem,
      };
    }

    // Toggle branch: if the LAST rule has toggle and has fired, un-fire only
    // that index (transformsApplied becomes the new max, or -1).
    const lastIdx = obj.transforms.length - 1;
    const lastRule = obj.transforms[lastIdx];
    if (lastRule.toggle && fired.includes(lastIdx)) {
      const remaining = fired.filter(ix => ix !== lastIdx);
      let newState: SessionState = {
        ...state,
        rulesFired: { ...state.rulesFired, [obj.id]: remaining },
        transformsApplied: { ...state.transformsApplied, [obj.id]: remaining.length ? remaining[remaining.length - 1] : -1 },
      };
      // Undo the shown output when nothing remains fired.
      const newObjectState: Partial<SceneObject> = { currentTransform: remaining.length ? remaining[remaining.length - 1] : -1 };
      const shown = remaining.length ? obj.transforms[remaining[remaining.length - 1]] : undefined;
      if (shown?.newImageUrl) newObjectState.imageUrl = shown.newImageUrl;
      else if (!shown) newObjectState.imageUrl = obj.imageUrl;
      if (shown?.newName) newObjectState.name = shown.newName;
      else if (!shown) newObjectState.name = obj.name;
      return {
        newState,
        success: true,
        message: lastRule.newMessage || 'تغییر وضعیت اعمال شد',
        transformed: true,
        newObjectState,
      };
    }

    if (needsItem) {
      return { newState: state, success: false, message: 'به نظر می‌رسد این مورد به آیتم دیگری نیاز دارد', needsItem: true };
    }
  }

  // Fallback: check requiresItem (old behavior for containers)
  if (!obj.requiresItem || !obj.requiresItem.includes(itemId)) {
    return { newState: state, success: false, message: 'این آیتم اینجا کار نمی‌کند' };
  }

  const sceneDiscovered = state.discoveredObjects[sceneId] || [];
  if (sceneDiscovered.includes(objectId)) {
    return { newState: state, success: false, message: 'این مورد قبلاً باز شده' };
  }

  // Remove used item from inventory if oneTimeUse
  let newInventory = [...state.inventory];
  if (obj.oneTimeUse) {
    newInventory = newInventory.filter((i: string) => i !== itemId);
  }

  const newDiscoveredObjects = {
    ...state.discoveredObjects,
    [sceneId]: [...sceneDiscovered, objectId],
  };

  let grantsItem: string | undefined;
  if (obj.grantsItem && !newInventory.includes(obj.grantsItem)) {
    newInventory.push(obj.grantsItem);
    grantsItem = obj.grantsItem;
  }

  const newState: SessionState = {
    ...state,
    discoveredObjects: newDiscoveredObjects,
    inventory: newInventory,
  };

  return { newState, success: true, message: obj.message || 'مورد با موفقیت استفاده شد' };
}
