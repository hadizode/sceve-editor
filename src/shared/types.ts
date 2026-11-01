import { clamp, nowIso, svgDataUrl, uid } from './utils';

// ============ Basic types ============
/**
 * There are NO object-type categories anymore (no decoration / item / container).
 * Every place in a room is a single unified "sprite": one reusable visual that can
 * be ANYTHING — an image, a solid color, fully invisible until transformed,
 * clickable, pickupable, item-granting, transform target, background layer, etc.
 * Behavior comes from the sprite's properties and rules, never from a type enum.
 */
export const OBJECT_TYPE = 'sprite' as const;
export type ObjectType = typeof OBJECT_TYPE;
/** @deprecated kept only so old imports keep compiling; there is exactly one kind now. */
export const OBJECT_TYPES = [OBJECT_TYPE] as const;

/** Single accent used for every sprite placeholder/indicator (there are no per-type colors). */
export const SPRITE_COLOR = '#38bdf8';
/** @deprecated use SPRITE_COLOR */
export const TYPE_COLORS: Record<string, string> = { sprite: SPRITE_COLOR };

export interface Asset {
  id: string;
  name: string;
  url: string; // data URL or external URL
  width: number;
  height: number;
  createdAt: string;
}

/** Images are referenced as `asset:<id>` so the same picture is stored only once. */
export const assetRef = (id: string) => `asset:${id}`;
export function resolveUrl(url: string, assets: Record<string, Asset>): string {
  if (url.startsWith('asset:')) return assets[url.slice(6)]?.url ?? '';
  return url;
}

export interface BackgroundLayer {
  id: string;
  name: string;
  /** Sprite reference (`sprite:<id>`). */
  spriteRef: string;
  opacity: number; // 0-1
  visible: boolean;
  offsetX: number;
  offsetY: number;
}

/**
 * An EFFECT is a side action attached to a transform (or to a pickup). While a transform's own
 * fields change the clicked object only, effects reach OUT: they can transform OTHER objects
 * automatically (even in other rooms), change another room's background, or open a door so the
 * player can walk into another room.
 */
export type EffectAction = 'transform' | 'background' | 'unlockDoor';

export interface TransformEffect {
  action: EffectAction;
  /** Target scene id. Empty/missing = the scene the trigger happens in. */
  sceneId?: string;
  /** Target object id (for `transform`) or view id (for `background` inside a close-up view). */
  objectId?: string;
  /** Which transform rule of the target object to apply automatically. Default 0 (the first one). */
  ruleIndex?: number;
  /** Sprite reference (`sprite:<id>`), asset ref or direct URL — used by `background`. */
  newSpriteId?: string;
  /** Door object that becomes clickable/enterable — used by `unlockDoor`. */
  doorObjectId?: string;
  /** Optional toast shown when the effect fires. */
  message?: string;
}

/** A door is an object that takes the player to another room when clicked. */
export interface DoorTarget {
  sceneId: string;
  /** Item ids the player must carry to pass; empty = open. */
  requiresItems?: string[];
  /** Message shown while the door is still locked. */
  lockedMessage?: string;
}

/**
 * A CONDITION that must hold before a transform rule may fire. The classic use case is an AND over
 * several prerequisites: "if all three fuses AND the connector are transformed → transform another
 * sprite". Every non-empty list must be satisfied; empty/missing conditions = always true.
 */
export interface TransformCondition {
  /** All of these objects must have applied at least `minRule + 1` of their transform rules (-1 = none needed). */
  transformedObjects?: { sceneId?: string; objectId: string; minRule?: number }[];
  /** All of these item ids must currently be in the inventory (duplicates are not required). */
  itemsInInventory?: string[];
  /**
   * When true, this condition is NOT gated by `transformsApplied` — it is evaluated purely from the
   * live game state (which transforms are VISIBLY applied / which items are held). That makes a rule
   * fire INSTANTLY the moment its prerequisites complete (e.g. the last fuse goes in → the panel
   * lights up immediately), with no extra click and no effect explicitly targeting this object.
   */
  autoApply?: boolean;
}

