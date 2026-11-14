import { livePoint } from './geometry';
import { allObjectsDeep } from './view-tree';
import type { PositionReq, Scene, SceneObject, SessionState, TransformCondition, TransformEffect, TransformRule } from './types';

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

/** All objects of a scene including objects inside any nested close-up view (effect targets live anywhere). */
const allObjectsOf = (sc: Scene): SceneObject[] => allObjectsDeep(sc.objects);

/**
 * Deep lookup for the target of a `background` effect: the object whose id matches `objectId`,
 * or the object that owns the view whose id matches `objectId`.
 */
function findViewHolder(objects: SceneObject[], objectId: string): SceneObject | undefined {
  for (const o of objects) {
    if (o.id === objectId || (o.view && o.view.id === objectId)) return o;
    if (o.view) {
      const hit = findViewHolder(o.view.objects, objectId);
      if (hit) return hit;
    }
  }
  return undefined;
}

// ============ Conditions ============
// A rule can carry extra gating beyond its `requiresItem`: e.g. "only fire once ALL three fuses AND
// the connector have been transformed". Every listed prerequisite must hold (logical AND).

/**
 * Coordinate-aware gating: "a point of object A (after its rotation motion) reached X/Y" or
 * "A is on click N (mod M)" — e.g. a clock hand whose 3rd click (90°) completes a circuit.
 * Empty list = always true; every requirement must hold (logical AND).
 */
export function checkPositions(reqs: PositionReq[] | undefined, state: SessionState, scenesById?: Record<string, Scene>): boolean {
  if (!reqs?.length) return true;
  if (!scenesById) return false;
  for (const r of reqs) {
    const sc = r.sceneId ? scenesById[r.sceneId] : Object.values(scenesById).find((s) => allObjectsOf(s).some((o) => o.id === r.objectId));
    const obj = sc ? allObjectsOf(sc).find((o) => o.id === r.objectId) : undefined;
    if (!obj) return false;
    const steps = state.motionSteps?.[r.objectId] ?? 0;
    const p = livePoint(obj, steps, r.anchor);
    const tol = Number.isFinite(r.tolerance) ? Math.max(0, r.tolerance as number) : 2;
    const op = r.op ?? 'eq';
    const okAxis = (v: number, t: number) => (op === 'gte' ? v >= t - tol : op === 'lte' ? v <= t + tol : Math.abs(v - t) <= tol);
    if (Number.isFinite(r.x) && !okAxis(p.x, r.x as number)) return false;
    if (Number.isFinite(r.y) && !okAxis(p.y, r.y as number)) return false;
    if ((r.stepsMod ?? 0) > 0 && r.stepsEq !== undefined) {
      const mod = r.stepsMod as number;
      if (((steps % mod) + mod) % mod !== r.stepsEq) return false;
    }
  }
  return true;
}

/** True when every prerequisite of the condition is satisfied by the current session state.
 * `depth` guards against recursive display checks on cyclic condition graphs. */

/**
 * Indexes of every transform rule of `objectId` that has already fired.
 * Older sessions only tracked the highest applied index (`transformsApplied`); for those we
 * derive the list as "0..max all fired", which matches the historical sequential firing model.
 */
export function firedOf(state: SessionState, objectId: string): number[] {
  const explicit = state.rulesFired?.[objectId];
  if (explicit) return explicit;
  const max = state.transformsApplied?.[objectId] ?? -1;
  if (max < 0) return [];
  return Array.from({ length: max + 1 }, (_, i) => i);
}

/**
 * Record that one or more rule indexes of `objectId` fired. `transformsApplied` is kept in sync
 * as the highest fired index (the visually applied look). Returns the same state ref when nothing
 * actually changed.
 */
export function markFired(state: SessionState, objectId: string, indexes: number[]): SessionState {
  if (!indexes.length) return state;
  const prev = firedOf(state, objectId);
  const merged = Array.from(new Set([...prev, ...indexes])).sort((a, b) => a - b);
  const newMax = merged.length ? Math.max(...merged, state.transformsApplied?.[objectId] ?? -1) : -1;
  return {
    ...state,
    rulesFired: { ...(state.rulesFired ?? {}), [objectId]: merged },
    transformsApplied: { ...(state.transformsApplied ?? {}), [objectId]: newMax },
  };
}

