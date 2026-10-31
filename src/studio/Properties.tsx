import React, { useMemo, useRef } from 'react';
import { useCtx, useCurrentProject, useProjectAssets, useSprites, useStudioStore } from '../stores/store';
import { assetRef, spriteRef, blankSprite, type SceneObject, type TransformRule } from '../shared/types';
import { obtainableItems } from '../shared/validation';
import { fitScale } from '../shared/geometry';
import { fileToImage } from '../shared/utils';
import { btnCls, Field, inputCls, ListInput, NumInput, Section } from './ui';
import { useResolved } from './konva-bits';

const st = () => useStudioStore.getState();
const r1 = (n: number) => Math.round(n * 10) / 10;

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
  // The dropdown shows what is CURRENTLY selected (it used to be bound to the sprite ref, which never matched an option).
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
 * Image transform: the image is drawn at its NATURAL size x these values, independent of the frame
 * (it may extend past the frame and is never clipped). Also the hit-area mode for the Player.
 */
function ImageSection({ obj, set }: { obj: SceneObject; set: (p: Partial<SceneObject>, key?: string) => void }) {
  const src = useResolved(obj.spriteRef);
  const fit = () => {
    const i = new Image();
    i.onload = () => i.naturalWidth && set(fitScale(obj, { width: i.naturalWidth, height: i.naturalHeight }));
    i.src = src;
  };
  const num = (k: 'scaleX' | 'scaleY' | 'imageOffsetX' | 'imageOffsetY', d: number) => (
    <NumInput
      value={r1(obj[k] ?? d)}
      step={k.startsWith('scale') ? 0.05 : 1}
      onChange={(n) => set({ [k]: k.startsWith('scale') && n === 0 ? d : n } as Partial<SceneObject>)}
    />
  );
  return (
    <Section title="🖼 Image (true size)" color="text-cyan-300">
      <p className="text-xs text-gray-500">Drawn at natural size × scale. It may extend past the frame and is never clipped.</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Scale X">{num('scaleX', 1)}</Field>
        <Field label="Scale Y">{num('scaleY', 1)}</Field>
        <Field label="Offset X">{num('imageOffsetX', 0)}</Field>
        <Field label="Offset Y">{num('imageOffsetY', 0)}</Field>
      </div>
      <div className="flex flex-wrap gap-1">
        <button className={btnCls} onClick={() => set({ scaleX: -(obj.scaleX ?? 1) })}>⇋ Flip H</button>
        <button className={btnCls} onClick={() => set({ scaleY: -(obj.scaleY ?? 1) })}>⇅ Flip V</button>
        <button className={btnCls} onClick={() => set({ scaleX: undefined, scaleY: undefined, imageOffsetX: undefined, imageOffsetY: undefined })}>Natural size</button>
        <button className={btnCls} disabled={!src} onClick={fit}>Fit to frame</button>
      </div>
      <Field label="Hit area">
        <select className={inputCls} value={obj.hitArea ?? 'frame'} onChange={(e) => set({ hitArea: e.target.value === 'image' ? 'image' : undefined })}>
          <option value="frame">Frame (default)</option>
          <option value="image">Image shape</option>
        </select>
      </Field>
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
  const assets = useProjectAssets();
  const sprites = useSprites();

  const selected = useMemo(() => (ctx ? ctx.objects.filter((o) => ids.includes(o.id)) : []), [ctx, ids]);
  const items = useMemo(
    () => Array.from(obtainableItems((project?.scenes ?? []).map((id) => scenes[id]).filter(Boolean))).sort(),
    [project, scenes]
  );

  if (selected.length === 0) return <ViewPanel />;
  if (selected.length > 1) return <MultiPanel objs={selected} />;

  const obj = selected[0];
  const set = (patch: Partial<SceneObject>, key?: string) => st().updateObject(obj.id, patch, key ?? `${obj.id}:${Object.keys(patch).join()}`);
  const ts = obj.transforms ?? [];
  const setT = (i: number, patch: Partial<TransformRule>) =>
    set({ transforms: ts.map((t, j) => (j === i ? { ...t, ...patch } : t)) }, `${obj.id}:tf${i}:${Object.keys(patch)[0]}`);

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

      <ImageSection obj={obj} set={set} />

      <div className="grid grid-cols-2 gap-2">
        <Field label="X"><NumInput value={r1(obj.x)} onChange={(n) => set({ x: n })} /></Field>
        <Field label="Y"><NumInput value={r1(obj.y)} onChange={(n) => set({ y: n })} /></Field>
        <Field label="Frame width"><NumInput value={r1(obj.width)} min={1} onChange={(n) => set({ width: Math.max(1, n) })} /></Field>
        <Field label="Frame height"><NumInput value={r1(obj.height)} min={1} onChange={(n) => set({ height: Math.max(1, n) })} /></Field>
      </div>
      <Field label="Rotation (deg)"><NumInput value={r1(obj.rotation)} onChange={(n) => set({ rotation: n })} /></Field>

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

      <Section title="🔄 Transforms" color="text-purple-300">
        <p className="text-xs text-gray-500">Rules run in order: rule 2 only applies after rule 1.</p>
        {ts.map((t, i) => (
          <div key={i} className="bg-surface-light rounded p-2 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-purple-300">Rule {i + 1}</span>
              <button className="text-red-400 hover:text-red-300" onClick={() => set({ transforms: ts.length > 1 ? ts.filter((_, j) => j !== i) : undefined })}>✕</button>
            </div>
            <Field label="Requires item">
              <input className={inputCls} list="item-ids" value={t.requiresItem} onChange={(e) => setT(i, { requiresItem: e.target.value })} />
            </Field>
            <Field label="New image (after transform)">
              <div className="flex gap-1">
                <select
                  className={inputCls}
                  value={t.newSpriteId ? sprites[t.newSpriteId]?.assetId ?? '' : ''}
                  onChange={(e) => setT(i, { newSpriteId: e.target.value ? st().useAssetSprite(e.target.value).slice(7) : undefined })}
                >
                  <option value="">(unchanged)</option>
                  {assets.map((a) => <option key={a.id} value={assetRef(a.id)}>🖼 {a.name}</option>)}
                </select>
                <button className={btnCls} title="Upload a new image as the post-transform sprite" onClick={async () => {
                  const inp = document.createElement('input');
                  inp.type = 'file'; inp.accept = 'image/*';
                  inp.onchange = async () => {
                    const f = inp.files?.[0];
                    if (!f) return;
                    try {
                      const a = st().addAsset(await fileToImage(f));
                      setT(i, { newSpriteId: st().useAssetSprite(assetRef(a.id), a.name).slice(7) });
                    } catch (err) { alert((err as Error).message); }
                  };
                  inp.click();
                }}>📁</button>
              </div>
            </Field>
            <Field label="New name">
              <input className={inputCls} dir="rtl" lang="fa" value={t.newName ?? ''} onChange={(e) => setT(i, { newName: e.target.value || undefined })} />
            </Field>
            <Field label="New message">
              <input className={inputCls} dir="rtl" lang="fa" value={t.newMessage ?? ''} onChange={(e) => setT(i, { newMessage: e.target.value || undefined })} />
            </Field>
            <Field label="Grants item">
              <input className={inputCls} list="item-ids" value={t.grantsItem ?? ''} onChange={(e) => setT(i, { grantsItem: e.target.value || undefined })} />
            </Field>
            <Check label="Consumes item" checked={t.consumesItem !== false} onChange={(v) => setT(i, { consumesItem: v })} />
            <Check label="Counts as discovery" checked={!!t.triggersDiscovery} onChange={(v) => setT(i, { triggersDiscovery: v })} />
          </div>
        ))}
        <button className="w-full bg-purple-700 hover:bg-purple-600 text-white px-2 py-1.5 rounded text-xs" onClick={() => set({ transforms: [...ts, { requiresItem: '', consumesItem: true }] })}>
          + Add transform rule
        </button>
      </Section>

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
