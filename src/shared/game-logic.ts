import type { Scene, SceneObject, SessionState, TransformEffect } from './types';

// ============ Effects / Transitions Engine ============
// A strong, separate part of the game logic: when something happens (a transform fires, an item is
// picked up), attached EFFECTS can reach outside the clicked object — automatically applying a
// transform on ANOTHER object (even in another room), changing another room's BACKGROUND, or opening
// a DOOR so the player can walk into another room.

/** One entry per scene; `null` means "this scene was already visited" (so its rules run once). */
export interface EffectCtx {
  scenesById: Record<string, Scene>;
  visited: Set<string>;
  messages: string[];
}

const pushMsg = (ctx: EffectCtx, m?: string) => {
  if (m && !ctx.messages.includes(m)) ctx.messages.push(m);
};

/** Apply one effect to the session state. Returns the updated state (same ref when nothing changed). */
function applyEffect(state: SessionState, eff: TransformEffect, triggerSceneId: string, ctx: EffectCtx): SessionState {
  const targetScene = eff.sceneId ? ctx.scenesById[eff.sceneId] : ctx.scenesById[triggerSceneId];
  const scopeId = eff.sceneId || triggerSceneId;

  // --- change another room's (or a close-up view's) background ---
  if (eff.action === 'background') {
    if (!eff.newSpriteId) return state;
    // objectId may point at a close-up view inside the scene → override that view's background instead.
    let key = targetScene?.id ?? scopeId;
    if (eff.objectId) {
      const holder = targetScene?.objects.find((o) => o.view && (o.view.id === eff.objectId || o.id === eff.objectId));
      if (holder?.view) key = holder.view.id;
    }
    if (!targetScene && !state.backgrounds?.[key]) return state;
    if (state.backgrounds?.[key] === eff.newSpriteId) return state;
    return { ...state, backgrounds: { ...(state.backgrounds ?? {}), [key]: eff.newSpriteId } };
  }

  // --- open a door (object with `door`) so the player can enter another room ---
  if (eff.action === 'unlockDoor') {
    if (!eff.doorObjectId) return state;
    const doors = state.openDoors ?? [];
    if (doors.includes(eff.doorObjectId)) return state;
    return { ...state, openDoors: [...doors, eff.doorObjectId] };
  }

  // --- automatically apply a transform rule on another object ---
  if (eff.action !== 'transform' || !targetScene) return state;
  const list = [
    ...targetScene.objects,
    ...targetScene.objects.flatMap((o) => (o.view ? o.view.objects : [])),
  ];
  const obj = list.find((o) => o.id === eff.objectId);
  if (!obj?.transforms?.length) return state;
  const idx = eff.ruleIndex ?? 0;
  const rule = obj.transforms[idx];
  if (!rule) return state;
  // Idempotent: each (scene, object) gets its automatic chain applied once, following links forward.
  if (ctx.visited.has(`${scopeId}|${obj.id}`)) return state;
  ctx.visited.add(`${scopeId}|${obj.id}`);

  let next = state;
  if (rule.grantsItem && !next.inventory.includes(rule.grantsItem)) {
    next = { ...next, inventory: [...next.inventory, rule.grantsItem] };
  }
  if (rule.triggersDiscovery) {
    const d = next.discoveredObjects[scopeId] || [];
    if (!d.includes(obj.id)) {
      next = { ...next, discoveredObjects: { ...next.discoveredObjects, [scopeId]: [...d, obj.id] } };
    }
  }
  next = { ...next, transformsApplied: { ...(next.transformsApplied ?? {}), [obj.id]: Math.max(next.transformsApplied?.[obj.id] ?? -1, idx) } };
  pushMsg(ctx, rule.newMessage);
  // The auto-transformed object may itself carry effects → the engine follows them recursively.
  if (rule.effects?.length) next = applyEffects(next, rule.effects, scopeId, ctx.scenesById).state;
  return next;
}

