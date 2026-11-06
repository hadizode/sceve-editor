import type { Scene, SceneObject, SessionState } from '../types';

/**
 * Discover an object in a scene. Returns updated state or null if already discovered.
 */
export function discoverObject(
  state: SessionState,
  sceneId: string,
  objectId: string,
  objects: SceneObject[]
): { newState: SessionState; message?: string; alreadyDiscovered: boolean; grantsItem?: string } {
  const sceneDiscovered = state.discoveredObjects[sceneId] || [];

  if (sceneDiscovered.includes(objectId)) {
    return { newState: state, alreadyDiscovered: true, message: 'این مورد قبلاً کشف شده است' };
  }

  const obj = objects.find(o => o.id === objectId);
  if (!obj) {
    return { newState: state, alreadyDiscovered: false, message: 'مورد یافت نشد' };
  }

  // Check if object requires an item
  if (obj.requiresItem && obj.requiresItem.length > 0) {
    const hasRequired = obj.requiresItem.every(item => state.inventory.includes(item));
    if (!hasRequired) {
      return { newState: state, alreadyDiscovered: false, message: 'برای باز کردن این مورد به آیتم خاصی نیاز دارید' };
    }
  }

  const newDiscovered = [...sceneDiscovered, objectId];
  const newDiscoveredObjects = { ...state.discoveredObjects, [sceneId]: newDiscovered };

  let newInventory = [...state.inventory];
  let grantsItem: string | undefined;

  if (obj.grantsItem) {
    if (!newInventory.includes(obj.grantsItem)) {
      newInventory.push(obj.grantsItem);
      grantsItem = obj.grantsItem;
    }
  }

  const newState: SessionState = {
    ...state,
    discoveredObjects: newDiscoveredObjects,
    inventory: newInventory,
  };

  return {
    newState,
    alreadyDiscovered: false,
    message: obj.message,
    grantsItem,
  };
}

/**
 * Pick up an object into inventory (if pickupable).
 */
export function pickupObject(
  state: SessionState,
  sceneId: string,
  objectId: string,
  objects: SceneObject[]
): { newState: SessionState; message?: string; success: boolean; itemId?: string } {
  const obj = objects.find(o => o.id === objectId);
  if (!obj) {
    return { newState: state, success: false, message: 'مورد یافت نشد' };
  }

  if (!obj.pickupable) {
    return { newState: state, success: false, message: 'این مورد قابل برداشتن نیست' };
  }

  const itemId = obj.pickupItemId || obj.id;
  let newInventory = [...state.inventory];

  if (newInventory.includes(itemId)) {
    return { newState: state, success: false, message: 'این مورد قبلاً برداشته شده' };
  }

  newInventory.push(itemId);

  // Mark as discovered so it disappears
  const sceneDiscovered = state.discoveredObjects[sceneId] || [];
  const newDiscoveredObjects = {
    ...state.discoveredObjects,
    [sceneId]: [...sceneDiscovered, objectId],
  };

  const newState: SessionState = {
    ...state,
    inventory: newInventory,
    discoveredObjects: newDiscoveredObjects,
  };

  return {
    newState,
    success: true,
    message: obj.pickupMessage || obj.message,
    itemId,
  };
}
