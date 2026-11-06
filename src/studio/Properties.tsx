import React, { useRef } from 'react';
import { useCtx, useSpriteSrc, useStudioStore } from '../stores/store';
import { assetRef, type RotateMotion, type SceneObject } from '../shared/types';
import { fileToImage } from '../shared/utils';
import { Icon, IconButton } from './icons';
import type { IconName } from './icons';
import { DoorSection } from './Transitions';
import { NumInput } from './ui';
import {rotateBoxAboutPivot} from '../shared/geometry';

// ============ Small UI primitives ============
const inputCls =
  'bg-[#2a2a2a] border border-white/10 rounded px-1.5 py-1 text-[12px] text-gray-200 ' +
  'focus:outline-none focus:border-indigo-400/60 w-full';
const btnCls =
  'inline-flex items-center justify-center gap-1 rounded bg-[#3a3a3a] border border-white/10 ' +
  'px-2 py-1 text-[11px] text-gray-200 hover:bg-[#4a4a4a] disabled:opacity-40 disabled:pointer-events-none';

/** NOTE: always read the store lazily. `useStudioStore` itself is a React hook and must never be called from an event handler. */
const st = () => useStudioStore.getState();

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
      {url ? <img src={url} alt="" className="h-full w-full object-contain" draggable={false} /> : null}
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

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

interface Ctx {
  set: (patch: Partial<SceneObject>) => void;
  setPts: (pts: { x: number; y: number }[]) => void;
  fit: () => void;
  src: string;
  inView: boolean;
}

// ============ Single-object properties panel ============
export function PropertiesPanel() {
  const ctx0 = useCtx();
  const selectedObjectIds = useStudioStore((s) => s.selectedObjectIds);
  // The object can live in the room OR inside the interactive view that is being edited.
  const obj = ctx0?.objects.find((o) => o.id === selectedObjectIds[0]);
  const src = useSpriteSrc(obj?.spriteRef);
  const file = useRef<HTMLInputElement>(null);

  if (!obj) {
    return <div className="p-4 text-[12px] text-gray-400">Select an object to edit its properties</div>;
  }

  const inView = !!ctx0?.view;
  const set = (patch: Partial<SceneObject>) => st().updateObject(obj.id, patch);
  const ctx: Ctx = {
    set,
    setPts: (pts) => set({ hit: { kind: 'polygon', points: pts.map((p) => ({ x: clamp01(p.x), y: clamp01(p.y) })) } }),
    src,
    inView,
    fit: () => {
      if (!src) return;
      const im = new window.Image();
      im.onload = () => set({ width: im.naturalWidth, height: im.naturalHeight });
      im.src = src;
    },
  };
  const isDoor = !!obj.door;

  return (
    <div className="space-y-2 p-3 text-[12px] text-gray-200">
      {/* ── object header ── */}
      <div className="-mx-3 -mt-3 px-3 py-2 bg-[#414141] border-b border-black/60 space-y-1.5">
        <div className="flex items-center gap-2">
          <Thumb url={src} className="w-9 h-9" />
          <input className={`${inputCls} !font-semibold`} aria-label="Name" value={obj.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton icon={obj.visible ? 'eye' : 'eyeOff'} title={obj.visible ? 'Visible (click to hide)' : 'Hidden (click to show)'} active={!obj.visible} onClick={() => set({ visible: !obj.visible })} />
          <IconButton icon={obj.locked ? 'lock' : 'unlock'} title={obj.locked ? 'Locked (click to unlock)' : 'Lock'} active={!!obj.locked} onClick={() => set({ locked: !obj.locked })} />
          {!inView && !isDoor && (
            <IconButton
              icon={obj.view ? 'search' : 'viewAdd'}
              title={obj.view ? `Edit interactive view (${obj.view.objects.length} objects)` : 'Add interactive view'}
              active={!!obj.view}
              onClick={() => {
                if (!obj.view) st().addView(obj.id);
                st().enterView(obj.id);
              }}
            />
          )}
          <div className="flex-1" />
          <IconButton icon="trash" title="Delete sprite" danger onClick={() => st().deleteObjects([obj.id])} />
        </div>
      </div>

      <input
        ref={file}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const a = st().addAsset(await fileToImage(f));
            set({ spriteRef: st().useAssetSprite(assetRef(a.id), a.name) });
          } catch (err) {
            alert((err as Error).message);
          }
        }}
      />

      <SpritePicker src={src} file={file} />
      <TransformSection obj={obj} ctx={ctx} />
      <HitSection obj={obj} ctx={ctx} />
      {!isDoor && <MotionSection obj={obj} ctx={ctx} />}

      {isDoor ? (
        // A door only has door settings.
        <DoorSection obj={obj} set={set} />
      ) : (
        <>
          <InteractionSection obj={obj} ctx={ctx} />
          <PickupSection obj={obj} ctx={ctx} />
          {!inView && obj.view && (
            <Section
              title="Interactive View"
              badge={obj.view.objects.length}
              right={
                <>
                  <IconButton icon="pencil" title="Edit view (opens the View tab)" compact onClick={() => st().enterView(obj.id)} />
                  <IconButton icon="trash" title="Remove view" compact danger onClick={() => confirm('Remove this view and everything inside it?') && st().removeView(obj.id)} />
                </>
              }
            >
              <p className="text-[11px] text-gray-400 truncate">{obj.view.title}</p>
              <p className="text-[10px] text-gray-500">View settings are in the View tab.</p>
            </Section>
          )}
          {!inView && <DoorSection obj={obj} set={set} />}
        </>
      )}
    </div>
  );
}

