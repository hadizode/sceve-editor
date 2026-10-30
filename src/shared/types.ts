import { z } from 'zod';

// ============ Enums & Types ============
export const ObjectTypeSchema = z.enum(['clue', 'number-piece', 'decoration', 'inventory', 'container', 'exit']);
export type ObjectType = z.infer<typeof ObjectTypeSchema>;

// ============ View (Interactive Scene within an Object) ============
export interface View {
  id: string;
  title: string;
  backgroundUrl: string;
  width: number;
  height: number;
  objects: SceneObject[];
  requiresItem?: string[]; // condition to open this view
  closeMessage?: string; // message when closing view
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
  visible: boolean;
  oneTimeUse: boolean;
  message?: string;
  number?: number;
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
  visible: z.boolean().default(true),
  oneTimeUse: z.boolean().default(false),
  message: z.string().optional(),
  number: z.number().min(0).max(9).optional(),
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
export const SceneSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  width: z.number(),
  height: z.number(),
  backgroundUrl: z.string(),
  objects: z.array(SceneObjectSchema),
  clueChain: z.array(z.string()),
  exitNumber: z.number().min(0).max(9),
});
export type Scene = z.infer<typeof SceneSchema>;

// ============ Project ============
export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  scenes: z.array(z.string()),
  finalLockDigits: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

// ============ Session ============
export const PlayerSchema = z.object({
  telegramId: z.string(),
  name: z.string(),
  online: z.boolean().default(false),
  ready: z.boolean().default(false),
});
export type Player = z.infer<typeof PlayerSchema>;

export const SessionStateSchema = z.object({
  currentSceneId: z.string(),
  discoveredObjects: z.record(z.string(), z.array(z.string())),
  inventory: z.array(z.string()),
  completedScenes: z.array(z.string()),
  finalLockEntered: z.string().optional(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  token: z.string(),
  projectId: z.string(),
  players: z.array(PlayerSchema),
  state: SessionStateSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

// ============ Validation Helpers ============
export function validateScene(scene: Scene): string[] {
  const errors: string[] = [];
  const numberPieces = scene.objects.filter(o => o.type === 'number-piece');
  if (numberPieces.length === 0) {
    errors.push('هر اتاق باید حداقل یک قطعه عدد داشته باشد');
  }
  const objectIds = new Set(scene.objects.map(o => o.id));
  for (const chainId of scene.clueChain) {
    if (!objectIds.has(chainId)) {
      errors.push(`آیتم زنجیر "${chainId}" وجود ندارد`);
    }
  }
  if (scene.clueChain.length > 0) {
    const lastId = scene.clueChain[scene.clueChain.length - 1];
    const lastObj = scene.objects.find(o => o.id === lastId);
    if (lastObj && lastObj.type !== 'number-piece') {
      errors.push('زنجیر سرنخ باید به یک قطعه عدد ختم شود');
    }
  }
  return errors;
}

export function validateProject(project: Project, scenes: Scene[]): string[] {
  const errors: string[] = [];
  if (project.scenes.length === 0) {
    errors.push('پروژه باید حداقل یک اتاق داشته باشد');
  }
  if (project.finalLockDigits.length !== project.scenes.length) {
    errors.push('تعداد ارقام قفل نهایی باید برابر تعداد اتاق‌ها باشد');
  }
  for (const scene of scenes) {
    const sceneErrors = validateScene(scene);
    errors.push(...sceneErrors.map(e => `[${scene.title}]: ${e}`));
  }
  return errors;
}
