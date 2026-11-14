import { z } from 'zod';

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
  // objectId -> indexes of every transform rule that has fired
  rulesFired?: Record<string, number[]>;
  // objectId -> highest fired transform-rule index (kept for backward compat)
  transformsApplied?: Record<string, number>;
}

/** Fresh, empty session state. */
export function createSessionState(): SessionState {
  return {
    currentSceneId: '',
    discoveredObjects: {},
    inventory: [],
    completedScenes: [],
    rulesFired: {},
    transformsApplied: {},
  };
}

export const SessionStateSchema: z.ZodType<SessionState> = z.object({
  currentSceneId: z.string(),
  discoveredObjects: z.record(z.string(), z.array(z.string())),
  inventory: z.array(z.string()),
  completedScenes: z.array(z.string()),
  finalLockEntered: z.string().optional(),
  rulesFired: z.record(z.string(), z.array(z.number())).optional(),
  transformsApplied: z.record(z.string(), z.number()).optional(),
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