/** Fire a batch of effects (recursive-safe); returns the new state plus any toast messages they produced. */
export function applyEffects(
  state: SessionState,
  effects: TransformEffect[],
  sceneId: string,
  scenesByIdOrCtx: Record<string, Scene> | EffectCtx
): { state: SessionState; messages: string[] } {
  const ctx: EffectCtx =
    'scenesById' in scenesByIdOrCtx && (scenesByIdOrCtx as EffectCtx).visited instanceof Set
      ? (scenesByIdOrCtx as EffectCtx)
      : { scenesById: scenesByIdOrCtx as Record<string, Scene>, visited: new Set<string>(), messages: [] };
  if (!effects.length) return { state, messages: ctx.messages };
  let s = state;
  for (const eff of effects) {
    const before = s;
    s = applyEffect(s, eff, sceneId, ctx);
    if (eff.message && s !== before) pushMsg(ctx, eff.message);
  }
  return { state: s, messages: ctx.messages };
}

/** All objects of a scene including nested close-up view objects (effect targets live anywhere). */
const allObjectsOf = (sc: Scene): SceneObject[] => [...sc.objects, ...sc.objects.flatMap((o) => (o.view ? o.view.objects : []))];

/** Every effect declared in a project's scenes — used by validation and by the Studio preview overlay. */
export function collectProjectEffects(scenes: Scene[]): { eff: TransformEffect; fromSceneId: string; fromName: string }[] {
  const out: { eff: TransformEffect; fromSceneId: string; fromName: string }[] = [];
  for (const sc of scenes) {
    for (const o of allObjectsOf(sc)) {
      for (const t of o.transforms ?? []) for (const e of t.effects ?? []) out.push({ eff: e, fromSceneId: sc.id, fromName: `${sc.title} → ${o.name}` });
      for (const e of o.pickupEffects ?? []) out.push({ eff: e, fromSceneId: sc.id, fromName: `${sc.title} → ${o.name} (pickup)` });
    }
  }
  return out;
}

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
  objects: SceneObject[],
  ctx?: InteractionCtx
): { newState: SessionState; message?: string; success: boolean; itemId?: string } {
  // Find the clicked object by id (as before).
  const target = objects.find(o => o.id === objectId);
  if (!target) {
    return { newState: state, success: false, message: 'مورد یافت نشد' };
  }

  const obj = target;

  if (!obj.pickupable) {
    return { newState: state, success: false, message: 'این مورد قابل برداشتن نیست' };
  }

  // Items live in the inventory keyed by their item id (`pickupItemId`, falling back to the object id).
  // This is what transform rules' `requiresItem` and validation compare against, so it must stay an id —
  // never the object's display name.
  const itemId = obj.pickupItemId || obj.id;

  // Block re-picking the *same* object instance, but not a second object that shares its pickupItemId.
  const sceneDiscovered = state.discoveredObjects[sceneId] || [];
  if (sceneDiscovered.includes(objectId)) {
    return { newState: state, success: false, message: 'این مورد قبلاً برداشته شده' };
  }

  // چند شیء می‌توانند یک pickupItemId داشته باشند (مثل ۳ فیوز) → تکراری مجاز است
  const newInventory = [...state.inventory, itemId];

  // Mark as discovered so it disappears
  const newDiscoveredObjects = {
    ...state.discoveredObjects,
    [sceneId]: [...sceneDiscovered, objectId],
  };

  const newState: SessionState = {
    ...state,
    inventory: newInventory,
    discoveredObjects: newDiscoveredObjects,
  };

  // Picking an item up can fire transition effects too (open a door, change another room, …).
  let finalState = newState;
  let extraMessage: string | undefined;
  if (obj.pickupEffects?.length && ctx?.scenesById) {
    const res = applyEffects(newState, obj.pickupEffects, sceneId, ctx.scenesById);
    finalState = res.state;
    extraMessage = res.messages[0];
  }

  return {
    newState: finalState,
    success: true,
    message: extraMessage ?? obj.pickupMessage ?? obj.message,
    itemId,
  };
}

/** Optional context for effect handling — without it, transforms/pickups still work (legacy callers). */
export interface InteractionCtx {
  /** All project scenes by id — effects may target objects/rooms other than the current one. */
  scenesById?: Record<string, Scene>;
}

