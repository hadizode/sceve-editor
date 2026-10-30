import { z } from 'zod';

// ============ Enums & Types ============
export const ObjectTypeSchema = z.enum(['decoration', 'inventory', 'container']);
export type ObjectType = z.infer<typeof ObjectTypeSchema>;

// ============ Asset (shared image library) ============
export interface Asset {
  id: string;
  name: string;
  url: string;           // data URL or external URL
  tags: string[];
  createdAt: string;
}

// ============ View (Interactive Scene within an Object) ============
export interface View {
  id: string;
  title: string;
  backgroundUrl: string;
  backgroundLayers?: BackgroundLayer[]; // multiple layered backgrounds
  width: number;
  height: number;
  objects: SceneObject[];
  requiresItem?: string[]; // condition to open this view
  closeMessage?: string; // message when closing view
}

// ============ Background Layer ============
export interface BackgroundLayer {
  id: string;
  imageUrl: string;
  layerIndex: number;    // z-order among backgrounds
  opacity: number;       // 0-1
  visible: boolean;
  offsetX?: number;      // parallax offset
  offsetY?: number;
}

// ============ Transform Rule (when item is used on object) ============
export interface TransformRule {
  requiresItem: string;        // item ID that must be used
  newImageUrl?: string;        // new image after transform
  newName?: string;            // new name after transform
  newMessage?: string;         // message shown after transform
  grantsItem?: string;         // item granted after transform
  consumesItem?: boolean;      // whether the used item is consumed (default: true)
  triggersDiscovery?: boolean; // whether this counts as discovering the object
}

// ============ SceneObject ============
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
  zIndex: number;
  layerIndex: number;          // global layer index for z-ordering
  visible: boolean;
  oneTimeUse: boolean;
  message?: string;
  digit?: number;              // 0-9, if this object represents a digit
  requiresItem?: string[];
  grantsItem?: string;
  soundUrl?: string;
  view?: View;
  customData?: Record<string, string>;
  // Inventory & Transform
  pickupable?: boolean;        // can this object be picked up into inventory?
  pickupItemId?: string;       // the item ID added to inventory when picked up
  pickupMessage?: string;      // message shown when picked up
  transforms?: TransformRule[]; // rules for transforming when items are used on this
  currentTransform?: number;   // index of current transform state (-1 = original)
}

export const TransformRuleSchema: z.ZodType<TransformRule> = z.object({
  requiresItem: z.string(),
  newImageUrl: z.string().optional(),
  newName: z.string().optional(),
  newMessage: z.string().optional(),
  grantsItem: z.string().optional(),
  consumesItem: z.boolean().optional(),
  triggersDiscovery: z.boolean().optional(),
});

export const BackgroundLayerSchema: z.ZodType<BackgroundLayer> = z.object({
  id: z.string(),
  imageUrl: z.string(),
  layerIndex: z.number(),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
});

export const SceneObjectSchema: z.ZodType<SceneObject> = z.object({
  id: z.string(),
  name: z.string(),
  type: ObjectTypeSchema,
  imageUrl: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().default(0),
  zIndex: z.number().default(0),
  layerIndex: z.number().default(0),
  visible: z.boolean().default(true),
  oneTimeUse: z.boolean().default(false),
  message: z.string().optional(),
  digit: z.number().min(0).max(9).optional(),
  requiresItem: z.array(z.string()).optional(),
  grantsItem: z.string().optional(),
  soundUrl: z.string().optional(),
  view: z.any().optional(),
  customData: z.record(z.string(), z.string()).optional(),
  pickupable: z.boolean().optional(),
  pickupItemId: z.string().optional(),
  pickupMessage: z.string().optional(),
  transforms: z.array(TransformRuleSchema).optional(),
  currentTransform: z.number().optional(),
});

// ============ Scene ============
export interface Scene {
  id: string;
  projectId: string;
  title: string;
  width: number;
  height: number;
  backgroundUrl: string;
  backgroundLayers?: BackgroundLayer[]; // multiple layered backgrounds
  objects: SceneObject[];
  clueChain: string[];
  exitNumber: number;
}

export const SceneSchema: z.ZodType<Scene> = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  width: z.number(),
  height: z.number(),
  backgroundUrl: z.string(),
  backgroundLayers: z.array(BackgroundLayerSchema).optional(),
  objects: z.array(SceneObjectSchema),
  clueChain: z.array(z.string()),
  exitNumber: z.number().min(0).max(9),
});

// ============ Project ============
export interface Project {
  id: string;
  name: string;
  description: string;
  scenes: string[];
  finalLockDigits: string;
  assets: string[];          // asset IDs used in this project
  createdAt: string;
  updatedAt: string;
}

export const ProjectSchema: z.ZodType<Project> = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  scenes: z.array(z.string()),
  finalLockDigits: z.string(),
  assets: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// ============ Session ============
export interface Player {
  telegramId: string;
  name: string;
  online: boolean;
  ready: boolean;
}

export const PlayerSchema: z.ZodType<Player> = z.object({
  telegramId: z.string(),
  name: z.string(),
  online: z.boolean().default(false),
  ready: z.boolean().default(false),
});

export interface SessionState {
  currentSceneId: string;
  discoveredObjects: Record<string, string[]>;
  inventory: string[];
  completedScenes: string[];
  finalLockEntered?: string;
}

export const SessionStateSchema: z.ZodType<SessionState> = z.object({
  currentSceneId: z.string(),
  discoveredObjects: z.record(z.string(), z.array(z.string())),
  inventory: z.array(z.string()),
  completedScenes: z.array(z.string()),
  finalLockEntered: z.string().optional(),
});

export interface Session {
  id: string;
  token: string;
  projectId: string;
  players: Player[];
  state: SessionState;
  createdAt: string;
  expiresAt: string;
}

export const SessionSchema: z.ZodType<Session> = z.object({
  id: z.string(),
  token: z.string(),
  projectId: z.string(),
  players: z.array(PlayerSchema),
  state: SessionStateSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
});

// ============ Validation Helpers ============
export function validateScene(scene: Scene): string[] {
  const errors: string[] = [];
  // Check for objects with digits
  const digitObjects = scene.objects.filter(o => o.digit !== undefined);
  if (digitObjects.length === 0) {
    errors.push('Every room must have at least one object with a digit');
  }
  const objectIds = new Set(scene.objects.map(o => o.id));
  for (const chainId of scene.clueChain) {
    if (!objectIds.has(chainId)) {
      errors.push(`Clue chain item "${chainId}" does not exist`);
    }
  }
  if (scene.clueChain.length > 0) {
    const lastId = scene.clueChain[scene.clueChain.length - 1];
    const lastObj = scene.objects.find(o => o.id === lastId);
    if (lastObj && lastObj.digit === undefined) {
      errors.push('Clue chain should end at an object with a digit');
    }
  }
  return errors;
}

export function validateProject(project: Project, scenes: Scene[]): string[] {
  const errors: string[] = [];
  if (project.scenes.length === 0) {
    errors.push('Project must have at least one room');
  }
  if (project.finalLockDigits.length !== project.scenes.length) {
    errors.push('Final lock digits count must match number of rooms');
  }
  for (const scene of scenes) {
    const sceneErrors = validateScene(scene);
    errors.push(...sceneErrors.map(e => `[${scene.title}]: ${e}`));
  }
  return errors;
}
