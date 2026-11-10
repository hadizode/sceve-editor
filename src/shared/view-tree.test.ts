import { describe, expect, it } from 'vitest';
import { allObjectsDeep, findObject, mapObject, objectPath, viewObjects, MAX_VIEW_DEPTH } from './view-tree';
import type { Scene, SceneObject, View } from './types';

const scene: Scene = {
  id: 'sc',
  projectId: 'p',
  title: 'Room',
  width: 400,
  height: 300,
  backgroundUrl: '',
  backgroundLayers: [],
  objects: [],
  clueChain: [],
  exitNumber: 1,
};

const obj = (id: string, view?: View): SceneObject => ({
  id,
  name: id,
  spriteRef: 'sprite:' + id,
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  rotation: 0,
  visible: true,
  locked: false,
  oneTimeUse: false,
  ...(view ? { view } : {}),
});

const view = (id: string, objects: SceneObject[]): View => ({
  id,
  title: 'V-' + id,
  backgroundUrl: '',
  width: 200,
  height: 200,
  objects,
});

// top -> view(v1) -> mid -> view(v2) -> leaf  (3 levels of nesting)
const leaf = obj('leaf', view('v3', []));
const mid = obj('mid', view('v2', [leaf]));
const top = obj('top', view('v1', [mid]));
scene.objects = [top];

describe('view-tree', () => {
  it('MAX_VIEW_DEPTH is 4', () => {
    expect(MAX_VIEW_DEPTH).toBe(4);
  });

  it('allObjectsDeep flattens 3 levels depth-first', () => {
    expect(allObjectsDeep(scene.objects).map((o) => o.id)).toEqual(['top', 'mid', 'leaf']);
  });

  it('findObject finds objects at any depth', () => {
    expect(findObject(scene.objects, 'leaf')?.id).toBe('leaf');
    expect(findObject(scene.objects, 'mid')?.id).toBe('mid');
    expect(findObject(scene.objects, 'top')?.id).toBe('top');
    expect(findObject(scene.objects, 'ghost')).toBeUndefined();
  });

  it('objectPath returns ids down to the object', () => {
    expect(objectPath(scene.objects, 'leaf')).toEqual(['top', 'mid', 'leaf']);
    expect(objectPath(scene.objects, 'mid')).toEqual(['top', 'mid']);
    expect(objectPath(scene.objects, 'top')).toEqual(['top']);
    expect(objectPath(scene.objects, 'nope')).toEqual([]);
  });

  it('mapObject updates deep immutably', () => {
    const next = mapObject(scene.objects, 'mid', (o) => ({ ...o, name: 'Mid2' }));
    expect(next).not.toBe(scene.objects);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('top');
    expect(next[0].view!.objects[0].name).toBe('Mid2');
    // original untouched
    expect(scene.objects[0].view!.objects[0].name).toBe('mid');
    expect(scene.objects[0].view!.objects[0]).toBe(mid);
  });

  it('mapObject updates the deepest object and keeps intermediate views', () => {
    const next = mapObject(scene.objects, 'leaf', (o) => ({ ...o, x: 9 }));
    expect(next).not.toBe(scene.objects);
    expect(next[0].view!.objects[0].view!.objects[0].x).toBe(9);
    expect(next[0].view!.id).toBe('v1');
    expect(next[0].view!.objects[0].view!.id).toBe('v2');
  });

  it('mapObject returns the SAME array reference when nothing changed', () => {
    expect(mapObject(scene.objects, 'ghost', (o) => ({ ...o, name: 'x' }))).toBe(scene.objects);
    expect(mapObject(scene.objects, 'mid', (o) => o)).toBe(scene.objects);
    expect(mapObject([], 'anything', (o) => o)).toBeInstanceOf(Array);
  });

  it('viewObjects', () => {
    expect(viewObjects(scene).map((o) => o.id)).toEqual(['top']);
    expect(viewObjects(scene, 'top').map((o) => o.id)).toEqual(['mid']);
    expect(viewObjects(scene, 'mid').map((o) => o.id)).toEqual(['leaf']);
    expect(viewObjects(scene, 'leaf')).toEqual([]);
    expect(viewObjects(scene, 'ghost')).toEqual([]);
    expect(viewObjects(scene, '')).toEqual(scene.objects);
  });
});
