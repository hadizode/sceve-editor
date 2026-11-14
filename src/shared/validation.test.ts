import { describe, expect, it } from 'vitest';
import { countAssetUsage, obtainableItems, sceneRefs, validateProject } from './validation';
import type { Asset, Project, Scene, Sprite, SceneObject, View } from './types';
import { assetRef, spriteRef } from './types';

const mkAsset = (id: string): Asset => ({ id, name: id, url: '', width: 10, height: 10, createdAt: 't' });
const mkSprite = (id: string, assetId: string): Sprite => ({ id, name: id, assetId, createdAt: 't' });

const mkScene = (id: string, refs: string[]): Scene => ({
  id,
  projectId: 'p',
  title: 'R',
  width: 400,
  height: 300,
  backgroundUrl: refs[0] ?? '',
  backgroundLayers: refs.slice(1).map((r, i) => ({ id: 'l' + i, name: 'L', spriteRef: r, opacity: 1, visible: true, offsetX: 0, offsetY: 0 })),
  objects: [],
  clueChain: [],
  exitNumber: 1,
});

describe('countAssetUsage', () => {
  it('counts references to sprites pointing at an asset across all scenes', () => {
    const assets = { 'asset-a': mkAsset('asset-a'), 'asset-b': mkAsset('asset-b') };
    const sprites = {
      'spr-1': mkSprite('spr-1', assetRef('asset-a')),
      'spr-2': mkSprite('spr-2', assetRef('asset-b')),
    };
    const scenes = {
      sc1: mkScene('sc1', [spriteRef('spr-1'), spriteRef('spr-1')]), // background + layer → 2 refs
      sc2: mkScene('sc2', [spriteRef('spr-2')]), // 1 ref
    };
    expect(countAssetUsage('asset-a', assets, sprites, scenes)).toBe(2);
    expect(countAssetUsage('asset-b', assets, sprites, scenes)).toBe(1);
    expect(countAssetUsage('asset-missing', assets, sprites, scenes)).toBe(0);
  });

  it('counts direct asset refs (backgrounds) too', () => {
    const assets = { 'asset-a': mkAsset('asset-a') };
    const scenes = { sc1: mkScene('sc1', [assetRef('asset-a')]) };
    expect(countAssetUsage('asset-a', assets, {}, scenes)).toBe(1);
  });

  it('returns 0 for empty scenes', () => {
    expect(countAssetUsage('asset-a', {}, {}, {})).toBe(0);
  });
});

describe('sceneRefs', () => {
  const mkObj = (id: string, spriteRef: string, view?: View): SceneObject => ({
    id,
    name: id,
    spriteRef,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    visible: true,
    locked: false,
    oneTimeUse: false,
    ...(view ? { view } : {}),
  });

  const mkView = (id: string, objects: SceneObject[]): View => ({
    id,
    title: 'V',
    backgroundUrl: '',
    width: 100,
    height: 100,
    objects,
  });

  it('collects refs from objects nested several levels deep', () => {
    const scene: Scene = {
      id: 'sc',
      projectId: 'p',
      title: 'R',
      width: 400,
      height: 300,
      backgroundUrl: '',
      backgroundLayers: [],
      objects: [
        mkObj('a', 'sprite:a', mkView('v1', [
          mkObj('b', 'sprite:b'),
          mkObj('c', 'sprite:c', mkView('v2', [mkObj('d', 'sprite:d')])),
        ])),
      ],
      clueChain: [],
      exitNumber: 1,
    };
    const refs = sceneRefs(scene);
    expect(refs).toEqual(expect.arrayContaining(['sprite:a', 'sprite:b', 'sprite:c', 'sprite:d']));
  });

  it('includes view backgrounds at any depth', () => {
    const scene: Scene = {
      id: 'sc',
      projectId: 'p',
      title: 'R',
      width: 400,
      height: 300,
      backgroundUrl: 'sprite:root-bg',
      backgroundLayers: [],
      objects: [
        mkObj('a', 'sprite:a', mkView('v1', [])),
      ],
      clueChain: [],
      exitNumber: 1,
    };
    (scene.objects[0].view as View).backgroundUrl = 'asset:bg-view';
    const refs = sceneRefs(scene);
    expect(refs).toContain('sprite:root-bg');
    expect(refs).toContain('asset:bg-view');
  });
});

describe('numpad validation', () => {
  const mkObj = (id: string, partial: Record<string, unknown> = {}): any => ({
    id,
    name: id,
    spriteRef: 'sprite:' + id,
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    rotation: 0,
    visible: true,
    locked: false,
    oneTimeUse: false,
    ...partial,
  });

  const mkScene = (objects: any[]): any => ({
    id: 's1',
    projectId: 'p',
    title: 'R',
    width: 400,
    height: 300,
    backgroundUrl: '',
    backgroundLayers: [],
    objects,
    clueChain: ['digit'],
    exitNumber: 1,
  });

  const project: Project = {
    id: 'p',
    name: 'P',
    description: '',
    scenes: ['s1'],
    finalLockDigits: '',
    assets: [],
    sprites: [],
    createdAt: 't',
    updatedAt: 't',
  };
  const sprites: Record<string, any> = {};
  for (const id of ['digit', 'pad', 'lock']) {
    sprites[id] = { id, name: id, assetId: '', createdAt: 't' };
  }

  it('counts every numpad number in range as obtainable', () => {
    const objects = [
      mkObj('digit', { digit: 1 }),
      mkObj('pad', { numpad: true, numpadMin: 3, numpadMax: 6 }),
    ];
    const obtainable = obtainableItems([mkScene(objects)]);
    for (const n of ['3', '4', '5', '6']) expect(obtainable.has(n)).toBe(true);
    expect(obtainable.has('2')).toBe(false);
    expect(obtainable.has('7')).toBe(false);
  });

  it('accepts a numeric requiresItem covered by a numpad sprite', () => {
    const objects = [
      mkObj('digit', { digit: 1 }),
      mkObj('pad', { numpad: true, numpadMin: 1, numpadMax: 9 }),
      mkObj('lock', { transforms: [{ requiresItem: '5', newSpriteId: 'sprite:x' }] }),
    ];
    const scenes = { s1: mkScene(objects) };
    const issues = validateProject(project, scenes, {}, sprites);
    expect(
      issues.some((i) => i.level === 'error' && i.message.includes('"5"')),
    ).toBe(false);
  });

  it('flags a numeric requiresItem outside every numpad range', () => {
    const objects = [
      mkObj('digit', { digit: 1 }),
      mkObj('pad', { numpad: true, numpadMin: 1, numpadMax: 4 }),
      mkObj('lock', { transforms: [{ requiresItem: '9', newSpriteId: 'sprite:x' }] }),
    ];
    const scenes = { s1: mkScene(objects) };
    const issues = validateProject(project, scenes, {}, sprites);
    expect(
      issues.some((i) => i.level === 'error' && i.message.includes('"9"')),
    ).toBe(true);
  });
});
