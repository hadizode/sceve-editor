import type { Scene, SceneObject, SessionState } from './types';

// ============ Pure Game Logic Functions ============

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
} {
  const obj = objects.find(o => o.id === objectId);
  if (!obj) return { newState: state, success: false, message: 'مورد یافت نشد' };
  
  if (!state.inventory.includes(itemId)) {
    return { newState: state, success: false, message: 'شما این آیتم را ندارید' };
  }

  // Check if this object has transforms and the *next* rule requires this item.
  // Progress is tracked in session state (`transformsApplied`), never on the editable object.
  if (obj.transforms && obj.transforms.length > 0) {
    const currentTransform = (state.transformsApplied ?? {})[objectId] ?? -1;
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
          transformsApplied: { ...(state.transformsApplied ?? {}), [objectId]: nextTransformIndex },
        };

        return {
          newState,
          success: true,
          message: rule.newMessage || 'با موفقیت استفاده شد',
          transformed: true,
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

  if (obj.grantsItem && !newInventory.includes(obj.grantsItem)) {
    newInventory.push(obj.grantsItem);
  }

  const newState: SessionState = {
    ...state,
    discoveredObjects: newDiscoveredObjects,
    inventory: newInventory,
  };

  return { newState, success: true, message: obj.message || 'مورد با موفقیت استفاده شد' };
}

/**
 * Every object in a room that carries a digit, together with the discovery scope it is tracked under:
 * top-level objects are tracked under the scene id, objects inside a close-up view under the parent object's id.
 * (Digits inside views used to be ignored, so a room whose digit lived in a view could never be completed.)
 */
export function roomDigitTargets(scene: Scene): { scopeId: string; obj: SceneObject }[] {
  const out: { scopeId: string; obj: SceneObject }[] = [];
  for (const o of scene.objects) {
    if (o.digit !== undefined) out.push({ scopeId: scene.id, obj: o });
    for (const v of o.view?.objects ?? []) {
      if (v.digit !== undefined) out.push({ scopeId: o.id, obj: v });
    }
  }
  return out;
}

/**
 * Check if a room/scene is complete (all objects with digits discovered).
 */
export function isRoomComplete(state: SessionState, scene: Scene): boolean {
  return roomDigitTargets(scene).every(({ scopeId, obj }) => (state.discoveredObjects[scopeId] || []).includes(obj.id));
}

/**
 * Get discovered digits for a room.
 */
export function getRoomDigits(state: SessionState, scene: Scene): { digit: number; objectId: string }[] {
  return roomDigitTargets(scene)
    .filter(({ scopeId, obj }) => (state.discoveredObjects[scopeId] || []).includes(obj.id))
    .map(({ obj }) => ({ digit: obj.digit!, objectId: obj.id }));
}

/**
 * Validate the final lock entry.
 */
export function validateFinalLock(
  state: SessionState,
  scenes: Scene[],
  enteredDigits: string
): { valid: boolean; message: string } {
  const expectedDigits = scenes
    .map(s => s.exitNumber.toString())
    .join('');
  
  if (enteredDigits === expectedDigits) {
    return { valid: true, message: 'تبریک! شما موفق شدید!' };
  }
  return { valid: false, message: 'رمز اشتباه است. دوباره تلاش کنید.' };
}

/**
 * Get the next clue in the chain based on what's been discovered.
 */
export function getNextClue(state: SessionState, scene: Scene): SceneObject | null {
  const discovered = state.discoveredObjects[scene.id] || [];
  for (const chainId of scene.clueChain) {
    if (!discovered.includes(chainId)) {
      return scene.objects.find(o => o.id === chainId) || null;
    }
  }
  return null;
}

/**
 * Check if all rooms are complete.
 */
export function allRoomsComplete(state: SessionState, scenes: Scene[]): boolean {
  return scenes.every(scene => isRoomComplete(state, scene));
}
