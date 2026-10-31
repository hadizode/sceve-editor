import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  cloneObject,
  cloneScene,
  computeFinalLock,
  createObject,
  createScene,
  normalizeBundle,
  type Asset,
  type BackgroundLayer,
  type ObjectType,
  type Project,
  type ProjectBundle,
  type Scene,
  type SceneObject,
  type View,
} from '../shared/types';
import { SEED_PROJECT, SEED_SCENES } from '../shared/seed-data';
import { idbStorage } from '../shared/idb';
import { sceneUrls } from '../shared/validation';
import { nowIso, uid, type LoadedImage } from '../shared/utils';
import {
  allRoomsComplete,
  applyItemToObject,
  discoverObject,
  isRoomComplete,
  pickupObject as pickupObj,
  validateFinalLock,
} from '../shared/game-logic';
import { createSessionState, type Player, type Session, type SessionState } from '../shared/types';

// ============ Context helpers (scene or the view being edited) ============
export interface EditContext {
  objects: SceneObject[];
  width: number;
  height: number;
  backgroundUrl: string;
  layers: BackgroundLayer[];
  view?: View;
}

export function getContext(scene: Scene | undefined, viewOf: string | null): EditContext | null {
  if (!scene) return null;
  const view = viewOf ? scene.objects.find((o) => o.id === viewOf)?.view : undefined;
  if (view) {
    return { objects: view.objects, width: view.width, height: view.height, backgroundUrl: view.backgroundUrl, layers: [], view };
  }
  return { objects: scene.objects, width: scene.width, height: scene.height, backgroundUrl: scene.backgroundUrl, layers: scene.backgroundLayers };
}

const setObjectsIn = (scene: Scene, viewOf: string | null, objects: SceneObject[]): Scene => {
  if (!viewOf) return { ...scene, objects };
  return {
    ...scene,
    objects: scene.objects.map((o) => (o.id === viewOf && o.view ? { ...o, view: { ...o.view, objects } } : o)),
  };
};

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom' | 'hdist' | 'vdist';
export type OrderMode = 'up' | 'down' | 'top' | 'bottom';

interface Snap {
  sceneId: string;
  scene: Scene;
}

interface StudioState {
  hydrated: boolean;
  projects: Project[];
  scenes: Record<string, Scene>;
  assets: Record<string, Asset>;
  screen: 'projects' | 'editor';
  currentProjectId: string | null;
  currentSceneId: string | null;
  editingViewOf: string | null;
  selectedObjectIds: string[];
  clipboard: SceneObject[];
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  showLabels: boolean;
  past: Snap[];
  future: Snap[];

  markHydrated: () => void;
  // projects
  createProject: (name: string, description: string) => string;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  updateProject: (patch: Partial<Pick<Project, 'name' | 'description'>>) => void;
  selectProject: (id: string) => void;
  closeProject: () => void;
  exportBundle: () => string;
  importBundle: (text: string) => { ok: true } | { ok: false; error: string };
  // scenes
  selectScene: (id: string) => void;
  addScene: (title?: string) => void;
  deleteScene: (id: string) => void;
  moveScene: (id: string, dir: -1 | 1) => void;
  duplicateScene: (id: string) => void;
  updateScene: (patch: Partial<Scene>, key?: string) => void;
  setBackground: (url: string, w: number, h: number) => void;
  // objects
  addObject: (type: ObjectType, patch?: Partial<SceneObject>) => string;
  addObjectFromAsset: (assetId: string, cx?: number, cy?: number) => void;
  updateObject: (id: string, patch: Partial<SceneObject>, key?: string) => void;
  updateObjects: (patches: Record<string, Partial<SceneObject>>, key?: string) => void;
  deleteObjects: (ids: string[]) => void;
  selectObject: (id: string, multi?: boolean) => void;
  selectObjects: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  copySelected: () => void;
  paste: () => void;
  duplicateSelected: () => void;
  nudge: (dx: number, dy: number) => void;
  orderObjects: (ids: string[], mode: OrderMode) => void;
  alignObjects: (mode: AlignMode) => void;
  // views
  enterView: (objectId: string) => void;
  exitView: () => void;
  addView: (objectId: string) => void;
  removeView: (objectId: string) => void;
  updateView: (objectId: string, patch: Partial<View>, key?: string) => void;
  // assets
  addAsset: (img: LoadedImage) => Asset;
  deleteAsset: (id: string) => boolean;
  // ui
  toggleGrid: () => void;
  toggleSnap: () => void;
  toggleLabels: () => void;
  setGridSize: (n: number) => void;
  // history
  undo: () => void;
  redo: () => void;
}