export interface TransformRule {
  requiresItem: string;
  /** New sprite for the object after this rule fires — can be any image. */
  newSpriteId?: string;
  newName?: string;
  newMessage?: string;
  grantsItem?: string;
  consumesItem?: boolean;
  triggersDiscovery?: boolean;
  /** Extra gating ("only once ALL of these objects are transformed…"). Empty = no extra condition. */
  conditions?: TransformCondition;
  /** Side actions fired when this rule applies (other objects / other rooms / doors). */
  effects?: TransformEffect[];
}

/**
 * A sprite is a reusable visual. It does NOT have to have an image:
 * - no `color` and no `assetId` → fully invisible until a transform gives it an image
 * - only `color` → a solid colored rectangle of any size
 * - `assetId` → any uploaded image
 *
 * Images are ALWAYS rendered at their natural size × the object's transform
 * (see shared/geometry.ts) and are never fitted to or clipped by the object frame.
 */
export interface Sprite {
  id: string;
  name: string;
  /** Optional reference into the project's assets (`asset:<id>` or direct URL); empty = no image. */
  assetId: string;
  /** Optional solid color fill (hex). Empty = transparent / no color. */
  color?: string;
  /** @deprecated ignored — images always render at natural size and may overflow the frame. */
  overflow?: boolean;
  /** @deprecated ignored — images are never fitted into the frame. */
  fit?: 'fill' | 'contain' | 'cover';
  createdAt: string;
}

/** Sprites are referenced as `sprite:<id>` so designers can swap one image everywhere at once. */
export const spriteRef = (id: string) => `sprite:${id}`;

/** Normalize a stored sprite id/ref into a full `sprite:<id>` reference (tolerates bare ids and direct URLs). */
export const transformRef = (id?: string) => (!id ? '' : id.startsWith('sprite:') ? id : spriteRef(id));

const SPRITE_REF_RE = /^sprite:spr-[0-9a-z]+$/i;
/**
 * True for values that are clearly sprite refs/ids (`sprite:spr-…` / `spr-…`). Such values must NEVER be
 * treated as image URLs: older saves stored `newSpriteId` as a raw sprite id, and registering it as a URL
 * would import a worthless asset + sprite on every hydrate. Anything else (asset:/data:/http/#color) is
 * passed to the registry unchanged.
 */
const looksLikeSpriteId = (v: string) => SPRITE_REF_RE.test(v) || /^spr-[0-9a-z]+$/i.test(v);

/** Resolve a sprite/image reference to a concrete URL. */
export function resolveSprite(ref: string, sprites: Record<string, Sprite>, assets: Record<string, Asset>): string {
  if (ref.startsWith('sprite:')) return resolveUrl(sprites[ref.slice(7)]?.assetId ?? '', assets);
  return resolveUrl(ref, assets);
}

/** Look up the sprite object for a reference (undefined for direct URLs / missing refs). */
export function getSprite(ref: string, sprites: Record<string, Sprite>): Sprite | undefined {
  return ref.startsWith('sprite:') ? sprites[ref.slice(7)] : undefined;
}

