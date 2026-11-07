import { z } from 'zod';
import { BackgroundLayerSchema, SceneObjectSchema, type BackgroundLayer, type SceneObject } from './object';

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