const recompute = (p: Project, scenes: Record<string, Scene>): Project => ({
  ...p,
  finalLockDigits: computeFinalLock(p.scenes, scenes),
});

let lastKey: string | undefined;
let lastTime = 0;

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => {
      /** Saves the current scene to the undo stack. Same `key` within 800ms = one undo step. */
      const pushHistory = (sceneId: string, key?: string) => {
        const t = Date.now();
        if (key && key === lastKey && t - lastTime < 800) {
          lastTime = t;
          return;
        }
        lastKey = key;
        lastTime = t;
        set((s) => ({
          past: [...s.past.slice(-99), { sceneId, scene: s.scenes[sceneId] }],
          future: [],
        }));
      };

      const commitScene = (sceneId: string, scene: Scene) =>
        set((s) => {
          const scenes = { ...s.scenes, [sceneId]: scene };
          return {
            scenes,
            projects: s.projects.map((p) =>
              p.id === scene.projectId ? { ...recompute(p, scenes), updatedAt: nowIso() } : p
            ),
          };
        });

      const edit = (key: string | undefined, fn: (scene: Scene) => Scene): boolean => {
        const id = get().currentSceneId;
        const scene = id ? get().scenes[id] : undefined;
        if (!id || !scene) return false;
        const next = fn(scene);
        if (next === scene) return false;
        pushHistory(id, key);
        commitScene(id, next);
        return true;
      };

      const editObjects = (key: string | undefined, fn: (o: SceneObject[]) => SceneObject[]) =>
        edit(key, (scene) => {
          const viewOf = get().editingViewOf;
          const cur = getContext(scene, viewOf)?.objects ?? scene.objects;
          const next = fn(cur);
          return next === cur ? scene : setObjectsIn(scene, viewOf, next);
        });

      const restore = (from: 'past' | 'future') => {
        const s = get();
        const stack = s[from];
        const snap = stack[stack.length - 1];
        if (!snap) return;
        const cur = s.scenes[snap.sceneId];
        lastKey = undefined;
        if (!cur) {
          set({ [from]: stack.slice(0, -1) } as Partial<StudioState>);
          return;
        }
        const other = from === 'past' ? 'future' : 'past';
        const scenes = { ...s.scenes, [snap.sceneId]: snap.scene };
        set({
          [from]: stack.slice(0, -1),
          [other]: [...s[other], { sceneId: snap.sceneId, scene: cur }],
          scenes,
          projects: s.projects.map((p) => (p.id === snap.scene.projectId ? recompute(p, scenes) : p)),
          currentSceneId: snap.sceneId,
          selectedObjectIds: [],
          editingViewOf:
            s.editingViewOf && s.currentSceneId === snap.sceneId && snap.scene.objects.some((o) => o.id === s.editingViewOf && o.view)
              ? s.editingViewOf
              : null,
        } as Partial<StudioState>);
      };

      return {
        hydrated: false,
        projects: [SEED_PROJECT],
        scenes: Object.fromEntries(SEED_SCENES.map((s) => [s.id, s])),
        assets: {},
        screen: 'projects',
        currentProjectId: null,
        currentSceneId: null,
        editingViewOf: null,
        selectedObjectIds: [],
        clipboard: [],
        showGrid: true,
        gridSize: 20,
        snapToGrid: false,
        showLabels: true,
        past: [],
        future: [],

        markHydrated: () => set({ hydrated: true }),

        // ---------- projects ----------
        createProject: (name, description) => {
          const id = uid('proj');
          const scene = createScene(id, 'Room 1');
          const project: Project = {
            id,
            name,
            description,
            scenes: [scene.id],
            finalLockDigits: '0',
            assets: [],
            createdAt: nowIso(),
            updatedAt: nowIso(),
          };
          set((s) => ({ projects: [...s.projects, project], scenes: { ...s.scenes, [scene.id]: scene } }));
          return id;
        },

        deleteProject: (id) =>
          set((s) => {
            const project = s.projects.find((p) => p.id === id);
            if (!project) return {};
            const scenes = { ...s.scenes };
            project.scenes.forEach((sid) => delete scenes[sid]);
            const projects = s.projects.filter((p) => p.id !== id);
            const stillUsed = new Set(projects.flatMap((p) => p.assets));
            const assets = { ...s.assets };
            project.assets.forEach((aid) => !stillUsed.has(aid) && delete assets[aid]);
            return { projects, scenes, assets, past: [], future: [] };
          }),

        duplicateProject: (id) =>
          set((s) => {
            const src = s.projects.find((p) => p.id === id);
            if (!src) return {};
            const pid = uid('proj');
            const copies = src.scenes.map((sid) => s.scenes[sid]).filter(Boolean).map((sc) => cloneScene(sc, pid, sc.title));
            const project: Project = {
              ...src,
              id: pid,
              name: `${src.name} (copy)`,
              scenes: copies.map((c) => c.id),
              createdAt: nowIso(),
              updatedAt: nowIso(),
            };
            return {
              projects: [...s.projects, project],
              scenes: { ...s.scenes, ...Object.fromEntries(copies.map((c) => [c.id, c])) },
            };
          }),

        updateProject: (patch) =>
          set((s) => ({
            projects: s.projects.map((p) => (p.id === s.currentProjectId ? { ...p, ...patch, updatedAt: nowIso() } : p)),
          })),

        selectProject: (id) => {
          const p = get().projects.find((x) => x.id === id);
          if (!p) return;
          set({
            screen: 'editor',
            currentProjectId: id,
            currentSceneId: p.scenes.find((sid) => get().scenes[sid]) ?? null,
            editingViewOf: null,
            selectedObjectIds: [],
            past: [],
            future: [],
          });
        },

        closeProject: () => set({ screen: 'projects', currentProjectId: null, currentSceneId: null, editingViewOf: null, selectedObjectIds: [] }),

        exportBundle: () => {
          const { currentProjectId, projects, scenes, assets } = get();
          const project = projects.find((p) => p.id === currentProjectId);
          if (!project) return '';
          const sc = project.scenes.map((id) => scenes[id]).filter(Boolean);
          const used = new Set<string>(project.assets);
          sc.flatMap(sceneUrls).forEach((u) => u.startsWith('asset:') && used.add(u.slice(6)));
          const bundle: ProjectBundle = {
            format: 'escape-studio',
            version: 2,
            project: recompute(project, scenes),
            scenes: sc,
            assets: [...used].map((id) => assets[id]).filter(Boolean),
          };
          return JSON.stringify(bundle, null, 2);
        },

        importBundle: (text) => {
          let b: ProjectBundle;
          try {
            b = normalizeBundle(text);
          } catch (e) {
            return { ok: false, error: (e as Error).message };
          }
          const st = get();
          let { project, scenes } = b;
          if (st.projects.some((p) => p.id === project.id) || scenes.some((sc) => st.scenes[sc.id])) {
            const pid = uid('proj');
            scenes = scenes.map((sc) => cloneScene(sc, pid, sc.title));
            project = { ...project, id: pid, name: `${project.name} (imported)`, scenes: scenes.map((sc) => sc.id) };
          }
          set((s) => ({
            projects: [...s.projects, project],
            scenes: { ...s.scenes, ...Object.fromEntries(scenes.map((sc) => [sc.id, sc])) },
            assets: { ...Object.fromEntries(b.assets.map((a) => [a.id, a])), ...s.assets },
          }));
          return { ok: true };
        },

        // ---------- scenes ----------
        selectScene: (id) => set({ currentSceneId: id, editingViewOf: null, selectedObjectIds: [] }),

        addScene: (title) => {
          const pid = get().currentProjectId;
          const project = get().projects.find((p) => p.id === pid);
          if (!pid || !project) return;
          const scene = createScene(pid, title || `Room ${project.scenes.length + 1}`);
          set((s) => {
            const scenes = { ...s.scenes, [scene.id]: scene };
            return {
              scenes,
              projects: s.projects.map((p) =>
                p.id === pid ? recompute({ ...p, scenes: [...p.scenes, scene.id], updatedAt: nowIso() }, scenes) : p
              ),
              currentSceneId: scene.id,
              editingViewOf: null,
              selectedObjectIds: [],
            };
          });
        },

        deleteScene: (id) =>
          set((s) => {
            const scene = s.scenes[id];
            if (!scene) return {};
            const project = s.projects.find((p) => p.id === scene.projectId);
            if (!project) return {};
            const idx = project.scenes.indexOf(id);
            const remaining = project.scenes.filter((x) => x !== id);
            const scenes = { ...s.scenes };
            delete scenes[id];
            return {
              scenes,
              projects: s.projects.map((p) => (p.id === project.id ? recompute({ ...p, scenes: remaining, updatedAt: nowIso() }, scenes) : p)),
              currentSceneId: s.currentSceneId === id ? remaining[Math.min(idx, remaining.length - 1)] ?? null : s.currentSceneId,
              editingViewOf: null,
              selectedObjectIds: [],
              past: s.past.filter((x) => x.sceneId !== id),
              future: s.future.filter((x) => x.sceneId !== id),
            };
          }),

        moveScene: (id, dir) =>
          set((s) => ({
            projects: s.projects.map((p) => {
              const i = p.scenes.indexOf(id);
              const j = i + dir;
              if (i < 0 || j < 0 || j >= p.scenes.length) return p;
              const list = [...p.scenes];
              [list[i], list[j]] = [list[j], list[i]];
              return recompute({ ...p, scenes: list, updatedAt: nowIso() }, s.scenes);
            }),
          })),

        duplicateScene: (id) =>
          set((s) => {
            const src = s.scenes[id];
            if (!src) return {};
            const copy = cloneScene(src, src.projectId, `${src.title} (copy)`);
            const scenes = { ...s.scenes, [copy.id]: copy };
            return {
              scenes,
              projects: s.projects.map((p) => {
                if (p.id !== src.projectId) return p;
                const list = [...p.scenes];
                list.splice(list.indexOf(id) + 1, 0, copy.id);
                return recompute({ ...p, scenes: list, updatedAt: nowIso() }, scenes);
              }),
              currentSceneId: copy.id,
              editingViewOf: null,
              selectedObjectIds: [],
            };
          }),

        updateScene: (patch, key) => {
          edit(key, (scene) => ({ ...scene, ...patch }));
        },

        setBackground: (url, w, h) => {
          const viewOf = get().editingViewOf;
          edit(undefined, (scene) =>
            viewOf
              ? {
                  ...scene,
                  objects: scene.objects.map((o) =>
                    o.id === viewOf && o.view ? { ...o, view: { ...o.view, backgroundUrl: url, width: w, height: h } } : o
                  ),
                }
              : { ...scene, backgroundUrl: url, width: w, height: h }
          );
        },

        // ---------- objects ----------
        addObject: (type, patch) => {
          const ctx = getContext(get().currentSceneId ? get().scenes[get().currentSceneId!] : undefined, get().editingViewOf);
          const count = ctx?.objects.length ?? 0;
          const obj = createObject(type, {
            x: 60 + ((count * 24) % 300),
            y: 60 + ((count * 24) % 300),
            ...patch,
          });
          if (editObjects(undefined, (o) => [...o, obj])) set({ selectedObjectIds: [obj.id] });
          return obj.id;
        },

        addObjectFromAsset: (assetId, cx, cy) => {
          const s = get();
          const a = s.assets[assetId];
          const ctx = getContext(s.currentSceneId ? s.scenes[s.currentSceneId] : undefined, s.editingViewOf);
          if (!a || !ctx) return;
          const k = Math.min(1, 160 / Math.max(a.width, a.height, 1));
          const w = Math.max(10, Math.round(a.width * k));
          const h = Math.max(10, Math.round(a.height * k));
          const x = Math.round((cx ?? ctx.width / 2) - w / 2);
          const y = Math.round((cy ?? ctx.height / 2) - h / 2);
          const obj = createObject('decoration', { name: a.name, imageUrl: `asset:${a.id}`, x, y, width: w, height: h });
          if (editObjects(undefined, (o) => [...o, obj])) set({ selectedObjectIds: [obj.id] });
        },

        updateObjects: (patches, key) => {
          editObjects(key, (objs) =>
            objs.some((o) => patches[o.id]) ? objs.map((o) => (patches[o.id] ? { ...o, ...patches[o.id] } : o)) : objs
          );
        },
        updateObject: (id, patch, key) => get().updateObjects({ [id]: patch }, key),

        deleteObjects: (ids) => {
          if (!ids.length) return;
          const set_ = new Set(ids);
          const viewOf = get().editingViewOf;
          const ok = edit(undefined, (scene) => {
            const cur = getContext(scene, viewOf)?.objects ?? scene.objects;
            const next = cur.filter((o) => !set_.has(o.id));
            if (next.length === cur.length) return scene;
            const updated = setObjectsIn(scene, viewOf, next);
            return viewOf ? updated : { ...updated, clueChain: updated.clueChain.filter((c) => !set_.has(c)) };
          });
          if (ok) set((s) => ({ selectedObjectIds: s.selectedObjectIds.filter((i) => !set_.has(i)) }));
        },

        selectObject: (id, multi = false) =>
          set((s) => ({
            selectedObjectIds: multi
              ? s.selectedObjectIds.includes(id)
                ? s.selectedObjectIds.filter((x) => x !== id)
                : [...s.selectedObjectIds, id]
              : [id],
          })),
        selectObjects: (ids) => set({ selectedObjectIds: ids }),
        selectAll: () => {
          const s = get();
          const ctx = getContext(s.currentSceneId ? s.scenes[s.currentSceneId] : undefined, s.editingViewOf);
          set({ selectedObjectIds: ctx?.objects.map((o) => o.id) ?? [] });
        },
        clearSelection: () => set({ selectedObjectIds: [] }),

        copySelected: () => {
          const s = get();
          const ctx = getContext(s.currentSceneId ? s.scenes[s.currentSceneId] : undefined, s.editingViewOf);
          const sel = ctx?.objects.filter((o) => s.selectedObjectIds.includes(o.id)) ?? [];
          if (sel.length) set({ clipboard: sel });
        },
        paste: () => {
          const clip = get().clipboard;
          if (!clip.length) return;
          const pasted = clip.map((o) => ({ ...cloneObject(o), x: o.x + 20, y: o.y + 20 }));
          if (editObjects(undefined, (objs) => [...objs, ...pasted])) {
            set({ selectedObjectIds: pasted.map((o) => o.id), clipboard: pasted });
          }
        },
        duplicateSelected: () => {
          get().copySelected();
          get().paste();
        },

        nudge: (dx, dy) => {
          const ids = new Set(get().selectedObjectIds);
          editObjects('nudge', (objs) =>
            objs.map((o) => (ids.has(o.id) && !o.locked ? { ...o, x: o.x + dx, y: o.y + dy } : o))
          );
        },

        orderObjects: (ids, mode) => {
          const sel = new Set(ids);
          editObjects(undefined, (objs) => {
            let arr = [...objs];
            if (mode === 'top') arr = [...arr.filter((o) => !sel.has(o.id)), ...arr.filter((o) => sel.has(o.id))];
            else if (mode === 'bottom') arr = [...arr.filter((o) => sel.has(o.id)), ...arr.filter((o) => !sel.has(o.id))];
            else if (mode === 'up') {
              for (let i = arr.length - 2; i >= 0; i--)
                if (sel.has(arr[i].id) && !sel.has(arr[i + 1].id)) [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
            } else {
              for (let i = 1; i < arr.length; i++)
                if (sel.has(arr[i].id) && !sel.has(arr[i - 1].id)) [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]];
            }
            return arr.every((o, i) => o === objs[i]) ? objs : arr;
          });
        },

        alignObjects: (mode) => {
          const ids = new Set(get().selectedObjectIds);
          editObjects(undefined, (objs) => {
            const sel = objs.filter((o) => ids.has(o.id) && !o.locked);
            if (sel.length < 2) return objs;
            const minX = Math.min(...sel.map((o) => o.x));
            const maxX = Math.max(...sel.map((o) => o.x + o.width));
            const minY = Math.min(...sel.map((o) => o.y));
            const maxY = Math.max(...sel.map((o) => o.y + o.height));
            const patch = new Map<string, Partial<SceneObject>>();
            const r = Math.round;
            if (mode === 'left') sel.forEach((o) => patch.set(o.id, { x: r(minX) }));
            if (mode === 'right') sel.forEach((o) => patch.set(o.id, { x: r(maxX - o.width) }));
            if (mode === 'hcenter') sel.forEach((o) => patch.set(o.id, { x: r((minX + maxX) / 2 - o.width / 2) }));
            if (mode === 'top') sel.forEach((o) => patch.set(o.id, { y: r(minY) }));
            if (mode === 'bottom') sel.forEach((o) => patch.set(o.id, { y: r(maxY - o.height) }));
            if (mode === 'vmiddle') sel.forEach((o) => patch.set(o.id, { y: r((minY + maxY) / 2 - o.height / 2) }));
            if (mode === 'hdist' || mode === 'vdist') {
              if (sel.length < 3) return objs;
              const h = mode === 'hdist';
              const sorted = [...sel].sort((a, b) => (h ? a.x - b.x : a.y - b.y));
              const total = sorted.reduce((acc, o) => acc + (h ? o.width : o.height), 0);
              const gap = ((h ? maxX - minX : maxY - minY) - total) / (sorted.length - 1);
              let pos = h ? minX : minY;
              sorted.forEach((o) => {
                patch.set(o.id, h ? { x: r(pos) } : { y: r(pos) });
                pos += (h ? o.width : o.height) + gap;
              });
            }
            return objs.map((o) => (patch.has(o.id) ? { ...o, ...patch.get(o.id) } : o));
          });
        },

        // ---------- views ----------
        enterView: (objectId) => {
          const s = get();
          const scene = s.currentSceneId ? s.scenes[s.currentSceneId] : undefined;
          if (scene?.objects.some((o) => o.id === objectId && o.view)) set({ editingViewOf: objectId, selectedObjectIds: [] });
        },
        exitView: () => set((s) => ({ editingViewOf: null, selectedObjectIds: s.editingViewOf ? [s.editingViewOf] : [] })),
        addView: (objectId) => {
          edit(undefined, (scene) => ({
            ...scene,
            objects: scene.objects.map((o) =>
              o.id === objectId && !o.view
                ? {
                    ...o,
                    view: { id: uid('view'), title: `${o.name} – Close-up`, backgroundUrl: o.imageUrl, width: 400, height: 400, objects: [] },
                  }
                : o
            ),
          }));
        },
        removeView: (objectId) => {
          if (get().editingViewOf === objectId) set({ editingViewOf: null });
          edit(undefined, (scene) => ({
            ...scene,
            objects: scene.objects.map((o) => (o.id === objectId ? { ...o, view: undefined } : o)),
          }));
        },
        updateView: (objectId, patch, key) => {
          edit(key, (scene) => ({
            ...scene,
            objects: scene.objects.map((o) => (o.id === objectId && o.view ? { ...o, view: { ...o.view, ...patch } } : o)),
          }));
        },

        // ---------- assets ----------
        addAsset: (img) => {
          const asset: Asset = { id: uid('asset'), name: img.name, url: img.url, width: img.width, height: img.height, createdAt: nowIso() };
          set((s) => ({
            assets: { ...s.assets, [asset.id]: asset },
            projects: s.projects.map((p) => (p.id === s.currentProjectId ? { ...p, assets: [...p.assets, asset.id] } : p)),
          }));
          return asset;
        },
        deleteAsset: (id) => {
          const s = get();
          const project = s.projects.find((p) => p.id === s.currentProjectId);
          if (!project) return false;
          const used = project.scenes.some((sid) => s.scenes[sid] && sceneUrls(s.scenes[sid]).includes(`asset:${id}`));
          if (used) return false;
          set((st) => {
            const assets = { ...st.assets };
            delete assets[id];
            return { assets, projects: st.projects.map((p) => ({ ...p, assets: p.assets.filter((a) => a !== id) })) };
          });
          return true;
        },

        // ---------- ui ----------
        toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
        toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
        toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
        setGridSize: (n) => set({ gridSize: Math.max(5, Math.round(n)) }),

        undo: () => restore('past'),
        redo: () => restore('future'),
      };
    },
    {
      name: 'escape-studio-v2',
      version: 1,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s) => ({ projects: s.projects, scenes: s.scenes, assets: s.assets }),
      onRehydrateStorage: () => (state) => state?.markHydrated(),
    }
  )
);

