import React, { useMemo, useRef } from 'react';
import {
  useCtx,
  useCurrentProject,
  useProjectAssets,
  useScene,
  useStudioStore,
} from '../stores/store';
import { assetRef, TYPE_COLORS, type BackgroundLayer } from '../shared/types';
import { validateProject, type Issue } from '../shared/validation';
import { fileToImage, uid } from '../shared/utils';
import { btnCls, Field, inputCls, NumInput } from './ui';
import { useResolved } from './konva-bits';

const st = () => useStudioStore.getState();

function Thumb({ url, className = '' }: { url: string; className?: string }) {
  const src = useResolved(url);
  return src ? <img src={src} alt="" className={`object-contain ${className}`} /> : <div className={`bg-gray-800 ${className}`} />;
}

async function pickImages(e: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files ?? []);
  e.target.value = '';
  const out = [];
  for (const f of files) {
    try {
      out.push(await fileToImage(f));
    } catch (err) {
      alert(`${f.name}: ${(err as Error).message}`);
    }
  }
  return out;
}

// ============ Rooms ============
export function RoomsPanel() {
  const project = useCurrentProject();
  const scenes = useStudioStore((s) => s.scenes);
  const cur = useStudioStore((s) => s.currentSceneId);
  if (!project) return null;
  return (
    <div className="p-3 border-b border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-gray-400">Rooms</h3>
        <span className="text-xs text-amber-300 font-mono" title="Final lock code (from each room's exit digit)">🔐 {project.finalLockDigits}</span>
      </div>
      <div className="space-y-1">
        {project.scenes.map((id, i) => {
          const s = scenes[id];
          if (!s) return null;
          return (
            <div
              key={id}
              className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs ${id === cur ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              onClick={() => st().selectScene(id)}
            >
              <span className="flex-1 truncate">{i + 1}. {s.title}</span>
              <button className="px-1 opacity-70 hover:opacity-100 disabled:opacity-20" disabled={i === 0} title="Move up" onClick={(e) => { e.stopPropagation(); st().moveScene(id, -1); }}>↑</button>
              <button className="px-1 opacity-70 hover:opacity-100 disabled:opacity-20" disabled={i === project.scenes.length - 1} title="Move down" onClick={(e) => { e.stopPropagation(); st().moveScene(id, 1); }}>↓</button>
              <button className="px-1 opacity-70 hover:opacity-100" title="Duplicate" onClick={(e) => { e.stopPropagation(); st().duplicateScene(id); }}>⧉</button>
              <button className="px-1 text-red-300 opacity-70 hover:opacity-100" title="Delete" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete room "${s.title}"?`)) st().deleteScene(id); }}>✕</button>
            </div>
          );
        })}
      </div>
      <button className="w-full mt-2 bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded text-xs" onClick={() => st().addScene()}>+ Room</button>
    </div>
  );
}

const PRESETS = ['800×600', '1024×768', '1280×720', '1920×1080', '1080×1920'];

export function RoomProps() {
  const scene = useScene();
  if (!scene) return null;
  const upd = (patch: Partial<typeof scene>, key: string) => st().updateScene(patch, `room-${key}`);
  return (
    <div className="p-3 border-b border-gray-700 space-y-2">
      <h3 className="text-xs font-bold text-gray-400">Room properties</h3>
      <Field label="Title">
        <input className={inputCls} value={scene.title} onChange={(e) => upd({ title: e.target.value }, 'title')} />
      </Field>
      <Field label="Exit digit (part of final code)">
        <select className={inputCls} value={scene.exitNumber} onChange={(e) => upd({ exitNumber: Number(e.target.value) }, 'exit')}>
          {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width"><NumInput value={scene.width} min={100} onChange={(n) => upd({ width: Math.max(100, Math.round(n)) }, 'w')} /></Field>
        <Field label="Height"><NumInput value={scene.height} min={100} onChange={(n) => upd({ height: Math.max(100, Math.round(n)) }, 'h')} /></Field>
      </div>
      <select
        className={inputCls}
        value=""
        onChange={(e) => {
          const [w, h] = e.target.value.split('×').map(Number);
          if (w && h) st().updateScene({ width: w, height: h });
        }}
      >
        <option value="">Size preset…</option>
        {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </div>
  );
}

// ============ Background ============
export function BackgroundPanel() {
  const ctx = useCtx();
  const assets = useProjectAssets();
  const file = useRef<HTMLInputElement>(null);
  const label = ctx?.view ? 'View background' : 'Background';
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const [img] = await pickImages(e);
    if (!img) return;
    const a = st().addAsset(img);
    st().setBackground(assetRef(a.id), img.width, img.height);
  };
  return (
    <div className="p-3 border-b border-gray-700 space-y-2">
      <h3 className="text-xs font-bold text-gray-400">{label}</h3>
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={upload} />
      <button className={`${btnCls} w-full`} onClick={() => file.current?.click()}>📁 Upload image (sets size)</button>
      <select
        className={inputCls}
        value=""
        onChange={(e) => {
          const a = assets.find((x) => x.id === e.target.value);
          if (a) st().setBackground(assetRef(a.id), a.width, a.height);
        }}
      >
        <option value="">Pick from assets…</option>
        {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {ctx?.backgroundUrl && (
        <button className={`${btnCls} w-full`} onClick={() => ctx && st().setBackground('', ctx.width, ctx.height)}>Clear background</button>
      )}
    </div>
  );
}

// ============ Layers (objects + background layers) ============
function BackgroundLayers() {
  const scene = useScene();
  const assets = useProjectAssets();
  const file = useRef<HTMLInputElement>(null);
  if (!scene) return null;
  const layers = scene.backgroundLayers;
  const save = (next: BackgroundLayer[], key?: string) => st().updateScene({ backgroundLayers: next }, key);
  const patch = (id: string, p: Partial<BackgroundLayer>, key?: string) => save(layers.map((l) => (l.id === id ? { ...l, ...p } : l)), key);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= layers.length) return;
    const n = [...layers];
    [n[i], n[j]] = [n[j], n[i]];
    save(n);
  };
  const add = (ref: string, name: string) =>
    save([...layers, { id: uid('bg'), name, spriteRef: ref, opacity: 1, visible: true, offsetX: 0, offsetY: 0 }]);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const img of await pickImages(e)) add(st().useAssetSprite(assetRef(st().addAsset(img).id), img.name), img.name);
  };
  return (
    <div className="mt-3 pt-3 border-t border-gray-700">
      <h4 className="text-xs font-bold text-cyan-300 mb-2">Background layers (above the base image)</h4>
      <div className="space-y-2">
        {layers.map((l, i) => (
          <div key={l.id} className="bg-surface-light rounded p-2 space-y-1">
            <div className="flex items-center gap-1">
              <Thumb url={l.spriteRef} className="w-8 h-8 rounded" />
              <input className={`${inputCls} flex-1`} value={l.name} onChange={(e) => patch(l.id, { name: e.target.value }, `bg-${l.id}-n`)} />
              <button className="px-1" title="Toggle" onClick={() => patch(l.id, { visible: !l.visible })}>{l.visible ? '👁' : '🚫'}</button>
              <button className="px-1" onClick={() => move(i, -1)}>↑</button>
              <button className="px-1" onClick={() => move(i, 1)}>↓</button>
              <button className="px-1 text-red-400" onClick={() => save(layers.filter((x) => x.id !== l.id))}>✕</button>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              Opacity
              <input type="range" min={0} max={1} step={0.05} value={l.opacity} className="flex-1" onChange={(e) => patch(l.id, { opacity: Number(e.target.value) }, `bg-${l.id}-o`)} />
              <span className="w-8 text-right">{Math.round(l.opacity * 100)}%</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs">
              <NumInput value={l.offsetX} onChange={(n) => patch(l.id, { offsetX: n }, `bg-${l.id}-x`)} />
              <NumInput value={l.offsetY} onChange={(n) => patch(l.id, { offsetY: n }, `bg-${l.id}-y`)} />
            </div>
          </div>
        ))}
      </div>
      <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
      <div className="flex gap-1 mt-2">
        <button className={`${btnCls} flex-1`} onClick={() => file.current?.click()}>+ Upload layer</button>
        <select className={`${inputCls} flex-1`} value="" onChange={(e) => { const a = assets.find((x) => x.id === e.target.value); if (a) add(st().useAssetSprite(assetRef(a.id), a.name), a.name); }}>
          <option value="">From assets…</option>
          {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
    </div>
  );
}

export function LayersPanel() {
  const ctx = useCtx();
  const selected = useStudioStore((s) => s.selectedObjectIds);
  if (!ctx) return null;
  const rows = [...ctx.objects].reverse(); // top of list = front
  return (
    <div className="p-3">
      <h3 className="font-bold text-indigo-300 mb-2 text-sm">Layers <span className="text-xs text-gray-500">(top = front)</span></h3>
      <div className="space-y-1">
        {rows.map((o) => (
          <div
            key={o.id}
            className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-xs ${selected.includes(o.id) ? 'bg-indigo-600/30 border border-indigo-500' : 'hover:bg-gray-700 border border-transparent'}`}
            onClick={(e) => st().selectObject(o.id, e.shiftKey || e.ctrlKey || e.metaKey)}
          >
            <div className="w-2.5 h-2.5 rounded" style={{ background: TYPE_COLORS[o.type ?? 'sprite'] ?? TYPE_COLORS.sprite }} />
            <span className={`truncate flex-1 ${o.visible ? '' : 'opacity-40'}`}>{o.name}</span>
            {o.digit !== undefined && <span className="text-amber-400">{o.digit}</span>}
            {o.view && <span title="Has view">🔍</span>}
            <button title="Show/hide" onClick={(e) => { e.stopPropagation(); st().updateObject(o.id, { visible: !o.visible }); }}>{o.visible ? '👁' : '🚫'}</button>
            <button title="Lock/unlock" onClick={(e) => { e.stopPropagation(); st().updateObject(o.id, { locked: !o.locked }); }}>{o.locked ? '🔒' : '🔓'}</button>
            <button className="px-0.5" onClick={(e) => { e.stopPropagation(); st().orderObjects([o.id], 'up'); }}>↑</button>
            <button className="px-0.5" onClick={(e) => { e.stopPropagation(); st().orderObjects([o.id], 'down'); }}>↓</button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-xs text-gray-500">No objects yet</p>}
      </div>
      {!ctx.view && <BackgroundLayers />}
    </div>
  );
}

// ============ Assets ============
export function AssetsPanel() {
  const assets = useProjectAssets();
  const file = useRef<HTMLInputElement>(null);
  const selected = useStudioStore((s) => s.selectedObjectIds);
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    for (const img of await pickImages(e)) st().addAsset(img);
  };
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-cyan-300 text-sm">📁 Assets ({assets.length})</h3>
        <button className="bg-cyan-700 hover:bg-cyan-600 text-white px-2 py-0.5 rounded text-xs" onClick={() => file.current?.click()}>+ Upload</button>
        <input ref={file} type="file" accept="image/*" multiple className="hidden" onChange={upload} />
      </div>
      <p className="text-xs text-gray-500 mb-2">Drag an asset onto the canvas, or use the buttons. Images dropped on the canvas are added automatically.</p>
      <div className="grid grid-cols-2 gap-2">
        {assets.map((a) => (
          <div key={a.id} className="bg-surface-light rounded p-1.5" draggable onDragStart={(e) => e.dataTransfer.setData('application/x-asset-id', a.id)}>
            <Thumb url={assetRef(a.id)} className="w-full h-16 rounded" />
            <div className="text-[11px] text-gray-300 truncate mt-1" title={a.name}>{a.name}</div>
            <div className="flex gap-0.5 mt-1">
              <button className={`${btnCls} flex-1 px-0`} title="Add to room" onClick={() => st().addObjectFromAsset(a.id)}>＋</button>
              <button className={`${btnCls} flex-1 px-0`} title="Use on selected object" disabled={selected.length === 0} onClick={() => st().updateObjects(Object.fromEntries(selected.map((i) => [i, { spriteRef: st().useAssetSprite(assetRef(a.id), a.name) }])))}>🖼</button>
              <button className={`${btnCls} flex-1 px-0`} title="Use as background" onClick={() => st().setBackground(assetRef(a.id), a.width, a.height)}>BG</button>
              <button className={`${btnCls} flex-1 px-0 text-red-300`} title="Delete" onClick={() => { if (!st().deleteAsset(a.id)) alert('This asset is still used in the project.'); }}>🗑</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ Clue chain ============
export function ChainPanel() {
  const scene = useScene();
  const selected = useStudioStore((s) => s.selectedObjectIds);
  const viewOf = useStudioStore((s) => s.editingViewOf);
  if (!scene) return null;
  if (viewOf) return <div className="p-4 text-xs text-gray-500">Clue chains are defined on room objects. Go back to the room to edit.</div>;
  const chain = scene.clueChain;
  const save = (next: string[]) => st().updateScene({ clueChain: next });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= chain.length) return;
    const n = [...chain];
    [n[i], n[j]] = [n[j], n[i]];
    save(n);
  };
  return (
    <div className="p-3">
      <h3 className="font-bold text-indigo-300 text-sm mb-2">Clue chain</h3>
      <div className="space-y-1 mb-2">
        {chain.map((id, i) => {
          const o = scene.objects.find((x) => x.id === id);
          return (
            <div key={id} className={`flex items-center gap-1 text-xs px-1 rounded ${o ? '' : 'bg-red-900/30'}`}>
              <span className="text-gray-500 w-5">{i + 1}.</span>
              <button className="flex-1 truncate text-left hover:text-indigo-300" onClick={() => o && st().selectObjects([id])}>{o ? o.name : `⚠ missing: ${id}`}</button>
              {o?.digit !== undefined && <span className="text-amber-400">{o.digit}</span>}
              <button className="px-1" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
              <button className="px-1" disabled={i === chain.length - 1} onClick={() => move(i, 1)}>↓</button>
              <button className="px-1 text-red-400" onClick={() => save(chain.filter((_, j) => j !== i))}>×</button>
            </div>
          );
        })}
        {chain.length === 0 && <p className="text-xs text-gray-500">Empty</p>}
      </div>
      <select className={inputCls} value="" onChange={(e) => e.target.value && save([...chain, e.target.value])}>
        <option value="">+ Add to chain…</option>
        {scene.objects.filter((o) => !chain.includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {selected.length > 0 && (
        <button className={`${btnCls} w-full mt-2`} onClick={() => save([...chain, ...selected.filter((i) => !chain.includes(i) && scene.objects.some((o) => o.id === i))])}>
          Append selected objects
        </button>
      )}
    </div>
  );
}

// ============ Checks ============
export function useIssues(): Issue[] {
  const project = useCurrentProject();
  const scenes = useStudioStore((s) => s.scenes);
  const assets = useStudioStore((s) => s.assets);
  const sprites = useStudioStore((s) => s.sprites);
  // sprites MUST be passed, otherwise every `sprite:` ref is reported as missing
  return useMemo(() => (project ? validateProject(project, scenes, assets, sprites) : []), [project, scenes, assets, sprites]);
}

export function ChecksPanel() {
  const issues = useIssues();
  const jump = (i: Issue) => {
    if (i.sceneId) st().selectScene(i.sceneId);
    if (i.objectId) st().selectObjects([i.objectId]);
  };
  if (issues.length === 0) return <div className="p-4 text-sm text-green-400">✓ All checks passed</div>;
  return (
    <div className="p-3 space-y-1">
      {issues.map((i, k) => (
        <button key={k} className={`w-full text-left text-xs flex gap-1.5 rounded px-1.5 py-1 hover:bg-gray-700 ${i.level === 'error' ? 'text-red-300' : 'text-amber-300'}`} onClick={() => jump(i)}>
          <span>{i.level === 'error' ? '❌' : '⚠️'}</span>
          <span>{i.message}</span>
        </button>
      ))}
    </div>
  );
}
