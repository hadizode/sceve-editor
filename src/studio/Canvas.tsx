import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer, Image as KImage, Rect, Text, Transformer, Shape } from 'react-konva';
import { useCtx, useScene, useStudioStore } from '../stores/store';
import { TYPE_COLORS, type SceneObject } from '../shared/types';
import { clamp, fileToImage } from '../shared/utils';
import { Bg, useSrc } from './konva-bits';
import { isTyping, useElementSize } from './ui';

const st = () => useStudioStore.getState();

interface NodeProps {
  obj: SceneObject;
  zoom: number;
  showLabel: boolean;
  dragging: boolean;
  register: (id: string, node: Konva.Image | null) => void;
  onSelect: (id: string, multi: boolean) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string) => void;
  onDragEnd: () => void;
}

function ObjNode({ obj, zoom, showLabel, dragging, register, onSelect, onDragStart, onDragMove, onDragEnd }: NodeProps) {
  const img = useSrc(obj.imageUrl);
  const ref = useRef<Konva.Image>(null);
  useEffect(() => {
    register(obj.id, ref.current);
    return () => register(obj.id, null);
  }, [obj.id, register]);

  return (
    <>
      {!img && (
        <Rect
          x={obj.x}
          y={obj.y}
          width={obj.width}
          height={obj.height}
          rotation={obj.rotation}
          fill="rgba(99,102,241,0.08)"
          stroke="#64748b"
          dash={[4, 3]}
          strokeWidth={1 / zoom}
          listening={false}
        />
      )}
      <KImage
        ref={ref}
        id={obj.id}
        image={img}
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        rotation={obj.rotation}
        opacity={obj.visible ? 1 : 0.3}
        draggable={!obj.locked}
        stroke={TYPE_COLORS[obj.type]}
        strokeWidth={showLabel ? 1 / zoom : 0}
        onMouseDown={(e) => onSelect(obj.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey)}
        onTouchStart={() => onSelect(obj.id, false)}
        onDragStart={() => onDragStart(obj.id)}
        onDragMove={() => onDragMove(obj.id)}
        onDragEnd={onDragEnd}
        onMouseEnter={(e) => {
          const c = e.target.getStage()?.container();
          if (c) c.style.cursor = obj.locked ? 'not-allowed' : 'move';
        }}
        onMouseLeave={(e) => {
          const c = e.target.getStage()?.container();
          if (c) c.style.cursor = 'default';
        }}
      />
      {showLabel && !dragging && (
        <Text
          x={obj.x}
          y={obj.y - 14 / zoom}
          text={`${obj.locked ? '🔒 ' : ''}${obj.name}${obj.view ? ' 🔍' : ''}`}
          fontSize={11 / zoom}
          fill="#e2e8f0"
          shadowColor="#000"
          shadowBlur={2}
          listening={false}
        />
      )}
    </>
  );
}

