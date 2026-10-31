import React, { useRef, useState } from 'react';
import { Stage, Layer, Image as KImage, Rect } from 'react-konva';
import { useScene, useStudioStore } from '../stores/store';
import type { Asset, BackgroundLayer, SceneObject, Sprite, View } from '../shared/types';
import { getSprite, resolveSprite } from '../shared/types';
import { frameNodeAttrs, imageNodeAttrs } from '../shared/geometry';
import { Bg, useSrc } from './konva-bits';
import { useElementSize } from './ui';

function PObj({ obj, found, onClick, sprites, assets }: { obj: SceneObject; found: boolean; onClick: () => void; sprites: Record<string, Sprite>; assets: Record<string, Asset> }) {
  const url = resolveSprite(obj.spriteRef, sprites, assets);
  const sp = getSprite(obj.spriteRef, sprites);
  const img = useSrc(url);
  if (!obj.visible || (found && obj.oneTimeUse)) return null;
  const click = { onClick, onTap: onClick };
  const nat = img && img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null;
  // color-only sprite fallback
  if (!img || !nat) {
    if (!sp?.color) return null;
    return <Rect {...frameNodeAttrs(obj)} fill={sp.color} {...click} />;
  }
  // image drawn at natural size x transform (same math as Studio/Player); hit area = frame (default) or image
  const imageHit = obj.hitArea === 'image';
  return (
    <>
      <KImage
        image={img}
        {...imageNodeAttrs(obj, nat)}
        listening={imageHit}
        {...(imageHit ? click : {})}
        onMouseEnter={(e) => {
          const c = e.target.getStage()?.container();
          if (c) c.style.cursor = 'pointer';
        }}
        onMouseLeave={(e) => {
          const c = e.target.getStage()?.container();
          if (c) c.style.cursor = 'default';
        }}
      />
      {!imageHit && (
        <Rect
          {...frameNodeAttrs(obj)}
          fill="rgba(0,0,0,0)"
          {...click}
          onMouseEnter={(e) => {
            const c = e.target.getStage()?.container();
            if (c) c.style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            const c = e.target.getStage()?.container();
            if (c) c.style.cursor = 'default';
          }}
        />
      )}
    </>
  );
}

function StaticScene(props: {
  width: number;
  height: number;
  backgroundUrl: string;
  layers: BackgroundLayer[];
  objects: SceneObject[];
  found: Set<string>;
  scale: number;
  onObjectClick: (o: SceneObject) => void;
  sprites: Record<string, Sprite>;
  assets: Record<string, Asset>;
}) {
  const { width, height, scale } = props;
  return (
    <Stage width={width * scale} height={height * scale} scaleX={scale} scaleY={scale} style={{ display: 'block' }}>
      <Layer>
        <Bg url={props.backgroundUrl} width={width} height={height} fallback />
        {props.layers
          .filter((l) => l.visible)
          .map((l) => (
            <Bg key={l.id} url={l.spriteRef} width={width} height={height} opacity={l.opacity} x={l.offsetX} y={l.offsetY} />
          ))}
        {props.objects.map((o) => (
          <PObj key={o.id} obj={o} found={props.found.has(o.id)} onClick={() => props.onObjectClick(o)} sprites={props.sprites} assets={props.assets} />
        ))}
      </Layer>
    </Stage>
  );
}

export default function Preview() {
  const scene = useScene();
  const sprites = useStudioStore((s) => s.sprites);
  const assets = useStudioStore((s) => s.assets);
  const ref = useRef<HTMLDivElement>(null);
  const size = useElementSize(ref);
  const [found, setFound] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<View | null>(null);
  const timer = useRef<number>();

  if (!scene) return <div className="p-8 text-center text-gray-400">No room to preview</div>;

  const say = (text: string) => {
    setMsg(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 4000);
  };

  const click = (o: SceneObject) => {
    if (o.view) {
      setView(o.view);
      return;
    }
    setFound((f) => new Set(f).add(o.id));
    say(o.message || o.pickupMessage || o.name);
  };

  const scale = Math.max(0.05, Math.min(1, (size.w - 32) / scene.width, (size.h - 32) / scene.height));
  const vScale = view ? Math.min(1, 500 / view.width, 400 / view.height) : 1;

  return (
    <div ref={ref} className="relative flex-1 min-h-0 flex items-center justify-center bg-gray-900 overflow-hidden">
      {size.w > 0 && (
        <div className="rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
          <StaticScene
            width={scene.width}
            height={scene.height}
            backgroundUrl={scene.backgroundUrl}
            layers={scene.backgroundLayers}
            objects={scene.objects}
            found={found}
            scale={scale}
            onObjectClick={click}
            sprites={sprites}
            assets={assets}
          />
        </div>
      )}
      {msg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-5 py-3 rounded-xl shadow-xl text-sm max-w-sm text-center" dir="rtl" lang="fa">
          {msg}
        </div>
      )}
      {view && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
          <div className="bg-surface rounded-xl border border-gray-600 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-surface-light border-b border-gray-700">
              <span className="text-sm text-indigo-300" dir="rtl" lang="fa">🔍 {view.title}</span>
              <button
                className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-xs"
                onClick={() => {
                  if (view.closeMessage) say(view.closeMessage);
                  setView(null);
                }}
              >
                ✕ Close
              </button>
            </div>
            <StaticScene
              width={view.width}
              height={view.height}
              backgroundUrl={view.backgroundUrl}
              layers={[]}
              objects={view.objects}
              found={found}
              scale={vScale}
              onObjectClick={(o) => {
                setFound((f) => new Set(f).add(o.id));
                say(o.message || o.name);
              }}
              sprites={sprites}
              assets={assets}
            />
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 text-gray-400 text-xs px-3 py-1 rounded">
        Preview • click objects to see their messages (no game rules applied)
      </div>
    </div>
  );
}