// ============ Player store (game session — plays the CURRENT studio project) ============
const PLAYER_KEY = 'escape-player-v2';

interface PlayerState {
  session: Session | null;
  scenes: Record<string, Scene>;
  assets: Record<string, Asset>;
  selectedItem: string | null;
  lockInput: string;
  toast: string | null;

  loadFromStudio: () => void;
  startNewGame: (players?: Player[]) => void;
  resetGame: () => void;
  setPlayerReady: (telegramId?: string) => void;
  selectItem: (id: string | null) => void;
  setToast: (t: string | null) => void;
  switchScene: (id: string) => void;
  clickObject: (objectId: string, viewId?: string) => void;
  pickup: (objectId: string, viewId?: string) => void;
  useItemOnObject: (itemId: string, objectId: string, viewId?: string) => void;
  enterLockDigit: (d: string) => void;
  clearLockDigit: () => void;
  submitLock: () => void;
}

let toastTimer: number | undefined;

/** All object ids in a scene/view *including* nested close-up view objects. */
export function scopeIds(scene: Scene, viewId?: string): Set<string> {
  if (viewId) {
    const v = scene.objects.find((o) => o.id === viewId)?.view;
    return new Set(v ? v.objects.map((o) => o.id) : []);
  }
  const s = new Set<string>();
  for (const o of scene.objects) {
    s.add(o.id);
    o.view?.objects.forEach((v) => s.add(v.id));
  }
  return s;
}