/**
 * Every rule of `obj` that can fire RIGHT NOW on an item use / click:
 * not yet fired, its conditions hold, and it is either free (empty `requiresItem`) or its item
 * requirement matches the used `itemId` (null = plain click, so only free rules match).
 */
export function pendingRules(
  obj: SceneObject,
  state: SessionState,
  itemId: string | null,
  scenesById?: Record<string, Scene>
): { index: number; rule: TransformRule }[] {
  const fired = firedOf(state, obj.id);
  const hits: { index: number; rule: TransformRule }[] = [];
  for (const [index, rule] of (obj.transforms ?? []).entries()) {
    if (fired.includes(index)) continue;
    const free = !rule.requiresItem;
    if (!free && rule.requiresItem !== itemId) continue;
    if (!checkTransformCondition(rule.conditions, state, scenesById)) continue;
    hits.push({ index, rule });
  }
  return hits;
}

export function checkTransformCondition(
  cond: TransformCondition | undefined,
  state: SessionState,
  scenesById?: Record<string, Scene>,
  depth = 0
): boolean {
  if (!cond) return true;
  for (const it of cond.itemsInInventory ?? []) {
    if (!state.inventory.includes(it)) return false;
  }
  if (!checkPositions(cond.positions, state, scenesById)) return false;
  for (const req of cond.transformedObjects ?? []) {
    // A transformedObjects prerequisite now checks whether the named rule index has
    // actually FIRED (recorded in rulesFired), not just whether some higher rule applied.
    // This lets an author chain rules on the same object: rule B with
    // { objectId: self, minRule: 0 } only succeeds once rule 0 has fired.
    if (!firedOf(state, req.objectId).includes(req.minRule ?? 0)) return false;
    // If the author pinned the prerequisite to a specific room, make sure the object really lives there.
    if (req.sceneId && scenesById) {
      const sc = scenesById[req.sceneId];
      if (sc && !allObjectsOf(sc).some((o) => o.id === req.objectId)) return false;
    }
    // autoApply conditions are checked from the LIVE game state: a prerequisite only counts when it
    // is VISIBLY transformed right now — so instant chains never light up ahead of what the player sees.
    if (cond.autoApply && scenesById && depth <= 24) {
      if (!prereqVisible(req, state, scenesById, depth + 1)) return false;
    }
  }
  return true;
}

/**
 * Condition check used by the RENDERER / auto-apply evaluator. A prerequisite counts as fulfilled
 * when it is VISIBLY transformed right now: recorded in `transformsApplied` AND its own shown rule
 * passes its gating (recursively). This keeps "instant" chains consistent with what the player
 * sees — an intermediate fuse panel that hasn't lit up yet does not light up the final panel.
 */
function prereqVisible(req: { sceneId?: string; objectId: string; minRule?: number }, state: SessionState, scenesById: Record<string, Scene>, depth = 0): boolean {
  if (depth > 24) return false; // cycle guard
  const sc = req.sceneId ? scenesById[req.sceneId] : Object.values(scenesById).find((s) => allObjectsOf(s).some((o) => o.id === req.objectId));
  const obj = sc ? allObjectsOf(sc).find((o) => o.id === req.objectId) : undefined;
  // The prerequisite's own shown (visually applied) rule = the HIGHEST fired index.
  const applied = state.transformsApplied?.[req.objectId] ?? -1;
  if (!firedOf(state, req.objectId).includes(req.minRule ?? 0)) return false;
  const idx = Math.min(applied, (obj?.transforms?.length ?? 1) - 1);
  const shown = obj?.transforms?.[idx];
  if (!shown) return true; // nothing to display-gate (e.g. discovery-only prereq) → recorded fire counts
  return checkTransformCondition(shown.conditions, state, scenesById, depth + 1);
}

export function checkConditionForDisplay(
  cond: TransformCondition | undefined,
  state: SessionState,
  scenesById: Record<string, Scene>,
  depth = 0
): boolean {
  if (!cond) return true;
  for (const it of cond.itemsInInventory ?? []) {
    if (!state.inventory.includes(it)) return false;
  }
  for (const req of cond.transformedObjects ?? []) {
    if (!prereqVisible(req, state, scenesById, depth)) return false;
  }
  if (!checkPositions(cond.positions, state, scenesById)) return false;
  return true;
}

