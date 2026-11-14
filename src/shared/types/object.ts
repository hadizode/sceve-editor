import { z } from 'zod';

// ============ Enums & Types ============
export const ObjectTypeSchema = z.enum(['decoration', 'inventory', 'container']);
export type ObjectType = z.infer<typeof ObjectTypeSchema>;

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

export const BackgroundLayerSchema: z.ZodType<BackgroundLayer> = z.object({
  id: z.string(),
  imageUrl: z.string(),
  layerIndex: z.number(),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
});

// ============ Sprite Animation (frame sequence) ============
export interface SpriteAnimation {
  frames: string[];              // image URLs, one per frame
  frameWidth?: number;           // display width override (defaults to object width)
  frameHeight?: number;          // display height override (defaults to object height)
  fps: number;                   // frames per second (default 8)
  loop: boolean;                 // loop the animation (default true)
  startFrame?: number;           // initial frame index (default 0)
}

export const SpriteAnimationSchema: z.ZodType<SpriteAnimation> = z.object({
  frames: z.array(z.string()),
  frameWidth: z.number().optional(),
  frameHeight: z.number().optional(),
  fps: z.number().positive(),
  loop: z.boolean(),
  startFrame: z.number().int().min(0).optional(),
});

// ============ Transform Condition (checked against session state) ============
export interface TransformCondition {
  /** Item IDs that must be present in inventory. */
  hasItems?: string[];
  /** Object IDs (in the same scene as the transformed object) that must be discovered. */
  discoveredObjects?: string[];
  /** Scene IDs that must have been completed. */
  completedScenes?: string[];
  /** Object IDs (anywhere, resolved via scenesById) that must be discovered. */
  crossSceneObjects?: string[];
  /** When true the rule is auto-applied and never shows up as "pending". */
  autoApply?: boolean;
}

export const TransformConditionSchema: z.ZodType<TransformCondition> = z.object({
  hasItems: z.array(z.string()).optional(),
  discoveredObjects: z.array(z.string()).optional(),
  completedScenes: z.array(z.string()).optional(),
  crossSceneObjects: z.array(z.string()).optional(),
  autoApply: z.boolean().optional(),
});

// ============ Transform Rule (when item is used on object) ============
export interface TransformRule {
  requiresItem?: string;       // item ID that must be used (omitted = free/no-item rule)
  newImageUrl?: string;        // new image after transform
  newName?: string;            // new name after transform
  newMessage?: string;         // message shown after transform
  grantsItem?: string;         // item granted after transform
  consumesItem?: boolean;      // whether the used item is consumed (default: true)
  triggersDiscovery?: boolean; // whether this counts as discovering the object
  conditions?: TransformCondition; // extra gating/automation for the rule
}

export const TransformRuleSchema: z.ZodType<TransformRule> = z.object({
  requiresItem: z.string().optional(),
  newImageUrl: z.string().optional(),
  newName: z.string().optional(),
  newMessage: z.string().optional(),
  grantsItem: z.string().optional(),
  consumesItem: z.boolean().optional(),
  triggersDiscovery: z.boolean().optional(),
  conditions: TransformConditionSchema.optional(),
});

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
  hitArea?: number[];            // polygon points [x1,y1,...] in LOCAL coords (relative to x,y, unrotated). Undefined = full rect.
  sprite?: SpriteAnimation;      // animated frame sequence (overrides static imageUrl while playing)
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

export const SceneObjectSchema: z.ZodType<SceneObject> = z.object({
  id: z.string(),
  name: z.string(),
  type: ObjectTypeSchema,
  imageUrl: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  hitArea: z.array(z.number()).optional(),
  sprite: SpriteAnimationSchema.optional(),
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
