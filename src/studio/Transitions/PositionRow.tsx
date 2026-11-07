import React, { useMemo, useState } from 'react';
import { livePoint } from '../../shared/geometry';
import { NumInput, inputCls, btnCls, Field } from '../ui';
import { IconButton } from '../icons';
import { Warn } from './layout';
import { short } from './helpers';
import type { ProjectObj } from './hooks';
import type { PositionReq, SceneObject } from '../../shared/types';

export const OPS: { v: 'eq' | 'gte' | 'lte'; label: string }[] = [
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

export function PositionRow({
  r,
  objs,
  onChange,
  onRemove,
}: {
  r: PositionReq;
  objs: ProjectObj[];
  onChange: (p: Partial<PositionReq>) => void;
  onRemove: () => void;
}) {
  const key = `${r.sceneId ?? ''}|${r.objectId}`;
  const target = objs.find((t) => t.obj.id === r.objectId)?.obj;
  const hasX = Number.isFinite(r.x);
  const hasY = Number.isFinite(r.y);
  const sorted = useMemo(
    () => [...objs].sort((a, b) => Number(!!b.obj.motion) - Number(!!a.obj.motion)),
    [objs]
  );
  const axis = (label: 'X' | 'Y', on: boolean, val: number | undefined) => (
    <label className="flex items-center gap-1 text-[11px]">
      <input
        type="checkbox"
        checked={on}
        title="Axis enabled — a disabled axis is NOT checked"
        onChange={(e) => onChange({ [label.toLowerCase()]: e.target.checked ? 0 : undefined })}
      />
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
          {sorted.map((t) => (
            <option key={t.key} value={t.key}>
              {t.obj.motion ? '🔄 ' : ''}{short(t.sceneTitle)} › {short(t.objTitle)}
            </option>
          ))}
        </select>
        <select
          className={`${inputCls} w-14 shrink-0`}
          value={r.op ?? 'eq'}
          onChange={(e) => onChange({ op: e.target.value as PositionReq['op'] })}
        >
          {OPS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
        </select>
        <IconButton icon="x" compact danger title="Remove" onClick={onRemove} />
      </div>
      <div className="grid grid-cols-2 gap-2">{axis('X', hasX, r.x)}{axis('Y', hasY, r.y)}</div>
      <div className="grid grid-cols-3 gap-1.5">
        <Field label="Anchor X">
          <NumInput
            value={r.anchor?.x ?? 0.5}
            step={0.05}
            onChange={(n) => onChange({ anchor: { x: n, y: r.anchor?.y ?? 0.5 } })}
          />
        </Field>
        <Field label="Anchor Y">
          <NumInput
            value={r.anchor?.y ?? 0.5}
            step={0.05}
            onChange={(n) => onChange({ anchor: { x: r.anchor?.x ?? 0.5, y: n } })}
          />
        </Field>
        <Field label="Tolerance px">
          <NumInput value={r.tolerance ?? 2} min={0} onChange={(n) => onChange({ tolerance: Math.max(0, n) })} />
        </Field>
      </div>
      {target?.motion && <PosPreview obj={target} r={r} onApply={onChange} />}
      {target && !target.motion && <Warn>"{target.name}" has no Motion, so it never moves.</Warn>}
      <details className="text-[11px] text-gray-400">
        <summary className="cursor-pointer select-none">Or by click count (e.g. clock: every 12, on click 3)</summary>
        <div className="grid grid-cols-2 gap-2 mt-1">
          <Field label="Cycle size">
            <NumInput
              value={r.stepsMod ?? 0}
              min={0}
              onChange={(n) => {
                const m = Math.floor(n);
                onChange(
                  m > 0 ? { stepsMod: m, stepsEq: Math.min(r.stepsEq ?? 0, m - 1) } : { stepsMod: undefined, stepsEq: undefined }
                );
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