/** Is this object currently usable? Effect override > initial flag > live `unlockWhen` condition. */
export function isUsable(state: SessionState, obj: SceneObject, scenesById: Record<string, Scene> = {}): boolean {
  const override = state.usable?.[obj.id];
  if (override !== undefined) return override;
  if (obj.usable !== false) return true;
  return !!obj.unlockWhen && checkConditionForDisplay(obj.unlockWhen, state, scenesById);
}

/**
 * The instant ("بدون کلیک") transform evaluator. Conditions marked `autoApply` behave like live
 * wires: the moment their prerequisites hold, the rule fires — no click, and no effect needs to
 * explicitly target the object. Call this after ANY state change (transform, pickup, item use, …);
 * it loops until stable so chained auto rules cascade in one pass. Returns the same state ref
 * when nothing new fired.
 */
export function evaluateAutoTransforms(
  state: SessionState,
  scenesById: Record<string, Scene>,
  scopeSceneId?: string
): { state: SessionState; messages: string[] } {
  const candidates: { sceneId: string; obj: SceneObject }[] = [];
  const addScene = (sc: Scene) => {
    for (const o of allObjectsOf(sc)) if (o.transforms?.length) candidates.push({ sceneId: sc.id, obj: o });
  };
  if (scopeSceneId && scenesById[scopeSceneId]) addScene(scenesById[scopeSceneId]);
  else for (const sc of Object.values(scenesById)) addScene(sc);
  if (!candidates.length) return { state, messages: [] };

  let s = state;
  const messages: string[] = [];
  // Loop until stable (max passes guard against pathological cycles).
  for (let pass = 0; pass < candidates.length + 2; pass++) {
    let changed = false;
    for (const { sceneId, obj } of candidates) {
      const nextIdx = (s.transformsApplied?.[obj.id] ?? -1) + 1;
      const rule = obj.transforms![nextIdx];
      if (!rule || !rule.conditions?.autoApply || rule.toggle) continue;
      // Only fire when the rule needs no item (free) — item-gated rules still need the player.
      if (rule.requiresItem) continue;
      // Evaluate prerequisites from the LIVE state: recorded transforms, or visibly-applied ones
      // (an auto-firing intermediate must itself actually be showing its transformed sprite first).
      const cond = rule.conditions;
      let ok = true;
      for (const it of cond.itemsInInventory ?? []) if (!s.inventory.includes(it)) { ok = false; break; }
      if (ok) {
        for (const req of cond.transformedObjects ?? []) {
          if (!prereqVisible(req, s, scenesById)) { ok = false; break; }
        }
      }
      // Coordinate-aware gating uses the LIVE step counter `s` (motion clicks counted so far).
      if (ok && !checkPositions(cond.positions, s, scenesById)) ok = false;
      if (!ok) continue;
      // Fire the rule exactly like applyEffect would: visuals via transformsApplied + grants/discovery/effects.
      let ns = { ...s, transformsApplied: { ...(s.transformsApplied ?? {}), [obj.id]: nextIdx } };
      if (rule.grantsItem && !ns.inventory.includes(rule.grantsItem)) ns = { ...ns, inventory: [...ns.inventory, rule.grantsItem] };
      if (rule.triggersDiscovery) {
        const d = ns.discoveredObjects[sceneId] || [];
        if (!d.includes(obj.id)) ns = { ...ns, discoveredObjects: { ...ns.discoveredObjects, [sceneId]: [...d, obj.id] } };
      }
      if (rule.newMessage && !messages.includes(rule.newMessage)) messages.push(rule.newMessage);
      if (rule.effects?.length) {
        const res = applyEffects(ns, rule.effects, sceneId, scenesById);
        ns = res.state;
        for (const m of res.messages) if (!messages.includes(m)) messages.push(m);
      }
      s = ns;
      changed = true;
    }
    if (!changed) break;
  }
  return { state: s, messages };
}

