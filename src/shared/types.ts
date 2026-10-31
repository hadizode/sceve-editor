import { clamp, nowIso, placeholderSvg, uid } from './utils';

// ============ Basic types ============
export const OBJECT_TYPES = ['decoration', 'inventory', 'container'] as const;
export type ObjectType = (typeof OBJECT_TYPES)[number];

export const TYPE_COLORS: Record<ObjectType, string> = {
  decoration: '#6b7280',
  inventory: '#10b981',
  container: '#8b5cf6',
};

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
  imageUrl: string;
  opacity: number; // 0-1
  visible: boolean;
  offsetX: number;
  offsetY: number;
}

export interface TransformRule {
  requiresItem: string;
  newImageUrl?: string;
  newName?: string;
  newMessage?: string;
  grantsItem?: string;
  consumesItem?: boolean;
  triggersDiscovery?: boolean;
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
  backgroundUrl: string;
  width: number;
  height: number;
  objects: SceneObject[];
  requiresItem?: string[];
  closeMessage?: string;
}

/** Draw order = position in the `objects` array (last = on top). */
export interface SceneObject {
  id: string;
  name: string;
  type: ObjectType;
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
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
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBundle {
  format: 'escape-studio';
  version: 2;
  project: Project;
  scenes: Scene[];
  assets: Asset[];
}

// ============ Factories ============
export function createObject(type: ObjectType, p: Partial<SceneObject> = {}): SceneObject {
  const label = { decoration: 'Decoration', inventory: 'Item', container: 'Container' }[type];
  return {
    id: uid('obj'),
    name: label,
    type,
    imageUrl: placeholderSvg(label, TYPE_COLORS[type], 80, 80),
    x: 100,
    y: 100,
    width: 80,
    height: 80,
    rotation: 0,
    visible: true,
    locked: false,
    oneTimeUse: false,
    ...(type === 'inventory' ? { pickupable: true } : {}),
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

// ============ Normalization (import + migration from the old format) ============
/* eslint-disable @typescript-eslint/no-explicit-any */
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : [];

function normalizeTransform(r: any): TransformRule {
  return {
    requiresItem: str(r?.requiresItem),
    newImageUrl: str(r?.newImageUrl) || undefined,
    newName: str(r?.newName) || undefined,
    newMessage: str(r?.newMessage) || undefined,
    grantsItem: str(r?.grantsItem) || undefined,
    consumesItem: r?.consumesItem !== false,
    triggersDiscovery: r?.triggersDiscovery === true,
  };
}

function normalizeView(r: any): View {
  const req = strList(r?.requiresItem);
  return {
    id: str(r?.id) || uid('view'),
    title: str(r?.title) || 'View',
    backgroundUrl: str(r?.backgroundUrl),
    width: Math.max(1, num(r?.width, 400)),
    height: Math.max(1, num(r?.height, 400)),
    objects: Array.isArray(r?.objects) ? r.objects.map((o: any) => normalizeObject(o, 1)) : [],
    requiresItem: req.length ? req : undefined,
    closeMessage: str(r?.closeMessage) || undefined,
  };
}

export function normalizeObject(raw: any, depth = 0): SceneObject {
  const o = raw ?? {};
  const type: ObjectType = OBJECT_TYPES.includes(o.type) ? o.type : 'decoration';
  const req = strList(o.requiresItem);
  const digit = Number.isInteger(o.digit) ? clamp(o.digit, 0, 9) : undefined;
  return {
    id: str(o.id) || uid('obj'),
    name: str(o.name) || 'Object',
    type,
    imageUrl: str(o.imageUrl),
    x: num(o.x, 0),
    y: num(o.y, 0),
    width: Math.max(1, num(o.width, 80)),
    height: Math.max(1, num(o.height, 80)),
    rotation: num(o.rotation, 0),
    visible: o.visible !== false,
    locked: o.locked === true,
    oneTimeUse: o.oneTimeUse === true,
    message: str(o.message) || undefined,
    digit,
    requiresItem: req.length ? req : undefined,
    grantsItem: str(o.grantsItem) || undefined,
    soundUrl: str(o.soundUrl) || undefined,
    view: depth === 0 && o.view ? normalizeView(o.view) : undefined,
    pickupable: o.pickupable === true ? true : undefined,
    pickupItemId: str(o.pickupItemId) || undefined,
    pickupMessage: str(o.pickupMessage) || undefined,
    transforms:
      Array.isArray(o.transforms) && o.transforms.length ? o.transforms.map(normalizeTransform) : undefined,
  };
}

const byOldOrder = (a: any, b: any) =>
  num(a?.layerIndex, 0) - num(b?.layerIndex, 0) || num(a?.zIndex, 0) - num(b?.zIndex, 0);

export function normalizeScene(raw: any, projectId: string): Scene {
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
    backgroundUrl: str(raw?.backgroundUrl),
    backgroundLayers: rawLayers.map((l, i) => ({
      id: str(l?.id) || uid('bg'),
      name: str(l?.name) || `Layer ${i + 1}`,
      imageUrl: str(l?.imageUrl),
      opacity: clamp(num(l?.opacity, 1), 0, 1),
      visible: l?.visible !== false,
      offsetX: num(l?.offsetX, 0),
      offsetY: num(l?.offsetY, 0),
    })),
    objects: rawObjs.map((o) => normalizeObject(o)),
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
  const scenes: Scene[] = data.scenes.map((s: any) => normalizeScene(s, pid));
  const order: string[] = strList(data.project.scenes);
  const ordered = order.length
    ? [
        ...order.map((id) => scenes.find((s) => s.id === id)).filter((s): s is Scene => !!s),
        ...scenes.filter((s) => !order.includes(s.id)),
      ]
    : scenes;
  const assets: Asset[] = (Array.isArray(data.assets) ? data.assets : [])
    .filter((a: any) => a && str(a.id) && str(a.url))
    .map((a: any) => ({
      id: str(a.id),
      name: str(a.name) || 'asset',
      url: str(a.url),
      width: num(a.width, 100),
      height: num(a.height, 100),
      createdAt: str(a.createdAt) || nowIso(),
    }));
  const project: Project = {
    id: pid,
    name: str(data.project.name) || 'Imported project',
    description: str(data.project.description),
    scenes: ordered.map((s) => s.id),
    finalLockDigits: ordered.map((s) => s.exitNumber).join(''),
    assets: strList(data.project.assets),
    createdAt: str(data.project.createdAt) || nowIso(),
    updatedAt: nowIso(),
  };
  return { format: 'escape-studio', version: 2, project, scenes: ordered, assets };
}
