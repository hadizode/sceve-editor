import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Konva from 'konva';
import { Stage, Layer, Image as KImage, Rect, Text, Transformer, Shape, Circle } from 'react-konva';
import { apply, boxBounds, boxMatrix, invert, konvaHitFunc, konvaNodeAttrs, patchFromNode, polygonScene, type Pt } from '../shared/geometry';
import { useCtx, useScene, useStudioStore } from '../stores/store';
import { type SceneObject } from '../shared/types';
import { clamp, fileToImage } from '../shared/utils';
import { Bg, useSrc, useSpriteOf } from './konva-bits';
import { isTyping, useElementSize } from './ui';

const st = () => useStudioStore.getState();

interface NodeProps {
  obj: SceneObject;
  zoom: number;
  register: (id: string, node: Konva.Node | null) => void;
  onSelect: (id: string, multi: boolean) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string) => void;
  onDragEnd: () => void;
}

/**
 * One object = ONE interactive Konva node whose transform is exactly boxMatrix(obj).
 * Image sprites render as a KImage stretched to the box; image-less sprites (colour / invisible
 * hotspot) render as a Rect with the same attrs. A polygon hit shape is just a hitFunc on that node.
 */
function ObjNode({ obj, zoom, register, onSelect, onDragStart, onDragMove, onDragEnd }: NodeProps) {
  const img = useSrc(obj.spriteRef);
  const sp = useSpriteOf(obj.spriteRef);
  const nodeRef = useRef<any>(null);
  const hasImage = !!img && img.naturalWidth > 0;

  useEffect(() => {
    register(obj.id, nodeRef.current);
    return () => register(obj.id, null);
  }, [obj.id, hasImage, register]);

  const attrs = konvaNodeAttrs(obj);
  const hitFunc = konvaHitFunc(obj);
  const common = {
    id: obj.id,
    opacity: obj.visible ? 1 : 0.4,
    draggable: !obj.locked,
    onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => onSelect(obj.id, e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey),
    onTouchStart: () => onSelect(obj.id, false),
    onDragStart: () => onDragStart(obj.id),
    onDragMove: () => onDragMove(obj.id),
    onDragEnd,
    onMouseEnter: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const c = e.target.getStage()?.container();
      if (c) c.style.cursor = obj.locked ? 'not-allowed' : 'move';
    },
    onMouseLeave: (e: Konva.KonvaEventObject<MouseEvent>) => {
      const c = e.target.getStage()?.container();
      if (c) c.style.cursor = 'default';
    },
  };

  if (hasImage) {
    return (
      <>
        {sp?.color && <Rect {...attrs} fill={sp.color} opacity={obj.visible ? 1 : 0.4} listening={false} />}
        <KImage ref={nodeRef} image={img} {...attrs} hitFunc={hitFunc} {...common} />
      </>
    );
  }
  return (
    <Rect
      ref={nodeRef}
      {...attrs}
      {...common}
      hitFunc={hitFunc}
      fill={sp?.color ?? 'rgba(99,102,241,0.08)'}
      stroke={sp?.color ? undefined : '#64748b'}
      dash={sp?.color ? undefined : [4, 3]}
      strokeWidth={(sp?.color ? 0 : 1) / zoom}
    />
  );
}

