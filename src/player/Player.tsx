// ============ Player (Game) — plays the CURRENT studio project live ============
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useImage from 'use-image';
import { itemName, usePlayerStore } from '../stores/store';
import type { Asset, Scene, SceneObject, SessionState, Sprite, View } from '../shared/types';
import { getSprite, resolveSprite, transformRef } from '../shared/types';
import { cssMatrix, frameMatrix, imageMatrix } from '../shared/geometry';

/** Resolve a sprite/image ref to the concrete image URL ('' when the sprite has no image). */
const spriteSrc = (ref: string | undefined, sprites: Record<string, Sprite>, assets: Record<string, Asset>) =>
  ref ? resolveSprite(ref, sprites, assets) : '';
import { allRoomsComplete } from '../shared/game-logic';

const faDigits = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]);

// ---------- Toast ----------
function Toast() {
  const toast = usePlayerStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="fixed top-14 left-1/2 -translate-x-1/2 z-[100] pointer-events-none" dir="rtl">
      <div className="bg-surface-lighter/95 border border-indigo-500/40 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl max-w-[80vw]">
        {toast}
      </div>
    </div>
  );
}

// ---------- Lobby (multiplayer simulation) ----------
function Lobby({ projectName }: { projectName: string }) {
  const session = usePlayerStore((s) => s.session);
  const setReady = usePlayerStore((s) => s.setPlayerReady);
  const startNewGame = usePlayerStore((s) => s.startNewGame);
  if (!session) return null;
  return (
    <div className="h-full flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-md bg-surface border border-gray-700 rounded-2xl p-6 space-y-5 shadow-2xl">
        <div>
          <h2 className="text-xl font-bold">🎮 لابی بازی</h2>
          <p className="text-sm text-gray-400 mt-1">پروژه: {projectName}</p>
        </div>
        <ul className="space-y-2">
          {session.players.map((p) => (
            <li key={p.telegramId} className="flex items-center gap-3 bg-surface-light rounded-xl px-3 py-2">
              <span className={`w-2.5 h-2.5 rounded-full ${p.online ? 'bg-emerald-400' : 'bg-gray-600'}`} />
              <span className="flex-1 text-sm">{p.name}</span>
              <span className={`text-xs ${p.ready ? 'text-emerald-400' : 'text-gray-500'}`}>
                {p.ready ? 'آماده ✓' : 'در انتظار…'}
              </span>
            </li>
          ))}
        </ul>
        <button
          onClick={() => setReady()}
          disabled={session.players[0]?.ready}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-bold"
        >
          {session.players[0]?.ready ? 'منتظر هم‌تیمی…' : '✅ آماده‌ام'}
        </button>
        <button
          onClick={() => startNewGame()}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-sm font-bold"
        >
          🚀 شروع بدون منتور (حالت تک‌نفره)
        </button>
      </div>
    </div>
  );
}

// ---------- Game object sprite ----------
/**
 * Rendering rule: the image is drawn at its NATURAL size x the sprite's transform
 * (scale / rotation / flip / offset) — never fitted to the frame and never clipped.
 * The frame is only the logical box + default hit area. Matrices come from shared/geometry
 * so Studio and Player produce identical results. Z-order = DOM order = scene array order.
 */
