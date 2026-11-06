# Data Model

Escape Room Studio uses a **unified sprite model**: there is exactly one object kind (`type: 'sprite'`). A sprite can be anything — an image, a solid color, invisible-until-transformed, clickable, pickupable, item-granting, a door, a background layer, a view. Behavior comes from the sprite's properties and rules, never from a type enum.

All types live in `src/shared/types.ts`; validation rules in `src/shared/validation.ts`.

## Image / Sprite References

Images are stored once in the project's asset library and referenced everywhere by stable ids:

- **Asset reference:** `asset:<id>` → resolved via `resolveUrl(url, assets)` to the asset's `url` (a data URL or external URL; never base64 inline in scene data).
- **Sprite reference:** `sprite:<id>` → resolved via `resolveSprite` / `getSprite` to a `Sprite`, which holds the `assetId`.
- Helpers: `assetRef(id)`, `spriteRef(id)`, `transformRef(id)` (tolerates bare sprite ids and direct URLs).

```typescript
interface Asset {
  id: string;
  name: string;
  url: string;   // data URL or external URL
  width: number;
  height: number;
  createdAt: string; // ISO-8601
}

interface Sprite {
  id: string;            // 'spr-...'
  name: string;
  assetId: string;       // 'asset:<id>' or direct URL; empty = no image
  color?: string;        // hex — solid color fill (empty = transparent)
  overflow?: boolean;    // @deprecated ignored
  fit?: 'fill' | 'contain' | 'cover'; // @deprecated ignored
  createdAt: string;
}
```

A sprite with no image and no color is fully invisible until a transform gives it one — useful for "reveal" tricks.

## SceneObject

The only geometry fields are `x`, `y`, `width`, `height`, `rotation` — the image always fills the box. Draw order = position in the scene's `objects` array (last drawn = on top); there is no separate `zIndex`.

```typescript
interface SceneObject {
  id: string;                    // 'obj-...'
  name: string;
  type?: ObjectType;             // always 'sprite'; kept for legacy compat
  /** The object's visual: a `sprite:<id>` ref (or legacy direct URL/asset ref). */
  spriteRef: string;
  x: number; y: number;          // top-left of the unrotated box
  width: number; height: number; // box size in px (> 0)
  rotation: number;              // degrees, pivot = box centre
  flipX?: boolean; flipY?: boolean;
  hit?: HitShape;                // click shape; default = whole box
  visible: boolean;
  locked: boolean;               // clickable only when false
  usable?: boolean;              // initial usability (default true)
  unusableMessage?: string;      // toast when clicked while locked
  unlockWhen?: TransformCondition; // becomes usable automatically when condition holds
  oneTimeUse: boolean;
  message?: string;              // toast/clue text shown on discovery
  requiresItem?: string[];       // item IDs needed to interact
  grantsItem?: string;           // item ID granted on discovery/pickup
  soundUrl?: string;             // optional sound effect
  pickupable?: boolean;
  pickupItemId?: string;         // item id added to inventory (defaults to object id)
  pickupMessage?: string;        // message shown when picked up (Persian)
  transforms?: TransformRule[];  // item-triggered changes (see below)
  motion?: RotateMotion;         // click-to-rotate (door hinge, lever, clock…)
  pickupEffects?: TransformEffect[]; // side effects fired when picked up
  door?: DoorTarget;             // clicking enters another room
  digit?: number;                // 0-9 clue digit (feeds the final lock)
  view?: View;                   // interactive close-up view (see below)
}

type HitShape = { kind: 'box' } | { kind: 'polygon'; points: Pt[] }; // points normalized 0..1
```

## Transforms

A `TransformRule` defines how an object changes when a specific item is used on it:

```typescript
interface TransformRule {
  requiresItem: string;          // inventory item that triggers this rule
  newSpriteId?: string;          // new sprite after the rule fires (`sprite:<id>` or URL)
  newName?: string;
  newMessage?: string;           // message shown after transform (Persian)
  grantsItem?: string;           // item granted after transform
  consumesItem?: boolean;        // whether the used item is consumed (default true)
  triggersDiscovery?: boolean;   // whether this counts as discovering the object
  hides?: boolean;               // hide the sprite while this rule is active
  conditions?: TransformCondition; // extra gating: "only when ALL of these…"
  filter?: SpriteFilter;         // visual filter applied when rule fires (invert, grayscale, …)
}

interface SpriteFilter {
  invert?: number;      // 0..1
  grayscale?: number;   // 0..1
  hueRotate?: number;   // degrees
  brightness?: number;  // 0..3 (1 = unchanged)
}

interface TransformCondition {
  transformedObjects?: { sceneId?: string; objectId: string; minRule?: number }[]; // AND: those objects must have applied ≥ minRule+1 rules
  itemsInInventory?: string[];      // AND: all these item ids must be held
  positions?: PositionReq[];        // AND: coordinate / click-count requirements
  autoApply?: boolean;              // evaluate from live state; fires instantly when prereqs complete
}

interface PositionReq {
  sceneId?: string;
  objectId: string;
  anchor?: Pt;              // point on the object (normalized 0..1); default = centre
  x?: number; y?: number;   // each defined axis checked separately
  op?: 'eq' | 'gte' | 'lte';
  tolerance?: number;       // px, default 2
  stepsEq?: number;         // (steps mod stepsMod) === stepsEq
  stepsMod?: number;        // e.g. 12 for a clock face
}
```

Rules apply in order; `currentTransform` (tracked in runtime `transformsApplied`) records which state the object is in. Multiple rules can chain (state 0 → 1 → 2 …).

## Effects

`TransformEffect` is a side action attached to a transform rule or a pickup. Effects reach OUT — they can transform other objects (even in other rooms), change another room's background, open a door, or mark an object usable:

```typescript
type EffectAction = 'transform' | 'background' | 'unlockDoor' | 'setUsable' | 'completeRoom';

interface TransformEffect {
  action: EffectAction;
  sceneId?: string;       // target scene; missing = scene where the trigger happens
  objectId?: string;      // target object (transform) or view id (background inside a view)
  ruleIndex?: number;     // which rule of the target object to apply (default 0)
  newSpriteId?: string;   // sprite ref / asset ref / URL — used by `background`
  doorObjectId?: string;  // door opened by `unlockDoor`
  usable?: boolean;       // for `setUsable`
  message?: string;       // optional toast when the effect fires
}
```

## Doors & Motion

```typescript
interface DoorTarget {
  sceneId: string;                // room entered when clicked
  requiresItems?: string[];       // items the player must carry; empty = open
  lockedMessage?: string;         // shown while the door is locked
  onEnterEffects?: TransformEffect[]; // fired when the player walks through
}

interface RotateMotion {
  kind: 'rotate';
  pivot: Pt;                      // pivot normalized to the box (may lie outside 0..1, e.g. hinge at x=0)
  angle: number;                  // degrees per click (positive = clockwise)
  duration?: number;              // ms, default 600
  maxSteps?: number;              // stop after N clicks; missing = unlimited
  toggle?: boolean;               // even clicks return to start position (switch / lever)
  message?: string;               // toast on each rotation click
}
```

## Interactive Views

A `View` is a close-up, zoomable scene attached to an object. It has its own background, objects, and transforms:

```typescript
interface View {
  id: string;
  title: string;
  backgroundUrl: string;          // `sprite:<id>` ref or direct URL
  width: number; height: number;
  objects: SceneObject[];         // nestable: view objects can have their own views
  requiresItem?: string[];        // items needed to open the view
  closeMessage?: string;
}
```

## Background Layers

A scene has one main background plus optional layered backgrounds drawn above it, in array order:

```typescript
interface BackgroundLayer {
  id: string;                     // 'bg-...'
  name: string;
  spriteRef: string;              // `sprite:<id>`
  opacity: number;                // 0-1
  visible: boolean;
  offsetX: number; offsetY: number;
}
```

