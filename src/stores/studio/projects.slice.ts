// ============ Studio slice: projects & navigation ============
import type { StateCreator } from 'zustand';
import type { Project } from '../../shared/types';
import type { StudioState } from './state';

export interface ProjectsSlice {
  createProject: (name: string, description: string) => void;
  deleteProject: (id: string) => void;
  selectProject: (id: string) => void;
  selectScene: (id: string) => void;
  setView: (view: 'projects' | 'editor') => void;
}

export const createProjectsSlice: StateCreator<StudioState, [], [], ProjectsSlice> =
  (set, get) => ({
    createProject: (name, description) => {
      const id = `proj-${Date.now()}`;
      const project: Project = {
        id,
        name,
        description,
        scenes: [],
        finalLockDigits: '',
        assets: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      set(state => ({ projects: [...state.projects, project] }));
    },

    deleteProject: (id) => {
      set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
      }));
    },

    selectProject: (id) => {
      const project = get().projects.find(p => p.id === id);
      if (project) {
        set({
          currentProjectId: id,
          currentSceneId: project.scenes.length > 0 ? project.scenes[0] : null,
          view: 'editor',
        });
      }
    },

    selectScene: (id) => set({ currentSceneId: id, selectedObjectIds: [] }),

    setView: (view) => set({ view }),
  });
