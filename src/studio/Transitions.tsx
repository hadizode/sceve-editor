import React, { useMemo, useRef, useState } from 'react';
import { useCtx, useCurrentProject, useProjectAssets, useSprites, useStudioStore } from '../stores/store';
import {
  assetRef,
  blankSprite,
  spriteRef,
  transformRef,
  type PositionReq,
  type Scene,
  type SceneObject,
  type SpriteFilter,
  type TransformCondition,
  type TransformEffect,
  type TransformRule,
} from '../shared/types';
import { livePoint } from '../shared/geometry';
import { obtainableItems } from '../shared/validation';
import { fileToImage } from '../shared/utils';
import { btnCls, Card, Field, Hint, inputCls, ListInput, NumInput, Section, Sub } from './ui';
import { useResolved } from './konva-bits';
import { Icon, IconButton } from './icons';

const st = () => useStudioStore.getState();

/**
 * Transitions — mental model
 * ──────────────────────────
 * An object owns an ORDERED list of rules. Rule N becomes available only after rule N-1 has fired.
 * Every rule reads as a sentence with three blocks:
 *
 *   ① WHEN      what triggers it            (click · use an item · automatically)
 *   ② ONLY IF   extra conditions            (other objects transformed · items held · positions / click counts)
 *   ③ THEN      what happens                (new look · items · side effects on other objects / rooms / doors)
 *
 * The data model is unchanged: the trigger is derived from `requiresItem` + `conditions.autoApply`.
 */

type SetFn = (p: Partial<SceneObject>, key?: string) => void;
type Trigger = 'click' | 'item' | 'auto';

// ───────────────────────── helpers ─────────────────────────
const short = (s?: string, n = 26) => ((s ?? '').length > n ? `${s!.slice(0, n - 2)}…` : s ?? '');

interface ProjectObj { key: string; sceneId: string; sceneTitle: string; objTitle: string; obj: SceneObject }

/** Every object in every room of the project (incl. close-up view objects), addressable as `sceneId|objectId`. */
function useProjectObjects(): ProjectObj[] {
  const project = useCurrentProject();
  const scenes = useStudioStore((s) => s.scenes);
  return useMemo(() => {
    const out: ProjectObj[] = [];
    for (const sc of (project?.scenes ?? []).map((id) => scenes[id]).filter(Boolean)) {
      const walk = (objs: SceneObject[], prefix = '') => {
        for (const o of objs) {
          out.push({ key: `${sc.id}|${o.id}`, sceneId: sc.id, sceneTitle: sc.title, objTitle: prefix + o.name, obj: o });
          if (o.view) walk(o.view.objects, `${prefix}${o.name} › `);
        }
      };
      walk(sc.objects);
    }
    return out;
  }, [project, scenes]);
}

function useRooms() {
  const project = useCurrentProject();
  const scenes = useStudioStore((s) => s.scenes);
  return useMemo(() => (project?.scenes ?? []).map((id) => scenes[id]).filter((s): s is Scene => !!s), [project, scenes]);
}

/** Autocomplete list of item ids that something in the project actually grants. */
function ItemDatalist() {
  const rooms = useRooms();
  const ids = useMemo(() => [...obtainableItems(rooms)].sort(), [rooms]);
  return (
    <datalist id="item-ids">
      {ids.map((i) => <option key={i} value={i} />)}
    </datalist>
  );
}

const hasLists = (c?: TransformCondition) =>
  !!c && (!!c.transformedObjects?.length || !!c.itemsInInventory?.length || !!c.positions?.length);
const condCount = (c?: TransformCondition) =>
  (c?.transformedObjects?.length ?? 0) + (c?.itemsInInventory?.length ?? 0) + (c?.positions?.length ?? 0);

/** Merge a patch into the condition; collapse to undefined only when nothing at all is left. */
function mergeCond(c: TransformCondition | undefined, patch: Partial<TransformCondition>): TransformCondition | undefined {
  const next: TransformCondition = { ...c, ...patch };
  (['transformedObjects', 'itemsInInventory', 'positions'] as const).forEach((k) => {
    if (!next[k]?.length) delete next[k];
  });
  if (!next.autoApply) delete next.autoApply;
  return hasLists(next) || next.autoApply ? next : undefined;
}

function filterOrUndef(f: SpriteFilter): SpriteFilter | undefined {
  const o: SpriteFilter = {};
  if (f.invert) o.invert = f.invert;
  if (f.grayscale) o.grayscale = f.grayscale;
  if (f.hueRotate) o.hueRotate = f.hueRotate;
  if (f.brightness !== undefined && f.brightness !== 1) o.brightness = f.brightness;
  return Object.keys(o).length ? o : undefined;
}

const triggerOf = (t: TransformRule): Trigger => (t.conditions?.autoApply && !t.requiresItem ? 'auto' : t.requiresItem ? 'item' : 'click');

