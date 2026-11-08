import React from 'react';
import { Field, NumInput, inputCls } from '../ui';
import type { OpacityAnim, OpacityEasing } from '../../shared/opacity-anim';
import { normalizeOpacityAnim } from '../../shared/opacity-anim';

const EASINGS: { v: OpacityEasing; label: string }[] = [
  { v: 'linear', label: 'Linear' },
  { v: 'ease', label: 'Ease' },
  { v: 'ease-in', label: 'Ease in' },
  { v: 'ease-out', label: 'Ease out' },
  { v: 'ease-in-out', label: 'Ease in-out' },
];

/** Reusable editor for a two-state sprite cross-fade animation (duration / easing / delay). */
export function OpacityAnimEditor({
  value,
  onChange,
}: {
  value?: OpacityAnim;
  onChange: (v: OpacityAnim | undefined) => void;
}) {
  const n = normalizeOpacityAnim(value);
  const write = (patch: Partial<OpacityAnim>) => onChange({ ...n, ...patch } as OpacityAnim);
  return (
    <div className="space-y-1.5 border-t border-white/5 pt-1.5">
      <Field label="Duration (ms)" stack>
        <NumInput value={n.duration} min={0} step={50} onChange={(v) => write({ duration: v })} />
      </Field>
      <Field label="Easing" stack>
        <select
          className={inputCls}
          value={n.easing}
          onChange={(e) => write({ easing: e.target.value as OpacityEasing })}
        >
          {EASINGS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Delay (ms)" stack>
        <NumInput value={n.delay} min={0} step={50} onChange={(v) => write({ delay: v })} />
      </Field>
      <p className="text-[10px] text-gray-500">0 = instant swap, default 500 ms.</p>
    </div>
  );
}