/** Strip discovered ids that no longer exist in the (edited) project. */
function pruneDiscovered(scenes: Record<string, Scene>, discovered: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [sid, ids] of Object.entries(discovered)) {
    const scene = scenes[sid];
    if (!scene) continue;
    const valid = scopeIds(scene);
    const kept = ids.filter((id) => valid.has(id));
    if (kept.length) out[sid] = kept;
  }
  return out;
}

const persistPlayer = (s: PlayerState) => {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ session: s.session }));
  } catch {}
};

export const usePlayerStore = create<PlayerState>()((set, get) => {
  const say = (message: string | null | undefined, ms = 4000) => {
    window.clearTimeout(toastTimer);
    set({ toast: message ?? null });
    if (message) toastTimer = window.setTimeout(() => set({ toast: null }), ms);
  };

  /** Persist + re-evaluate room completion after every state change. */
  const commit = (state: SessionState) => {
    const g = get();
    const session = g.session;
    if (!session) return;
    const list = Object.values(g.scenes).filter((sc) => sc.projectId === session.projectId);
    const completed = new Set(session.state.completedScenes);
    for (const sc of list) {
      if (sc.objects.some((o) => o.digit !== undefined) && isRoomComplete(state, sc)) completed.add(sc.id);
    }
    const next: SessionState = { ...state, completedScenes: [...completed] };
    set({ session: { ...session, state: next } });
    persistPlayer(get());
  };

  const sceneOfCurrent = () => {
    const g = get();
    const sid = g.session?.state.currentSceneId;
    return sid ? g.scenes[sid] : undefined;
  };

  return {
    session: null,
    scenes: {},
    assets: {},
    selectedItem: null,
    lockInput: '',
    toast: null,

    /** Load the current project from the studio store (live, unsaved edits included). */
    loadFromStudio: () => {
      const st = useStudioStore.getState();
      const project = st.projects.find((p) => p.id === st.currentProjectId);
      if (!project) return;
      const scenes = Object.fromEntries(project.scenes.map((id) => [id, st.scenes[id]]).filter(([, s]) => !!s));
      let saved: { session: Session | null } | null = null;
      try {
        saved = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null');
      } catch {}
      const resume = !!saved?.session && saved.session.projectId === project.id && saved.session.started;
      const first = project.scenes[0];
      const base: SessionState = resume && saved?.session
        ? { ...saved.session.state, currentSceneId: scenes[saved.session.state.currentSceneId] ? saved.session.state.currentSceneId : first }
        : createSessionState(first);
      const session: Session = {
        id: uid('sess'),
        projectId: project.id,
        token: `local-${project.id}`,
        players: [
          { telegramId: 'you', name: 'شما', online: true, ready: true },
          { telegramId: 'bot-demo', name: 'هم‌تیمی (دمو)', online: false, ready: !resume ? false : true },
        ],
        started: resume ? saved!.session!.started : true,
        complete: resume ? saved!.session!.complete : false,
        state: { ...base, discoveredObjects: pruneDiscovered(scenes, base.discoveredObjects) },
      };
      set({ session, scenes, assets: st.assets, selectedItem: null, lockInput: '', toast: null });
    },

    startNewGame: (players) => {
      const g = get();
      const first = Object.keys(g.scenes)[0];
      if (!g.session || !first) return;
      set({
        session: {
          ...g.session,
          started: true,
          complete: false,
          players: players ?? g.session.players.map((p) => ({ ...p, ready: true })),
          state: createSessionState(first),
        },
        selectedItem: null,
        lockInput: '',
      });
      persistPlayer(get());
      say('بازی شروع شد! موفق باشید 🎮');
    },

    resetGame: () => {
      const g = get();
      if (!g.session) return;
      const first = Object.keys(g.scenes)[0];
      set({
        session: { ...g.session, started: false, complete: false, state: createSessionState(first) },
        selectedItem: null,
        lockInput: '',
      });
      persistPlayer(get());
    },

    setPlayerReady: (telegramId = 'you') => {
      const g = get();
      if (!g.session) return;
      const players = g.session.players.map((p) => (p.telegramId === telegramId ? { ...p, ready: true } : p));
      set({ session: { ...g.session, players } });
      if (players.every((p) => p.ready)) {
        get().startNewGame(players);
      } else {
        say('آماده شدید! منتظر هم‌تیمی‌ها بمانید…');
      }
    },

    selectItem: (id) => set({ selectedItem: id }),
    setToast: say,

    switchScene: (id) => {
      const g = get();
      if (!g.session || !g.scenes[id]) return;
      commit({ ...g.session.state, currentSceneId: id });
    },

    clickObject: (objectId, viewId) => {
      const g = get();
      const scene = sceneOfCurrent();
      if (!g.session || !scene) return;
      const objs = viewId ? scene.objects.find((o) => o.id === viewId)?.view?.objects ?? [] : scene.objects;
      const res = discoverObject(g.session.state, viewId || scene.id, objectId, objs);
      if (res.grantsItem) say(`🎒 آیتم به دست آمد: ${itemName(objs, res.grantsItem)}`, 5000);
      else if (res.message) say(res.message);
      if (res.newState !== g.session.state) commit(res.newState);
    },

    pickup: (objectId, viewId) => {
      const g = get();
      const scene = sceneOfCurrent();
      if (!g.session || !scene) return;
      const objs = viewId ? scene.objects.find((o) => o.id === viewId)?.view?.objects ?? [] : scene.objects;
      const res = pickupObj(g.session.state, viewId || scene.id, objectId, objs);
      if (res.message) say(res.message);
      if (res.success) commit(res.newState);
    },

    useItemOnObject: (itemId, objectId, viewId) => {
      const g = get();
      const scene = sceneOfCurrent();
      if (!g.session || !scene) return;
      const objs = viewId ? scene.objects.find((o) => o.id === viewId)?.view?.objects ?? [] : scene.objects;
      const res = applyItemToObject(g.session.state, viewId || scene.id, objectId, itemId, objs);
      if (res.message) say(res.message, res.success ? 5000 : 3000);
      if (res.success) {
        commit(res.newState);
        set({ selectedItem: null });
      }
    },

    enterLockDigit: (d) => {
      const g = get();
      const maxLen = Math.max(1, Object.keys(g.scenes).length);
      if (g.lockInput.length >= maxLen) return;
      set({ lockInput: g.lockInput + d });
    },
    clearLockDigit: () => set((s) => ({ lockInput: s.lockInput.slice(0, -1) })),

    submitLock: () => {
      const g = get();
      if (!g.session) return;
      const list = Object.values(g.scenes).filter((sc) => sc.projectId === g.session!.projectId);
      if (!allRoomsComplete(g.session.state, list)) {
        say('هنوز همه اتاق‌ها کامل نشده‌اند!');
        return;
      }
      const res = validateFinalLock(g.session.state, list, g.lockInput);
      say(res.message, 6000);
      if (res.valid) {
        set({ session: { ...g.session, complete: true } });
        persistPlayer(get());
      }
    },
  };
});