function ObjSprite({
  obj,
  state,
  sceneId,
  viewId,
  assets,
  sprites,
  onOpenView,
}: {
  obj: SceneObject;
  state: SessionState;
  sceneId: string;
  viewId?: string; // id of parent object whose view we are in
  assets: Record<string, Asset>;
  sprites: Record<string, Sprite>;
  onOpenView: (objectId: string) => void;
}) {
  const discovered = state.discoveredObjects[viewId || sceneId]?.includes(obj.id);
  // Objects that carry a digit (shows its badge once found) or still have transform rules
  // (an item must be usable on them after the first click) must stay on screen after discovery.
  const keepVisible = obj.digit !== undefined || !!obj.transforms?.length;
  // pickupGone removed: pickupObject already marks the object discovered, so `discovered` covers it
  // (and checking inventory by itemId would wrongly hide every sibling sharing a pickupItemId).
  const hidden = !obj.visible || (!keepVisible && !!discovered && !obj.view);
  const tIndex = (state.transformsApplied ?? {})[obj.id] ?? -1;
  const applied = obj.transforms?.[tIndex];
  // After a transform fires, the object takes on the rule's new sprite ("بعد از ترنسفورم عکس بگیرن").
  const ref = applied?.newSpriteId ? transformRef(applied.newSpriteId) : obj.spriteRef;
  const sp = getSprite(ref, sprites);
  const url = spriteSrc(ref, sprites, assets);
  const name = applied?.newName || obj.name;
  const [img] = useImage(url || '', 'anonymous');
  const selectedItem = usePlayerStore((s) => s.selectedItem);
  const clickObject = usePlayerStore((s) => s.clickObject);
  const pickup = usePlayerStore((s) => s.pickup);
  const useItemOnObject = usePlayerStore((s) => s.useItemOnObject);
  const say = usePlayerStore((s) => s.setToast);

  if (hidden) return null;

  const clickable = obj.digit !== undefined || !!obj.requiresItem?.length || !!obj.grantsItem || !!obj.message || !!obj.view || obj.pickupable === true || !!obj.transforms?.length;

  const nextRule = obj.transforms?.[((state.transformsApplied ?? {})[obj.id] ?? -1) + 1];
  const onlyTransform = !obj.message && obj.digit === undefined && !obj.grantsItem && !obj.requiresItem?.length;

  const handleClick = () => {
    if (!clickable) return;
    if (selectedItem) { useItemOnObject(selectedItem, obj.id, viewId); return; }
    // rule without an item: executes with a simple click
    if (nextRule && !nextRule.requiresItem) { useItemOnObject(null, obj.id, viewId); return; }
    if (obj.view) { onOpenView(obj.id); return; }
    if (obj.pickupable) { pickup(obj.id, viewId); return; }
    // transform-only object with no message: show a hint instead of staying silent
    if (nextRule && onlyTransform) { say('برای استفاده از این مورد، آیتم مناسب را از کیف خود انتخاب کنید'); return; }
    clickObject(obj.id, viewId);
  };

  // A sprite with neither image nor color is fully invisible — but still clickable
  // when it has game rules (invisible hotspot), and never shows a placeholder.
  const hasVisual = !!url || !!sp?.color;
  const nw = img?.naturalWidth ?? 0;
  const nh = img?.naturalHeight ?? 0;
  const nat = img && nw > 0 && nh > 0 ? { width: nw, height: nh } : null;
  // hit area: 'frame' (default) or the rendered image's rotated bounds
  const imageHit = obj.hitArea === 'image' && !!nat;
  const pointerCls = clickable ? 'cursor-pointer' : 'pointer-events-none';
  const fm = cssMatrix(frameMatrix(obj));

  return (
    <>
      {sp?.color && (
        <div
          className="absolute pointer-events-none"
          style={{ left: 0, top: 0, width: obj.width, height: obj.height, transform: fm, transformOrigin: '0 0', background: sp.color }}
        />
      )}
      {nat && (
        <img
          src={url}
          alt={name}
          title={name}
          draggable={false}
          onClick={imageHit ? handleClick : undefined}
          className={`select-none ${imageHit ? `${pointerCls} hover:brightness-110` : 'pointer-events-none'}`}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: nw,
            height: nh,
            maxWidth: 'none', // Tailwind preflight sets img { max-width: 100% }, which would shrink overflowing images
            transform: cssMatrix(imageMatrix(obj, nat)),
            transformOrigin: '0 0',
          }}
        />
      )}
      {/* frame: default hit area + digit badge */}
      <div
        className={`absolute rounded ${imageHit ? 'pointer-events-none' : `${pointerCls} ${hasVisual && clickable ? 'hover:ring-2 hover:ring-amber-400/70' : ''}`}`}
        style={{ left: 0, top: 0, width: obj.width, height: obj.height, transform: fm, transformOrigin: '0 0' }}
        onClick={imageHit ? undefined : handleClick}
        title={name}
      >
        {obj.digit !== undefined && discovered && (
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-amber-500 text-black text-xs font-bold flex items-center justify-center shadow pointer-events-none">
            {faDigits(String(obj.digit))}
          </div>
        )}
      </div>
    </>
  );
}

