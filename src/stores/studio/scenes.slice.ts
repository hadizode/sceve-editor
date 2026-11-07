// ============ Studio slice: scenes (add/update/duplicate/reorder/export/import) ============
import type { StateCreator } from 'zustand';
import type { Scene, SceneObject } from '../../shared/types';
import type { StudioState } from './state';

export interface ScenesSlice {
  addScene: (title: string) => void;
  updateScene: (scene: Scene) => void;
  duplicateScene: (sceneId: string) => void;
  reorderObjects: (objectIds: string[]) => void;
  exportProject: () => string;
  importProject: (json: string) => void;
}

export const createScenesSlice: StateCreator<StudioState, [], [], ScenesSlice> =
  (set, get) => ({
    addScene: (title) => {
      const { currentProjectId, scenes } = get();
      if (!currentProjectId) return;
      const sceneId = `scene-${Date.now()}`;
      const scene: Scene = {
        id: sceneId,
        projectId: currentProjectId,
        title,
        width: 800,
        height: 600,
        backgroundUrl: '',
        objects: [],
        clueChain: [],
        exitNumber: 0,
      };
      set(state => ({
        scenes: { ...state.scenes, [sceneId]: scene },
        currentSceneId: sceneId,
        projects: state.projects.map(p =>
          p.id === currentProjectId
            ? { ...p, scenes: [...p.scenes, sceneId], updatedAt: new Date().toISOString() }
            : p
        ),
      }));
    },

    updateScene: (scene) => {
      set(state => ({
        scenes: { ...state.scenes, [scene.id]: scene },
        projects: state.projects.map(p =>
          p.id === scene.projectId ? { ...p, updatedAt: new Date().toISOString() } : p
        ),
      }));
    },

    duplicateScene: (sceneId) => {
      const { scenes, currentProjectId } = get();
      const source = scenes[sceneId];
      if (!source || !currentProjectId) return;
      const newId = `scene-${Date.now()}`;
      const newScene: Scene = {
        ...source,
        id: newId,
        title: `${source.title} (کپی)`,
        objects: source.objects.map(o => ({ ...o, id: `obj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` })),
      };
      set(state => ({
        scenes: { ...state.scenes, [newId]: newScene },
        currentSceneId: newId,
        projects: state.projects.map(p =>
          p.id === currentProjectId
            ? { ...p, scenes: [...p.scenes, newId], updatedAt: new Date().toISOString() }
            : p
        ),
      }));
    },

    reorderObjects: (objectIds) => {
      const { currentSceneId, scenes } = get();
      if (!currentSceneId) return;
      const scene = scenes[currentSceneId];
      const objMap = new Map(scene.objects.map((o: SceneObject) => [o.id, o]));
      const reordered = objectIds.map(id => objMap.get(id)).filter(Boolean) as SceneObject[];
      const remaining = scene.objects.filter(o => !objectIds.includes(o.id));
      set(state => ({
        scenes: { ...state.scenes, [currentSceneId]: { ...scene, objects: [...remaining, ...reordered] } },
      }));
    },

    exportProject: () => {
      const { currentProjectId, projects, scenes } = get();
      const project = projects.find(p => p.id === currentProjectId);
      if (!project) return '{}';
      const projectScenes = project.scenes.map(sid => scenes[sid]).filter(Boolean);
      return JSON.stringify({ project, scenes: projectScenes }, null, 2);
    },

    importProject: (json) => {
      try {
        const data = JSON.parse(json);
        if (data.project && data.scenes) {
          const existingScenes = get().scenes;
          const newScenes: Record<string, Scene> = { ...existingScenes };
          (data.scenes as Scene[]).forEach((s: Scene) => { newScenes[s.id] = s; });
          set(state => ({
            projects: [...state.projects.filter(p => p.id !== data.project.id), data.project],
            scenes: newScenes,
          }));
        }
      } catch (e) {
        console.error('Import failed:', e);
      }
    },
  });