/** Human-readable reason why the condition currently fails ('' when it holds). */
export function conditionFailMessage(cond: TransformCondition | undefined, state: SessionState, scenesById?: Record<string, Scene>): string {
  if (!cond) return '';
  for (const it of cond.itemsInInventory ?? []) {
    if (!state.inventory.includes(it)) return `⏳ هنوز همه شرایط فراهم نشده — آیتم «${it}» در کیف شما نیست`;
  }
  for (const req of cond.transformedObjects ?? []) {
    if (!firedOf(state, req.objectId).includes(req.minRule ?? 0)) return '⏳ هنوز همه شرایط فراهم نشده — اول بقیه موارد را فعال کنید';
  }
  if (!checkPositions(cond.positions, state, scenesById)) return '⏳ هنوز همه شرایط فراهم نشده — موقعیت درست نیست';
  return '';
}

/**
 * Run the instant-condition pass after any player action. When a rule's `autoApply` condition just
 * became true (e.g. the LAST fuse/connector got transformed), its transform fires immediately —
 * no click needed. The player store's commit() calls `evaluateAutoTransforms` on every state change,
 * so this wrapper is kept for direct/legacy callers that hold the scene map themselves.
 */
export function autoApplyConditions(state: SessionState, scenesById?: Record<string, Scene>): { state: SessionState; messages: string[] } {
  if (!scenesById || !Object.keys(scenesById).length) return { state, messages: [] };
  return evaluateAutoTransforms(state, scenesById);
}

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
      const holder = targetScene ? findViewHolder(targetScene.objects, eff.objectId) : undefined;
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

  if (eff.action === 'setUsable') {
    if (!eff.objectId) return state;
    const v = eff.usable !== false;
    if (state.usable?.[eff.objectId] === v) return state;
    return { ...state, usable: { ...(state.usable ?? {}), [eff.objectId]: v } };
  }

  if (eff.action === 'completeRoom') {
    const sid = eff.sceneId || triggerSceneId;
    const sc = ctx.scenesById[sid];
    if (!sc || state.completedScenes.includes(sid)) return state;
    pushMsg(ctx, `🔢 رقم این اتاق: ${sc.exitNumber}`);
    return { ...state, completedScenes: [...state.completedScenes, sid] };
  }

  // --- automatically apply / revert / toggle a transform rule on another object ---
  if (eff.action !== 'transform' || !targetScene) return state;
  const list = allObjectsDeep(targetScene.objects);
  const obj = list.find((o) => o.id === eff.objectId);
  if (!obj?.transforms?.length) return state;
  const idx = eff.ruleIndex ?? 0;
  const rule = obj.transforms[idx];
  if (!rule) return state;
  const mode = eff.mode ?? 'apply';
  const current = state.transformsApplied?.[obj.id] ?? -1;

  // 'revert' skips the condition check and the `visited` guard: step back to before this rule
  // (or to the original look when nothing of it is applied).
  if (mode === 'revert') {
    const target = Math.min(current, idx - 1);
    if (target === current) return state;
    return {
      ...state,
      transformsApplied: { ...(state.transformsApplied ?? {}), [obj.id]: target },
    };
  }

  // 'toggle': revert when the rule is already applied, otherwise fall through to 'apply'.
  if (mode === 'toggle' && current >= idx) {
    return {
      ...state,
      transformsApplied: { ...(state.transformsApplied ?? {}), [obj.id]: idx - 1 },
    };
  }

  // Conditions still gate automatic transforms: "transform box X" only fires when X's own
  // prerequisites (e.g. all three fuses + the connector already transformed) actually hold.
  if (!checkTransformCondition(rule.conditions, state, ctx.scenesById)) return state;
  // Idempotent: each (scene, object) gets its automatic chain applied once, following links forward.
  if (ctx.visited.has(`${scopeId}|${obj.id}`)) return state;
  ctx.visited.add(`${scopeId}|${obj.id}`);

  const targetIdx = Math.max(current, idx);
  const changed =
    targetIdx !== current ||
    (rule.grantsItem && !state.inventory.includes(rule.grantsItem)) ||
    (rule.triggersDiscovery && !(state.discoveredObjects[scopeId] ?? []).includes(obj.id));
  if (!changed) return state;

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
  next = { ...next, transformsApplied: { ...(next.transformsApplied ?? {}), [obj.id]: targetIdx } };
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