// ───────────────────────── layout primitives ─────────────────────────
const TONES = {
  when: 'border-sky-700/50 text-sky-300',
  if: 'border-amber-700/50 text-amber-300',
  then: 'border-emerald-700/50 text-emerald-300',
  fx: 'border-purple-700/50 text-purple-300',
} as const;

function Block({ n, title, tone, hint, children }: { n: string; title: string; tone: keyof typeof TONES; hint?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-[3px] border bg-black/15 ${TONES[tone].split(' ')[0]}`}>
      <div className="flex items-center gap-1.5 px-2 h-6 border-b border-white/5">
        <span className={`w-4 h-4 rounded-full bg-white/10 text-[10px] leading-4 text-center font-bold ${TONES[tone].split(' ')[1]}`}>{n}</span>
        <span className={`text-[11px] font-bold uppercase tracking-wide ${TONES[tone].split(' ')[1]}`}>{title}</span>
        {hint && <span className="text-[10px] text-gray-500 truncate">{hint}</span>}
      </div>
      <div className="p-2 space-y-2">{children}</div>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-amber-400 leading-snug">⚠ {children}</p>;
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-0.5 bg-black/25 border border-line rounded-[4px] p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          title={o.title}
          aria-pressed={o.v === value}
          onClick={() => onChange(o.v)}
          className={`flex-1 h-6 rounded-[3px] text-[11px] ${o.v === value ? 'bg-primary text-white' : 'text-gray-300 hover:bg-white/10'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── image picker ─────────────────────────
/** Picks an image (or a colour-only / invisible sprite). Stores FULL `sprite:` refs. */
function ImgPick({ value, onChange }: { value?: string; onChange: (ref: string | undefined) => void }) {
  const assets = useProjectAssets();
  const sprites = useSprites();
  const file = useRef<HTMLInputElement>(null);
  const ref = value ? transformRef(value) : '';
  const current = ref ? sprites[ref.slice(7)] : undefined;
  const isBlank = !!current && !current.assetId;
  const selectValue = !value ? '' : current ? current.assetId || '__blank__' : value;
  const src = useResolved(ref);
  return (
    <div className="space-y-1">
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
            onChange(st().useAssetSprite(assetRef(a.id), a.name));
          } catch (err) {
            alert((err as Error).message);
          }
        }}
      />
      <div className="flex gap-1 items-center">
        <IconButton icon="upload" solid title="Upload image" onClick={() => file.current?.click()} />
        <select
          className={`${inputCls} flex-1`}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') onChange(undefined);
            else if (v === '__blank__') onChange(spriteRef(st().addSprite(blankSprite('Blank')).id));
            else if (v.startsWith('asset:')) onChange(st().useAssetSprite(v));
            else onChange(v);
          }}
        >
          <option value="">— unchanged —</option>
          <option value="__blank__">■ Colour only / invisible</option>
          {assets.map((a) => <option key={a.id} value={assetRef(a.id)}>{a.name}</option>)}
        </select>
        {src ? (
          <img src={src} alt="" className="w-8 h-8 rounded object-contain bg-black/30 shrink-0" />
        ) : isBlank && current?.color ? (
          <span className="w-8 h-8 rounded shrink-0 border border-line" style={{ background: current.color }} />
        ) : null}
      </div>
      {isBlank && current && (
        <label className="flex items-center gap-2 text-[11px] text-gray-400">
          Fill colour
          <input type="color" value={current.color || '#000000'} onChange={(e) => st().updateSprite(current.id, { color: e.target.value })} />
          <button className={btnCls} onClick={() => st().updateSprite(current.id, { color: undefined })}>Invisible</button>
        </label>
      )}
    </div>
  );
}

// ───────────────────────── ① WHEN ─────────────────────────
function WhenBlock({ rule, trigger, setTrigger, upd }: { rule: TransformRule; trigger: Trigger; setTrigger: (t: Trigger) => void; upd: (p: Partial<TransformRule>) => void }) {
  return (
    <Block n="1" title="When" tone="when" hint="what triggers this rule">
      <Seg<Trigger>
        value={trigger}
        onChange={setTrigger}
        options={[
          { v: 'click', label: 'Click', title: 'Fires when the player clicks the object' },
          { v: 'item', label: 'Use item', title: 'Fires when the player uses a chosen inventory item on the object' },
          { v: 'auto', label: 'Automatic', title: 'Fires by itself the moment all conditions hold — no click' },
        ]}
      />
      {trigger === 'item' && (
        <>
          <Field label="Item that must be used" stack>
            <input className={inputCls} list="item-ids" value={rule.requiresItem} placeholder="e.g. wire-cutter" onChange={(e) => upd({ requiresItem: e.target.value.trim() })} />
          </Field>
          {!rule.requiresItem && <Warn>No item chosen — until you pick one this rule fires on a plain click.</Warn>}
        </>
      )}
      {trigger === 'click' && <Hint>Plain click. Add conditions below to make it wait for something.</Hint>}
      {trigger === 'auto' && (
        <>
          <Hint>Fires instantly when every condition below becomes true, and the player doesn’t click anything.</Hint>
          {!hasLists(rule.conditions) && <Warn>Automatic needs at least one condition, otherwise it can never fire (and is dropped on reload).</Warn>}
        </>
      )}
    </Block>
  );
}

