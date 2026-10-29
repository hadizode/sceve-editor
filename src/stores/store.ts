import { create } from 'zustand';
import type { Project, Scene, SceneObject, Session, SessionState } from '../shared/types';
import { SEED_PROJECT, SEED_SCENE, SEED_SCENE_2, SEED_SESSION } from '../shared/seed-data';
import { discoverObject, isRoomComplete, applyItemToContainer } from '../shared/game-logic';

// ============ Studio Store ============
interface StudioState {
  projects: Project[];
  scenes: Record<string, Scene>;
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
}

export const useStudioStore = create<StudioState>((set, get) => ({
  projects: [SEED_PROJECT],
  scenes: { [SEED_SCENE.id]: SEED_SCENE, [SEED_SCENE_2.id]: SEED_SCENE_2 },
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

  createProject: (name, description) => {
    const id = `proj-${Date.now()}`;
    const project: Project = {
      id,
      name,
      description,
      scenes: [],
      finalLockDigits: '',
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
    if (project && project.scenes.length > 0) {
      set({ currentProjectId: id, currentSceneId: project.scenes[0], view: 'editor' });
    } else {
      set({ currentProjectId: id, view: 'editor' });
    }
  },

  selectScene: (id) => set({ currentSceneId: id, selectedObjectIds: [] }),

  setView: (view) => set({ view }),

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

  addObject: (obj) => {
    const { currentSceneId, scenes } = get();
    if (!currentSceneId) return;
    const scene = scenes[currentSceneId];
    const updatedScene = { ...scene, objects: [...scene.objects, obj] };
    set(state => ({ scenes: { ...state.scenes, [currentSceneId]: updatedScene } }));
  },

  updateObject: (id, updates) => {
    const { currentSceneId, scenes } = get();
    if (!currentSceneId) return;
    const scene = scenes[currentSceneId];
    const updatedScene = {
      ...scene,
      objects: scene.objects.map(o => o.id === id ? { ...o, ...updates } : o),
    };
    set(state => ({ scenes: { ...state.scenes, [currentSceneId]: updatedScene } }));
  },

  deleteObject: (id) => {
    const { currentSceneId, scenes } = get();
    if (!currentSceneId) return;
    const scene = scenes[currentSceneId];
    const updatedScene = {
      ...scene,
      objects: scene.objects.filter(o => o.id !== id),
      clueChain: scene.clueChain.filter(cid => cid !== id),
    };
    set(state => ({
      scenes: { ...state.scenes, [currentSceneId]: updatedScene },
      selectedObjectIds: state.selectedObjectIds.filter(sid => sid !== id),
    }));
  },

  selectObject: (id, multi = false) => {
    if (multi) {
      set(state => ({
        selectedObjectIds: state.selectedObjectIds.includes(id)
          ? state.selectedObjectIds.filter(sid => sid !== id)
          : [...state.selectedObjectIds, id],
      }));
    } else {
      set({ selectedObjectIds: [id] });
    }
  },

  clearSelection: () => set({ selectedObjectIds: [] }),

  setZoom: (z) => set({ zoom: Math.max(0.25, Math.min(3, z)) }),
  setPan: (x, y) => set({ panX: x, panY: y }),
  toggleGrid: () => set(state => ({ showGrid: !state.showGrid })),
  setGridSize: (s) => set({ gridSize: s }),
  toggleSnap: () => set(state => ({ snapToGrid: !state.snapToGrid })),

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
    const objMap = new Map(scene.objects.map(o => [o.id, o]));
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

  pushUndo: () => {
    const { currentSceneId, scenes, undoStack } = get();
    if (!currentSceneId) return;
    set({
      undoStack: [...undoStack.slice(-20), JSON.parse(JSON.stringify(scenes[currentSceneId]))],
      redoStack: [],
    });
  },

  undo: () => {
    const { undoStack, currentSceneId, scenes, redoStack } = get();
    if (undoStack.length === 0 || !currentSceneId) return;
    const prev = undoStack[undoStack.length - 1];
    const saved = JSON.parse(JSON.stringify(scenes[currentSceneId]));
    const newScenes = { ...scenes } as Record<string, Scene>;
    newScenes[currentSceneId] = prev;
    set({ undoStack: undoStack.slice(0, -1), redoStack: [...redoStack, saved], scenes: newScenes });
  },

  redo: () => {
    const { redoStack, currentSceneId, scenes, undoStack } = get();
    if (redoStack.length === 0 || !currentSceneId) return;
    const next = redoStack[redoStack.length - 1];
    const saved = JSON.parse(JSON.stringify(scenes[currentSceneId]));
    const newScenes = { ...scenes } as Record<string, Scene>;
    newScenes[currentSceneId] = next;
    set({ redoStack: redoStack.slice(0, -1), undoStack: [...undoStack, saved], scenes: newScenes });
  },
}));

// ============ Player Store ============
interface PlayerState {
  session: Session | null;
  scenes: Record<string, Scene>;
  currentSceneId: string;
  sessionState: SessionState;
  toast: string | null;
  selectedItem: string | null;
  gameStarted: boolean;
  gameComplete: boolean;
  lockInput: string;
  // Actions
  initSession: (session: Session, scenes: Record<string, Scene>) => void;
  clickObject: (objectId: string) => void;
  useItemOnObject: (itemId: string, objectId: string) => void;
  selectItem: (itemId: string | null) => void;
  setToast: (msg: string | null) => void;
  startGame: () => void;
  setPlayerReady: () => void;
  enterLockDigit: (d: string) => void;
  clearLockDigit: () => void;
  submitLock: () => void;
  switchScene: (sceneId: string) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  session: null,
  scenes: {},
  currentSceneId: '',
  sessionState: {
    currentSceneId: '',
    discoveredObjects: {},
    inventory: [],
    completedScenes: [],
  },
  toast: null,
  selectedItem: null,
  gameStarted: false,
  gameComplete: false,
  lockInput: '',

  initSession: (session, scenes) => {
    set({
      session,
      scenes,
      currentSceneId: session.state.currentSceneId,
      sessionState: session.state,
    });
  },

  clickObject: (objectId) => {
    const { sessionState, currentSceneId, scenes, session } = get();
    const scene = scenes[currentSceneId];
    if (!scene || !session) return;

    const result = discoverObject(sessionState, currentSceneId, objectId, scene.objects);
    
    if (result.alreadyDiscovered) {
      set({ toast: 'این مورد قبلاً کشف شده است' });
      setTimeout(() => set({ toast: null }), 2000);
      return;
    }

    if (result.message) {
      set({ toast: result.message });
      setTimeout(() => set({ toast: null }), 3000);
    }

    let newState = result.newState;

    // Check room completion
    const updatedScene = { ...scene };
    if (isRoomComplete(newState, updatedScene)) {
      if (!newState.completedScenes.includes(currentSceneId)) {
        newState = {
          ...newState,
          completedScenes: [...newState.completedScenes, currentSceneId],
        };
        set({ toast: `🎉 اتاق "${scene.title}" کامل شد! عدد: ${scene.exitNumber}` });
        setTimeout(() => set({ toast: null }), 4000);
      }
    }

    set(state => ({
      sessionState: newState,
      session: state.session ? { ...state.session, state: newState } : null,
    }));

    // Save to localStorage
    try {
      localStorage.setItem('escape-room-state', JSON.stringify(newState));
    } catch {}
  },

  useItemOnObject: (itemId, objectId) => {
    const { sessionState, currentSceneId, scenes, session } = get();
    const scene = scenes[currentSceneId];
    if (!scene || !session) return;

    const result = applyItemToContainer(sessionState, currentSceneId, objectId, itemId, scene.objects);
    
    if (result.success) {
      set(state => ({
        sessionState: result.newState,
        selectedItem: null,
        toast: result.message,
        session: state.session ? { ...state.session, state: result.newState } : null,
      }));
      setTimeout(() => set({ toast: null }), 3000);
    } else {
      set({ toast: result.message });
      setTimeout(() => set({ toast: null }), 2000);
    }
  },

  selectItem: (itemId) => set({ selectedItem: itemId }),

  setToast: (msg) => set({ toast: msg }),

  startGame: () => set({ gameStarted: true }),

  setPlayerReady: () => {
    const { session } = get();
    if (!session) return;
    const updatedPlayers = session.players.map(p =>
      p.telegramId === 'user-1' ? { ...p, ready: true } : p
    );
    set(state => ({
      session: state.session ? { ...state.session, players: updatedPlayers } : null,
    }));
  },

  enterLockDigit: (d) => {
    const { lockInput } = get();
    if (lockInput.length < 10) {
      set({ lockInput: lockInput + d });
    }
  },

  clearLockDigit: () => {
    const { lockInput } = get();
    set({ lockInput: lockInput.slice(0, -1) });
  },

  submitLock: () => {
    const { sessionState, scenes, session, lockInput } = get();
    const allScenes = Object.values(scenes);
    const expected = allScenes.map(s => s.exitNumber.toString()).join('');
    
    if (lockInput === expected) {
      set({ gameComplete: true, toast: '🎊 تبریک! شما برنده شدید!' });
    } else {
      set({ lockInput: '', toast: '❌ رمز اشتباه است. دوباره تلاش کنید.' });
      setTimeout(() => set({ toast: null }), 3000);
    }
  },

  switchScene: (sceneId) => {
    set({ currentSceneId: sceneId, selectedItem: null });
  },
}));