## Scene
```typescript
interface Scene {
  id: string;                     // 'scene-...'
  projectId: string;
  title: string;
  width: number; height: number;  // room size in px
  backgroundUrl: string;          // `sprite:<id>` ref or direct URL
  backgroundLayers: BackgroundLayer[];
  objects: SceneObject[];
  clueChain: string[];            // ordered object IDs forming the clue chain
  exitNumber: number;             // 0-9 — this room's digit for the final lock
}
```

## Project

```typescript
interface Project {
  id: string;                     // 'proj-...'
  name: string;
  description: string;
  scenes: string[];               // scene IDs in order
  /** Derived automatically from every room's `exitNumber` — single source of truth. */
  finalLockDigits: string;
  assets: string[];               // asset ids used in the project
  sprites: string[];              // sprite ids used in the project
  createdAt: string;              // ISO-8601
  updatedAt: string;              // ISO-8601
}

interface ProjectBundle {
  format: 'escape-studio';
  version: 3;                     // export/import format version
  project: Project;
  scenes: Scene[];
  assets: Asset[];
  sprites: Sprite[];
}
```

Factories: `createSprite`, `blankSprite`, `createObject`, `createScene`, `cloneObject`, `cloneScene`, `computeFinalLock`.

## Runtime State (Session)

Not part of the editable project; lives in the player store:

```typescript
interface Player {
  telegramId: string;
  name: string;
  online: boolean;
  ready: boolean;
}

interface SessionState {
  currentSceneId: string;
  /** sceneId/viewId -> discovered object ids */
  discoveredObjects: Record<string, string[]>;
  inventory: string[];            // collected item ids
  completedScenes: string[];
  /** objectId -> index of last applied transform rule (-1 = none) */
  transformsApplied: Record<string, number>;
  /** sceneId/viewId -> background sprite ref overridden by an effect */
  backgrounds?: Record<string, string>;
  /** Door object ids opened by effects */
  openDoors?: string[];
  /** objectId -> runtime usability override set by effects */
  usable?: Record<string, boolean>;
  /** objectId -> number of motion (rotation) clicks performed */
  motionSteps?: Record<string, number>;
}

interface Session {
  id: string;
  projectId: string;
  token: string;
  players: Player[];
  started: boolean;
  complete: boolean;
  state: SessionState;
}

function createSessionState(firstSceneId: string): SessionState;
```

## Import / Migration

Older exports stored images as a raw `imageUrl` on each object. `normalizeBundle(text)` (format `escape-studio`, version 3) migrates those bundles: every image used anywhere (objects, views, layers, backgrounds, transforms) is turned into a sprite in the project's asset/sprite library, and references are rewritten to `sprite:<id>` / `asset:<id>`.

## Validation Rules (`validateProject`)

1. Project must have at least one room
2. Every room must have at least one object with a `digit`
3. No duplicate object ids (within a scene, including view objects)
4. Every clue-chain item must reference an existing object
5. Clue chain's last object should define a `digit` (warning if missing)
6. Every `requiresItem` on an object/transform must be obtainable somewhere (granted by a pickup or transform)
7. Transform `conditions.transformedObjects` must point at real objects that actually have transform rules (and `minRule` must be within range)
8. `conditions.itemsInInventory` items must be obtainable
9. `conditions.positions` must point at real objects; objects with position requirements but no `motion` get a warning (they never move)
10. Objects with requirements/rules but no visible result (message / item / digit / view / pickupable) get a warning
11. Sprites with no image/color and no transforms get a warning (invisible forever)
12. Sprites referenced anywhere must exist; their assets must exist
13. Objects fully outside the room bounds get a warning (overflow sprites intentionally exempt)

## Game Flow

```
Lobby → Room 1 → [discover all digit objects] → Room Complete →
Room 2 → [discover all digit objects] → Room Complete → … →
All Rooms Complete → Final Lock (digits from all rooms) → Victory!
```

- First-click-wins: only the first player to click an object discovers it; others get "already discovered".
- Room completion is triggered when all digit objects in the room are discovered.
- The final lock code is the concatenation of every room's `exitNumber`.
- Inventory is shared across all players in the session.
