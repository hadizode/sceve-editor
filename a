import React from 'react';
import { useStudioStore } from '../stores/store';
import type { SceneObject } from '../shared/types';
import { Icon, IconButton } from './icons';
import type { IconName } from './icons';
// ============ Small UI primitives ============
const inputCls =
  'bg-[#2a2a2a] border border-white/10 rounded px-1.5 py-1 text-[12px] text-gray-200 ' +
  'focus:outline-none focus:border-indigo-400/60 w-full';

const btnCls =
  'inline-flex items-center justify-center gap-1 rounded bg-[#3a3a3a] border border-white/10 ' +
  'px-2 py-1 text-[11px] text-gray-200 hover:bg-[#4a4a4a] disabled:opacity-40 disabled:pointer-events-none';

function Section({
  title,
  badge,
  right,
  children,
}: {
  title: string;
  badge?: number;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-white/5 pt-2">
      <div className="flex items-center gap-1 mb-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h4>
        {badge !== undefined && (
          <span className="rounded-full bg-white/10 px-1.5 text-[10px] leading-4 text-gray-300">{badge}</span>
        )}
        <div className="flex-1" />
        {right}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-0.5 block text-[10px] text-gray-500">{label}</label>
      {children}
    </div>
  );
}

function Thumb({ url, className }: { url?: string; className?: string }) {
  return (
    <div className={`${className ?? 'w-9 h-9'} shrink-0 overflow-hidden rounded border border-white/10 bg-black/30`}>
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain" draggable={false} />
      ) : null}
    </div>
  );
}

// ============ Geometry helpers ============
/** Regular n-gon centred at (0.5, 0.5) with radius 0.5, first vertex pointing up. */
function regularPolygon(n: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    pts.push({ x: +(0.5 + 0.5 * Math.cos(a)).toFixed(3), y: +(0.5 + 0.5 * Math.sin(a)).toFixed(3) });
  }
  return pts;
}

// Local store accessors that work on either the scene or the currently-entered view.
type St = ReturnType<typeof useStudioStore.getState>;
interface Ctx {
  set: (patch: Partial<SceneObject>) => void;
  setPts: (pts: { x: number; y: number }[]) => void;
  fit: () => void;
  src: string | undefined;
  st: () => St;
}

// ============ Single-object properties panel ============
export function PropertiesPanel() {
  const st = useStudioStore;
  const scenes = useStudioStore(s => s.scenes);
  const currentSceneId = useStudioStore(s => s.currentSceneId);
  const selectedObjectIds = useStudioStore(s => s.selectedObjectIds);
  const updateObject = useStudioStore(s => s.updateObject);

  const scene = currentSceneId ? scenes[currentSceneId] : null;
  const obj = scene?.objects.find(o => o.id === selectedObjectIds[0]);

  if (!obj) {
    return <div className="p-4 text-[12px] text-gray-400">Select an object to edit its properties</div>;
  }

  const file = React.createRef<HTMLInputElement>();

  const ctx: Ctx = {
    set: patch => updateObject(obj.id, patch),
    setPts: pts => updateObject(obj.id, { hitArea: pts.flatMap(p => [p.x * obj.width, p.y * obj.height]) }),
    src: obj.sprite?.frames?.[0] ?? obj.imageUrl,
    fit: () => {
            if (!src) return;
      const im = new window.Image();
      im.onload = () => updateObject(obj.id, { width: im.naturalWidth, height: im.naturalHeight });
      im.src = src;
    },
    st,
  };

  return (
    <div className="space-y-2 p-3 text-[12px] text-gray-200">
      {/* ── object header ── */}
      <div className="-mx-3 -mt-3 px-3 py-2 bg-[#414141] border-b border-black/60 space-y-1.5">
        <div className="flex items-center gap-2">
          <Thumb url={obj.spriteRef} className="w-9 h-9" />
          <input className={`${inputCls} !font-semibold`} aria-label="Name" value={obj.name} onChange={(e) => ctx.set({ name: e.target.value })} />
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton icon={obj.visible ? 'eye' : 'eyeOff'} title={obj.visible ? 'Visible (click to hide)' : 'Hidden (click to show)'} active={!obj.visible} onClick={() => ctx.set({ visible: !obj.visible })} />
          <IconButton icon={obj.locked ? 'lock' : 'unlock'} title={obj.locked ? 'Locked (click to unlock)' : 'Lock'} active={!!obj.locked} onClick={() => ctx.set({ locked: !obj.locked })} />
          <IconButton
            icon={obj.view ? 'search' : 'viewAdd'}
            title={obj.view ? `Edit interactive view (${obj.view.objects.length} objects)` : 'Add interactive view'}
            active={!!obj.view}
            onClick={() => (obj.view ? st().enterView(obj.id) : st().addView(obj.id))}
          />
          <div className="flex-1" />
          <IconButton icon="trash" title="Delete sprite" danger onClick={() => st().deleteObjects([obj.id])} />
        </div>
      </div>

      <input
        ref={file}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (!f) return;
          const r = new FileReader();
          r.onload = () => ctx.set({ imageUrl: r.result as string });
          r.readAsDataURL(f);
        }}
      />

      <SpritePicker obj={obj} ctx={ctx} file={file} />
      <TransformSection obj={obj} ctx={ctx} />
      <HitSection obj={obj} ctx={ctx} />
      <InteractionSection obj={obj} ctx={ctx} />
      <PickupSection obj={obj} ctx={ctx} />

      {obj.view && (
        <Section
          title="Interactive View"
          badge={obj.view.objects.length}
          right={
            <>
              <IconButton icon="pencil" title="Edit view contents" compact onClick={() => st().enterView(obj.id)} />
              <IconButton icon="trash" title="Remove view" compact danger onClick={() => confirm('Remove this view and everything inside it?') && st().removeView(obj.id)} />
            </>
          }
        >
          <p className="text-[11px] text-gray-400 truncate">{obj.view.title}</p>
        </Section>
      )}
    </div>
  );
}

