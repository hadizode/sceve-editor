import React from 'react';
import { Image as KImage, Rect } from 'react-konva';
import useImage from 'use-image';
import { useStudioStore } from '../stores/store';
import { resolveSprite } from '../shared/types';

/**
 * Resolve ANY reference (`sprite:<id>`, `asset:<id>` or a direct URL) to a concrete image URL.
 * (Previously only `asset:` refs were resolved, so every `sprite:` ref was loaded as a literal URL
 * and no image ever rendered in the studio.)
 */
export function useResolved(url: string): string {
  const assets = useStudioStore((s) => s.assets);
  const sprites = useStudioStore((s) => s.sprites);
  return resolveSprite(url, sprites, assets);
}

export function useSrc(ref: string) {
  const [img] = useImage(useResolved(ref));
  return img;
}

/** Resolve a sprite/image reference to the Sprite record (undefined for direct URLs / missing). */
export function useSpriteOf(ref: string) {
  const sprites = useStudioStore((s) => s.sprites);
  return ref.startsWith('sprite:') ? sprites[ref.slice(7)] : undefined;
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
