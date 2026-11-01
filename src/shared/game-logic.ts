import type { Scene, SceneObject, Session, SessionState, TransformRule } from './types';

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

/**
 * Check if a room/scene is complete (all objects with digits discovered).
 */
export function isRoomComplete(state: SessionState, scene: Scene): boolean {
  const discovered = state.discoveredObjects[scene.id] || [];
  const digitObjects = scene.objects.filter(o => o.digit !== undefined);
  return digitObjects.every(obj => discovered.includes(obj.id));
}

/**
 * Get discovered digits for a room.
 */
export function getRoomDigits(state: SessionState, scene: Scene): { digit: number; objectId: string }[] {
  const discovered = state.discoveredObjects[scene.id] || [];
  return scene.objects
    .filter(o => o.digit !== undefined && discovered.includes(o.id))
    .map(o => ({ digit: o.digit!, objectId: o.id }));
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

// ============ Geometry helpers (hit areas & polygon frames) ============

export interface Point { x: number; y: number }

/**
 * Compute the 4 corners (polygon) of a rotated object's bounding box.
 * Rotation is around the object's center, matching Konva semantics.
 */
export function getObjectCorners(obj: {
  x: number; y: number; width: number; height: number; rotation?: number;
}): Point[] {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const rad = ((obj.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const local: Point[] = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  return local.map(p => ({
    x: cx + p.x * cos - p.y * sin,
    y: cy + p.x * sin + p.y * cos,
  }));
}

/**
 * Flatten corners into a Konva Polygon `points` array [x1,y1,x2,y2,...].
 */
export function getCornersAsPoints(obj: {
  x: number; y: number; width: number; height: number; rotation?: number;
}): number[] {
  return getObjectCorners(obj).flatMap(p => [p.x, p.y]);
}

/**
 * Axis-aligned bounding box of the rotated object (used for label placement).
 */
export function getRotatedBounds(obj: {
  x: number; y: number; width: number; height: number; rotation?: number;
}): { minX: number; minY: number; maxX: number; maxY: number } {
  const pts = getObjectCorners(obj);
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * Point-in-polygon test (ray casting). Used to build accurate hit areas
 * so transparent image pixels don't swallow clicks on objects behind them.
 */
export function pointInPolygon(px: number, py: number, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersects = (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Build a Konva `hitFunc` for a clickable region of an object.
 *
 * Konva invokes `hitFunc` with the canvas context already transformed into
 * the shape's LOCAL coordinate space (position/rotation/scale applied), and
 * then performs its own point-in-path containment test. Tracing the desired
 * polygon here therefore gives an exact hit area for the object:
 *  - no custom `hitArea`  -> full width×height rectangle
 *  - custom `hitArea`     -> the flattened polygon [x1,y1,x2,y2,...]
 * This fixes the previous behavior where the whole bounding box of rotated
 * or irregularly-shaped art was clickable (and decorative overlays could
 * swallow clicks meant for objects behind them).
 */
export function createObjectHitFunc(width: number, height: number, hitArea?: number[]) {
  if (hitArea && hitArea.length >= 6) {
    const pts = hitArea;
    return (ctx: any) => {
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i + 1 < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
    };
  }
  return (ctx: any) => {
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.closePath();
  };
}

/**
 * Convert a flattened [x1,y1,x2,y2,...] array into Point[].
 */
export function toPoints(flat: number[]): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  return pts;
}