// ───────────────────────── ② ONLY IF ─────────────────────────
const OPS: { v: 'eq' | 'gte' | 'lte'; label: string }[] = [
  { v: 'eq', label: '=' },
  { v: 'gte', label: '≥' },
  { v: 'lte', label: '≤' },
];

/** "After N clicks, where is the anchor?" with one-tap copy into the X / Y fields. */
function PosPreview({ obj, r, onApply }: { obj: SceneObject; r: PositionReq; onApply: (p: Partial<PositionReq>) => void }) {
  const [n, setN] = useState(1);
  const p = livePoint(obj, n, r.anchor);
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  return (
    <div className="flex items-center gap-1 text-[11px] bg-black/25 rounded p-1">
      <span className="text-gray-400 shrink-0">After click</span>
      <div className="w-12"><NumInput value={n} min={0} onChange={(v) => setN(Math.max(0, Math.floor(v)))} /></div>
      <span className="text-cyan-300 font-mono flex-1 text-center">({x}, {y})</span>
      <button className={btnCls} onClick={() => onApply({ x })}>→X</button>
      <button className={btnCls} onClick={() => onApply({ y })}>→Y</button>
      <button className={btnCls} onClick={() => onApply({ x, y })}>→X+Y</button>
    </div>
  );
}

function PositionRow({ r, objs, onChange, onRemove }: { r: PositionReq; objs: ProjectObj[]; onChange: (p: Partial<PositionReq>) => void; onRemove: () => void }) {
  const key = `${r.sceneId ?? ''}|${r.objectId}`;
  const target = objs.find((t) => t.obj.id === r.objectId)?.obj;
  const hasX = Number.isFinite(r.x);
  const hasY = Number.isFinite(r.y);
  const sorted = useMemo(() => [...objs].sort((a, b) => Number(!!b.obj.motion) - Number(!!a.obj.motion)), [objs]);
  const axis = (label: 'X' | 'Y', on: boolean, val: number | undefined) => (
    <label className="flex items-center gap-1 text-[11px]">
      <input type="checkbox" checked={on} title="Axis enabled — a disabled axis is NOT checked" onChange={(e) => onChange({ [label.toLowerCase()]: e.target.checked ? 0 : undefined })} />
      <span className="text-gray-400">{label}</span>
      {on && <NumInput value={val as number} step={5} onChange={(n) => onChange({ [label.toLowerCase()]: n })} />}
    </label>
  );
  return (
    <div className="rounded border border-cyan-800/40 bg-surface p-2 space-y-1.5">
      <div className="flex gap-1 items-center">
        <select
          className={`${inputCls} flex-1`}
          value={key}
          onChange={(e) => {
            const [sid, oid] = e.target.value.split('|');
            onChange({ sceneId: sid || undefined, objectId: oid });
          }}
        >
          <option value="|">— sprite —</option>
          {sorted.map((t) => <option key={t.key} value={t.key}>{t.obj.motion ? '🔄 ' : ''}{short(t.sceneTitle)} › {short(t.objTitle)}</option>)}
        </select>
        <select className={`${inputCls} w-14 shrink-0`} value={r.op ?? 'eq'} onChange={(e) => onChange({ op: e.target.value as PositionReq['op'] })}>
          {OPS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <IconButton icon="x" compact danger title="Remove" onClick={onRemove} />
      </div>
      <div className="grid grid-cols-2 gap-2">{axis('X', hasX, r.x)}{axis('Y', hasY, r.y)}</div>
      <div className="grid grid-cols-3 gap-1.5">
        <Field label="Anchor X"><NumInput value={r.anchor?.x ?? 0.5} step={0.05} onChange={(n) => onChange({ anchor: { x: n, y: r.anchor?.y ?? 0.5 } })} /></Field>
        <Field label="Anchor Y"><NumInput value={r.anchor?.y ?? 0.5} step={0.05} onChange={(n) => onChange({ anchor: { x: r.anchor?.x ?? 0.5, y: n } })} /></Field>
        <Field label="Tolerance px"><NumInput value={r.tolerance ?? 2} min={0} onChange={(n) => onChange({ tolerance: Math.max(0, n) })} /></Field>
      </div>
      {target?.motion && <PosPreview obj={target} r={r} onApply={onChange} />}
      {target && !target.motion && <Warn>“{target.name}” has no Motion, so it never moves.</Warn>}
      <details className="text-[11px] text-gray-400">
        <summary className="cursor-pointer select-none">Or by click count (e.g. clock: every 12, on click 3)</summary>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <Field label="Cycle size">
            <NumInput
              value={r.stepsMod ?? 0}
              min={0}
              onChange={(n) => {
                const m = Math.floor(n);
                onChange(m > 0 ? { stepsMod: m, stepsEq: Math.min(r.stepsEq ?? 0, m - 1) } : { stepsMod: undefined, stepsEq: undefined });
              }}
            />
          </Field>
          <Field label="Must be on click #">
            <NumInput value={r.stepsEq ?? 0} min={0} onChange={(n) => onChange({ stepsEq: Math.max(0, Math.floor(n)) })} />
          </Field>
        </div>
      </details>
    </div>
  );
}

export function ConditionsEditor({
  cond,
  onChange,
  excludeObjId,
}: {
  cond?: TransformCondition;
  onChange: (next: TransformCondition | undefined) => void;
  excludeObjId?: string;
}) {
  const objs = useProjectObjects();
  const c = cond;
  const setC = (patch: Partial<TransformCondition>) => onChange(mergeCond(c, patch));
  const tos = c?.transformedObjects ?? [];
  const pos = c?.positions ?? [];
  const used = new Set(tos.map((e) => `${e.sceneId ?? ''}|${e.objectId}`));
  const candidates = objs.filter((t) => (!excludeObjId || t.obj.id !== excludeObjId) && t.obj.transforms?.length);
  return (
    <div className="space-y-2">
      <Sub title="Other sprites already transformed" count={tos.length} defaultOpen={tos.length > 0}>
        {tos.map((e, i) => {
          const key = `${e.sceneId ?? ''}|${e.objectId}`;
          return (
            <div key={i} className="flex gap-1 items-center">
              <select
                className={`${inputCls} flex-1`}
                value={key}
                onChange={(ev) => {
                  const [sid, oid] = ev.target.value.split('|');
                  setC({ transformedObjects: tos.map((x, j) => (j === i ? { sceneId: sid || undefined, objectId: oid, minRule: x.minRule } : x)) });
                }}
              >
                <option value="|">— sprite —</option>
                {candidates.filter((t) => !used.has(t.key) || t.key === key).map((t) => (
                  <option key={t.key} value={t.key}>{short(t.sceneTitle)} › {short(t.objTitle)} ({t.obj.transforms!.length})</option>
                ))}
              </select>
              <span className="text-[10px] text-gray-400 shrink-0" title="Which rule of that sprite must already have fired">rule ≥</span>
              <div className="w-12 shrink-0">
                <NumInput value={(e.minRule ?? 0) + 1} min={1} onChange={(n) => setC({ transformedObjects: tos.map((x, j) => (j === i ? { ...x, minRule: Math.max(0, Math.floor(n) - 1) } : x)) })} />
              </div>
              <IconButton icon="x" compact danger title="Remove" onClick={() => setC({ transformedObjects: tos.filter((_, j) => j !== i) })} />
            </div>
          );
        })}
        <button className={`${btnCls} w-full`} onClick={() => setC({ transformedObjects: [...tos, { objectId: '', minRule: 0 }] })}>
          <Icon name="plus" size={12} /> Add sprite
        </button>
        {candidates.length === 0 && <Hint>No other sprite has transform rules yet.</Hint>}
      </Sub>

      <Sub title="Items the player holds" count={c?.itemsInInventory?.length ?? 0} defaultOpen={!!c?.itemsInInventory?.length}>
        <ListInput value={c?.itemsInInventory} onChange={(v) => setC({ itemsInInventory: v })} placeholder="fuse, connector" />
        <Hint>Comma separated item ids. Only checked, never consumed.</Hint>
      </Sub>

      <Sub title="Position / click count" count={pos.length} defaultOpen={pos.length > 0}>
        {pos.map((r, i) => (
          <PositionRow
            key={i}
            r={r}
            objs={objs}
            onChange={(p) => setC({ positions: pos.map((q, j) => (j === i ? { ...q, ...p } : q)) })}
            onRemove={() => setC({ positions: pos.filter((_, j) => j !== i) })}
          />
        ))}
        <button className={`${btnCls} w-full`} onClick={() => setC({ positions: [...pos, { objectId: '', op: 'gte' }] })}>
          <Icon name="plus" size={12} /> Sprite must reach a position
        </button>
        <Hint>Uses the sprite’s live position after its Motion rotations. 🔄 = has Motion.</Hint>
      </Sub>
    </div>
  );
}

function IfBlock({ obj, rule, upd }: { obj: SceneObject; rule: TransformRule; upd: (p: Partial<TransformRule>) => void }) {
  const c = rule.conditions;
  return (
    <Block n="2" title="Only if" tone="if" hint="all must hold — empty = always">
      <ConditionsEditor cond={c} onChange={(next) => upd({ conditions: next })} excludeObjId={obj.id} />
    </Block>
  );
}

// ───────────────────────── effects (side actions) ─────────────────────────
const ACTIONS: { v: TransformEffect['action']; label: string }[] = [
  { v: 'transform', label: 'Transform another object' },
  { v: 'background', label: 'Change background' },
  { v: 'unlockDoor', label: 'Open a door' },
  { v: 'setUsable', label: 'Lock / unlock an object' },
];

function EffectCard({ eff, idx, onChange, onRemove }: { eff: TransformEffect; idx: number; onChange: (p: Partial<TransformEffect>) => void; onRemove: () => void }) {
  const allObjs = useProjectObjects();
  const targets = allObjs;
  const rooms = useRooms();
  const curScene = useStudioStore((s) => s.currentSceneId);
  const targetKey = eff.objectId ? `${eff.sceneId ?? curScene}|${eff.objectId}` : '';
  const target = allObjs.find((t) => t.key === targetKey)?.obj;
  return (
    <div className="rounded border border-purple-800/50 bg-surface p-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <span className="text-[11px] font-bold text-purple-300">Effect {idx + 1}</span>
        <select className={`${inputCls} flex-1`} value={eff.action} onChange={(e) => onChange({ action: e.target.value as TransformEffect['action'], objectId: undefined, doorObjectId: undefined, ruleIndex: undefined, usable: undefined })}>
          {ACTIONS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
        </select>
        <IconButton icon="x" compact danger title="Remove effect" onClick={onRemove} />
      </div>

      {eff.action === 'transform' && (
        <>
          <Field label="Sprite" stack>
            <select
              className={inputCls}
              value={targetKey}
              onChange={(e) => {
                const [sid, oid] = e.target.value.split('|');
                onChange({ sceneId: !sid || sid === curScene ? undefined : sid, objectId: oid || undefined, ruleIndex: 0 });
              }}
            >
              <option value="">— choose —</option>
              {allObjs.filter((t) => t.obj.transforms?.length).map((t) => (
                <option key={t.key} value={t.key}>{short(t.sceneTitle)} › {short(t.objTitle)}</option>
              ))}
            </select>
          </Field>
          {target?.transforms && (
            <Field label="Which rule" stack>
              <select className={inputCls} value={eff.ruleIndex ?? 0} onChange={(e) => onChange({ ruleIndex: Number(e.target.value) })}>
                {target.transforms.map((t, i) => <option key={i} value={i}>Rule {i + 1}{t.newName ? ` — ${short(t.newName, 20)}` : ''}</option>)}
              </select>
            </Field>
          )}
        </>
      )}
      {eff.action === 'setUsable' && (
        <>
          <Field label="Object to lock / unlock">
            <select className={inputCls} value={eff.objectId ?? ''} onChange={(e) => onChange({ objectId: e.target.value || undefined })}>
              <option value="">— choose —</option>
              {targets.map((t) => <option key={t.key} value={t.obj.id}>{shortName(t.sceneTitle)} › {shortName(t.objTitle)}{t.obj.door ? ' 🚪' : ''}</option>)}
            </select>
          </Field>
          <Field label="Set to">
            <select
              className={inputCls}
              value={eff.usable === false ? 'no' : 'yes'}
              onChange={(e) => onChange({ usable: e.target.value === 'no' ? false : undefined })}
            >
              <option value="yes">Usable</option>
              <option value="no">Locked</option>
            </select>
          </Field>
        </>
      )}
      {eff.action === 'background' && (
        <>
          <Field label="Room" stack>
            <select className={inputCls} value={eff.sceneId ?? ''} onChange={(e) => onChange({ sceneId: e.target.value || undefined })}>
              <option value="">(this room)</option>
              {rooms.map((sc) => <option key={sc.id} value={sc.id}>{sc.title}</option>)}
            </select>
          </Field>
          <Field label="New background" stack>
            <ImgPick value={eff.newSpriteId} onChange={(r) => onChange({ newSpriteId: r })} />
          </Field>
        </>
      )}

      {eff.action === 'unlockDoor' && (
        <Field label="Door" stack>
          <select className={inputCls} value={eff.doorObjectId ?? ''} onChange={(e) => onChange({ doorObjectId: e.target.value || undefined })}>
            <option value="">— choose —</option>
            {allObjs.filter((t) => t.obj.door).map((t) => <option key={t.key} value={t.obj.id}>{short(t.sceneTitle)} › {short(t.objTitle)}</option>)}
          </select>
          {!allObjs.some((t) => t.obj.door) && <Warn>No door exists yet. Mark a sprite as a door first.</Warn>}
        </Field>
      )}

      <Field label="Toast message (optional)" stack>
        <input className={inputCls} dir="rtl" lang="fa" value={eff.message ?? ''} onChange={(e) => onChange({ message: e.target.value || undefined })} />
      </Field>
    </div>
  );
}

function EffectsEditor({ effects, onChange }: { effects: TransformEffect[]; onChange: (next: TransformEffect[]) => void }) {
  const upd = (i: number, p: Partial<TransformEffect>) => onChange(effects.map((e, j) => (j === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-2">
      {effects.map((e, i) => (
        <EffectCard key={i} eff={e} idx={i} onChange={(p) => upd(i, p)} onRemove={() => onChange(effects.filter((_, j) => j !== i))} />
      ))}
      <button className={`${btnCls} w-full`} onClick={() => onChange([...effects, { action: 'transform' }])}>
        <Icon name="plus" size={12} /> Add effect
      </button>
    </div>
  );
}

// ───────────────────────── ③ THEN ─────────────────────────
function ThenBlock({ obj, rule, trigger, upd }: { obj: SceneObject; rule: TransformRule; trigger: Trigger; upd: (p: Partial<TransformRule>) => void }) {
  const f = rule.filter ?? {};
  const setF = (p: SpriteFilter) => upd({ filter: filterOrUndef({ ...f, ...p }) });
  return (
    <Block n="3" title="Then" tone="then" hint="what happens">
      <Sub title="Appearance" defaultOpen>
        <Field label="New image" stack><ImgPick value={rule.newSpriteId} onChange={(r) => upd({ newSpriteId: r })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="New name" stack>
            <input className={inputCls} dir="rtl" lang="fa" value={rule.newName ?? ''} placeholder={obj.name} onChange={(e) => upd({ newName: e.target.value || undefined })} />
          </Field>
          <Field label="Message" stack>
            <input className={inputCls} dir="rtl" lang="fa" value={rule.newMessage ?? ''} onChange={(e) => upd({ newMessage: e.target.value || undefined })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-[11px] text-gray-300">
          <input
            type="checkbox"
            checked={!!rule.hides}
            onChange={(e) => upd({ hides: e.target.checked ? true : undefined })}
          />
          Sprite disappears when this rule fires
        </label>
        <div className="space-y-1.5 border-t border-white/5 pt-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400">Colour filter (while this rule is showing)</span>
            {rule.filter && <button className={btnCls} onClick={() => upd({ filter: undefined })}>Reset</button>}
          </div>
          <div className="flex gap-4 text-[11px] text-gray-300">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!f.invert} onChange={(e) => setF({ invert: e.target.checked ? 1 : undefined })} />Invert</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!f.grayscale} onChange={(e) => setF({ grayscale: e.target.checked ? 1 : undefined })} />Grayscale</label>
          </div>
          <Field label={`Hue rotate — ${f.hueRotate ?? 0}°`} stack>
            <input type="range" min={0} max={360} className="w-full" value={f.hueRotate ?? 0} onChange={(e) => setF({ hueRotate: Number(e.target.value) || undefined })} />
          </Field>
          <Field label={`Brightness — ${(f.brightness ?? 1).toFixed(2)}×`} stack>
            <input type="range" min={0} max={3} step={0.05} className="w-full" value={f.brightness ?? 1} onChange={(e) => setF({ brightness: Number(e.target.value) })} />
          </Field>
        </div>
      </Sub>

      <Sub title="Items" defaultOpen={!!rule.grantsItem}>
        <Field label="Gives item" stack>
          <input className={inputCls} list="item-ids" value={rule.grantsItem ?? ''} placeholder="item id" onChange={(e) => upd({ grantsItem: e.target.value.trim() || undefined })} />
        </Field>
        {trigger === 'item' && (
          <label className="flex items-center gap-2 text-[11px] text-gray-300">
            <input type="checkbox" checked={rule.consumesItem !== false} onChange={(e) => upd({ consumesItem: e.target.checked })} />
            Used item is consumed
          </label>
        )}
        <label className="flex items-center gap-2 text-[11px] text-gray-300">
          <input type="checkbox" checked={!!rule.triggersDiscovery} onChange={(e) => upd({ triggersDiscovery: e.target.checked })} />
          Counts as discovering this sprite (digit / room progress)
        </label>
      </Sub>

      <Sub title="Side effects on other things" count={rule.effects?.length ?? 0} defaultOpen={!!rule.effects?.length}>
        <EffectsEditor effects={rule.effects ?? []} onChange={(next) => upd({ effects: next.length ? next : undefined })} />
        {!rule.effects?.length && <Hint>Fire a rule on another sprite (even in another room), swap a room background, or open a door.</Hint>}
      </Sub>
    </Block>
  );
}

// ───────────────────────── rule card ─────────────────────────
function summarize(obj: SceneObject, t: TransformRule, trigger: Trigger): string {
  const when = trigger === 'click' ? 'Click' : trigger === 'item' ? `Use “${t.requiresItem || '?'}”` : 'Automatic';
  const n = condCount(t.conditions);
  const then: string[] = [];
  if (t.hides) then.push('disappears');
  if (t.newName) then.push(`becomes “${short(t.newName, 16)}”`);
  else if (t.newSpriteId) then.push('new look');
  if (t.filter) then.push('filter');
  if (t.grantsItem) then.push(`gives ${t.grantsItem}`);
  if (t.effects?.length) then.push(`${t.effects.length} effect${t.effects.length > 1 ? 's' : ''}`);
  return `${when}${n ? ` · if ${n}` : ''} → ${then.join(', ') || obj.name}`;
}

function RuleCard({ obj, ts, i, set }: { obj: SceneObject; ts: TransformRule[]; i: number; set: SetFn }) {
  const rule = ts[i];
  const [trigger, setTriggerState] = useState<Trigger>(() => triggerOf(rule));
  const write = (next: TransformRule[], k: string) => set({ transforms: next.length ? next : undefined }, `${obj.id}:tf-${k}`);
  const upd = (p: Partial<TransformRule>) => write(ts.map((t, j) => (j === i ? { ...t, ...p } : t)), `${i}:${Object.keys(p)[0]}`);

  const setTrigger = (m: Trigger) => {
    setTriggerState(m);
    if (m === 'item') upd({ conditions: mergeCond(rule.conditions, { autoApply: false }) });
    else if (m === 'click') upd({ requiresItem: '', conditions: mergeCond(rule.conditions, { autoApply: false }) });
    else upd({ requiresItem: '', conditions: mergeCond(rule.conditions, { autoApply: true }) });
  };

  const move = (d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= ts.length) return;
    const n = [...ts];
    [n[i], n[j]] = [n[j], n[i]];
    write(n, 'move');
  };

  return (
    <Card
      title={`Rule ${i + 1}`}
      subtitle={summarize(obj, rule, trigger)}
      defaultOpen={ts.length === 1 || i === ts.length - 1}
      onRemove={() => write(ts.filter((_, j) => j !== i), 'del')}
    >
      <div className="flex justify-end gap-0.5 -mt-0.5">
        <IconButton icon="arrowUp" compact title="Move earlier in the chain" disabled={i === 0} onClick={() => move(-1)} />
        <IconButton icon="arrowDown" compact title="Move later in the chain" disabled={i === ts.length - 1} onClick={() => move(1)} />
        <IconButton icon="copy" compact title="Duplicate rule" onClick={() => write([...ts.slice(0, i + 1), structuredClone(rule), ...ts.slice(i + 1)], 'dup')} />
      </div>
      <WhenBlock rule={rule} trigger={trigger} setTrigger={setTrigger} upd={upd} />
      <IfBlock obj={obj} rule={rule} upd={upd} />
      <ThenBlock obj={obj} rule={rule} trigger={trigger} upd={upd} />
    </Card>
  );
}

// ---------- Usability editor (locked objects / unlockWhen) ----------
/**
 * Every object starts usable unless "Usable at the start" is unchecked. A locked object shows its
 * `unusableMessage` when clicked and becomes usable either through a `setUsable` effect or — if an
 * `unlockWhen` condition is defined — the instant that condition holds, without any click.
 */
export function UsabilitySection({ obj, set }: { obj: SceneObject; set: (p: Partial<SceneObject>, key?: string) => void }) {
  const locked = obj.usable === false;
  return (
    <Section title="Usability" color="text-amber-300">
      <label className="flex items-center gap-2 text-gray-300 text-sm">
        <input
          type="checkbox"
          checked={obj.usable !== false}
          onChange={(e) => set({ usable: e.target.checked ? undefined : false }, `${obj.id}:usable`)}
        />
        Usable at the start
      </label>
      {locked && (<>
        <Field label="Message while locked">
          <input className={inputCls} dir="rtl" lang="fa" value={obj.unusableMessage ?? ''} onChange={(e) => set({ unusableMessage: e.target.value || undefined }, `${obj.id}:unmsg`)} />
        </Field>
        <p className="text-[11px] text-gray-500">
          While locked, clicking only shows this message. A «Lock / unlock an object» effect from any
          transform/pickup can free it — or define a condition below so it unlocks by itself the moment it holds.
        </p>
        <ConditionsEditor cond={obj.unlockWhen} onChange={(next) => set({ unlockWhen: next }, `${obj.id}:unlockWhen`)} />
      </>)}
    </Section>
  );
}

// ───────────────────────── door ─────────────────────────
export function DoorSection({ obj, set }: { obj: SceneObject; set: SetFn }) {
  const rooms = useRooms();
  const curScene = useStudioStore((s) => s.currentSceneId);
  const door = obj.door;
  const hasOther = !!(obj.transforms?.length || obj.pickupable || obj.view || obj.digit !== undefined ||
    obj.grantsItem || obj.requiresItem?.length || obj.pickupEffects?.length);

  const toggle = (on: boolean) => {
    if (!on) return set({ door: undefined }, `${obj.id}:door`);
    set({ door: { sceneId: sceneList.find((s) => s.id !== curScene)?.id ?? '', requiresItems: [] } }, `${obj.id}:door`);
  };

  return (
    <Card title="🚪 Door" subtitle={door ? `→ ${rooms.find((s) => s.id === door.sceneId)?.title ?? '?'}` : 'not a door'} defaultOpen={!!door}>
      <label className="flex items-center gap-2 text-[11px] text-gray-300">
        <input type="checkbox" checked={!!door} onChange={(e) => toggle(e.target.checked)} />
        This sprite is a door to another room
      </label>
      {door && (<>
        <Field label="Goes to room">
          <select className={inputCls} value={door.sceneId} onChange={(e) => set({ door: { ...door, sceneId: e.target.value } }, `${obj.id}:door`)}>
            <option value="">— choose —</option>
            {sceneList.map((sc) => <option key={sc.id} value={sc.id}>{sc.title}</option>)}
          </select>
        </Field>
        <Field label="Items required to pass (comma separated, empty = always open)">
          <ListInput value={door.requiresItems} onChange={(v) => set({ door: { ...door, requiresItems: v } }, `${obj.id}:doorreq`)} placeholder="key-gold, fuse" />
        </Field>
        <Field label="Locked message">
          <input className={inputCls} dir="rtl" lang="fa" value={door.lockedMessage ?? ''} onChange={(e) => set({ door: { ...door, lockedMessage: e.target.value || undefined } }, `${obj.id}:doorlock`)} />
        </Field>
        <Field label="When the player walks through, also…">
          <EffectsEditor
            effects={door.onEnterEffects ?? []}
            onChange={(next) => set({ door: { ...door, onEnterEffects: next.length ? next : undefined } }, `${obj.id}:door-eff`)}
          />
        </Field>
        <p className="text-[11px] text-gray-500">An «Open a door» effect from any transform/pickup can also unlock this door at runtime.</p>
      </>)}
    </Section>
  );
}

// ---------- Main panel (embedded in the Props tab below the basic properties) ----------
function TransitionsEditor({ obj, set }: { obj: SceneObject; set: (p: Partial<SceneObject>, key?: string) => void }) {
  const sprites = useSprites();
  const ts = obj.transforms ?? [];
  const addRule = () => set({ transforms: [...ts, { requiresItem: '', consumesItem: true }] }, `${obj.id}:tf-add`);

  return (
    <div className="space-y-2">
      <ItemDatalist />

      <div className="flex items-center gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Rules</h4>
        <span className="text-[10px] text-gray-500">fire in order: rule 2 only after rule 1</span>
        <div className="flex-1" />
        <button className={btnCls} onClick={addRule}><Icon name="plus" size={12} /> Rule</button>
      </div>

      {ts.length === 0 && (
        <div className="rounded border border-dashed border-white/10 p-3 text-center space-y-1.5">
          <p className="text-[11px] text-gray-400">«{obj.name}» doesn’t change yet.</p>
          <button className={btnCls} onClick={addRule}><Icon name="plus" size={12} /> Add first rule</button>
        </div>
      )}

      {ts.map((_, i) => <RuleCard key={i} obj={obj} ts={ts} i={i} set={set} />)}

      {obj.pickupable && (
        <Card title="Pickup effects" subtitle="when this item is picked up" defaultOpen={!!obj.pickupEffects?.length}>
          <EffectsEditor effects={obj.pickupEffects ?? []} onChange={(next) => set({ pickupEffects: next.length ? next : undefined }, `${obj.id}:pk-eff`)} />
        </Card>
      )}
      {/* -------- Usability (locked objects / unlockWhen) -------- */}
      <UsabilitySection obj={obj} set={set} />
      {/* -------- Door -------- */}
      <DoorSection obj={obj} set={set} />
    </div>
  );
}

// ───────────────────────── public wrappers ─────────────────────────
/** Embeddable version (e.g. inside Properties). */
export function TransitionsPanel({ obj, set }: { obj: SceneObject; set: SetFn }) {
  return <TransitionsEditor obj={obj} set={set} />;
}

/** The dedicated "Transitions" tab of the Studio inspector. */
export function TransitionsTab() {
  const ctx = useCtx();
  const ids = useStudioStore((s) => s.selectedObjectIds);
  const selected = useMemo(() => (ctx ? ctx.objects.filter((o) => ids.includes(o.id)) : []), [ctx, ids]);

  if (selected.length === 0) {
    return (
      <div className="p-4 text-[12px] text-gray-400 space-y-2" dir="ltr">
        <p>Select a sprite to edit what it turns into.</p>
        <p className="text-[11px] text-gray-500">
          Every rule reads <b className="text-sky-300">When</b> → <b className="text-amber-300">Only if</b> → <b className="text-emerald-300">Then</b>.
          Rules run in order, and can reach other sprites, rooms and doors.
        </p>
      </div>
    );
  }
  if (selected.length > 1) return <div className="p-4 text-[12px] text-gray-400">Select a single sprite to edit its transitions.</div>;

  const obj = selected[0];
  const set: SetFn = (patch, key) => st().updateObject(obj.id, patch, key ?? `${obj.id}:${Object.keys(patch).join()}`);
  return (
    <div className="p-3 space-y-2 text-[12px]">
      <h3 className="font-semibold text-gray-100 truncate">Transitions — {obj.name}</h3>
      <TransitionsEditor obj={obj} set={set} />
    </div>
  );
}
