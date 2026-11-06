// ============ Studio Store — merges all slices (zustand slice pattern) ============
import { create } from 'zustand';
import { SEED_PROJECT, SEED_SCENE, SEED_SCENE_2, SEED_ASSETS } from '../../shared/seed-data';
import type { StudioState } from './state';
import { createProjectsSlice } from './projects.slice';
import { createScenesSlice } from './scenes.slice';
import { createObjectsSlice } from './objects.slice';
import { createViewSlice } from './view.slice';
import { createHistorySlice } from './history.slice';
import { createAssetsSlice } from './assets.slice';

const initialState: Pick<
  StudioState,
  | 'projects' | 'scenes' | 'assets'
  | 'currentProjectId' | 'currentSceneId' | 'selectedObjectIds' | 'view'
  | 'zoom' | 'panX' | 'panY' | 'showGrid' | 'gridSize' | 'snapToGrid'
  | 'undoStack' | 'redoStack'
> = {
  projects: [SEED_PROJECT],
  scenes: { [SEED_SCENE.id]: SEED_SCENE, [SEED_SCENE_2.id]: SEED_SCENE_2 },
  assets: Object.fromEntries(SEED_ASSETS.map(a => [a.id, a])),
  currentProjectId: null,
  currentSceneId: null,
  selectedObjectIds: [],
  view: 'projects',
  zoom: 1,
  panX: 0,
  panY: 0,
  showGrid: true,
  gridSize: 20,
  snapToGrid: false,
  undoStack: [],
  redoStack: [],
};

export const useStudioStore = create<StudioState>()((...a) => ({
  ...initialState,
  ...createProjectsSlice(...a),
  ...createScenesSlice(...a),
  ...createObjectsSlice(...a),
  ...createViewSlice(...a),
  ...createHistorySlice(...a),
  ...createAssetsSlice(...a),
}));

// Re-export the state type for consumers that import it from the store barrel.
export type { StudioState };
