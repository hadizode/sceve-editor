import React, { useEffect, useState } from 'react';
import { Image as KImage, Rect } from 'react-konva';
import { useStudioStore } from '../stores/store';
import { resolveSprite } from '../shared/types';

/**
 * Resolve ANY reference (`sprite:<id>`, `asset:<id>` or a direct URL) to a concrete image URL.
 */
export function useResolved(url: string): string {
  const assets = useStudioStore((s) => s.assets);
  const sprites = useStudioStore((s) => s.sprites);
  const resolved = resolveSprite(url || '', sprites, assets);
  // A non-empty ref that resolves to nothing means a dangling sprite/asset reference — say so instead of failing silently.
  useEffect(() => {
    if (url && !resolved && (url.startsWith('sprite:') || url.startsWith('asset:'))) {
      const sp = url.startsWith('sprite:') ? sprites[url.slice(7)] : undefined;
      console.error('[studio] cannot resolve image ref', url, url.startsWith('sprite:') ? (sp ? `sprite exists, assetId="${sp.assetId}" is ${assets[sp.assetId.replace(/^asset:/, '')] ? 'present' : 'MISSING from assets'}` : 'sprite MISSING from sprites') : 'asset MISSING');
    }
  }, [url, resolved, sprites, assets]);
  return resolved;
}

/**
 * Loads an image with a plain <img> (no extra library) and reports load errors in the console.
 * Returns the loaded element, or undefined while loading / on failure.
 */
export function useLoadedImage(url: string): HTMLImageElement | undefined {
  const [state, setState] = useState<{ url: string; img?: HTMLImageElement }>({ url: '' });
  useEffect(() => {
    if (!url) {
      setState({ url: '' });
      return;
    }
    let alive = true;
    const img = new window.Image();
    img.onload = () => {
      if (alive) setState({ url, img });
    };
    img.onerror = () => {
      console.error('[studio] image failed to load:', url.slice(0, 60) + (url.length > 60 ? '…' : ''), `(length ${url.length})`);
      if (alive) setState({ url });
    };
    img.src = url;
    return () => {
      alive = false;
    };
  }, [url]);
  return state.url === url ? state.img : undefined;
}

export function useSrc(ref: string) {
  return useLoadedImage(useResolved(ref));
}

/** Resolve a sprite/image reference to the Sprite record (undefined for direct URLs / missing). */
export function useSpriteOf(ref: string) {
  const sprites = useStudioStore((s) => s.sprites);
  return ref && ref.startsWith('sprite:') ? sprites[ref.slice(7)] : undefined;
}

/**
 * Renders a sprite/image reference as a full-bleed background.
 * Supports solid-color-only sprites (no image needed).
 */
export function Bg({
  url,
  width,
  height,
  opacity = 1,
  x = 0,
  y = 0,
  fallback = false,
}: {
  url: string;
  width: number;
  height: number;
  opacity?: number;
  x?: number;
  y?: number;
  fallback?: boolean;
}) {
  const img = useSrc(url);
  const sp = useSpriteOf(url);
  if (!img) {
    if (sp?.color) return <Rect x={x} y={y} width={width} height={height} fill={sp.color} opacity={opacity} listening={false} />;
    return fallback ? <Rect x={x} y={y} width={width} height={height} fill="#1a1a2e" listening={false} /> : null;
  }
  return <KImage image={img} x={x} y={y} width={width} height={height} opacity={opacity} listening={false} />;
}
