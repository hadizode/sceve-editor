import React, { useMemo, useRef } from 'react';
import { useCtx, useCurrentProject, useProjectAssets, useSprites, useStudioStore } from '../stores/store';
import { assetRef, spriteRef, transformRef, blankSprite, type SceneObject, type Sprite, type TransformEffect, type TransformRule } from '../shared/types';
import { btnCls, Field, inputCls, ListInput, NumInput, Section } from './ui';
import { useResolved } from './konva-bits';
import { fileToImage } from '../shared/utils';

const st = () => useStudioStore.getState();

/**
 * The Transitions section is a strong, SEPARATE part of the studio: transforms are not just
 * "this object changes" — each rule (and each pickup) can fire EFFECTS that reach outside:
 *  - automatically apply a transform on ANOTHER object (even in another room)
 *  - change another room's (or a close-up view's) BACKGROUND
 *  - open a DOOR so the player can walk into another room
 * Doors themselves are configured here too: an object with a `door` target takes the player
 * to another room when clicked (optionally gated by items or opened by an effect).
 */

// ---------- small helpers ----------
function shortName(s?: string) {
  return (s || '').length > 26 ? s!.slice(0, 24) + '…' : s || '';
}

/** Every object in every scene of the project, addressable as `sceneId|objectId`. */
function useProjectObjects(): { key: string; sceneTitle: string; objTitle: string; obj: SceneObject }[] {
  const project = useCurrentProject();
  const scenes = useStudioStore((s) => s.scenes);
  return useMemo(() => {
    const out: { key: string; sceneTitle: string; objTitle: string; obj: SceneObject }[] = [];
    for (const sc of (project?.scenes ?? []).map((id) => scenes[id]).filter(Boolean)) {
      const walk = (objs: SceneObject[], prefix = '') => {
        for (const o of objs) {
          out.push({ key: `${sc.id}|${o.id}`, sceneTitle: sc.title, objTitle: prefix + o.name, obj: o });
          if (o.view) walk(o.view.objects, `${prefix}${o.name} › `);
        }
      };
      walk(sc.objects);
    }
    return out;
  }, [project, scenes]);
}

/** Image picker for effect backgrounds / post-transform sprites. Stores FULL `sprite:` refs. */
function ImgPick({ value, onChange }: { value?: string; onChange: (ref: string | undefined) => void }) {
  const assets = useProjectAssets();
  const sprites = useSprites();
  const file = useRef<HTMLInputElement>(null);
  const current = value ? sprites[transformRef(value).slice(7)] : undefined;
  const selectValue = !value ? '' : current ? current.assetId || '__blank__' : value;
  const src = useResolved(value ? transformRef(value) : '');
  return (
    <div className="space-y-1">
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try {
          const a = st().addAsset(await fileToImage(f));
          onChange(st().useAssetSprite(assetRef(a.id), a.name));
        } catch (err) { alert((err as Error).message); }
      }} />
      <div className="flex gap-1">
        <button className={`${btnCls} flex-1`} onClick={() => file.current?.click()}>📁</button>
        <select
          className={`${inputCls} flex-1`}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '__blank__') onChange(spriteRef(st().addSprite(blankSprite('Blank')).id));
            else if (v === '') onChange(undefined);
            else if (v.startsWith('asset:')) onChange(st().useAssetSprite(v));
            else onChange(v);
          }}
        >
          <option value="">— none —</option>
          <option value="__blank__">■ Color only</option>
          {assets.map((a) => <option key={a.id} value={assetRef(a.id)}>🖼 {a.name}</option>)}
        </select>
        {src && <img src={src} alt="" className="w-8 h-8 rounded object-contain bg-gray-800 shrink-0" />}
      </div>
    </div>
  );
}

/** Sprite color fallback for previews. */
const spColor = (sprites: Record<string, Sprite>, ref?: string) =>
  ref ? sprites[transformRef(ref).slice(7)]?.color : undefined;

// ---------- Effects editor (shared by transform rules and pickups) ----------
const ACTIONS: { v: TransformEffect['action']; label: string }[] = [
  { v: 'transform', label: '🔄 Transform another object' },
  { v: 'background', label: '🖼 Change background' },
  { v: 'unlockDoor', label: '🚪 Open a door' },
];

