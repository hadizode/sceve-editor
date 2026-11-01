import type { Asset, Project, Scene, SceneObject, Sprite } from './types';
import { getSprite, transformRef } from './types';

export interface Issue {
  level: 'error' | 'warning';
  message: string;
  sceneId?: string;
  /** top-level object to jump to */
  objectId?: string;
}

export function flattenObjects(scene: Scene): SceneObject[] {
  return scene.objects.flatMap((o) => [o, ...(o.view?.objects ?? [])]);
}

/** Every item id a player can actually get somewhere in the project. */
export function obtainableItems(scenes: Scene[]): Set<string> {
  const s = new Set<string>();
  for (const scene of scenes) {
    for (const o of flattenObjects(scene)) {
      if (o.grantsItem) s.add(o.grantsItem);
      if (o.pickupable) s.add(o.pickupItemId || o.id);
      o.transforms?.forEach((t) => t.grantsItem && s.add(t.grantsItem));
    }
  }
  return s;
}

/** Every sprite/image reference used by a scene (objects, views, layers, backgrounds, transforms). */
export function sceneRefs(scene: Scene): string[] {
  const refs: string[] = [scene.backgroundUrl, ...scene.backgroundLayers.map((l) => l.spriteRef)];
  for (const o of scene.objects) {
    refs.push(o.spriteRef);
    o.transforms?.forEach((t) => t.newSpriteId && refs.push(transformRef(t.newSpriteId)));
    if (o.view) {
      refs.push(o.view.backgroundUrl);
      o.view.objects.forEach((v) => {
        refs.push(v.spriteRef);
        v.transforms?.forEach((t) => t.newSpriteId && refs.push(transformRef(t.newSpriteId)));
      });
    }
  }
  return refs.filter(Boolean);
}

/** @deprecated kept as an alias — returns sprite refs now. */
export const sceneUrls = sceneRefs;

/** True when the sprite has no visual at all (no image and no color) — valid only before a transform gives it one. */
export function spriteHasVisual(spr: Sprite | undefined): boolean {
  return !!spr && (!!spr.assetId || !!spr.color);
}

export function validateProject(
  project: Project,
  scenes: Record<string, Scene>,
  assets: Record<string, Asset>,
  sprites: Record<string, Sprite> = {}
): Issue[] {
  const issues: Issue[] = [];
  const list = project.scenes.map((id) => scenes[id]).filter((s): s is Scene => !!s);
  if (list.length === 0) {
    issues.push({ level: 'error', message: 'Project must have at least one room' });
    return issues;
  }
  const obtainable = obtainableItems(list);

  for (const scene of list) {
    const at = (message: string, level: Issue['level'], objectId?: string): void => {
      issues.push({ level, message: `[${scene.title}] ${message}`, sceneId: scene.id, objectId });
    };
    const all = flattenObjects(scene);
    const topIdOf = (o: SceneObject) =>
      scene.objects.find((t) => t.id === o.id || t.view?.objects.some((v) => v.id === o.id))?.id;

    if (!all.some((o) => o.digit !== undefined)) at('Room has no object with a digit', 'error');

    const seen = new Set<string>();
    for (const o of all) {
      if (seen.has(o.id)) at(`Duplicate object id "${o.id}"`, 'error', topIdOf(o));
      seen.add(o.id);
    }

    for (const id of scene.clueChain) {
      if (!scene.objects.some((o) => o.id === id)) at(`Clue chain item "${id}" does not exist`, 'error');
    }
    if (scene.clueChain.length === 0) at('No clue chain defined', 'warning');
    else {
      const last = scene.objects.find((o) => o.id === scene.clueChain[scene.clueChain.length - 1]);
      if (last && last.digit === undefined) at('Clue chain should end at an object with a digit', 'warning', last.id);
    }

    for (const o of all) {
      const top = topIdOf(o);
      for (const item of o.requiresItem ?? []) {
        if (!obtainable.has(item)) at(`"${o.name}" requires "${item}" but nothing grants it`, 'error', top);
      }
      for (const item of o.view?.requiresItem ?? []) {
        if (!obtainable.has(item)) at(`View of "${o.name}" requires "${item}" but nothing grants it`, 'error', top);
      }
      o.transforms?.forEach((t, i) => {
        if (!t.requiresItem) at(`"${o.name}" transform ${i + 1} has no required item`, 'error', top);
        else if (!obtainable.has(t.requiresItem))
          at(`"${o.name}" transform ${i + 1} requires "${t.requiresItem}" but nothing grants it`, 'error', top);
      });
      // A sprite that requires an item / transforms should actually do something when interacted with.
      if ((o.requiresItem?.length || o.transforms?.length) && !o.grantsItem && o.digit === undefined && !o.view && !o.message && !o.pickupable)
        at(`"${o.name}" has requirements/rules but no visible result (message/item/digit/view)`, 'warning', top);
      // Sprites are allowed to have no image and no color — but only when a transform will give them one.
      const spr = getSprite(o.spriteRef, sprites);
      if (!o.spriteRef) at(`"${o.name}" has no sprite`, 'warning', top);
      else if (!spriteHasVisual(spr) && !o.transforms?.length)
        at(`"${o.name}" sprite is empty (no image/color) and nothing transforms it`, 'warning', top);
    }

    for (const o of scene.objects) {
      // overflow sprites intentionally draw outside the room — don't warn about them
      if (getSprite(o.spriteRef, sprites)?.overflow) continue;
      if (o.x + o.width < 0 || o.y + o.height < 0 || o.x > scene.width || o.y > scene.height)
        at(`"${o.name}" is outside the room`, 'warning', o.id);
    }

    for (const ref of sceneRefs(scene)) {
      if (ref.startsWith('sprite:')) {
        const s = sprites[ref.slice(7)];
        if (!s) at(`Missing sprite ${ref}`, 'error');
        else if (s.assetId.startsWith('asset:') && !assets[s.assetId.slice(6)]) {
          at(`Missing asset ${s.assetId}`, 'error');
          break;
        }
      } else if (ref.startsWith('asset:') && !assets[ref.slice(6)]) {
        at(`Missing asset ${ref}`, 'error');
        break;
      }
    }
  }
  return issues;
}