export default function Canvas() {
  const scene = useScene();
  const ctx = useCtx();
  const viewOf = useStudioStore((s) => s.editingViewOf);
  const selected = useStudioStore((s) => s.selectedObjectIds);
  const showGrid = useStudioStore((s) => s.showGrid);
  const gridSize = useStudioStore((s) => s.gridSize);
  const snapToGrid = useStudioStore((s) => s.snapToGrid);
  const showLabels = useStudioStore((s) => s.showLabels);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const nodes = useRef(new Map<string, Konva.Image>());
  const dragRef = useRef<{ pos: Map<string, { x: number; y: number }> } | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeAdditive = useRef(false);

  const size = useElementSize(containerRef);
  const measured = size.w > 0;
  const [cam, setCam] = useState({ zoom: 1, x: 0, y: 0 });
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  const w = ctx?.width ?? 0;
  const h = ctx?.height ?? 0;

  const fit = useCallback(() => {
    if (!measured || !w || !h) return;
    const z = clamp(Math.min(size.w / w, size.h / h) * 0.85, 0.05, 5);
    setCam({ zoom: z, x: (size.w - w * z) / 2, y: (size.h - h * z) / 2 });
  }, [measured, size.w, size.h, w, h]);

  // auto-fit when scene / view / measured size / background changes
  useEffect(() => {
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene?.id, viewOf, measured, ctx?.backgroundUrl]);

  // wheel zoom (native listener so preventDefault works)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setCam((c) => {
        const nz = clamp(c.zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.05, 5);
        const k = nz / c.zoom;
        return { zoom: nz, x: mx - (mx - c.x) * k, y: my - (my - c.y) * k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // space = pan mode
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e)) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpace(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const register = useCallback((id: string, node: Konva.Image | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  // bind the single shared Transformer to selected, unlocked nodes
  useEffect(() => {
    const tr = trRef.current;
    if (!tr || !ctx) return;
    const list = ctx.objects
      .filter((o) => selected.includes(o.id) && !o.locked)
      .map((o) => nodes.current.get(o.id))
      .filter((n): n is Konva.Image => !!n);
    tr.nodes(list);
    tr.getLayer()?.batchDraw();
  }, [selected, ctx, measured]);

  // ---- object interaction ----
  const onSelect = useCallback((id: string, multi: boolean) => {
    const s = st();
    if (multi) s.selectObject(id, true);
    else if (!s.selectedObjectIds.includes(id)) s.selectObject(id);
  }, []);

  const onDragStart = useCallback((id: string) => {
    const s = st();
    const c = ctx;
    const ids = s.selectedObjectIds.includes(id) ? s.selectedObjectIds : [id];
    const pos = new Map<string, { x: number; y: number }>();
    ids.forEach((i) => {
      const n = nodes.current.get(i);
      const locked = c?.objects.find((o) => o.id === i)?.locked;
      if (n && !locked) pos.set(i, { x: n.x(), y: n.y() });
    });
    dragRef.current = { pos };
    setDragging(true);
  }, [ctx]);

  const onDragMove = useCallback(
    (id: string) => {
      const d = dragRef.current;
      const node = nodes.current.get(id);
      const start = d?.pos.get(id);
      if (!d || !node || !start) return;
      let nx = node.x();
      let ny = node.y();
      if (snapToGrid) {
        nx = Math.round(nx / gridSize) * gridSize;
        ny = Math.round(ny / gridSize) * gridSize;
        node.position({ x: nx, y: ny });
      }
      const dx = nx - start.x;
      const dy = ny - start.y;
      d.pos.forEach((p, i) => {
        if (i !== id) nodes.current.get(i)?.position({ x: p.x + dx, y: p.y + dy });
      });
    },
    [snapToGrid, gridSize]
  );

  const onDragEnd = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setDragging(false);
    if (!d) return;
    const patches: Record<string, Partial<SceneObject>> = {};
    d.pos.forEach((_, i) => {
      const n = nodes.current.get(i);
      if (n) patches[i] = { x: Math.round(n.x()), y: Math.round(n.y()) };
    });
    st().updateObjects(patches);
  }, []);

  const onTransformEnd = () => {
    const tr = trRef.current;
    if (!tr) return;
    const patches: Record<string, Partial<SceneObject>> = {};
    tr.nodes().forEach((n) => {
      patches[n.id()] = {
        x: Math.round(n.x()),
        y: Math.round(n.y()),
        width: Math.max(5, Math.round(n.width() * n.scaleX())),
        height: Math.max(5, Math.round(n.height() * n.scaleY())),
        rotation: Math.round(n.rotation() * 10) / 10,
      };
      n.scaleX(1);
      n.scaleY(1);
    });
    st().updateObjects(patches);
  };

  // ---- pan + marquee (container level) ----
  const rel = (e: React.MouseEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onContainerDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && space)) {
      e.preventDefault();
      panRef.current = { x: e.clientX, y: e.clientY };
      setPanning(true);
    }
  };
  const onContainerMove = (e: React.MouseEvent) => {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.x;
      const dy = e.clientY - panRef.current.y;
      panRef.current = { x: e.clientX, y: e.clientY };
      setCam((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
    } else if (marquee) {
      const p = rel(e);
      setMarquee({ ...marquee, x2: p.x, y2: p.y });
    }
  };
  const finish = () => {
    if (panRef.current) {
      panRef.current = null;
      setPanning(false);
    }
    if (!marquee || !ctx) return;
    const box = {
      x: Math.min(marquee.x1, marquee.x2),
      y: Math.min(marquee.y1, marquee.y2),
      width: Math.abs(marquee.x2 - marquee.x1),
      height: Math.abs(marquee.y2 - marquee.y1),
    };
    setMarquee(null);
    const additive = marqueeAdditive.current;
    if (box.width < 4 && box.height < 4) {
      if (!additive) st().clearSelection();
      return;
    }
    const hit = ctx.objects
      .filter((o) => {
        const n = nodes.current.get(o.id);
        return !!n && Konva.Util.haveIntersection(box, n.getClientRect());
      })
      .map((o) => o.id);
    st().selectObjects(additive ? Array.from(new Set([...st().selectedObjectIds, ...hit])) : hit);
  };

  // ---- drop images / assets ----
  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const r = containerRef.current!.getBoundingClientRect();
    const x = (e.clientX - r.left - cam.x) / cam.zoom;
    const y = (e.clientY - r.top - cam.y) / cam.zoom;
    const assetId = e.dataTransfer.getData('application/x-asset-id');
    if (assetId) {
      st().addObjectFromAsset(assetId, x, y);
      return;
    }
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    let off = 0;
    for (const f of files) {
      try {
        const asset = st().addAsset(await fileToImage(f));
        st().addObjectFromAsset(asset.id, x + off, y + off);
        off += 20;
      } catch (err) {
        alert((err as Error).message);
      }
    }
  };

  // ---- grid (single Shape instead of hundreds of Line nodes) ----
  const gridShape = useMemo(() => {
    if (!showGrid || !measured) return null;
    const left = -cam.x / cam.zoom;
    const top = -cam.y / cam.zoom;
    const right = (size.w - cam.x) / cam.zoom;
    const bottom = (size.h - cam.y) / cam.zoom;
    let step = gridSize;
    while ((right - left) / step > 150) step *= 2;
    return (
      <Shape
        listening={false}
        stroke="#334155"
        strokeWidth={0.5 / cam.zoom}
        sceneFunc={(c, shape) => {
          c.beginPath();
          for (let x = Math.floor(left / step) * step; x <= right; x += step) {
            c.moveTo(x, top);
            c.lineTo(x, bottom);
          }
          for (let y = Math.floor(top / step) * step; y <= bottom; y += step) {
            c.moveTo(left, y);
            c.lineTo(right, y);
          }
          c.strokeShape(shape);
        }}
      />
    );
  }, [showGrid, measured, cam, size.w, size.h, gridSize]);

  const cursor = space ? (panning ? 'grabbing' : 'grab') : 'default';

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-gray-900 overflow-hidden select-none"
      style={{ cursor, touchAction: 'none' }}
      onMouseDown={onContainerDown}
      onMouseMove={onContainerMove}
      onMouseUp={finish}
      onMouseLeave={finish}
      onContextMenu={(e) => e.preventDefault()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {measured && ctx && scene ? (
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          scaleX={cam.zoom}
          scaleY={cam.zoom}
          x={cam.x}
          y={cam.y}
          style={{ display: 'block' }}
          onMouseDown={(e) => {
            if (space || e.evt.button !== 0 || e.target !== e.target.getStage()) return;
            const p = stageRef.current?.getPointerPosition();
            if (!p) return;
            marqueeAdditive.current = e.evt.shiftKey;
            setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
          }}
        >
          <Layer listening={false}>
            <Bg url={ctx.backgroundUrl} width={ctx.width} height={ctx.height} fallback />
            {ctx.layers
              .filter((l) => l.visible)
              .map((l) => (
                <Bg key={l.id} url={l.imageUrl} width={ctx.width} height={ctx.height} opacity={l.opacity} x={l.offsetX} y={l.offsetY} />
              ))}
            {gridShape}
            <Rect
              width={ctx.width}
              height={ctx.height}
              stroke="#6366f1"
              strokeWidth={1.5 / cam.zoom}
              dash={[8 / cam.zoom, 4 / cam.zoom]}
            />
          </Layer>
          <Layer>
            {ctx.objects.map((o) => (
              <ObjNode
                key={o.id}
                obj={o}
                zoom={cam.zoom}
                showLabel={showLabels}
                dragging={dragging}
                register={register}
                onSelect={onSelect}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
              />
            ))}
            <Transformer
              ref={trRef}
              rotateEnabled
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              borderStroke="#6366f1"
              anchorStroke="#6366f1"
              anchorFill="#6366f1"
              anchorSize={8}
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5 ? oldBox : newBox)}
              onTransformEnd={onTransformEnd}
            />
          </Layer>
        </Stage>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm">Select or create a room</div>
      )}

      {marquee && (
        <div
          className="absolute border border-indigo-400 bg-indigo-500/15 pointer-events-none"
          style={{
            left: Math.min(marquee.x1, marquee.x2),
            top: Math.min(marquee.y1, marquee.y2),
            width: Math.abs(marquee.x2 - marquee.x1),
            height: Math.abs(marquee.y2 - marquee.y1),
          }}
        />
      )}

      {/* overlays */}
      {ctx?.view && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-amber-700/90 text-white text-xs px-3 py-1.5 rounded-lg shadow">
          <span>🔍 Editing view: {ctx.view.title}</span>
          <button className="bg-black/30 hover:bg-black/50 px-2 py-0.5 rounded" onClick={() => st().exitView()}>
            ← Back to room
          </button>
        </div>
      )}
      <div className="absolute top-2 left-2 z-10 bg-black/60 text-gray-400 text-[11px] px-2 py-1 rounded pointer-events-none">
        Scroll = zoom • Space/middle-drag = pan • drag empty area = select • drop images here
      </div>
      <div className="absolute bottom-2 left-2 z-10 bg-black/60 text-gray-400 text-[11px] px-2 py-1 rounded font-mono pointer-events-none">
        {w}×{h} • {Math.round(cam.zoom * 100)}%
      </div>
      <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 bg-black/60 rounded px-1 py-0.5">
        <button className="text-gray-200 px-1.5" onClick={() => setCam((c) => ({ ...c, zoom: clamp(c.zoom * 0.8, 0.05, 5) }))}>−</button>
        <button className="text-gray-200 px-1.5" onClick={() => setCam((c) => ({ ...c, zoom: clamp(c.zoom * 1.25, 0.05, 5) }))}>+</button>
        <button className="text-gray-200 px-1.5 text-xs" title="Fit to view" onClick={fit}>⊡ Fit</button>
      </div>
    </div>
  );
}
