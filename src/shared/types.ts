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

export interface TransformRule {
  requiresItem: string;
  /** New sprite for the object after this rule fires — can be any image. */
  newSpriteId?: string;
  newName?: string;
  newMessage?: string;
  grantsItem?: string;
  consumesItem?: boolean;
  triggersDiscovery?: boolean;
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

/** What counts as a click on a sprite: its logical frame (default) or its rendered image's bounds. */
export type HitArea = 'frame' | 'image';

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
  constructor(private assets: Record<string, Asset>, private nameHint = '') {}
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
    if (v.startsWith('sprite:')) return v; // already migrated / authored with sprites
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

function normalizeTransform(r: any, reg: SpriteRegistry): TransformRule {
  return {
    requiresItem: str(r?.requiresItem),
    newSpriteId: reg.register(r?.newSpriteId ?? r?.newImageUrl) || undefined,
    newName: str(r?.newName) || undefined,
    newMessage: str(r?.newMessage) || undefined,
    grantsItem: str(r?.grantsItem) || undefined,
    consumesItem: r?.consumesItem !== false,
    triggersDiscovery: r?.triggersDiscovery === true,
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
    hitArea: o.hitArea === 'image' ? 'image' : undefined,
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
  // Every image used anywhere (objects, views, layers, backgrounds, transforms) becomes a sprite.
  const reg = new SpriteRegistry(assetMap);
  const scenes: Scene[] = data.scenes.map((s: any) => normalizeScene(s, pid, reg));
  const order: string[] = strList(data.project.scenes);
  const ordered = order.length
    ? [
        ...order.map((id) => scenes.find((s) => s.id === id)).filter((s): s is Scene => !!s),
        ...scenes.filter((s) => !order.includes(s.id)),
      ]
    : scenes;
  const sprites = reg.list();
  const project: Project = {
    id: pid,
    name: str(data.project.name) || 'Imported project',
    description: str(data.project.description),
    scenes: ordered.map((s) => s.id),
    finalLockDigits: ordered.map((s) => s.exitNumber).join(''),
    assets: strList(data.project.assets).filter((id) => assetMap[id]),
    sprites: sprites.map((s) => s.id),
    createdAt: str(data.project.createdAt) || nowIso(),
    updatedAt: nowIso(),
  };
  return { format: 'escape-studio', version: 3, project, scenes: ordered, assets, sprites };
}
