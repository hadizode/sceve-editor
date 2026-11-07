import type { SceneObject, SessionState } from '../types';

/**
 * Apply an inventory item to an object (with transform support).
 */
export function applyItemToObject(
  state: SessionState,
  sceneId: string,
  objectId: string,
  itemId: string,
  objects: SceneObject[]
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

  // Check if this object has transforms and this item matches one
  if (obj.transforms && obj.transforms.length > 0) {
    const currentTransform = obj.currentTransform ?? -1;
    const nextTransformIndex = currentTransform + 1;

    if (nextTransformIndex < obj.transforms.length) {
      const rule = obj.transforms[nextTransformIndex];

      if (rule.requiresItem === itemId) {
        // Apply transform
        let newInventory = [...state.inventory];

        // Consume item if specified (default: true)
        if (rule.consumesItem !== false) {
          newInventory = newInventory.filter((i: string) => i !== itemId);
        }

        // Grant new item if specified
        if (rule.grantsItem && !newInventory.includes(rule.grantsItem)) {
          newInventory.push(rule.grantsItem);
        }

        // Build new object state
        const newObjectState: Partial<SceneObject> = {
          currentTransform: nextTransformIndex,
        };

        if (rule.newImageUrl) newObjectState.imageUrl = rule.newImageUrl;
        if (rule.newName) newObjectState.name = rule.newName;

        // Mark as discovered if triggersDiscovery
        let newDiscoveredObjects = state.discoveredObjects;
        if (rule.triggersDiscovery) {
          const sceneDiscovered = state.discoveredObjects[sceneId] || [];
          if (!sceneDiscovered.includes(objectId)) {
            newDiscoveredObjects = {
              ...state.discoveredObjects,
              [sceneId]: [...sceneDiscovered, objectId],
            };
          }
        }

        const newState: SessionState = {
          ...state,
          inventory: newInventory,
          discoveredObjects: newDiscoveredObjects,
        };

        return {
          newState,
          success: true,
          message: rule.newMessage || 'با موفقیت استفاده شد',
          transformed: true,
          newObjectState,
        };
      }
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