/** Every effect declared in a project's scenes — used by validation and by the Studio preview overlay. */
export function collectProjectEffects(scenes: Scene[]): { eff: TransformEffect; fromSceneId: string; fromName: string }[] {
  const out: { eff: TransformEffect; fromSceneId: string; fromName: string }[] = [];
  for (const sc of scenes) {
    for (const o of allObjectsOf(sc)) {
      for (const t of o.transforms ?? []) for (const e of t.effects ?? []) out.push({ eff: e, fromSceneId: sc.id, fromName: `${sc.title} → ${o.name}` });
      for (const e of o.pickupEffects ?? []) out.push({ eff: e, fromSceneId: sc.id, fromName: `${sc.title} → ${o.name} (pickup)` });
      for (const e of o.door?.onEnterEffects ?? []) out.push({ eff: e, fromSceneId: sc.id, fromName: `${sc.title} → ${o.name} (enter door)` });
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

  if (!isUsable(state, obj, ctx?.scenesById)) {
    return { newState: state, success: false, message: obj.unusableMessage || 'فعلاً قابل استفاده نیست' };
  }

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
    extraMessage = res.messages.join(' • ') || undefined;
  }

  return {
    newState: finalState,
    success: true,
    message: [obj.pickupMessage ?? obj.message, extraMessage].filter(Boolean).join(' • ') || extraMessage || obj.pickupMessage || obj.message,
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

  if (!isUsable(state, obj, ctx?.scenesById)) {
    return { newState: state, success: false, message: obj.unusableMessage || 'فعلاً قابل استفاده نیست' };
  }

  // Numpad numbers (numeric strings) act like virtual items: they are picked from the
  // numpad overlay and used directly on objects, so they never need to be in the inventory
  // and are never consumed.
  if (itemId && !state.inventory.includes(itemId) && !/^\d+$/.test(itemId)) {
    return { newState: state, success: false, message: 'شما این آیتم را ندارید' };
  }

  // Clicking on an object whose LAST rule is a toggle rule that has already FIRED switches back:
  // remove ONLY that index from rulesFired and set transformsApplied to the new highest fired
  // index (or -1 when nothing is left). Auto-apply rules ignore toggle.
  if (!itemId && obj.transforms?.length) {
    const lastIndex = obj.transforms.length - 1;
    const lastRule = obj.transforms[lastIndex];
    if (lastRule?.toggle && !lastRule.conditions?.autoApply) {
      const fired = firedOf(state, objectId);
      if (fired.includes(lastIndex)) {
        const remaining = fired.filter((i) => i !== lastIndex);
        const nextState: SessionState = {
          ...state,
          rulesFired: { ...(state.rulesFired ?? {}), [objectId]: remaining },
          transformsApplied: {
            ...(state.transformsApplied ?? {}),
            [objectId]: remaining.length ? Math.max(...remaining) : -1,
          },
        };
        return { newState: nextState, success: true, message: 'با موفقیت استفاده شد', transformed: true };
      }
    }
  }

  // Fire EVERY pending rule at once — not just the "next" one. One click completes all free rules
  // whose conditions hold (plus all rules matching the used item). Progress is tracked in session
  // state (`rulesFired` / `transformsApplied`), never on the editable object.
  let needsItem = false;
  if (obj.transforms && obj.transforms.length > 0) {
    const hits = pendingRules(obj, state, itemId, ctx?.scenesById);

    if (hits.length) {
      // Every hit was chosen against the SAME starting state; apply their bookkeeping together.
      let newState: SessionState = { ...state };
      const messages: string[] = [];
      const hitIndexes: number[] = [];
      const allEffects: TransformEffect[] = [];

      for (const { index, rule } of hits) {
        hitIndexes.push(index);

        // Consume the item only when the rule actually required one (default: true)
        if (rule.requiresItem && rule.consumesItem !== false) {
          newState = { ...newState, inventory: removeOne(newState.inventory, rule.requiresItem) };
        }

        // Grant new item if not already in the inventory
        if (rule.grantsItem && !newState.inventory.includes(rule.grantsItem)) {
          newState = { ...newState, inventory: [...newState.inventory, rule.grantsItem] };
        }

        // Mark as discovered if triggersDiscovery
        if (rule.triggersDiscovery) {
          const sceneDiscovered = newState.discoveredObjects[sceneId] || [];
          if (!sceneDiscovered.includes(objectId)) {
            newState = {
              ...newState,
              discoveredObjects: { ...newState.discoveredObjects, [sceneId]: [...sceneDiscovered, objectId] },
            };
          }
        }

        if (rule.newMessage && !messages.includes(rule.newMessage)) messages.push(rule.newMessage);
        if (rule.effects?.length) allEffects.push(...rule.effects);
      }

      // Record every fired index once (updates rulesFired + the transformsApplied max).
      newState = markFired(newState, objectId, hitIndexes);

      // Transition engine: run ALL concatenated effects once, after the bookkeeping above.
      let finalState = newState;
      if (allEffects.length && ctx?.scenesById) {
        const res = applyEffects(newState, allEffects, sceneId, ctx.scenesById);
        finalState = res.state;
        for (const m of res.messages) if (!messages.includes(m)) messages.push(m);
      }

      return {
        newState: finalState,
        success: true,
        message: messages.join(' • ') || 'با موفقیت استفاده شد',
        transformed: true,
      };
    }

    // No hits: nothing could fire right now — an item is needed when any unfired rule still exists.
    const fired = firedOf(state, objectId);
    needsItem = obj.transforms.some((_, i) => !fired.includes(i));
  }

  // Unmet rules → explain what is still missing: the FIRST unfired rule whose item matches (or
  // whose requiresItem is empty) and whose conditions fail.
  const condMsg = (obj.transforms ?? [])
    .map((t, i) =>
      !firedOf(state, objectId).includes(i) &&
      (!t.requiresItem || (itemId !== null && t.requiresItem === itemId)) &&
      !checkTransformCondition(t.conditions, state, ctx?.scenesById)
        ? conditionFailMessage(t.conditions, state, ctx?.scenesById)
        : ''
    )
    .find(Boolean);

  if (!itemId) {
    return {
      newState: state,
      success: false,
      message:
        condMsg ||
        (needsItem ? 'برای استفاده از این مورد، آیتم مناسب را از کیف خود انتخاب کنید' : 'این مورد قابل استفاده نیست'),
    };
  }

  // Item selected but its matching rule's conditions are not met yet → tell the player why.
  if (condMsg) {
    return { newState: state, success: false, message: condMsg || 'هنوز شرایط لازم فراهم نشده است' };
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
 * Check if all rooms are complete.
export function allRoomsComplete(state: SessionState, scenes: Scene[]): boolean {
  return scenes.every((s) => state.completedScenes.includes(s.id));
}
*/

// ============ Doors / Room transitions ============

/**
 * Gate for opening an object's close-up view. Pure — never mutates `state`.
 * Required = unique union of the object's own `requiresItem` and its view's `requiresItem`.
 */
export function canOpenView(
  state: SessionState,
  obj: SceneObject,
  selectedItem: string | null
): { ok: true } | { ok: false; message: string } {
  const required = Array.from(
    new Set([...(obj.requiresItem ?? []), ...(obj.view?.requiresItem ?? [])])
  );
  if (required.length === 0 || (state.unlockedViews ?? []).includes(obj.id)) return { ok: true };
  if (required.some((i) => !state.inventory.includes(i)))
    return { ok: false, message: 'برای باز کردن این مورد به آیتم نیاز دارید' };
  if (selectedItem === null || !required.includes(selectedItem))
    return { ok: false, message: 'آیتم مناسب را از کیف خود انتخاب کنید' };
  return { ok: true };
}

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
  let s = state;
  const msgs: string[] = [];
  if (obj.door.onEnterEffects?.length) {
    const scenesById = Object.fromEntries(rooms.map((r) => [r.id, r]));
    const res = applyEffects(s, obj.door.onEnterEffects, target.id, scenesById);
    s = res.state;
    msgs.push(...res.messages);
  }
  return {
    newState: { ...s, currentSceneId: target.id },
    entered: true,
    message: [`🚪 وارد شدید: ${target.title}`, ...msgs].join(' • '),
  };
}
export function allRoomsComplete(state: SessionState, scenes: Scene[]): boolean {
  return scenes.every((s) => state.completedScenes.includes(s.id));
}

export function validateFinalLock(
  state: SessionState,
  scenes: Scene[],
  enteredDigits: string
): { valid: boolean; message: string } {
  const expected = scenes.map((s) => s.exitNumber.toString()).join('');
  if (enteredDigits === expected) return { valid: true, message: 'تبریک! شما موفق شدید!' };
  return { valid: false, message: 'رمز اشتباه است. دوباره تلاش کنید.' };
}