const EMOJI_FONT = "'Segoe UI Emoji','Noto Color Emoji','Apple Color Emoji',sans-serif";
/** Turn an emoji/text into a ready-made SVG sprite image (no upload needed). */
export function emojiSprite(emoji: string, size = 128): string {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-size="${size * 0.78}" font-family="${EMOJI_FONT}">${emoji}</text></svg>`
  );
}
/** Pick a readable text color for a solid background hex color. */
export function contrastTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1f2937' : '#ffffff';
}

/** Runtime state of a session (not part of the editable project data). */
export interface Player {
  telegramId: string;
  name: string;
  online: boolean;
  ready: boolean;
}

export interface SessionState {
  currentSceneId: string;
  /** sceneId/viewId -> discovered object ids */
  discoveredObjects: Record<string, string[]>;
  inventory: string[];
  completedScenes: string[];
  /** objectId -> index of the last applied transform rule (-1 = none) */
  transformsApplied: Record<string, number>;
  /** sceneId/viewId -> background sprite ref overridden by an effect (e.g. "the lights turn on") */
  backgrounds?: Record<string, string>;
  /** Door object ids opened by effects — a door can also be gated only by items. */
  openDoors?: string[];
}

export interface Session {
  id: string;
  projectId: string;
  token: string;
  players: Player[];
  started: boolean;
  complete: boolean;
  state: SessionState;
}

export function createSessionState(firstSceneId: string): SessionState {
  return {
    currentSceneId: firstSceneId,
    discoveredObjects: {},
    inventory: [],
    completedScenes: [],
    transformsApplied: {},
    backgrounds: {},
    openDoors: [],
  };
}

export interface View {
  id: string;
  title: string;
  /** Sprite reference (`sprite:<id>`) or direct URL. */
  backgroundUrl: string;
  width: number;
  height: number;
  objects: SceneObject[];
  requiresItem?: string[];
  closeMessage?: string;
}

/** What counts as a click on a sprite: its logical frame (default), the rendered image's bounds, or the custom polygon. */
export type HitArea = 'frame' | 'image' | 'polygon';

/**
 * A side length of the sprite's polygon frame, in FRAME-LOCAL coordinates
 * (x → right along the top edge, y → down along the left edge; the frame box is 0..width / 0..height).
 * Points are ordered around the shape; the engine closes the loop automatically.
 */
export interface FramePoint {
  x: number;
  y: number;
}

/** Draw order = position in the `objects` array (last = on top). */
export interface SceneObject {
  id: string;
  name: string;
  /** Always 'sprite' now — kept for backward compatibility with old bundles. */
  type?: ObjectType;
  /** The object's sprite — a `sprite:<id>` reference to any image asset. */
  spriteRef: string;
  /** Logical frame: selection box, data model and default hit area. NOT the image bounds. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Image scale applied on top of its NATURAL size. Negative = flipped. Default 1. */
  scaleX?: number;
  scaleY?: number;
  /** Image centre offset from the frame centre, in the sprite's rotated space. Default 0. */
  imageOffsetX?: number;
  imageOffsetY?: number;
  /** Hit area for clicks in the Player. Default 'frame'. */
  hitArea?: HitArea;
  /**
   * Custom polygon frame ("per-side sizing / extra sides"). When present, this shape REPLACES the
   * rectangular frame as the selection box outline and the click/hit area (auto-active: picking
   * 'polygon' is not required). Coordinates are frame-local (0..width, 0..height) and follow the
   * object's rotation/scale like everything else.
   */
  framePolygon?: FramePoint[];
  visible: boolean;
  locked: boolean;
  oneTimeUse: boolean;
  message?: string;
  digit?: number;
  requiresItem?: string[];
  grantsItem?: string;
  soundUrl?: string;
  view?: View;
  pickupable?: boolean;
  pickupItemId?: string;
  pickupMessage?: string;
  transforms?: TransformRule[];
  /** Side effects fired when this object is picked up (transform other objects, change rooms, open doors). */
  pickupEffects?: TransformEffect[];
  /** Door: clicking this object takes the player to another room. */
  door?: DoorTarget;
}

export interface Scene {
  id: string;
  projectId: string;
  title: string;
  width: number;
  height: number;
  /** Sprite reference (`sprite:<id>`) or direct URL. */
  backgroundUrl: string;
  backgroundLayers: BackgroundLayer[]; // drawn above backgroundUrl, in array order
  objects: SceneObject[];
  clueChain: string[];
  exitNumber: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  scenes: string[];
  /** Derived automatically from every room's exitNumber (single source of truth). */
  finalLockDigits: string;
  assets: string[];
  sprites: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBundle {
  format: 'escape-studio';
  version: 3;
  project: Project;
  scenes: Scene[];
  assets: Asset[];
  sprites: Sprite[];
}

// ============ Factories ============
/** Placeholder sprite used when an object is created without an image — it can be replaced by anything. */
export function placeholderSprite(label: string, color: string): string {
  const text = label.replace(/[&<>]/g, '');
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">` +
      `<rect width="100%" height="100%" fill="${color}" rx="10"/>` +
      `<text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${contrastTextColor(color)}" font-size="30" font-weight="bold" font-family="Vazirmatn,sans-serif">${text}</text>` +
      `</svg>`
  );
}

export function createSprite(name: string, assetId: string, extra: Partial<Pick<Sprite, 'color' | 'overflow' | 'fit'>> = {}): Sprite {
  return { id: uid('spr'), name: name || 'sprite', assetId, createdAt: nowIso(), ...extra };
}

/** A sprite with no image at all — invisible, or a solid color if given. Great for "reveal on transform" tricks. */
export function blankSprite(name: string, color = ''): Sprite {
  return { id: uid('spr'), name: name || 'Blank sprite', assetId: '', color: color || undefined, createdAt: nowIso() };
}