/** Human-readable item name: prefer the object that grants it, else fallback table. */
const ITEM_NAMES: Record<string, string> = {
  'key-gold': '🔑 کلید طلایی',
  'key-small': '🔑 کلید کوچک',
  'digit-7': '🔢 عدد ۷',
  'digit-3': '🔢 عدد ۳',
  'wire-cutter': '🔧 سیم‌چین',
};
export function itemName(objects: SceneObject[], id: string): string {
  const granter = objects.find((o) => o.grantsItem === id || o.pickupItemId === id);
  if (granter) return `🎒 ${granter.name}`;
  return ITEM_NAMES[id] || `🎒 ${id}`;
}

// ============ Hooks ============
export function useScene(): Scene | undefined {
  return useStudioStore((s) => (s.currentSceneId ? s.scenes[s.currentSceneId] : undefined));
}

export function useCtx(): EditContext | null {
  const scene = useScene();
  const viewOf = useStudioStore((s) => s.editingViewOf);
  return useMemo(() => getContext(scene, viewOf), [scene, viewOf]);
}

export function useCurrentProject(): Project | undefined {
  return useStudioStore((s) => s.projects.find((p) => p.id === s.currentProjectId));
}

export function useProjectAssets(): Asset[] {
  const assets = useStudioStore((s) => s.assets);
  const ids = useStudioStore((s) => s.projects.find((p) => p.id === s.currentProjectId)?.assets);
  return useMemo(() => (ids ?? []).map((id) => assets[id]).filter(Boolean), [assets, ids]);
}
