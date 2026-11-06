import type { Scene, Project } from './scene';
import type { SceneObject } from './object';

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
    const lastObj = scene.objects.find((o: SceneObject) => o.id === lastId);
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
