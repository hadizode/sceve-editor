// ============ Studio Store — state shape & actions ============
import type { Asset, Project, Scene, SceneObject } from '../../shared/types';

export interface StudioState {
  projects: Project[];
  scenes: Record<string, Scene>;
  assets: Record<string, Asset>; // assetId -> Asset
  currentProjectId: string | null;
  currentSceneId: string | null;
  selectedObjectIds: string[];
  view: 'projects' | 'editor';
  zoom: number;
  panX: number;
  panY: number;
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  undoStack: Scene[];
  redoStack: Scene[];
  // Actions
  createProject: (name: string, description: string) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string) => void;
  selectScene: (id: string) => void;
  setView: (view: 'projects' | 'editor') => void;
  addScene: (title: string) => void;
  updateScene: (scene: Scene) => void;
  addObject: (obj: SceneObject) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  deleteObject: (id: string) => void;
  selectObject: (id: string, multi?: boolean) => void;
  clearSelection: () => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  toggleGrid: () => void;
  setGridSize: (s: number) => void;
  toggleSnap: () => void;
  duplicateScene: (sceneId: string) => void;
  reorderObjects: (objectIds: string[]) => void;
  exportProject: () => string;
  importProject: (json: string) => void;
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  // Assets
  addAsset: (asset: Asset) => void;
  removeAsset: (id: string) => void;
  uploadAssets: (files: FileList) => Promise<void>;
}