// ============ Sprite picker ============
function SpritePicker({ obj, ctx, file }: { obj: SceneObject; ctx: Ctx; file: React.RefObject<HTMLInputElement> }) {
  const frames = obj.sprite?.frames ?? [];
  return (
    <Section title="Sprite" badge={frames.length || undefined}>
      <div className="flex items-center gap-1">
        <button className={`${btnCls} flex-1`} onClick={() => file.current?.click()}>
          <Icon name="upload" size={12} /> Upload image
        </button>
        <IconButton icon="upload" solid title="Upload image" onClick={() => file.current?.click()} />
      </div>
      {frames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {frames.map((f, i) => (
            <Thumb key={i} url={f} className="w-10 h-10" />
          ))}
        </div>
      )}
    </Section>
  );
}

// ============ Transform ============
function TransformSection({ obj, ctx }: { obj: SceneObject; ctx: Ctx }) {
  const { set, st } = ctx;
    const num = (v: number, nv: string) => (Number.isFinite(Number(nv)) ? Number(nv) : v);
  return (
    <Section title="Transform">
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="X"><input type="number" className={inputCls} value={Math.round(obj.x)} onChange={e => set({ x: num(obj.x, e.target.value) })} /></Field>
        <Field label="Y"><input type="number" className={inputCls} value={Math.round(obj.y)} onChange={e => set({ y: num(obj.y, e.target.value) })} /></Field>
        <Field label="Width"><input type="number" className={inputCls} value={Math.round(obj.width)} onChange={e => set({ width: Math.max(1, num(obj.width, e.target.value)) })} /></Field>
        <Field label="Height"><input type="number" className={inputCls} value={Math.round(obj.height)} onChange={e => set({ height: Math.max(1, num(obj.height, e.target.value)) })} /></Field>
        <Field label="Rotation"><input type="number" className={inputCls} value={Math.round(obj.rotation)} onChange={e => set({ rotation: num(obj.rotation, e.target.value) })} /></Field>
      </div>
      <Field label="Flip">
        <div className="flex gap-1">
          <IconButton solid icon="flipH" title="Flip horizontal" active={!!obj.flipX} className="!w-auto flex-1" onClick={() => set({ flipX: obj.flipX ? undefined : true })} />
          <IconButton solid icon="flipV" title="Flip vertical" active={!!obj.flipY} className="!w-auto flex-1" onClick={() => set({ flipY: obj.flipY ? undefined : true })} />
        </div>
      </Field>
      <Field label="Layer">
        <div className="flex gap-1">
          <IconButton solid icon="toFront" title="Bring to front" className="!w-auto flex-1" onClick={() => st().orderObjects([obj.id], 'top')} />
          <IconButton solid icon="arrowUp" title="Forward" className="!w-auto flex-1" onClick={() => st().orderObjects([obj.id], 'up')} />
          <IconButton solid icon="arrowDown" title="Backward" className="!w-auto flex-1" onClick={() => st().orderObjects([obj.id], 'down')} />
          <IconButton solid icon="toBack" title="Send to back" className="!w-auto flex-1" onClick={() => st().orderObjects([obj.id], 'bottom')} />
        </div>
      </Field>
      <button className={`${btnCls} w-full`} disabled={!ctx.src} onClick={ctx.fit}>
        <Icon name="fit" size={12} /> Set to image size
      </button>
    </Section>
  );
}

