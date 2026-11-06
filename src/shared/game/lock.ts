import type { Scene, SceneObject, SessionState } from '../types';

/**
 * Check if a room/scene is complete (all objects with digits discovered).
 */
export function isRoomComplete(state: SessionState, scene: Scene): boolean {
  const discovered = state.discoveredObjects[scene.id] || [];
  const digitObjects = scene.objects.filter(o => o.digit !== undefined);
  return digitObjects.every(obj => discovered.includes(obj.id));
}

/**
 * Get discovered digits for a room.
 */
export function getRoomDigits(state: SessionState, scene: Scene): { digit: number; objectId: string }[] {
  const discovered = state.discoveredObjects[scene.id] || [];
  return scene.objects
    .filter((o: SceneObject) => o.digit !== undefined && discovered.includes(o.id))
    .map(o => ({ digit: o.digit!, objectId: o.id }));
}

/**
 * Validate the final lock entry.
 */
export function validateFinalLock(
  state: SessionState,
  scenes: Scene[],
  enteredDigits: string
): { valid: boolean; message: string } {
  const expectedDigits = scenes
    .map(s => s.exitNumber.toString())
    .join('');

  if (enteredDigits === expectedDigits) {
    return { valid: true, message: 'تبریک! شما موفق شدید!' };
  }
  return { valid: false, message: 'رمز اشتباه است. دوباره تلاش کنید.' };
}

/**
 * Check if all rooms are complete.
 * NOTE: this is the single canonical definition (the old game-logic.ts file
 * contained a duplicated copy inside a comment — removed during the split).
 */
export function allRoomsComplete(state: SessionState, scenes: Scene[]): boolean {
  return scenes.every(scene => isRoomComplete(state, scene));
}