export function createObject(p: Partial<SceneObject> = {}): SceneObject {
  return {
    id: uid('obj'),
    name: 'Sprite',
    type: OBJECT_TYPE,
    spriteRef: '',
    x: 100,
    y: 100,
    width: 80,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    oneTimeUse: false,
    ...p,
  };
}

export function createScene(projectId: string, title: string): Scene {
  return {
    id: uid('scene'),
    projectId,
    title,
    width: 800,
    height: 600,
    backgroundUrl: '',
    backgroundLayers: [],
    objects: [],
    clueChain: [],
    exitNumber: 0,
  };
}

export function cloneObject(o: SceneObject): SceneObject {
  return {
    ...o,
    id: uid('obj'),
    view: o.view
      ? { ...o.view, id: uid('view'), objects: o.view.objects.map(cloneObject) }
      : undefined,
  };
}

/** Deep clone with fresh ids; the clue chain is remapped to the new ids. */
export function cloneScene(src: Scene, projectId: string, title: string): Scene {
  const idMap = new Map<string, string>();
  const objects = src.objects.map((o) => {
    const c = cloneObject(o);
    idMap.set(o.id, c.id);
    return c;
  });
  return {
    ...src,
    id: uid('scene'),
    projectId,
    title,
    objects,
    clueChain: src.clueChain.map((id) => idMap.get(id) ?? id),
    backgroundLayers: src.backgroundLayers.map((l) => ({ ...l, id: uid('bg') })),
  };
}

export const computeFinalLock = (sceneIds: string[], scenes: Record<string, Scene>) =>
  sceneIds.map((id) => scenes[id]?.exitNumber ?? 0).join('');

// ============ Normalization (import + migration from the old imageUrl format) ============
/* eslint-disable @typescript-eslint/no-explicit-any */
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];

/** Collects every image URL found while normalizing and turns each one into a Sprite. */
export class SpriteRegistry {
  private byKey = new Map<string, Sprite>();
  /** Stable key: `asset:<id>` refs collapse to the same sprite; other URLs hash their content. */
  private static key(url: string, assets: Record<string, Asset>): string {
    if (url.startsWith('asset:')) return 'a|' + url.slice(6);
    let h = 5381;
    for (let i = 0; i < url.length; i++) h = ((h << 5) + h + url.charCodeAt(i)) | 0;
    return 'u|' + h.toString(36) + '|' + url.length;
  }
  constructor(private assets: Record<string, Asset>, private nameHint = '', private knownSprites?: Record<string, Sprite>) {}
  /** Accepts an existing `sprite:` ref (kept as-is), a color value, or any image URL/asset-ref (wrapped in a new sprite). */
  register(raw: unknown): string {
    // Newer sprite payloads may carry extra props (color/overflow/fit) alongside a ref/url/color.
    if (raw && typeof raw === 'object') {
      const o = raw as Record<string, unknown>;
      const base = o.ref ?? o.spriteRef ?? o.url ?? o.assetId ?? o.color;
      const hasBase = typeof base === 'string' && base.length > 0;
      const color = typeof o.color === 'string' ? o.color : '';
      // A sprite with no image at all — only a color (or even fully empty) is valid.
      if (!hasBase && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return this.register(color);
      if (!hasBase) return '';
      const ref = this.register(base);
      if (!ref) return '';
      const s = this.byKey.get(ref);
      if (s) {
        if (color) s.color = color;
        if (o.overflow === true) s.overflow = true;
        if (o.fit === 'fill' || o.fit === 'contain' || o.fit === 'cover') s.fit = o.fit;
      }
      return ref;
    }
    const v = str(raw);
    if (!v) return '';
    if (v.startsWith('sprite:')) {
      // Bare sprite ids from older saves (`sprite:spr-xyz` without the sprite being registered yet)
      // are adopted into the registry so validation and rendering can resolve them.
      const sid = v.slice(7);
      if (this.knownSprites && !this.knownSprites[sid] && !this.byKey.has(v) && /^spr-/.test(sid)) {
        this.byKey.set(v, { id: sid, name: 'Image', assetId: '', createdAt: nowIso() });
      }
      return v; // already migrated / authored with sprites
    }
    // A raw sprite id stored where a ref was expected → normalize, never import as a URL.
    if (looksLikeSpriteId(v)) return this.register(spriteRef(v));
    // Legacy solid-color "images" become color-only sprites (no asset needed).
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) {
      const k = 'c|' + v.toLowerCase();
      let s = this.byKey.get(k);
      if (!s) {
        s = createSprite('Color', '', { color: v });
        this.byKey.set(k, s);
      }
      return spriteRef(s.id);
    }
    const k = SpriteRegistry.key(v, this.assets);
    let s = this.byKey.get(k);
    if (!s) {
      const assetId = v.startsWith('asset:') ? v : this.importDirectUrl(v);
      s = createSprite(this.nameHint || 'Image', assetId);
      this.byKey.set(k, s);
    }
    return spriteRef(s.id);
  }
  /** Direct data/external URLs become real assets so the sprite always points at the asset library. */
  private importDirectUrl(url: string): string {
    const id = uid('asset');
    this.assets[id] = { id, name: this.nameHint || 'image', url, width: 100, height: 100, createdAt: nowIso() };
    return assetRef(id);
  }
  list(): Sprite[] {
    return [...this.byKey.values()];
  }
}