/**
 * Remove exactly ONE occurrence of an item from the inventory.
 * (Array.filter would drop every duplicate — e.g. 3 collected fuses — which is wrong when
 * multiple objects share a pickupItemId.)
 */
const removeOne = (inv: string[], id: string) => {
  const i = inv.indexOf(id);
  return i < 0 ? inv : [...inv.slice(0, i), ...inv.slice(i + 1)];
};

/**
 * Apply an inventory item to an object (with transform support).
 */
export function applyItemToObject(
  state: SessionState,
  sceneId: string,
  objectId: string,
  itemId: string | null, // null = click without a selected item
  objects: SceneObject[],
  ctx?: InteractionCtx
): {
  newState: SessionState;
  success: boolean;
  message: string;
  transformed?: boolean;
} {
  const obj = objects.find(o => o.id === objectId);
  if (!obj) return { newState: state, success: false, message: 'مورد یافت نشد' };

  if (itemId && !state.inventory.includes(itemId)) {
    return { newState: state, success: false, message: 'شما این آیتم را ندارید' };
  }

  // Check if this object has transforms and the *next* rule matches.
  // Progress is tracked in session state (`transformsApplied`), never on the editable object.
  // An empty `requiresItem` means "no item required" — the rule fires with a plain click.
  let needsItem = false;
  if (obj.transforms && obj.transforms.length > 0) {
    const currentTransform = (state.transformsApplied ?? {})[objectId] ?? -1;
    const nextTransformIndex = currentTransform + 1;

    if (nextTransformIndex < obj.transforms.length) {
      const rule = obj.transforms[nextTransformIndex];
      const free = !rule.requiresItem; // empty = no item required

      if (free || (itemId !== null && rule.requiresItem === itemId)) {
        // Apply transform
        let newInventory = [...state.inventory];

        // Consume the item only when the rule actually required one (default: true)
        if (!free && rule.consumesItem !== false) {
          newInventory = removeOne(newInventory, rule.requiresItem);
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

        // Transition engine: the rule may reach outside this object — auto-transform other
        // objects (even in other rooms), change another room's background, or open a door.
        let finalState = newState;
        let effectMsg: string | undefined;
        if (rule.effects?.length && ctx?.scenesById) {
          const res = applyEffects(newState, rule.effects, sceneId, ctx.scenesById);
          finalState = res.state;
          effectMsg = res.messages[0];
        }

        return {
          newState: finalState,
          success: true,
          message: [rule.newMessage, effectMsg].filter(Boolean).join(' • ') || 'با موفقیت استفاده شد',
          transformed: true,
        };
      }
      needsItem = true;
    }
  }

  if (!itemId) {
    return {
      newState: state,
      success: false,
      message: needsItem ? 'برای استفاده از این مورد، آیتم مناسب را از کیف خود انتخاب کنید' : 'این مورد قابل استفاده نیست',
    };
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
    newInventory = removeOne(newInventory, itemId);
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

// ============ Doors / Room transitions ============

/** Is the player allowed to walk through this door right now? */
export function canUseDoor(state: SessionState, obj: SceneObject): boolean {
  const req = obj.door?.requiresItems ?? [];
  const openByEffect = (state.openDoors ?? []).includes(obj.id);
  return openByEffect || req.every((i) => state.inventory.includes(i));
}

/**
 * Try to move to another room through a door object. Returns null when the object is not a door.
 * `rooms` restricts navigation to the project's own scene list.
 */
export function tryEnterDoor(
  state: SessionState,
  obj: SceneObject,
  rooms: Scene[]
): { newState: SessionState; entered: boolean; message?: string } | null {
  if (!obj.door?.sceneId) return null;
  const target = rooms.find((s) => s.id === obj.door!.sceneId);
  if (!target) return { newState: state, entered: false, message: '🚪 این در به اتاق معتبری وصل نیست (در استودیو بررسی کنید)' };
  if (!canUseDoor(state, obj)) {
    return { newState: state, entered: false, message: obj.door.lockedMessage || '🔒 این در قفل است — کلیدش را پیدا کنید!' };
  }
  return { newState: { ...state, currentSceneId: target.id }, entered: true, message: `🚪 وارد شدید: ${target.title}` };
}
