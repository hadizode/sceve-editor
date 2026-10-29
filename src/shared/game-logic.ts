import type { Scene, SceneObject, Session, SessionState } from './types';

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
 * Check if a room/scene is complete (all number-pieces discovered).
 */
export function isRoomComplete(state: SessionState, scene: Scene): boolean {
  const discovered = state.discoveredObjects[scene.id] || [];
  const numberPieces = scene.objects.filter(o => o.type === 'number-piece');
  return numberPieces.every(np => discovered.includes(np.id));
}

/**
 * Get discovered digits for a room.
 */
export function getRoomDigits(state: SessionState, scene: Scene): { digit: number; objectId: string }[] {
  const discovered = state.discoveredObjects[scene.id] || [];
  return scene.objects
    .filter(o => o.type === 'number-piece' && discovered.includes(o.id) && o.number !== undefined)
    .map(o => ({ digit: o.number!, objectId: o.id }));
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

/**
 * Apply item to container (use inventory item on an object).
 */
export function applyItemToContainer(
  state: SessionState,
  sceneId: string,
  objectId: string,
  itemId: string,
  objects: SceneObject[]
): { newState: SessionState; success: boolean; message: string } {
  const obj = objects.find(o => o.id === objectId);
  if (!obj) return { newState: state, success: false, message: 'مورد یافت نشد' };
  
  if (!obj.requiresItem || !obj.requiresItem.includes(itemId)) {
    return { newState: state, success: false, message: 'این آیتم اینجا کار نمی‌کند' };
  }
  
  if (!state.inventory.includes(itemId)) {
    return { newState: state, success: false, message: 'شما این آیتم را ندارید' };
  }

  // Remove used item from inventory if oneTimeUse
  let newInventory = [...state.inventory];
  if (obj.oneTimeUse) {
    newInventory = newInventory.filter(i => i !== itemId);
  }

  // Discover the object
  const sceneDiscovered = state.discoveredObjects[sceneId] || [];
  if (sceneDiscovered.includes(objectId)) {
    return { newState: state, success: false, message: 'این مورد قبلاً باز شده' };
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