// ============ Sprite picker ============
function SpritePicker({ src, file }: { src: string; file: React.RefObject<HTMLInputElement> }) {
  return (
    <Section title="Sprite">
      <div className="flex items-center gap-2">
        <Thumb url={src} className="w-10 h-10" />
        <button className={`${btnCls} flex-1`} onClick={() => file.current?.click()}>
          <Icon name="upload" size={12} /> Upload image
        </button>
      </div>
    </Section>
  );
}

// ============ Transform ============
function TransformSection({ obj, ctx }: { obj: SceneObject; ctx: Ctx }) {
  const { set } = ctx;
  const num = (v: number, nv: string) => (Number.isFinite(Number(nv)) ? Number(nv) : v);
  return (
    <Section title="Transform">
      <div className="grid grid-cols-2 gap-1.5">
        <Field label="X"><input type="number" className={inputCls} value={Math.round(obj.x)} onChange={(e) => set({ x: num(obj.x, e.target.value) })} /></Field>
        <Field label="Y"><input type="number" className={inputCls} value={Math.round(obj.y)} onChange={(e) => set({ y: num(obj.y, e.target.value) })} /></Field>
        <Field label="Width"><input type="number" className={inputCls} value={Math.round(obj.width)} onChange={(e) => set({ width: Math.max(1, num(obj.width, e.target.value)) })} /></Field>
        <Field label="Height"><input type="number" className={inputCls} value={Math.round(obj.height)} onChange={(e) => set({ height: Math.max(1, num(obj.height, e.target.value)) })} /></Field>
        <Field label="Rotation">
        <input type="number" className={inputCls} value={Math.round(obj.rotation)}
          onChange={(e) => set(rotateBoxAboutPivot(obj, num(obj.rotation, e.target.value)))} />
      </Field>
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
  const { setPts, set } = ctx;
  const pts = obj.hit?.kind === 'polygon' ? obj.hit.points : [];

  const removeAt = (i: number) => setPts(pts.filter((_, j) => j !== i));
  const addAfter = (i: number) => {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const next = [...pts];
    next.splice(i + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    setPts(next);
  };

  return (
    <Section
      title="Hit Area"
      badge={pts.length >= 3 ? pts.length : undefined}
      right={<IconButton icon="trash" title="Reset to rectangle" compact onClick={() => set({ hit: undefined })} />}
    >
      <div className="flex gap-1">
        <IconButton solid icon="shapeBox" title="Box (whole sprite)" onClick={() => set({ hit: undefined })} />
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
                onChange={(e) => setPts(pts.map((q, j) => (j === i ? { ...q, x: Number(e.target.value) || 0 } : q)))}
              />
              <input
                type="number"
                step={0.05}
                className={inputCls}
                value={+p.y.toFixed(3)}
                onChange={(e) => setPts(pts.map((q, j) => (j === i ? { ...q, y: Number(e.target.value) || 0 } : q)))}
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

// ============ Motion (click-to-rotate) ============
/**
 * A motion rotates the sprite around a pivot on every click (lever, door hinge, clock hand…).
 * The pivot is normalized to the object's box and may lie outside 0..1 (a hinge at x=0);
 * drag it directly on the canvas with the orange PivotHandle.
 */
function MotionSection({ obj, ctx }: { obj: SceneObject; ctx: Ctx }) {
  const { set } = ctx;
  const m = obj.motion;
  const patchMotion = (p: Partial<RotateMotion>) =>
    m && set({ motion: { ...m, ...p } }, `${obj.id}:motion`);

  return (
    <Section title="Motion">
      <label className="flex items-center gap-2 text-gray-300">
        <input
          type="checkbox"
          checked={!!m}
          onChange={(e) =>
            set(
              {
                motion: e.target.checked
                  ? { kind: 'rotate', pivot: { x: 0.5, y: 0.5 }, angle: 90, duration: 600 }
                  : undefined,
              },
              `${obj.id}:motion`
            )
          }
        />
        Rotate around a pivot when clicked
      </label>
      {m && (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <Field label="Pivot X (0..1)">
              <NumInput value={m.pivot.x} step={0.05} onChange={(n) => patchMotion({ pivot: { ...m.pivot, x: n } })} />
            </Field>
            <Field label="Pivot Y (0..1)">
              <NumInput value={m.pivot.y} step={0.05} onChange={(n) => patchMotion({ pivot: { ...m.pivot, y: n } })} />
            </Field>
            <Field label="Angle / click (°)">
              <NumInput value={m.angle} step={5} onChange={(n) => patchMotion({ angle: n })} />
            </Field>
            <Field label="Duration (ms)">
              <NumInput value={m.duration ?? 600} min={0} step={50} onChange={(n) => patchMotion({ duration: Math.max(0, n) })} />
            </Field>
            <Field label="Max clicks (0 = unlimited)">
              <NumInput value={m.maxSteps ?? 0} min={0} onChange={(n) => patchMotion({ maxSteps: Math.floor(n) > 0 ? Math.floor(n) : undefined })} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-gray-300">
            <input type="checkbox" checked={!!m.toggle} onChange={(e) => patchMotion({ toggle: e.target.checked ? true : undefined })} />
            Toggle (even clicks return to the start position)
          </label>
          <Field label="Message per rotation (optional)">
            <input dir="rtl" lang="fa" className={inputCls} value={m.message ?? ''} onChange={(e) => patchMotion({ message: e.target.value || undefined })} />
          </Field>
          <button
            className={`${btnCls} w-full`}
            title="A clock hand: 30° per click, pivot at the bottom-centre of the box"
            onClick={() =>
              set({ motion: { kind: 'rotate', pivot: { x: 0.5, y: 1 }, angle: 30, duration: 400, toggle: undefined } }, `${obj.id}:motion`)
            }
          >
            Clock hand (30°, pivot bottom-center)
          </button>
          <p className="text-[10px] text-gray-500">Tip: drag the orange pivot dot on the canvas to move the rotation centre.</p>
        </>
      )}
    </Section>
  );
}

// ============ Interaction ============
function InteractionSection({ obj, ctx }: { obj: SceneObject; ctx: Ctx }) {
  const { set } = ctx;
  return (
    <Section title="Interaction">
      <Field label="Message (shown on click)">
        <textarea dir="rtl" lang="fa" rows={2} className={inputCls} value={obj.message ?? ''} onChange={(e) => set({ message: e.target.value || undefined })} />
      </Field>
      <Field label="Digit (0-9, optional)">
        <input type="number" min={0} max={9} className={inputCls} value={obj.digit ?? ''} onChange={(e) => set({ digit: e.target.value ? Number(e.target.value) : undefined })} />
      </Field>
      <label className="flex items-center gap-2 text-gray-300">
        <input type="checkbox" checked={obj.oneTimeUse} onChange={(e) => set({ oneTimeUse: e.target.checked })} />
        One-time use
      </label>
      <Field label="Requires Items (comma-separated IDs)">
        <input className={inputCls} value={obj.requiresItem?.join(', ') ?? ''} onChange={(e) => set({ requiresItem: e.target.value ? e.target.value.split(',').map((s) => s.trim()) : undefined })} />
      </Field>
      <Field label="Grants Item (ID)">
        <input className={inputCls} value={obj.grantsItem ?? ''} onChange={(e) => set({ grantsItem: e.target.value || undefined })} />
      </Field>
    </Section>
  );
}

// ============ Pickup ============
function PickupSection({ obj, ctx }: { obj: SceneObject; ctx: Ctx }) {
  const { set } = ctx;
  return (
    <Section title="Pickup">
      <label className="flex items-center gap-2 text-gray-300">
        <input type="checkbox" checked={!!obj.pickupable} onChange={(e) => set({ pickupable: e.target.checked })} />
        Pickupable (can be added to inventory)
      </label>
      {obj.pickupable && (
        <>
          <Field label="Pickup Item ID">
            <input className={inputCls} placeholder="e.g., wire-cutter" value={obj.pickupItemId ?? ''} onChange={(e) => set({ pickupItemId: e.target.value || undefined })} />
          </Field>
          <Field label="Pickup Message">
            <textarea dir="rtl" lang="fa" rows={2} className={inputCls} value={obj.pickupMessage ?? ''} onChange={(e) => set({ pickupMessage: e.target.value || undefined })} />
          </Field>
        </>
      )}
    </Section>
  );
}

// ============ Multi-selection panel ============
export function MultiPanel() {
  const ctx0 = useCtx();
  const selectedObjectIds = useStudioStore((s) => s.selectedObjectIds);
  const sel = ctx0?.objects.filter((o) => selectedObjectIds.includes(o.id)) ?? [];

  if (sel.length < 2) return null;

  const align = (m: Parameters<ReturnType<typeof st>['alignObjects']>[0], icon: IconName, title: string) => (
    <IconButton key={m} solid icon={icon} title={title} onClick={() => st().alignObjects(m)} />
  );

  const allVisible = sel.every((o) => o.visible);
  const allLocked = sel.every((o) => o.locked);
  const ids = sel.map((o) => o.id);

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
          <IconButton solid icon={allVisible ? 'eye' : 'eyeOff'} title={allVisible ? 'Hide all' : 'Show all'} className="!w-auto flex-1" onClick={() => st().updateObjects(Object.fromEntries(ids.map((i) => [i, { visible: !allVisible }])))} />
          <IconButton solid icon={allLocked ? 'lock' : 'unlock'} title={allLocked ? 'Unlock all' : 'Lock all'} className="!w-auto flex-1" onClick={() => st().updateObjects(Object.fromEntries(ids.map((i) => [i, { locked: !allLocked }])))} />
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