/** Normalize a stored transform/effect sprite value: full refs are kept, bare ids promoted, URLs imported as new sprites. */
const normalizeSpriteValue = (v: unknown, reg: SpriteRegistry): string | undefined => {
  if (typeof v !== 'string' || !v) return undefined;
  return reg.register(v) || undefined;
};

/** Normalize the extra gating condition of a rule ("only when ALL these objects are transformed / items held"). */
function normalizeConditions(raw: any): TransformCondition | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const objs = Array.isArray(raw.transformedObjects)
    ? raw.transformedObjects
        .filter((e: any) => e && typeof e === 'object' && str(e.objectId))
        .map((e: any) => ({
          sceneId: str(e.sceneId) || undefined,
          objectId: str(e.objectId),
          minRule: Number.isInteger(e.minRule) ? Math.max(-1, e.minRule as number) : undefined,
        }))
    : [];
  const items = strList(raw.itemsInInventory);
  if (!objs.length && !items.length) return undefined;
  return {
    transformedObjects: objs.length ? objs : undefined,
    itemsInInventory: items.length ? items : undefined,
    autoApply: raw.autoApply === true ? true : undefined,
  };
}

function normalizeEffects(list: any, reg: SpriteRegistry): TransformEffect[] | undefined {
  if (!Array.isArray(list) || !list.length) return undefined;
  const out: TransformEffect[] = [];
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const action = str(e.action) as EffectAction;
    if (action !== 'transform' && action !== 'background' && action !== 'unlockDoor') continue;
    out.push({
      action,
      sceneId: str(e.sceneId) || undefined,
      objectId: str(e.objectId) || undefined,
      ruleIndex: Number.isInteger(e.ruleIndex) ? Math.max(0, e.ruleIndex as number) : undefined,
      newSpriteId: normalizeSpriteValue(e.newSpriteId ?? e.newImageUrl ?? e.backgroundUrl, reg),
      doorObjectId: str(e.doorObjectId) || undefined,
      message: str(e.message) || undefined,
    });
  }
  return out.length ? out : undefined;
}

function normalizeTransform(r: any, reg: SpriteRegistry): TransformRule {
  // Tolerant normalization: older data may store a bare sprite id (`spr-…`) instead of a full
  // `sprite:` ref — the registry promotes it and adopts the sprite so it resolves to the right image.
  return {
    requiresItem: str(r?.requiresItem),
    newSpriteId: normalizeSpriteValue(r?.newSpriteId ?? r?.newImageUrl, reg),
    newName: str(r?.newName) || undefined,
    newMessage: str(r?.newMessage) || undefined,
    grantsItem: str(r?.grantsItem) || undefined,
    consumesItem: r?.consumesItem !== false,
    triggersDiscovery: r?.triggersDiscovery === true,
    conditions: normalizeConditions(r?.conditions),
    effects: normalizeEffects(r?.effects, reg),
  };
}