function EffectCard({ eff, idx, onChange, onRemove }: {
  eff: TransformEffect;
  idx: number;
  onChange: (patch: Partial<TransformEffect>) => void;
  onRemove: () => void;
}) {
  const project = useCurrentProject();
  const scenes = useStudioStore((s) => s.scenes);
  const allObjs = useProjectObjects();
  const sceneList = (project?.scenes ?? []).map((id) => scenes[id]).filter(Boolean);
  const scope = eff.sceneId || '';
  // Objects to target: inside the chosen scene (empty sceneId = current room is handled by the caller's default).
  const targets = allObjs.filter((t) => (scope ? t.key.startsWith(`${scope}|`) : true));
  const doorTargets = allObjs.filter((t) => t.obj.door && (scope ? t.key.startsWith(`${scope}|`) : true));

  return (
    <div className="bg-surface rounded p-2 space-y-2 border border-purple-800/50">
      <div className="flex justify-between items-center text-xs">
        <span className="text-purple-300 font-bold">Effect {idx + 1}</span>
        <button className="text-red-400 hover:text-red-300" onClick={onRemove}>✕</button>
      </div>
      <Field label="Action">
        <select className={inputCls} value={eff.action} onChange={(e) => onChange({ action: e.target.value as TransformEffect['action'] })}>
          {ACTIONS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
        </select>
      </Field>
      {eff.action !== 'background' && (
        <Field label="Target room (empty = same room)">
          <select className={inputCls} value={scope} onChange={(e) => onChange({ sceneId: e.target.value || undefined, objectId: undefined, doorObjectId: undefined })}>
            <option value="">(same room)</option>
            {sceneList.map((sc) => <option key={sc.id} value={sc.id}>🚪 {sc.title}</option>)}
          </select>
        </Field>
      )}
      {eff.action === 'transform' && (
        <>
          <Field label="Object to transform automatically">
            <select className={inputCls} value={eff.objectId ?? ''} onChange={(e) => onChange({ objectId: e.target.value || undefined })}>
              <option value="">— choose —</option>
              {targets.map((t) => <option key={t.key} value={t.obj.id}>{shortName(t.sceneTitle)} › {shortName(t.objTitle)}{t.obj.transforms?.length ? ` (${t.obj.transforms.length} rule)` : ' ⚠ no rules'}</option>)}
            </select>
          </Field>
          <Field label="Which rule of that object">
            <NumInput
              value={eff.ruleIndex ?? 0}
              min={0}
              onChange={(n) => onChange({ ruleIndex: Math.max(0, Math.floor(n)) })}
            />
          </Field>
        </>
      )}
      {eff.action === 'background' && (
        <>
          <Field label="Room whose background changes">
            <select className={inputCls} value={eff.sceneId ?? ''} onChange={(e) => onChange({ sceneId: e.target.value || undefined })}>
              <option value="">(same room)</option>
              {sceneList.map((sc) => <option key={sc.id} value={sc.id}>🖼 {sc.title}</option>)}
            </select>
          </Field>
          <Field label="New background image">
            <ImgPick value={eff.newSpriteId} onChange={(ref) => onChange({ newSpriteId: ref })} />
          </Field>
        </>
      )}
      {eff.action === 'unlockDoor' && (
        <Field label="Door to open">
          <select className={inputCls} value={eff.doorObjectId ?? ''} onChange={(e) => onChange({ doorObjectId: e.target.value || undefined })}>
            <option value="">— choose —</option>
            {allObjs.filter((t) => t.obj.door).map((t) => <option key={t.key} value={t.obj.id}>{shortName(t.sceneTitle)} › {shortName(t.objTitle)}</option>)}
          </select>
          {!doorTargets.length && eff.sceneId && <p className="text-[10px] text-orange-400 mt-1">این اتاق در را تعریف نکرده است.</p>}
        </Field>
      )}
      <Field label="Message when it fires (optional)">
        <input className={inputCls} dir="rtl" lang="fa" value={eff.message ?? ''} onChange={(e) => onChange({ message: e.target.value || undefined })} />
      </Field>
    </div>
  );
}

function EffectsEditor({ effects, onChange }: { effects: TransformEffect[]; onChange: (next: TransformEffect[]) => void }) {
  const upd = (i: number, patch: Partial<TransformEffect>) => onChange(effects.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <div className="space-y-2">
      {effects.map((e, i) => (
        <EffectCard key={i} eff={e} idx={i} onChange={(p) => upd(i, p)} onRemove={() => onChange(effects.filter((_, j) => j !== i))} />
      ))}
      <button
        className={`${btnCls} w-full border border-purple-700 text-purple-200`}
        onClick={() => onChange([...effects, { action: 'transform' }])}
      >
        + Add effect
      </button>
      {effects.length === 0 && <p className="text-[11px] text-gray-500">No effects yet — add one to reach other objects/rooms.</p>}
    </div>
  );
}

// ---------- Door editor ----------
function DoorSection({ obj, set }: { obj: SceneObject; set: (p: Partial<SceneObject>, key?: string) => void }) {
  const project = useCurrentProject();
  const scenes = useStudioStore((s) => s.scenes);
  const sceneList = (project?.scenes ?? []).map((id) => scenes[id]).filter(Boolean);
  const door = obj.door;
  return (
    <Section title="🚪 Door (room transition)" color="text-sky-300">
      <label className="flex items-center gap-2 text-gray-300 text-sm">
        <input
          type="checkbox"
          checked={!!door}
          onChange={(e) => set({ door: e.target.checked ? { sceneId: sceneList.find((s2) => s2.id !== objId(obj))?.id ?? sceneList[0]?.id ?? '', requiresItems: [] } : undefined }, `${obj.id}:door`)}
        />
        This object is a door — clicking it walks the player into another room
      </label>
      {door && (
        <>
          <Field label="Goes to room">
            <select className={inputCls} value={door.sceneId} onChange={(e) => set({ door: { ...door, sceneId: e.target.value } }, `${obj.id}:door`)}>
              <option value="">— choose —</option>
              {sceneList.map((sc) => <option key={sc.id} value={sc.id}>🚪 {sc.title}</option>)}
            </select>
          </Field>
          <Field label="Items required to pass (comma separated, empty = always open)">
            <ListInput value={door.requiresItems} onChange={(v) => set({ door: { ...door, requiresItems: v } }, `${obj.id}:doorreq`)} placeholder="key-gold, fuse" />
          </Field>
          <Field label="Locked message">
            <input className={inputCls} dir="rtl" lang="fa" value={door.lockedMessage ?? ''} onChange={(e) => set({ door: { ...door, lockedMessage: e.target.value || undefined } }, `${obj.id}:doorlock`)} />
          </Field>
          <p className="text-[11px] text-gray-500">An «Open a door» effect from any transform/pickup can also unlock this door at runtime.</p>
        </>
      )}
    </Section>
  );
}
const objId = (o: SceneObject) => o.id;

// ---------- Main panel (embedded in the Props tab below the basic properties) ----------
function TransitionsEditor({ obj, set }: { obj: SceneObject; set: (p: Partial<SceneObject>, key?: string) => void }) {
  const sprites = useSprites();
  const ts = obj.transforms ?? [];
  const setT = (i: number, patch: Partial<TransformRule>) =>
    set({ transforms: ts.map((t, j) => (j === i ? { ...t, ...patch } : t)) }, `${obj.id}:tf${i}:${Object.keys(patch)[0]}`);
  const nextSpriteOf = (t: TransformRule) => (t.newSpriteId ? transformRef(t.newSpriteId) : obj.spriteRef);

  return (
    <div className="space-y-3">
      {/* -------- Transform rules -------- */}
      <Section title="🔄 Transforms" color="text-purple-300">
        <p className="text-xs text-gray-500">
          Rules run in order (rule 2 only after rule 1). An <b>empty “Requires item” means no item is needed</b> — the rule fires with a plain click.
        </p>
        {ts.map((t, i) => {
          const ref = nextSpriteOf(t);
          return (
            <div key={i} className="bg-surface-light rounded p-2 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-purple-300 font-bold">Rule {i + 1}</span>
                <button className="text-red-400 hover:text-red-300" onClick={() => set({ transforms: ts.length > 1 ? ts.filter((_, j) => j !== i) : undefined }, `${obj.id}:tf-del-${i}`)}>✕</button>
              </div>
              <Field label="Requires item (empty = no item needed, fires on click)">
                <input className={inputCls} list="item-ids" value={t.requiresItem} onChange={(e) => setT(i, { requiresItem: e.target.value })} placeholder="e.g. wire-cutter" />
              </Field>
              <div className="flex items-center gap-2">
                <Field label="New image (after transform)">
                  <ImgPick value={t.newSpriteId} onChange={(r) => setT(i, { newSpriteId: r })} />
                </Field>
              </div>
              {(t.newSpriteId || t.newName) && (
                <div className="flex items-center gap-2 text-[11px] text-gray-400">
                  <span>This object becomes:</span>
                  <span className="text-purple-200">{t.newName || obj.name}</span>
                  {ref && (sprites[ref.slice(7)]?.assetId || spColor(sprites, ref)) && <span className="text-gray-500">(new look)</span>}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Field label="New name">
                  <input className={inputCls} dir="rtl" lang="fa" value={t.newName ?? ''} onChange={(e) => setT(i, { newName: e.target.value || undefined })} />
                </Field>
                <Field label="Grants item">
                  <input className={inputCls} list="item-ids" value={t.grantsItem ?? ''} onChange={(e) => setT(i, { grantsItem: e.target.value || undefined })} />
                </Field>
              </div>
              <Field label="New message">
                <input className={inputCls} dir="rtl" lang="fa" value={t.newMessage ?? ''} onChange={(e) => setT(i, { newMessage: e.target.value || undefined })} />
              </Field>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-300">
                <label className="flex items-center gap-2"><input type="checkbox" checked={t.consumesItem !== false} onChange={(e) => setT(i, { consumesItem: e.target.checked })} />Consumes item</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!t.triggersDiscovery} onChange={(e) => setT(i, { triggersDiscovery: e.target.checked })} />Counts as discovery</label>
              </div>

              {/* per-rule TRANSITION EFFECTS — the heart of the separate transitions engine */}
              <div className="border-t border-purple-900/60 pt-2">
                <p className="text-[11px] font-bold text-purple-300 mb-1">⚡ When this rule fires, also…</p>
                <EffectsEditor effects={t.effects ?? []} onChange={(next) => setT(i, { effects: next.length ? next : undefined })} />
              </div>
            </div>
          );
        })}
        <button className="w-full bg-purple-700 hover:bg-purple-600 text-white px-2 py-1.5 rounded text-xs" onClick={() => set({ transforms: [...ts, { requiresItem: '', consumesItem: true }] }, `${obj.id}:tf-add`)}>
          + Add transform rule
        </button>
      </Section>

      {/* -------- Pickup effects -------- */}
      {obj.pickupable && (
        <Section title="🎒 Pickup transitions — when this item is picked up…" color="text-green-300">
          <EffectsEditor effects={obj.pickupEffects ?? []} onChange={(next) => set({ pickupEffects: next.length ? next : undefined }, `${obj.id}:pk-eff`)} />
        </Section>
      )}

      {/* -------- Door -------- */}
      <DoorSection obj={obj} set={set} />
    </div>
  );
}

// ---------- Public wrappers ----------
/** Embedded in the Props tab (below the basic properties) so editing stays one continuous flow. */
export function TransitionsPanel({ obj, set }: { obj: SceneObject; set: (p: Partial<SceneObject>, key?: string) => void }) {
  return <TransitionsEditor obj={obj} set={set} />;
}

/** Dedicated "🔄 Transitions" tab in the Studio sidebar — edits the selected object's transitions. */
export function TransitionsTab() {
  const ctx = useCtx();
  const ids = useStudioStore((s) => s.selectedObjectIds);
  const selected = useMemo(() => (ctx ? ctx.objects.filter((o) => ids.includes(o.id)) : []), [ctx, ids]);
  if (selected.length === 0) {
    return (
      <div className="p-4 text-gray-400 text-sm space-y-2" dir="ltr">
        <p>Select an object on the canvas to edit its transitions.</p>
        <p className="text-xs text-gray-500">
          Here you can define transform rules, chain effects that fire on OTHER objects (even in other rooms),
          change another room&apos;s background, open doors remotely — and turn any sprite into a door to another room.
        </p>
      </div>
    );
  }
  if (selected.length > 1) return <div className="p-4 text-gray-400 text-sm">Select a single object to edit its transitions.</div>;
  const obj = selected[0];
  const set = (patch: Partial<SceneObject>, key?: string) => st().updateObject(obj.id, patch, key ?? `${obj.id}:${Object.keys(patch).join()}`);
  return (
    <div className="p-3 space-y-3 text-sm">
      <h3 className="font-bold text-purple-300 text-base">🔄 Transitions — {obj.name}</h3>
      <TransitionsEditor obj={obj} set={set} />
    </div>
  );
}
