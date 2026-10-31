import type { Asset, Project, Scene, SceneObject } from './types';

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

export function sceneUrls(scene: Scene): string[] {
  const urls: string[] = [scene.backgroundUrl, ...scene.backgroundLayers.map((l) => l.imageUrl)];
  for (const o of scene.objects) {
    urls.push(o.imageUrl);
    o.transforms?.forEach((t) => t.newImageUrl && urls.push(t.newImageUrl));
    if (o.view) {
      urls.push(o.view.backgroundUrl);
      o.view.objects.forEach((v) => {
        urls.push(v.imageUrl);
        v.transforms?.forEach((t) => t.newImageUrl && urls.push(t.newImageUrl));
      });
    }
  }
  return urls.filter(Boolean);
}

export function validateProject(
  project: Project,
  scenes: Record<string, Scene>,
  assets: Record<string, Asset>
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
      if (o.type === 'container' && !o.requiresItem?.length && !o.transforms?.length)
        at(`Container "${o.name}" has no requirement`, 'warning', top);
      if (!o.imageUrl) at(`"${o.name}" has no image`, 'warning', top);
    }

    for (const o of scene.objects) {
      if (o.x + o.width < 0 || o.y + o.height < 0 || o.x > scene.width || o.y > scene.height)
        at(`"${o.name}" is outside the room`, 'warning', o.id);
    }

    for (const url of sceneUrls(scene)) {
      if (url.startsWith('asset:') && !assets[url.slice(6)]) {
        at(`Missing asset ${url}`, 'error');
        break;
      }
    }
  }
  return issues;
}