// ---------- Zoom/Pan scene view ----------
function SceneStage({
  scene,
  state,
  assets,
  sprites,
}: {
  scene: Scene;
  state: SessionState;
  assets: Record<string, Asset>;
  sprites: Record<string, Sprite>;
}) {
  const [openViewOf, setOpenViewOf] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const compute = () => setFit(Math.min(el.clientWidth / scene.width, el.clientHeight / scene.height, 2));
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scene.width, scene.height]);

  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
    setOpenViewOf(null);
  }, [scene.id]);

  const zoom = scene.width * fit * scale;
  const zoomH = scene.height * fit * scale;

  const view: View | undefined = openViewOf
    ? scene.objects.find((o) => o.id === openViewOf)?.view
    : undefined;

  const onWheel = useCallback((e: React.WheelEvent) => {
    setScale((s) => Math.min(4, Math.max(0.5, s * (e.deltaY < 0 ? 1.1 : 0.9))));
  }, []);

  return (
    // wrapRef is the game VIEWPORT — the only element allowed to crop sprites.
    <div
      ref={wrapRef}
      className="relative w-full h-full overflow-hidden bg-black/40 touch-none"
      onWheel={onWheel}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest('[data-scene-content]')) return;
        dragRef.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = dragRef.current;
        if (!d) return;
        setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) });
      }}
      onPointerUp={() => (dragRef.current = null)}
    >
      <div
        data-scene-content
        className="absolute left-1/2 top-1/2 shadow-2xl"
        style={{
          width: view ? Math.max(view.width, 400) : zoom,
          height: view ? Math.max(view.height, 400) : zoomH,
          transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
        }}
      >
        {view ? (
          <ViewOverlay scene={scene} state={state} assets={assets} sprites={sprites} view={view} onClose={() => setOpenViewOf(null)} />
        ) : (
          <div className="relative w-full h-full" style={{ transform: `scale(${fit * scale})`, transformOrigin: 'top left' }}>
            <SceneContent scene={scene} state={state} assets={assets} sprites={sprites} onOpenView={setOpenViewOf} />
          </div>
        )}
      </div>
      {!view && (
        <div className="absolute bottom-2 left-2 flex gap-1 z-10" dir="ltr">
          <button className="w-8 h-8 rounded-lg bg-surface-light/90 border border-gray-700 text-sm" onClick={() => setScale((s) => Math.min(4, s * 1.2))}>+</button>
          <button className="w-8 h-8 rounded-lg bg-surface-light/90 border border-gray-700 text-sm" onClick={() => setScale((s) => Math.max(0.5, s / 1.2))}>−</button>
          <button className="w-8 h-8 rounded-lg bg-surface-light/90 border border-gray-700 text-xs" onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}>⟲</button>
        </div>
      )}
    </div>
  );
}

