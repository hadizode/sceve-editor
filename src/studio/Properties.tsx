import React, { useMemo, useRef } from 'react';
import { useCtx, useCurrentProject, useProjectAssets, useSprites, useStudioStore } from '../stores/store';
import { assetRef, spriteRef, blankSprite, type Pt, type SceneObject } from '../shared/types';
import { obtainableItems } from '../shared/validation';
import { fitBox, regularPolygon } from '../shared/geometry';
import { fileToImage } from '../shared/utils';
import { btnCls, Field, inputCls, ListInput, NumInput, Section } from './ui';
import { useResolved } from './konva-bits';
import { TransitionsPanel } from './Transitions';

const st = () => useStudioStore.getState();
const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

type SetFn = (p: Partial<SceneObject>, key?: string) => void;

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-gray-300 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Preview({ url }: { url: string }) {
  const src = useResolved(url);
  return (
    <div className="mt-2 w-full h-16 bg-gray-800 rounded overflow-hidden flex items-center justify-center">
      {src ? <img src={src} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-xs text-gray-500">no image</span>}
    </div>
  );
}

/**
 * Sprite picker — an object's visual is ANY image from the project's assets (or an upload), a
 * solid color, or nothing at all (invisible hotspot). There is no predefined sprite list:
 * a sprite is created on demand from the chosen asset.
 */
function SpritePicker({ value, onPick }: { value: string; onPick: (ref: string) => void }) {
  const assets = useProjectAssets();
  const sprites = useSprites();
  const file = useRef<HTMLInputElement>(null);
  const current = value.startsWith('sprite:') ? sprites[value.slice(7)] : undefined;
  const selectValue = !value ? '' : current ? (current.assetId ? current.assetId : '__blank__') : value;

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const a = st().addAsset(await fileToImage(f));
      onPick(st().useAssetSprite(assetRef(a.id), a.name));
    } catch (err) {
      alert((err as Error).message);
    }
  };

  return (
    <div className="space-y-1">
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={upload} />
      <div className="flex gap-1">
        <button className={`${btnCls} flex-1`} onClick={() => file.current?.click()}>📁 Upload</button>
        <select
          className={`${inputCls} flex-1`}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__blank__') onPick(spriteRef(st().addSprite(blankSprite('Blank')).id));
            else if (v === '') onPick('');
            else if (v.startsWith('asset:')) onPick(st().useAssetSprite(v));
            else onPick(v);
          }}
        >
          <option value="">— no image (invisible) —</option>
          <option value="__blank__">■ Color only</option>
          {assets.map((a) => (
            <option key={a.id} value={assetRef(a.id)}>🖼 {a.name}</option>
          ))}
        </select>
      </div>
      {current && (
        <div className="flex items-center gap-1 text-[11px] text-gray-400">
          <span>Color fill</span>
          <input
            type="color"
            className="w-6 h-6 bg-transparent border-0 p-0 cursor-pointer mr-auto"
            value={current.color ?? '#888888'}
            onChange={(e) => st().updateSprite(current.id, { color: e.target.value })}
            title="Solid color fill (works without any image)"
          />
          {current.color && (
            <button
              className="text-red-400"
              title="Clear color"
              onClick={() => st().updateSprite(current.id, { color: undefined })}
            >✕</button>
          )}
        </div>
      )}
      <Preview url={value} />
    </div>
  );
}

/**
 * Geometry: ONE box. The image always fills it, so resizing the box resizes the sprite.
 * Rotation pivots on the box centre; flips mirror around it.
 */
function TransformSection({ obj, set }: { obj: SceneObject; set: SetFn }) {
  const src = useResolved(obj.spriteRef);
  const fit = () => {
    const i = new Image();
    i.onload = () => i.naturalWidth && set(fitBox(obj, { width: i.naturalWidth, height: i.naturalHeight }), `${obj.id}:fit`);
    i.src = src;
  };
  return (
    <Section title="📐 Transform" color="text-cyan-300">
      <div className="grid grid-cols-2 gap-2">
        <Field label="X"><NumInput value={r1(obj.x)} onChange={(n) => set({ x: n })} /></Field>
        <Field label="Y"><NumInput value={r1(obj.y)} onChange={(n) => set({ y: n })} /></Field>
        <Field label="Width"><NumInput value={r1(obj.width)} min={1} onChange={(n) => set({ width: Math.max(1, n) })} /></Field>
        <Field label="Height"><NumInput value={r1(obj.height)} min={1} onChange={(n) => set({ height: Math.max(1, n) })} /></Field>
      </div>
      <Field label="Rotation (deg)"><NumInput value={r1(obj.rotation)} onChange={(n) => set({ rotation: n })} /></Field>
      <div className="flex flex-wrap gap-1">
        <button className={`${btnCls} ${obj.flipX ? '!bg-primary text-white' : ''}`} onClick={() => set({ flipX: obj.flipX ? undefined : true })}>⇋ Flip H</button>
        <button className={`${btnCls} ${obj.flipY ? '!bg-primary text-white' : ''}`} onClick={() => set({ flipY: obj.flipY ? undefined : true })}>⇅ Flip V</button>
        <button className={btnCls} disabled={!src} title="Resize the box to the image's natural size (centre stays)" onClick={fit}>Image size</button>
      </div>
    </Section>
  );
}