function normalizeView(r: any, reg: SpriteRegistry): View {
  const req = strList(r?.requiresItem);
  return {
    id: str(r?.id) || uid('view'),
    title: str(r?.title) || 'View',
    backgroundUrl: reg.register(r?.backgroundUrl ?? r?.backgroundSprite),
    width: Math.max(1, num(r?.width, 400)),
    height: Math.max(1, num(r?.height, 400)),
    objects: Array.isArray(r?.objects) ? r.objects.map((o: any) => normalizeObject(o, reg, 1)) : [],
    requiresItem: req.length ? req : undefined,
    closeMessage: str(r?.closeMessage) || undefined,
  };
}

/** Frame-local polygon points → clean list (≥3 finite points), or undefined. Used by import/migration. */
export function normalizeFramePolygon(raw: any): FramePoint[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const pts = raw
    .map((p: any) => ({ x: num(p?.x, NaN), y: num(p?.y, NaN) }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  return pts.length >= 3 ? pts : undefined;
}

export function normalizeObject(raw: any, reg: SpriteRegistry, depth = 0): SceneObject {
  const o = raw ?? {};
  // Old bundles had decoration/inventory/container types — everything is one unified sprite now.
  const legacyType = typeof o.type === 'string' ? o.type : '';
  const req = strList(o.requiresItem);
  const digit = Number.isInteger(o.digit) ? clamp(o.digit, 0, 9) : undefined;
  return {
    id: str(o.id) || uid('obj'),
    name: str(o.name) || 'Object',
    type: OBJECT_TYPE,
    spriteRef: reg.register(o.spriteRef ?? o.imageUrl),
    x: num(o.x, 0),
    y: num(o.y, 0),
    width: Math.max(1, num(o.width, 80)),
    height: Math.max(1, num(o.height, 80)),
    rotation: num(o.rotation, 0),
    scaleX: Number.isFinite(o.scaleX) && o.scaleX !== 0 && o.scaleX !== 1 ? o.scaleX : undefined,
    scaleY: Number.isFinite(o.scaleY) && o.scaleY !== 0 && o.scaleY !== 1 ? o.scaleY : undefined,
    imageOffsetX: Number.isFinite(o.imageOffsetX) && o.imageOffsetX !== 0 ? o.imageOffsetX : undefined,
    imageOffsetY: Number.isFinite(o.imageOffsetY) && o.imageOffsetY !== 0 ? o.imageOffsetY : undefined,
    hitArea: o.hitArea === 'image' || o.hitArea === 'polygon' ? o.hitArea : undefined,
    framePolygon: normalizeFramePolygon(o.framePolygon),
    visible: o.visible !== false,
    locked: o.locked === true,
    oneTimeUse: o.oneTimeUse === true,
    message: str(o.message) || undefined,
    digit,
    requiresItem: req.length ? req : undefined,
    grantsItem: str(o.grantsItem) || undefined,
    soundUrl: str(o.soundUrl) || undefined,
    view: depth === 0 && o.view ? normalizeView(o.view, reg) : undefined,
    // Legacy 'inventory' objects were auto-pickupable — keep that behavior when importing old bundles.
    pickupable: o.pickupable === true || legacyType === 'inventory' ? true : undefined,
    pickupItemId: str(o.pickupItemId) || undefined,
    pickupMessage: str(o.pickupMessage) || undefined,
    pickupEffects: normalizeEffects(o.pickupEffects, reg),
    door:
      o.door && typeof o.door === 'object' && str(o.door.sceneId)
        ? { sceneId: str(o.door.sceneId), requiresItems: strList(o.door.requiresItems), lockedMessage: str(o.door.lockedMessage) || undefined }
        : undefined,
    transforms:
      Array.isArray(o.transforms) && o.transforms.length ? o.transforms.map((t: any) => normalizeTransform(t, reg)) : undefined,
  };
}

const byOldOrder = (a: any, b: any) =>
  num(a?.layerIndex, 0) - num(b?.layerIndex, 0) || num(a?.zIndex, 0) - num(b?.zIndex, 0);

export function normalizeScene(raw: any, projectId: string, reg: SpriteRegistry): Scene {
  const rawObjs: any[] = Array.isArray(raw?.objects) ? [...raw.objects] : [];
  // migrate old zIndex/layerIndex format to array order
  if (rawObjs.some((o) => o && (o.layerIndex !== undefined || o.zIndex !== undefined))) rawObjs.sort(byOldOrder);
  const rawLayers: any[] = Array.isArray(raw?.backgroundLayers) ? [...raw.backgroundLayers] : [];
  if (rawLayers.some((l) => l && l.layerIndex !== undefined)) rawLayers.sort(byOldOrder);
  return {
    id: str(raw?.id) || uid('scene'),
    projectId,
    title: str(raw?.title) || 'Room',
    width: Math.max(1, num(raw?.width, 800)),
    height: Math.max(1, num(raw?.height, 600)),
    backgroundUrl: reg.register(raw?.backgroundUrl ?? raw?.backgroundSprite),
    backgroundLayers: rawLayers.map((l, i) => ({
      id: str(l?.id) || uid('bg'),
      name: str(l?.name) || `Layer ${i + 1}`,
      spriteRef: reg.register(l?.spriteRef ?? l?.imageUrl),
      opacity: clamp(num(l?.opacity, 1), 0, 1),
      visible: l?.visible !== false,
      offsetX: num(l?.offsetX, 0),
      offsetY: num(l?.offsetY, 0),
    })),
    objects: rawObjs.map((o) => normalizeObject(o, reg)),
    clueChain: strList(raw?.clueChain),
    exitNumber: clamp(Math.round(num(raw?.exitNumber, 0)), 0, 9),
  };
}

export function normalizeBundle(text: string): ProjectBundle {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }
  if (!data || typeof data !== 'object' || !data.project || !Array.isArray(data.scenes)) {
    throw new Error('File is not a project export (missing "project" / "scenes")');
  }
  const pid = str(data.project.id) || uid('proj');
  const assetMap: Record<string, Asset> = {};
  const assets: Asset[] = (Array.isArray(data.assets) ? data.assets : [])
    .filter((a: any) => a && str(a.id) && str(a.url))
    .map((a: any) => {
      const asset: Asset = {
        id: str(a.id),
        name: str(a.name) || 'asset',
        url: str(a.url),
        width: num(a.width, 100),
        height: num(a.height, 100),
        createdAt: str(a.createdAt) || nowIso(),
      };
      assetMap[asset.id] = asset;
      return asset;
    });
  // Sprites shipped with the bundle are known up-front so refs pointing at them resolve directly.
  const spriteList: Sprite[] = (Array.isArray(data.sprites) ? data.sprites : [])
    .filter((s: any) => s && str(s.id))
    .map((s: any) => ({
      id: str(s.id),
      name: str(s.name) || 'sprite',
      assetId: str(s.assetId ?? s.imageUrl),
      color: str(s.color) || undefined,
      createdAt: str(s.createdAt) || nowIso(),
    }));
  // Every image used anywhere (objects, views, layers, backgrounds, transforms) becomes a sprite.
  const reg = new SpriteRegistry(assetMap, '', Object.fromEntries(spriteList.map((s) => [s.id, s])));
  const scenes: Scene[] = data.scenes.map((s: any) => normalizeScene(s, pid, reg));
  const order: string[] = strList(data.project.scenes);
  const ordered = order.length
    ? [
        ...order.map((id) => scenes.find((s) => s.id === id)).filter((s): s is Scene => !!s),
        ...scenes.filter((s) => !order.includes(s.id)),
      ]
    : scenes;
  const byId: Record<string, Sprite> = { ...Object.fromEntries(spriteList.map((s) => [s.id, s])), ...Object.fromEntries(reg.list().map((s) => [s.id, s])) };
  const sprites = Object.values(byId);
  // The registry may have created NEW assets while normalizing (direct data/external URLs are
  // imported into the asset library). Return those too, otherwise imported bundles lose images.
  const allAssets = Object.values(assetMap);
  const project: Project = {
    id: pid,
    name: str(data.project.name) || 'Imported project',
    description: str(data.project.description),
    scenes: ordered.map((s) => s.id),
    finalLockDigits: ordered.map((s) => s.exitNumber).join(''),
    assets: [...new Set([...strList(data.project.assets).filter((id) => assetMap[id]), ...allAssets.map((a) => a.id)])],
    sprites: sprites.map((s) => s.id),
    createdAt: str(data.project.createdAt) || nowIso(),
    updatedAt: nowIso(),
  };
  return { format: 'escape-studio', version: 3, project, scenes: ordered, assets: allAssets, sprites };
}