// ============ Hit area ============
function HitSection({ obj, ctx }: { obj: SceneObject; ctx: Ctx }) {
  const { setPts } = ctx;
  const pts: { x: number; y: number }[] = [];
  const ha = obj.hitArea ?? [];
  for (let i = 0; i + 1 < ha.length; i += 2) pts.push({ x: ha[i] / Math.max(1, obj.width), y: ha[i + 1] / Math.max(1, obj.height) });
  const set = ctx.set;

  const removeAt = (i: number) => {
    const next = pts.filter((_, j) => j !== i);
    setPts(next);
  };
  const addAfter = (i: number) => {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const next = [...pts];
    next.splice(i + 1, 0, mid);
    setPts(next);
  };

  return (
    <Section
      title="Hit Area"
      badge={pts.length >= 3 ? pts.length : undefined}
      right={<IconButton icon="trash" title="Reset to rectangle" compact onClick={() => set({ hitArea: undefined })} />}
    >
      <div className="flex gap-1">
        <IconButton solid icon="shapeBox" title="Box" onClick={() => setPts([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])} />
        <IconButton solid icon="shape3" title="Triangle" onClick={() => setPts(regularPolygon(3))} />
        <IconButton solid icon="shape5" title="Pentagon" onClick={() => setPts(regularPolygon(5))} />
        <IconButton solid icon="shape6" title="Hexagon" onClick={() => setPts(regularPolygon(6))} />
        <IconButton solid icon="shape8" title="Octagon" onClick={() => setPts(regularPolygon(8))} />
      </div>
      {pts.length >= 3 ? (
        <div className="space-y-1">
          {pts.map((p, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className="w-5 text-[10px] text-gray-500">#{i + 1}</span>
              <input
                type="number"
                step={0.05}
                className={inputCls}
                value={+p.x.toFixed(3)}
                onChange={e => {
                  const next = pts.map((q, j) => (j === i ? { ...q, x: Number(e.target.value) || 0 } : q));
                  setPts(next);
                }}
              />
              <input
                type="number"
                step={0.05}
                className={inputCls}
                value={+p.y.toFixed(3)}
                onChange={e => {
                  const next = pts.map((q, j) => (j === i ? { ...q, y: Number(e.target.value) || 0 } : q));
                  setPts(next);
                }}
              />
              <IconButton icon="minus" compact title="Remove point" disabled={pts.length <= 3} onClick={() => removeAt(i)} />
              <IconButton icon="plus" compact title="Add a point after this one" onClick={() => addAfter(i)} />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gray-500">No custom hit polygon — the full rectangle is clickable.</p>
      )}
    </Section>
  );
}

// ============ Interaction ============
function InteractionSection({ obj, ctx }: { obj: SceneObject; ctx: Ctx }) {
  const { set } = ctx;
  return (
    <Section title="Interaction">
      <Field label="Type">
        <select className={inputCls} value={obj.type} onChange={e => set({ type: e.target.value as SceneObject['type'] })}>
          <option value="decoration">Decoration</option>
          <option value="inventory">Inventory Item</option>
          <option value="container">Container</option>
        </select>
      </Field>
      <Field label="Message (shown on click)">
        <textarea dir="rtl" lang="fa" rows={2} className={inputCls} value={obj.message ?? ''} onChange={e => set({ message: e.target.value || undefined })} />
      </Field>
      <Field label="Digit (0-9, optional)">
        <input type="number" min={0} max={9} className={inputCls} value={obj.digit ?? ''} onChange={e => set({ digit: e.target.value ? Number(e.target.value) : undefined })} />
      </Field>
      <label className="flex items-center gap-2 text-gray-300">
        <input type="checkbox" checked={obj.oneTimeUse} onChange={e => set({ oneTimeUse: e.target.checked })} />
        One-time use
      </label>
      <Field label="Requires Items (comma-separated IDs)">
        <input className={inputCls} value={obj.requiresItem?.join(', ') ?? ''} onChange={e => set({ requiresItem: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined })} />
      </Field>
      <Field label="Grants Item (ID)">
        <input className={inputCls} value={obj.grantsItem ?? ''} onChange={e => set({ grantsItem: e.target.value || undefined })} />
      </Field>
      <label className="flex items-center gap-2 text-gray-300">
        <Icon name="check" size={12} />
        <input type="checkbox" checked={!!obj.view} onChange={() => (obj.view ? ctx.st().removeView(obj.id) : ctx.st().addView(obj.id))} />
        Has interactive view
      </label>
    </Section>
  );
}

// ============ Pickup ============
function PickupSection({ obj, ctx }: { obj: SceneObject; ctx: Ctx }) {
  const { set } = ctx;
  return (
    <Section title="Pickup">
      <label className="flex items-center gap-2 text-gray-300">
        <Icon name="check" size={12} />
        <input type="checkbox" checked={!!obj.pickupable} onChange={e => set({ pickupable: e.target.checked })} />
        Pickupable (can be added to inventory)
      </label>
      {obj.pickupable && (
        <>
          <Field label="Pickup Item ID">
            <input className={inputCls} placeholder="e.g., wire-cutter" value={obj.pickupItemId ?? ''} onChange={e => set({ pickupItemId: e.target.value || undefined })} />
          </Field>
          <Field label="Pickup Message">
            <textarea dir="rtl" lang="fa" rows={2} className={inputCls} value={obj.pickupMessage ?? ''} onChange={e => set({ pickupMessage: e.target.value || undefined })} />
          </Field>
        </>
      )}
    </Section>
  );
}

// ============ Multi-selection panel ============
export function MultiPanel() {
  const st = useStudioStore;
  const scenes = useStudioStore(s => s.scenes);
  const currentSceneId = useStudioStore(s => s.currentSceneId);
  const selectedObjectIds = useStudioStore(s => s.selectedObjectIds);

  const scene = currentSceneId ? scenes[currentSceneId] : null;
  const sel = scene?.objects.filter(o => selectedObjectIds.includes(o.id)) ?? [];
  if (sel.length < 2) return null;

  const align = (m: Parameters<ReturnType<typeof st>['alignObjects']>[0], icon: IconName, title: string) => (
    <IconButton key={m} solid icon={icon} title={title} onClick={() => st().alignObjects(m)} />
  );

  const allVisible = sel.every(o => o.visible);
  const allLocked = sel.every(o => o.locked);
  const ids = sel.map(o => o.id);

  return (
    <div className="space-y-2 p-3 text-[12px] text-gray-200">
      <div className="-mx-3 -mt-3 border-b border-black/60 bg-[#414141] px-3 py-2 font-semibold">
        {sel.length} objects selected
      </div>

      <Section title="Align">
        <div className="flex flex-wrap gap-1">
          {align('left', 'alignLeft', 'Align left')}{align('hcenter', 'alignHCenter', 'Align center')}{align('right', 'alignRight', 'Align right')}
          {align('top', 'alignTop', 'Align top')}{align('vmiddle', 'alignVMiddle', 'Align middle')}{align('bottom', 'alignBottom', 'Align bottom')}
          {align('hdist', 'distH', 'Distribute horizontally')}{align('vdist', 'distV', 'Distribute vertically')}
        </div>
      </Section>

      <Section title="Order">
        <div className="flex gap-1">
          <IconButton solid icon="toFront" title="Bring to front" className="!w-auto flex-1" onClick={() => st().orderObjects(ids, 'top')} />
          <IconButton solid icon="arrowUp" title="Forward" className="!w-auto flex-1" onClick={() => st().orderObjects(ids, 'up')} />
          <IconButton solid icon="arrowDown" title="Backward" className="!w-auto flex-1" onClick={() => st().orderObjects(ids, 'down')} />
          <IconButton solid icon="toBack" title="Send to back" className="!w-auto flex-1" onClick={() => st().orderObjects(ids, 'bottom')} />
        </div>
      </Section>

      <Section title="State">
        <div className="flex gap-1">
          <IconButton solid icon={allVisible ? 'eye' : 'eyeOff'} title={allVisible ? 'Hide all' : 'Show all'} className="!w-auto flex-1" onClick={() => sel.forEach(o => st().updateObject(o.id, { visible: !allVisible }))} />
          <IconButton solid icon={allLocked ? 'lock' : 'unlock'} title={allLocked ? 'Unlock all' : 'Lock all'} className="!w-auto flex-1" onClick={() => sel.forEach(o => st().updateObject(o.id, { locked: !allLocked }))} />
        </div>
      </Section>

      <Section title="Actions">
        <button className={`${btnCls} w-full`} onClick={() => st().deleteObjects(ids)}>
          <Icon name="trash" size={12} /> Delete {ids.length} sprites
        </button>
      </Section>
    </div>
  );
}

