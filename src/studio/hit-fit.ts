import { traceHitPolygon } from '../shared/hit-from-image';
import { resolveSprite } from '../shared/types';
import { useStudioStore } from '../stores/store';
import { notify } from '../shared/notify';
import type { SceneObject } from '../shared/types';

export interface LoadAlphaResult {
  alpha: Uint8Array;
  w: number;
  h: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to load image'));
    img.src = src;
  });
}

/** Load an image, draw it downscaled on an offscreen canvas, return its alpha channel. */
export async function loadAlpha(src: string, maxSide = 256): Promise<LoadAlphaResult | null> {
  try {
    const img = await loadImage(src);
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height, 1));
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = data[i * 4 + 3];
    return { alpha, w, h };
  } catch {
    return null;
  }
}

/** Check whether at least 2% of pixels have alpha < 250 (i.e. the image has transparency). */
export async function imageHasTransparency(src: string): Promise<boolean> {
  const result = await loadAlpha(src, 256);
  if (!result) return false;
  let transparent = 0;
  for (let i = 0; i < result.alpha.length; i++) {
    if (result.alpha[i] < 250) transparent++;
  }
  return transparent / result.alpha.length >= 0.02;
}

/** Find an object by id in the current scene (handling the edited view). */
function findObject(st: ReturnType<typeof useStudioStore.getState>, objectId: string): SceneObject | undefined {
  const sceneId = st.currentSceneId;
  if (!sceneId) return undefined;
  const scene = st.scenes[sceneId];
  if (!scene) return undefined;
  const viewOf = st.editingViewOf;
  if (viewOf) {
    const viewObj = scene.objects.find((o: SceneObject) => o.id === viewOf);
    return viewObj?.view?.objects.find((o: SceneObject) => o.id === objectId);
  }
  return scene.objects.find((o: SceneObject) => o.id === objectId);
}

/**
 * Fit a hit polygon to the object's sprite image.
 * Resolves the sprite src through the store, traces the polygon, and writes `hit`
 * (undefined when null). Returns 'ok' | 'rect' | 'noimage'.
 */
export async function fitHitToImage(
  objectId: string,
  opts: { threshold?: number; maxPoints?: number; includeAllParts?: boolean } = {},
): Promise<'ok' | 'rect' | 'noimage'> {
  const st = useStudioStore.getState();
  const obj = findObject(st, objectId);
  if (!obj) return 'noimage';

  const src = resolveSprite(obj.spriteRef, st.sprites, st.assets);
  if (!src) return 'noimage';

  const result = await loadAlpha(src, 256);
  if (!result) return 'noimage';

  const pts = traceHitPolygon(result.alpha, result.w, result.h, {
    threshold: opts.threshold,
    maxPoints: opts.maxPoints,
    includeAllParts: opts.includeAllParts,
  });

  if (!pts) {
    st.updateObject(objectId, { hit: undefined });
    return 'rect';
  }

  st.updateObject(objectId, { hit: { kind: 'polygon', points: pts } });
  return 'ok';
}