/**
 * Hit shape: what counts as a click. Always relative to the box (percent), so it keeps its shape
 * when the box is resized, rotated or flipped.
 */
function HitSection({ obj, set }: { obj: SceneObject; set: SetFn }) {
  const pts = obj.hit?.kind === 'polygon' ? obj.hit.points : null;
  const setPts = (next: Pt[] | null) =>
    set({ hit: next && next.length >= 3 ? { kind: 'polygon', points: next } : undefined }, `${obj.id}:hit`);
  const movePt = (i: number, p: Pt) => setPts((pts ?? []).map((q, j) => (j === i ? p : q)));
  const addAfter = (i: number) => {
    if (!pts) return;
    const a = pts[i], b = pts[(i + 1) % pts.length];
    setPts([...pts.slice(0, i + 1), { x: r3((a.x + b.x) / 2), y: r3((a.y + b.y) / 2) }, ...pts.slice(i + 1)]);
  };
  const removeAt = (i: number) => pts && pts.length > 3 && setPts(pts.filter((_, j) => j !== i));
  const pct = (n: number) => Math.min(100, Math.max(0, n)) / 100;
  return (
    <Section title="🎯 Hit shape (click area)" color="text-fuchsia-300">
      <Field label="Shape">
        <select
          className={inputCls}
          value={pts ? 'polygon' : 'box'}
          onChange={(e) => setPts(e.target.value === 'polygon' ? regularPolygon(4) : null)}
        >
          <option value="box">Box (whole sprite)</option>
          <option value="polygon">Polygon</option>
        </select>
      </Field>
      {!pts ? (
        <p className="text-xs text-gray-500">The whole box is clickable. Choose Polygon to cut the click area to a custom shape.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1">
            <button className={btnCls} onClick={() => setPts([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])}>▭ Box</button>
            <button className={btnCls} onClick={() => setPts(regularPolygon(3))}>△ Triangle</button>
            <button className={btnCls} onClick={() => setPts(regularPolygon(5))}>⬠ Pentagon</button>
            <button className={btnCls} onClick={() => setPts(regularPolygon(6))}>⬡ Hexagon</button>
            <button className={btnCls} onClick={() => setPts(regularPolygon(8))}>Octagon</button>
          </div>
          <p className="text-xs text-gray-400">{pts.length} points · drag the cyan dots on the canvas or edit below (% of the box)</p>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {pts.map((p, i) => (
              <div key={i} className="flex items-center gap-1 bg-surface-light rounded px-1 py-1">
                <span className="text-[10px] text-gray-400 w-6 shrink-0">P{i + 1}</span>
                <NumInput value={r1(p.x * 100)} min={0} max={100} onChange={(n) => movePt(i, { ...p, x: r3(pct(n)) })} />
                <NumInput value={r1(p.y * 100)} min={0} max={100} onChange={(n) => movePt(i, { ...p, y: r3(pct(n)) })} />
                <button className={`${btnCls} shrink-0`} disabled={pts.length <= 3} title="Remove point" onClick={() => removeAt(i)}>−</button>
                <button className={`${btnCls} shrink-0`} title="Add a point after this one" onClick={() => addAfter(i)}>+</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
}

function MultiPanel({ objs }: { objs: SceneObject[] }) {
  const ids = objs.map((o) => o.id);
  const all = (patch: Partial<SceneObject>) => st().updateObjects(Object.fromEntries(ids.map((i) => [i, patch])));
  const align = (m: Parameters<ReturnType<typeof st>['alignObjects']>[0], label: string) => (
    <button key={m} className={btnCls} onClick={() => st().alignObjects(m)}>{label}</button>
  );
  return (
    <div className="p-3 space-y-3 text-sm">
      <h3 className="font-bold text-indigo-300">{objs.length} objects selected</h3>
      <Section title="Align" color="text-gray-300">
        <div className="flex flex-wrap gap-1">
          {align('left', '⇤ Left')}{align('hcenter', '↔ Center')}{align('right', 'Right ⇥')}
          {align('top', '⤒ Top')}{align('vmiddle', '↕ Middle')}{align('bottom', 'Bottom ⤓')}
          {align('hdist', '⇹ Distribute H')}{align('vdist', '⇳ Distribute V')}
        </div>
      </Section>
      <Section title="Order" color="text-gray-300">
        <div className="flex flex-wrap gap-1">
          <button className={btnCls} onClick={() => st().orderObjects(ids, 'top')}>To front</button>
          <button className={btnCls} onClick={() => st().orderObjects(ids, 'up')}>Forward</button>
          <button className={btnCls} onClick={() => st().orderObjects(ids, 'down')}>Backward</button>
          <button className={btnCls} onClick={() => st().orderObjects(ids, 'bottom')}>To back</button>
        </div>
      </Section>
      <Section title="State" color="text-gray-300">
        <div className="flex flex-wrap gap-1">
          <button className={btnCls} onClick={() => all({ visible: true })}>Show all</button>
          <button className={btnCls} onClick={() => all({ visible: false })}>Hide all</button>
          <button className={btnCls} onClick={() => all({ locked: true })}>Lock</button>
          <button className={btnCls} onClick={() => all({ locked: false })}>Unlock</button>
        </div>
      </Section>
      <button className="w-full bg-red-700 hover:bg-red-600 text-white px-2 py-1.5 rounded text-xs" onClick={() => st().deleteObjects(ids)}>
        Delete selected
      </button>
    </div>
  );
}

function ViewPanel() {
  const ctx = useCtx();
  const viewOf = useStudioStore((s) => s.editingViewOf);
  const view = ctx?.view;
  if (!view || !viewOf) {
    return <div className="p-4 text-gray-400 text-sm">Select an object to edit its properties</div>;
  }
  const upd = (patch: Partial<typeof view>, key: string) => st().updateView(viewOf, patch, `view-${key}`);
  return (
    <div className="p-3 space-y-3 text-sm">
      <h3 className="font-bold text-amber-300">🔍 View settings</h3>
      <Field label="Title">
        <input className={inputCls} dir="rtl" lang="fa" value={view.title} onChange={(e) => upd({ title: e.target.value }, 'title')} />
      </Field>
      <Field label="Message when closed">
        <input className={inputCls} dir="rtl" lang="fa" value={view.closeMessage ?? ''} onChange={(e) => upd({ closeMessage: e.target.value || undefined }, 'close')} />
      </Field>
      <Field label="Items required to open">
        <ListInput value={view.requiresItem} onChange={(v) => upd({ requiresItem: v }, 'req')} placeholder="item-a, item-b" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Width"><NumInput value={view.width} min={50} onChange={(n) => upd({ width: Math.max(50, n) }, 'w')} /></Field>
        <Field label="Height"><NumInput value={view.height} min={50} onChange={(n) => upd({ height: Math.max(50, n) }, 'h')} /></Field>
      </div>
      <p className="text-xs text-gray-500">Add objects to this view with the buttons on the left. Click empty canvas to see these settings.</p>
      <button className={`${btnCls} w-full`} onClick={() => st().exitView()}>← Back to room</button>
    </div>
  );
}

export function PropertiesPanel() {
  const ctx = useCtx();
  const ids = useStudioStore((s) => s.selectedObjectIds);
  const viewOf = useStudioStore((s) => s.editingViewOf);
  const project = useCurrentProject();
  const scenes = useStudioStore((s) => s.scenes);

  const selected = useMemo(() => (ctx ? ctx.objects.filter((o) => ids.includes(o.id)) : []), [ctx, ids]);
  const items = useMemo(
    () => Array.from(obtainableItems((project?.scenes ?? []).map((id) => scenes[id]).filter(Boolean))).sort(),
    [project, scenes]
  );

  if (selected.length === 0) return <ViewPanel />;
  if (selected.length > 1) return <MultiPanel objs={selected} />;

  const obj = selected[0];
  const set: SetFn = (patch, key) => st().updateObject(obj.id, patch, key ?? `${obj.id}:${Object.keys(patch).join()}`);

  return (
    <div className="p-3 space-y-3 text-sm">
      <datalist id="item-ids">{items.map((i) => <option key={i} value={i} />)}</datalist>
      <h3 className="font-bold text-indigo-300 text-base">Sprite</h3>

      <Field label="Name">
        <input className={inputCls} value={obj.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Image">
        <SpritePicker value={obj.spriteRef} onPick={(ref) => set({ spriteRef: ref }, `${obj.id}:sprite`)} />
      </Field>

      <TransformSection obj={obj} set={set} />
      <HitSection obj={obj} set={set} />

      <Field label="Message (shown on click)">
        <textarea className={inputCls} dir="rtl" lang="fa" rows={2} value={obj.message ?? ''} onChange={(e) => set({ message: e.target.value || undefined })} />
      </Field>
      <Field label="Digit (optional)">
        <select className={inputCls} value={obj.digit ?? ''} onChange={(e) => set({ digit: e.target.value === '' ? undefined : Number(e.target.value) })}>
          <option value="">—</option>
          {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </Field>

      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <Check label="Visible" checked={obj.visible} onChange={(v) => set({ visible: v })} />
        <Check label="Locked" checked={obj.locked} onChange={(v) => set({ locked: v })} />
        <Check label="One-time use" checked={obj.oneTimeUse} onChange={(v) => set({ oneTimeUse: v })} />
      </div>

      <Field label="Requires items (comma separated)">
        <ListInput value={obj.requiresItem} onChange={(v) => set({ requiresItem: v }, `${obj.id}:req`)} />
      </Field>
      <Field label="Grants item">
        <input className={inputCls} list="item-ids" value={obj.grantsItem ?? ''} onChange={(e) => set({ grantsItem: e.target.value || undefined })} />
      </Field>
      <Field label="Sound URL">
        <input className={inputCls} value={obj.soundUrl ?? ''} onChange={(e) => set({ soundUrl: e.target.value || undefined })} />
      </Field>

      <div className="flex flex-wrap gap-1">
        <button className={btnCls} onClick={() => st().orderObjects([obj.id], 'top')}>To front</button>
        <button className={btnCls} onClick={() => st().orderObjects([obj.id], 'up')}>Forward</button>
        <button className={btnCls} onClick={() => st().orderObjects([obj.id], 'down')}>Backward</button>
        <button className={btnCls} onClick={() => st().orderObjects([obj.id], 'bottom')}>To back</button>
      </div>

      <Section title="🎒 Pickup" color="text-green-300">
        <Check label="Pickupable (goes to inventory)" checked={!!obj.pickupable} onChange={(v) => set({ pickupable: v || undefined })} />
        {obj.pickupable && (
          <>
            <Field label="Item ID (defaults to object id)">
              <input className={inputCls} value={obj.pickupItemId ?? ''} placeholder="e.g. wire-cutter" onChange={(e) => set({ pickupItemId: e.target.value || undefined })} />
            </Field>
            <Field label="Pickup message">
              <textarea className={inputCls} dir="rtl" lang="fa" rows={2} value={obj.pickupMessage ?? ''} onChange={(e) => set({ pickupMessage: e.target.value || undefined })} />
            </Field>
          </>
        )}
      </Section>

      {/* Transforms / effects / doors live in their own dedicated panel — see studio/Transitions.tsx */}
      <TransitionsPanel obj={obj} set={set} />

      <Section title="🔍 Interactive view" color="text-amber-300">
        {obj.view ? (
          <>
            <p className="text-xs text-gray-400">“{obj.view.title}” • {obj.view.objects.length} object(s)</p>
            <button className="w-full bg-amber-700 hover:bg-amber-600 text-white px-2 py-1.5 rounded text-xs" onClick={() => st().enterView(obj.id)}>
              ✏️ Edit view contents
            </button>
            <button className="w-full bg-red-800 hover:bg-red-700 text-white px-2 py-1 rounded text-xs" onClick={() => confirm('Remove this view and everything inside it?') && st().removeView(obj.id)}>
              Remove view
            </button>
          </>
        ) : (
          <button className="w-full bg-amber-700 hover:bg-amber-600 text-white px-2 py-1.5 rounded text-xs" onClick={() => st().addView(obj.id)}>
            + Add interactive view
          </button>
        )}
      </Section>

      <button className="w-full bg-red-700 hover:bg-red-600 text-white px-2 py-1.5 rounded text-xs mt-2" onClick={() => st().deleteObjects([obj.id])}>
        Delete sprite
      </button>
      {viewOf && null}
    </div>
  );
}