// ---------- Scene content (background layers + objects in array order) ----------
function SceneContent({
  scene,
  state,
  assets,
  sprites,
  viewId,
  onOpenView,
}: {
  scene: Scene;
  state: SessionState;
  assets: Record<string, Asset>;
  sprites: Record<string, Sprite>;
  viewId?: string;
  onOpenView: (objectId: string) => void;
}) {
  const parent = viewId ? scene.objects.find((o) => o.id === viewId) : undefined;
  const W = viewId ? parent?.view?.width ?? scene.width : scene.width;
  const H = viewId ? parent?.view?.height ?? scene.height : scene.height;
  const objects = viewId ? parent?.view?.objects ?? [] : scene.objects;
  const bgRef = viewId ? parent?.view?.backgroundUrl ?? '' : scene.backgroundUrl;
  const bgUrl = spriteSrc(bgRef, sprites, assets);
  const bgSp = getSprite(bgRef, sprites);
  const [bg] = useImage(bgUrl || '', 'anonymous');

  // NOTE: no overflow-hidden here — sprite images may extend past the scene bounds; only the viewport crops.
  return (
    <div className="absolute inset-0 bg-surface-light" style={{ width: W, height: H }}>
      {/* background: image (cover) or solid color sprite */}
      {bg ? (
        <img src={bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none" />
      ) : bgSp?.color ? (
        <div className="absolute inset-0" style={{ background: bgSp.color }} />
      ) : null}
      {!viewId &&
        scene.backgroundLayers.filter((l) => l.visible).map((l) => {
          const u = spriteSrc(l.spriteRef, sprites, assets);
          const lsp = getSprite(l.spriteRef, sprites);
          if (!u && !lsp?.color) return null;
          return u ? (
            <img
              key={l.id}
              src={u}
              alt=""
              className="absolute select-none pointer-events-none"
              style={{ left: l.offsetX, top: l.offsetY, width: '100%', opacity: l.opacity }}
            />
          ) : (
            <div key={l.id} className="absolute inset-0 pointer-events-none" style={{ transform: `translate(${l.offsetX}px, ${l.offsetY}px)`, background: lsp?.color, opacity: l.opacity }} />
          );
        })}
      {objects.map((o) => (
        <ObjSprite key={o.id} obj={o} state={state} sceneId={scene.id} viewId={viewId} assets={assets} sprites={sprites} onOpenView={onOpenView} />
      ))}
    </div>
  );
}

// ---------- Close-up view overlay ----------
function ViewOverlay({
  scene,
  state,
  assets,
  sprites,
  view,
  onClose,
}: {
  scene: Scene;
  state: SessionState;
  assets: Record<string, Asset>;
  sprites: Record<string, Sprite>;
  view: View;
  onClose: () => void;
}) {
  const locked = view.requiresItem?.length
    ? !view.requiresItem.every((i) => state.inventory.includes(i))
    : false;
  const clickObject = usePlayerStore((s) => s.clickObject);

  if (locked) {
    return (
      <div className="w-full h-full bg-surface border border-gray-700 rounded-xl flex flex-col items-center justify-center gap-3 p-6" dir="rtl">
        <div className="text-4xl">🔒</div>
        <p className="text-sm text-gray-300">برای باز کردن این مورد به آیتم نیاز دارید.</p>
        <button className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-sm" onClick={onClose}>بازگشت</button>
      </div>
    );
  }

  const parentObj = scene.objects.find((o) => o.view?.id === view.id);

  // No overflow-hidden: sprites in a view may overflow it too; the game viewport (SceneStage) crops.
  return (
    <div className="w-full h-full relative bg-surface border border-gray-700 rounded-xl">
      <div className="absolute inset-0">
        <SceneContent scene={scene} state={state} assets={assets} sprites={sprites} viewId={parentObj?.id} onOpenView={() => {}} />
      </div>
      <div className="absolute top-2 right-2 left-2 flex items-center justify-between z-10" dir="rtl">
        <span className="bg-black/60 text-xs px-2 py-1 rounded-lg">{view.title}</span>
        <button
          className="bg-black/60 hover:bg-red-600/80 text-xs px-2.5 py-1 rounded-lg"
          onClick={() => {
            if (view.closeMessage && parentObj) clickObject(parentObj.id, undefined);
            onClose();
          }}
        >
          ✕ بستن
        </button>
      </div>
    </div>
  );
}

// ---------- Inventory ----------
function InventoryPanel() {
  const inventory = usePlayerStore((s) => s.session?.state.inventory ?? EMPTY);
  const selectedItem = usePlayerStore((s) => s.selectedItem);
  const selectItem = usePlayerStore((s) => s.selectItem);
  const scenes = usePlayerStore((s) => s.scenes);
  const projectId = usePlayerStore((s) => s.session?.projectId);
  const assets = usePlayerStore((s) => s.assets);
  const sprites = usePlayerStore((s) => s.sprites);

  const itemMeta = useMemo(() => {
    const m: Record<string, { name: string; url: string; color?: string }> = {};
    if (!projectId) return m;
    const walk = (objs: SceneObject[]) => {
      for (const o of objs) {
        const sp = getSprite(o.spriteRef, sprites);
        const u = spriteSrc(o.spriteRef, sprites, assets);
        if (o.grantsItem && !m[o.grantsItem]) m[o.grantsItem] = { name: o.name, url: u, color: sp?.color };
        const key = o.pickupItemId || o.id;
        if (o.pickupable && !m[key]) m[key] = { name: o.name, url: u, color: sp?.color };
        o.transforms?.forEach((t) => {
          if (t.grantsItem && !m[t.grantsItem]) {
            const tref = t.newSpriteId ? transformRef(t.newSpriteId) : o.spriteRef;
            m[t.grantsItem] = { name: `${o.name} ✨`, url: spriteSrc(tref, sprites, assets), color: getSprite(tref, sprites)?.color };
          }
        });
        if (o.view) walk(o.view.objects);
      }
    };
    Object.values(scenes).filter((sc) => sc.projectId === projectId).forEach((sc) => walk(sc.objects));
    return m;
  }, [scenes, projectId, assets, sprites]);

  // Group duplicates so e.g. 3 collected fuses show one icon with a ×3 counter.
  const counts = inventory.reduce<Record<string, number>>((a, id) => ((a[id] = (a[id] ?? 0) + 1), a), {});

  return (
    <div className="bg-surface border-t border-gray-700 px-3 py-2 flex items-center gap-2 min-h-[64px] overflow-x-auto" dir="rtl">
      <span className="text-xs text-gray-400 shrink-0 ml-1">🎒 کیف:</span>
      {inventory.length === 0 && <span className="text-xs text-gray-600">خالی — بگردید و آیتم پیدا کنید!</span>}
      {Object.keys(counts).map((id) => {
        const meta = itemMeta[id];
        return (
          <button
            key={id}
            onClick={() => selectItem(selectedItem === id ? null : id)}
            className={`relative shrink-0 w-12 h-12 rounded-xl border flex items-center justify-center overflow-hidden transition-all ${
              selectedItem === id ? 'border-amber-400 ring-2 ring-amber-400/50 scale-110' : 'border-gray-600 hover:border-gray-400'
            }`}
            title={meta?.name ?? itemName([], id)}
          >
            {meta?.url ? (
              <img src={meta.url} alt="" className="w-full h-full object-contain p-0.5" />
            ) : meta?.color ? (
              <div className="w-full h-full rounded-md" style={{ background: meta.color }} title={meta.name} />
            ) : (
              <span className="text-[9px] text-gray-300 px-0.5 truncate">{meta?.name ?? itemName([], id)}</span>
            )}
            {counts[id] > 1 && (
              <span className="absolute -bottom-1 -left-1 bg-amber-500 text-black text-[10px] rounded-full px-1">×{counts[id]}</span>
            )}
          </button>
        );
      })}
      {selectedItem && (
        <span className="text-[11px] text-amber-300 mr-2 shrink-0 animate-pulse">آیتم انتخاب شد — روی یک شیء کلیک کنید تا استفاده شود</span>
      )}
    </div>
  );
}
const EMPTY: string[] = [];

// ---------- Final lock ----------
function FinalLock() {
  const session = usePlayerStore((s) => s.session);
  const scenes = usePlayerStore((s) => s.scenes);
  const lockInput = usePlayerStore((s) => s.lockInput);
  const enterDigit = usePlayerStore((s) => s.enterLockDigit);
  const clearDigit = usePlayerStore((s) => s.clearLockDigit);
  const submitLock = usePlayerStore((s) => s.submitLock);
  const resetGame = usePlayerStore((s) => s.resetGame);

  if (!session) return null;
  const list = Object.values(scenes).filter((sc) => sc.projectId === session.projectId);
  const ready = allRoomsComplete(session.state, list);

  if (session.complete) {
    return (
      <div className="h-full flex items-center justify-center p-6" dir="rtl">
        <div className="text-center space-y-4 bg-surface border border-emerald-500/50 rounded-2xl p-8 max-w-md shadow-2xl">
          <div className="text-6xl">🏆</div>
          <h2 className="text-2xl font-bold text-emerald-400">تبریک! فرار موفق!</h2>
          <p className="text-sm text-gray-400">شما رمز نهایی را درست وارد کردید و اتاق فرار را تمام کردید.</p>
          <button onClick={resetGame} className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-bold">
            🔄 بازی جدید
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center p-6" dir="rtl">
      <div className="w-full max-w-sm bg-surface border border-gray-700 rounded-2xl p-6 space-y-4">
        <h2 className="font-bold">🔐 قفل خروج</h2>
        <p className="text-xs text-gray-400">
          {ready ? 'همه اتاق‌ها کامل شده‌اند! رمز نهایی را وارد کنید.' : 'ابتدا همه اتاق‌ها را کامل کنید.'}
        </p>
        <div className="flex gap-2 justify-center" dir="ltr">
          {list.map((sc) => {
            const done = session.state.completedScenes.includes(sc.id);
            return (
              <div key={sc.id} className={`w-10 h-12 rounded-lg border flex items-center justify-center text-lg font-bold ${done ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-gray-600 text-gray-600'}`}>
                {/* the lock code is each room's exit digit — not whichever digit object the player found */}
                {done ? faDigits(String(sc.exitNumber)) : '?'}
              </div>
            );
          })}
        </div>
        <div className="bg-black/40 rounded-xl py-3 text-center text-2xl tracking-[0.5em] font-mono" dir="ltr">
          {lockInput ? faDigits(lockInput) : <span className="text-gray-600 text-base">— — —</span>}
        </div>
        <div className="grid grid-cols-3 gap-2" dir="ltr">
          {'123456789'.split('').map((d) => (
            <button key={d} disabled={!ready} onClick={() => enterDigit(d)} className="py-2.5 rounded-xl bg-surface-light hover:bg-surface-lighter border border-gray-700 disabled:opacity-30 font-bold text-lg">
              {faDigits(d)}
            </button>
          ))}
          <button disabled={!ready} onClick={clearDigit} className="py-2.5 rounded-xl bg-red-900/40 hover:bg-red-800/50 border border-red-800 disabled:opacity-30 text-sm">⌫</button>
          <button disabled={!ready} onClick={() => enterDigit('0')} className="py-2.5 rounded-xl bg-surface-light hover:bg-surface-lighter border border-gray-700 disabled:opacity-30 font-bold text-lg">۰</button>
          <button disabled={!ready || !lockInput} onClick={submitLock} className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-sm font-bold">✔</button>
        </div>
      </div>
    </div>
  );
}

// ---------- Main Player ----------
export default function Player({ projectName }: { projectName: string }) {
  const loadFromStudio = usePlayerStore((s) => s.loadFromStudio);
  const session = usePlayerStore((s) => s.session);
  const scenes = usePlayerStore((s) => s.scenes);
  const assets = usePlayerStore((s) => s.assets);
  const sprites = usePlayerStore((s) => s.sprites);
  const switchScene = usePlayerStore((s) => s.switchScene);
  const [tab, setTab] = useState<'rooms' | 'exit'>('rooms');

  useEffect(() => {
    loadFromStudio();
  }, [loadFromStudio]);

  const sceneList = useMemo(
    () => (session ? Object.values(scenes).filter((sc) => sc.projectId === session.projectId) : []),
    [scenes, session]
  );
  const currentScene = session ? scenes[session.state.currentSceneId] : undefined;

  if (!session) {
    return <div className="h-full flex items-center justify-center text-gray-400" dir="rtl">در حال بارگذاری…</div>;
  }
  if (!session.started) {
    return (
      <>
        <Toast />
        <Lobby projectName={projectName} />
      </>
    );
  }

  const roomDone = (sc: Scene) => session.state.completedScenes.includes(sc.id);

  return (
    <div className="h-full flex flex-col" dir="rtl">
      <Toast />
      {/* Room tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-surface border-b border-gray-700 overflow-x-auto flex-shrink-0">
        {sceneList.map((sc, i) => (
          <button
            key={sc.id}
            onClick={() => { setTab('rooms'); switchScene(sc.id); }}
            className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap ${
              tab === 'rooms' && sc.id === session.state.currentSceneId
                ? 'bg-indigo-600 text-white'
                : roomDone(sc)
                ? 'bg-emerald-900/50 text-emerald-300 hover:bg-emerald-800/50'
                : 'bg-surface-light text-gray-300 hover:bg-surface-lighter'
            }`}
          >
            {roomDone(sc) ? '✓ ' : ''}{faDigits(String(i + 1))}. {sc.title}
          </button>
        ))}
        <button
          onClick={() => setTab('exit')}
          className={`mr-auto px-3 py-1 rounded-lg text-xs whitespace-nowrap ${tab === 'exit' ? 'bg-amber-600 text-black font-bold' : 'bg-surface-light text-amber-300 hover:bg-surface-lighter'}`}
        >
          🔐 خروج
        </button>
      </div>

      {/* Stage */}
      <div className="flex-1 min-h-0">
        {tab === 'exit' ? (
          <FinalLock />
        ) : currentScene ? (
          <SceneStage key={currentScene.id} scene={currentScene} state={session.state} assets={assets} sprites={sprites} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 text-sm" dir="rtl">اتاقی وجود ندارد — در استودیو بسازید.</div>
        )}
      </div>

      <InventoryPanel />
    </div>
  );
}
