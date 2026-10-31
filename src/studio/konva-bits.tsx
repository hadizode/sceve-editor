import React from 'react';
import { Image as KImage, Rect } from 'react-konva';
import useImage from 'use-image';
import { useStudioStore } from '../stores/store';
import { resolveUrl } from '../shared/types';

export function useResolved(url: string): string {
  const assets = useStudioStore((s) => s.assets);
  return resolveUrl(url, assets);
}

export function useSrc(url: string) {
  const [img] = useImage(useResolved(url));
  return img;
}

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
  if (!img) return fallback ? <Rect x={x} y={y} width={width} height={height} fill="#1a1a2e" listening={false} /> : null;
  return <KImage image={img} x={x} y={y} width={width} height={height} opacity={opacity} listening={false} />;
}