/** Non-interactive extras (selection outline, hit-shape outline, label) in their own layer above the sprites. */
function ObjOverlay({ obj, zoom, selected, showLabel }: { obj: SceneObject; zoom: number; selected: boolean; showLabel: boolean }) {
  const poly = polygonScene(obj);
  const vb = boxBounds(obj);
  return (
    <>
      {selected && obj.locked && (
        <Rect {...konvaNodeAttrs(obj)} stroke="#f59e0b" strokeWidth={1 / zoom} dash={[4 / zoom, 3 / zoom]} listening={false} />
      )}
      {poly.length >= 3 && (
        <Shape
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
            ctx.closePath();
            ctx.fillStrokeShape(shape);
          }}
          stroke={selected ? '#22d3ee' : 'rgba(34,211,238,0.55)'}
          strokeWidth={1 / zoom}
          dash={[6 / zoom, 4 / zoom]}
          listening={false}
        />
      )}
      {showLabel && (
        <Text
          x={vb.x}
          y={vb.y - 14 / zoom}
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

/** Draggable vertex handles for the selected object's hit polygon (points are normalized to the box). */
function PolyHandles({ obj, zoom }: { obj: SceneObject; zoom: number }) {
  if (obj.hit?.kind !== 'polygon' || obj.hit.points.length < 3) return null;
  const pts = obj.hit.points;
  const m = boxMatrix(obj);
  const move = (i: number, scenePt: Pt) => {
    const inv = invert(m);
    if (!inv) return;
    const l = apply(inv, scenePt);
    const next = pts.map((q, j) =>
      j === i ? { x: Math.round(clamp(l.x / obj.width, 0, 1) * 1000) / 1000, y: Math.round(clamp(l.y / obj.height, 0, 1) * 1000) / 1000 } : q
    );
    st().updateObject(obj.id, { hit: { kind: 'polygon', points: next } }, `${obj.id}:hit-v${i}`);
  };
  return (
    <>
      {pts.map((p, i) => {
        const q = apply(m, { x: p.x * obj.width, y: p.y * obj.height });
        return (
          <Circle
            key={i}
            x={q.x}
            y={q.y}
            radius={5 / zoom}
            fill="#22d3ee"
            stroke="#0e7490"
            strokeWidth={1 / zoom}
            draggable
            onDragMove={(e) => move(i, { x: e.target.x(), y: e.target.y() })}
            onMouseEnter={(e) => {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = 'pointer';
            }}
            onMouseLeave={(e) => {
              const c = e.target.getStage()?.container();
              if (c) c.style.cursor = 'default';
            }}
          />
        );
      })}
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
  const nodes = useRef(new Map<string, Konva.Node>());
  const dragRef = useRef<{ pos: Map<string, { x: number; y: number; ox: number; oy: number }> } | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const marqueeAdditive = useRef(false);

  const size = useElementSize(containerRef);
  const measured = size.w > 0;
  const [cam, setCam] = useState({ zoom: 1, x: 0, y: 0 });
  const [space, setSpace] = useState(false);
  const [panning, setPanning] = useState(false);
  const [dragging, setDragging] = useState(false);
  // bumped whenever a node (re)mounts (e.g. after its image loads) so the Transformer re-binds
  const [nodeVer, setNodeVer] = useState(0);
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

  const register = useCallback((id: string, node: Konva.Node | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
    setNodeVer((v) => v + 1);
  }, []);

  // bind the single shared Transformer to selected, unlocked nodes
  useEffect(() => {
    const tr = trRef.current;
    if (!tr || !ctx) return;
    const list = ctx.objects
      .filter((o) => selected.includes(o.id) && !o.locked)
      .map((o) => nodes.current.get(o.id))
      .filter((n): n is Konva.Node => !!n);
    tr.nodes(list);
    tr.getLayer()?.batchDraw();
  }, [selected, ctx, measured, nodeVer]);

  // ---- object interaction ----
  const onSelect = useCallback((id: string, multi: boolean) => {
    const s = st();
    if (multi) s.selectObject(id, true);
    else if (!s.selectedObjectIds.includes(id)) s.selectObject(id);
  }, []);

  const onDragStart = useCallback((id: string) => {
    const s = st();
    const ids = s.selectedObjectIds.includes(id) ? s.selectedObjectIds : [id];
    const pos = new Map<string, { x: number; y: number; ox: number; oy: number }>();
    ids.forEach((i) => {
      const n = nodes.current.get(i);
      const o = ctx?.objects.find((q) => q.id === i);
      if (n && o && !o.locked) pos.set(i, { x: n.x(), y: n.y(), ox: o.x, oy: o.y });
    });
    dragRef.current = { pos };
    setDragging(true);
  }, [ctx]);

  // Drags move the box by a delta; every dragged node simply follows that delta.
  const onDragMove = useCallback(
    (id: string) => {
      const d = dragRef.current;
      const node = nodes.current.get(id);
      const start = d?.pos.get(id);
      if (!d || !node || !start) return;
      let dx = node.x() - start.x;
      let dy = node.y() - start.y;
      if (snapToGrid) {
        dx = Math.round((start.ox + dx) / gridSize) * gridSize - start.ox;
        dy = Math.round((start.oy + dy) / gridSize) * gridSize - start.oy;
        node.position({ x: start.x + dx, y: start.y + dy });
      }
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
    d.pos.forEach((p, i) => {
      const n = nodes.current.get(i);
      if (n) patches[i] = { x: Math.round(p.ox + (n.x() - p.x)), y: Math.round(p.oy + (n.y() - p.y)) };
    });
    st().updateObjects(patches);
  }, []);

  // Transformer result → box patch (scale is folded into width/height; a negative scale is a flip).
  const onTransformEnd = () => {
    const tr = trRef.current;
    if (!tr || !ctx) return;
    const patches: Record<string, Partial<SceneObject>> = {};
    tr.nodes().forEach((n) => {
      const o = ctx.objects.find((q) => q.id === n.id());
      if (!o) return;
      const p = patchFromNode({
        x: n.x(), y: n.y(), rotation: n.rotation(), scaleX: n.scaleX(), scaleY: n.scaleY(), width: n.width(), height: n.height(),
      });
      patches[o.id] = p;
      // bake the scale into the node right away so it matches the committed box
      n.scaleX(p.flipX ? -1 : 1);
      n.scaleY(p.flipY ? -1 : 1);
      n.width(p.width);
      n.height(p.height);
      n.offset({ x: p.width / 2, y: p.height / 2 });
    });
    st().updateObjects(patches);
  };

  // single selection → resize width or height independently with the side anchors
  const anchorList = useMemo(() => {
    const unlocked = ctx?.objects.filter((o) => selected.includes(o.id) && !o.locked) ?? [];
    if (unlocked.length === 1) {
      return ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
    }
    return ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  }, [selected, ctx]);

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
                <Bg key={l.id} url={l.spriteRef} width={ctx.width} height={ctx.height} opacity={l.opacity} x={l.offsetX} y={l.offsetY} />
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
                register={register}
                onSelect={onSelect}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
              />
            ))}
            {/* hit-polygon vertex handles for the single selected object */}
            {selected.length === 1 && (() => {
              const o = ctx.objects.find((x) => x.id === selected[0]);
              return o && o.hit?.kind === 'polygon' ? <PolyHandles obj={o} zoom={cam.zoom} /> : null;
            })()}
            <Transformer
              ref={trRef}
              rotateEnabled
              enabledAnchors={anchorList}
              anchorStyleFunc={(anchor) => {
                // side anchors (width/height only) get a square style, corners stay round
                const name = anchor.getAttr('name') as string;
                if (['top', 'bottom', 'left', 'right'].includes(name)) {
                  anchor.setAttrs({ width: 10, height: 6, cornerRadius: 2 });
                  if (name === 'top' || name === 'bottom') {
                    anchor.width(14);
                    anchor.height(6);
                  } else {
                    anchor.width(6);
                    anchor.height(14);
                  }
                }
              }}
              borderStroke="#6366f1"
              anchorStroke="#6366f1"
              anchorFill="#6366f1"
              anchorSize={8}
              boundBoxFunc={(oldBox, newBox) => (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5 ? oldBox : newBox)}
              onTransformEnd={onTransformEnd}
            />
          </Layer>
          <Layer listening={false}>
            {!dragging &&
              ctx.objects.map((o) => (
                <ObjOverlay key={o.id} obj={o} zoom={cam.zoom} selected={selected.includes(o.id)} showLabel={showLabels} />
              ))}
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
