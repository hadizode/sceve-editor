import type { Scene, SceneObject, SessionState } from '../types';

/**
 * Get the next clue in the chain based on what's been discovered.
 */
export function getNextClue(state: SessionState, scene: Scene): SceneObject | null {
  const discovered = state.discoveredObjects[scene.id] || [];
  for (const chainId of scene.clueChain) {
    if (!discovered.includes(chainId)) {
      return scene.objects.find(o => o.id === chainId) || null;
    }
  }
  return null;
}
