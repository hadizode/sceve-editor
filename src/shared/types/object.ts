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

// ============ Transform Conditions ============
// A rule's conditions gate when it may fire. All present fields must hold.
export interface TransformConditions {
  // Item IDs that must all be in the inventory.
  itemsInInventory?: string[];
  // Other objects that must already have fired at least one of their rules
  // (or the rule with index >= minRule). Use objectId 'self' to chain onto
  // this object's own fired rules: e.g. rule B with
  // { transformedObjects: [{ objectId: 'self', minRule: 0 }] } only fires
  // after rule 0 of the same object has fired.
  transformedObjects?: { objectId: string; minRule?: number }[];
  // The referenced object(s) must be visible/discovered in the scene.
  prereqVisible?: boolean;
  // Position constraints evaluated against other objects (by id).
  checkPositions?: { belowObjectId?: string; aboveObjectId?: string };
  // When set, the rule fires automatically (no item needed) once satisfied.
  autoApply?: boolean;
}

export const TransformConditionsSchema: z.ZodType<TransformConditions> = z.object({
  itemsInInventory: z.array(z.string()).optional(),
  transformedObjects: z.array(z.object({
    objectId: z.string(),
    minRule: z.number().int().min(0).optional(),
  })).optional(),
  prereqVisible: z.boolean().optional(),
  checkPositions: z.object({
    belowObjectId: z.string().optional(),
    aboveObjectId: z.string().optional(),
  }).optional(),
  autoApply: z.boolean().optional(),
});

// ============ Effect emitted by a fired rule ============
export interface TransformEffect {
  kind: string;                  // e.g. 'sound' | 'toast' | ...
  [key: string]: unknown;
}

export const TransformEffectSchema: z.ZodType<TransformEffect> = z.record(z.string(), z.any()) as unknown as z.ZodType<TransformEffect>;

// ============ Transform Rule (when item is used on object) ============
export interface TransformRule {
  requiresItem: string;        // item ID that must be used ('' = no item needed)
  newImageUrl?: string;        // new image after transform
  newName?: string;            // new name after transform
  newMessage?: string;         // message shown after transform
  grantsItem?: string;         // item granted after transform
  consumesItem?: boolean;      // whether the used item is consumed (default: true)
  triggersDiscovery?: boolean; // whether this counts as discovering the object
  toggle?: boolean;            // clicking again un-fires the rule (reverts state)
  effects?: TransformEffect[]; // side-effects applied when the rule fires
  conditions?: TransformConditions; // gating conditions for firing
}

export const TransformRuleSchema: z.ZodType<TransformRule> = z.object({
  requiresItem: z.string(),
  newImageUrl: z.string().optional(),
  newName: z.string().optional(),
  newMessage: z.string().optional(),
  grantsItem: z.string().optional(),
  consumesItem: z.boolean().optional(),
  triggersDiscovery: z.boolean().optional(),
  toggle: z.boolean().optional(),
  effects: z.array(TransformEffectSchema).optional(),
  conditions: TransformConditionsSchema.optional(),
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
  currentTransform?: number;   // legacy: index of current transform state (-1 = original)
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
