import { describe, expect, it } from 'vitest';
import { cloneScene, normalizeScene, SpriteRegistry, type Scene } from './types';

const reg = new SpriteRegistry({}, '', {});

const view = (objects: any[]) => ({
  id: 'view',
  title: 'V',
  backgroundUrl: '',
  width: 200,
  height: 200,
  objects,
});

const leaf = {
  id: 'leaf', name: 'Leaf', spriteRef: 'sprite:leaf', x: 0, y: 0, width: 10, height: 10, visible: true, locked: false,
};
const mid = { ...leaf, id: 'mid', name: 'Mid', spriteRef: 'sprite:mid', view: view([leaf]) };
const top = { ...leaf, id: 'top', name: 'Top', spriteRef: 'sprite:top', view: view([mid]) };

const scene = (objects: any): Scene => ({
  id: 's1', projectId: 'p', title: 'Room', width: 400, height: 300,
  backgroundUrl: '', backgroundLayers: [], objects, clueChain: [], exitNumber: 1,
});

const collectIds = (objs: any[], acc: string[] = []): string[] => {
  for (const o of objs) {
    acc.push(o.id);
    if (o.view) collectIds(o.view.objects, acc);
  }
  return acc;
};

describe('nested views normalization', () => {
  it('keeps 3 levels of nesting through normalizeScene and is idempotent', () => {
    const once = normalizeScene(scene([top]), 'p', reg);
    const twice = normalizeScene(once, 'p', reg);
    expect(twice).toEqual(once);
    const o: any = once.objects[0];
    expect(o.view.objects[0].id).toBe('mid');
    expect(o.view.objects[0].view.objects[0].id).toBe('leaf');
    expect(o.view.objects[0].view.objects[0].view).toBeUndefined();
  });

  it('cuts a 7-level chain at the max view depth (4)', () => {
    let cur: any = leaf;
    for (let i = 6; i >= 0; i--) {
      cur = { ...leaf, id: 'o' + i, name: 'O' + i, spriteRef: 'sprite:o' + i, view: view([cur]) };
    }
    const once = normalizeScene(scene([cur]), 'p', reg);
    expect(collectIds(once.objects)).toEqual(['o0', 'o1', 'o2', 'o3', 'o4']);
    const o4 = ((((once.objects[0] as any).view.objects[0] as any).view.objects[0] as any).view.objects[0] as any).view.objects[0];
    expect(o4.view).toBeUndefined();
  });

  it('cloneScene gives fresh ids at all levels', () => {
    const once = normalizeScene(scene([top]), 'p', reg);
    const copy = cloneScene(once, 'p', 'Copy');
    const originals = collectIds([top]);
    const cloned = collectIds(copy.objects);
    expect(cloned.length).toBe(originals.length);
    for (const id of cloned) expect(originals).not.toContain(id);
    // shape preserved: 3 levels of nesting in the copy
    const c: any = copy.objects[0];
    expect(c.view.objects[0].view.objects[0].id).not.toBe('leaf');
    expect(c.view.objects[0].view.objects[0].view).toBeUndefined();
  });
});
