import React, { useState } from 'react';
import { Section, Field, Check, inputCls } from '../ui';
import { ImgPick } from './ImgPick';
import { OpacityAnimEditor } from './OpacityAnimEditor';
import { Warn } from './layout';
import type { SceneObject } from '../../shared/types';
import type { SetFn } from './helpers';
import type { OpacityAnim } from '../../shared/opacity-anim';

type TwoState = NonNullable<SceneObject['twoState']>;

/** "Two states" checkbox + A / B image pickers, initial state, cross-fade anim, toggle-on-click. */
export function TwoStateSection({ obj, set }: { obj: SceneObject; set: SetFn }) {
  const ts = obj.twoState;
  const enabled = !!ts;
  const cur: TwoState = ts ?? {
    a: obj.spriteRef ?? '',
    b: '',
    initial: 'a',
    toggleOnClick: false,
    anim: { duration: 500 },
  };

  const write = (next: TwoState | undefined) => set({ twoState: next }, `${obj.id}:twostate`);

  const enable = () =>
    write({
      a: obj.spriteRef ?? '',
      b: '',
      initial: 'a',
      toggleOnClick: false,
      anim: { duration: 500 },
    });

  const patch = (upd: Partial<TwoState>) => write({ ...cur, ...upd } as TwoState);

  return (
    <Section title="Two states">
      <div className="flex items-center gap-2 text-gray-300 text-[11px]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => (e.target.checked ? enable() : write(undefined))}
        />
        <span>Two-state sprite — cross-fade between two images</span>
      </div>
      {!enabled && (
        <p className="text-[11px] text-gray-500">
          Turn on to give this sprite two images (A / B) that cross-fade when its state changes.
        </p>
      )}
      {enabled && (
        <div className="space-y-2">
          <Field label="Image A" stack>
            <ImgPick value={cur.a || undefined} onChange={(v) => patch({ a: v ?? '' })} />
          </Field>
          <Field label="Image B" stack>
            <ImgPick value={cur.b || undefined} onChange={(v) => patch({ b: v ?? '' })} />
          </Field>
          {!cur.a && <Warn>Image A is empty — the sprite has nothing to show in state A.</Warn>}
          <Field label="Initial state" stack>
            <select
              className={inputCls}
              value={cur.initial ?? 'a'}
              onChange={(e) => patch({ initial: e.target.value as 'a' | 'b' })}
            >
              <option value="a">A</option>
              <option value="b">B</option>
            </select>
          </Field>
          <Field label="Cross-fade animation" stack>
            <OpacityAnimEditor value={cur.anim} onChange={(v) => patch({ anim: v })} />
          </Field>
          <Check
            label="Toggle on click"
            checked={!!cur.toggleOnClick}
            onChange={(v) => patch({ toggleOnClick: v })}
            hint="Clicking the sprite flips between A and B without needing a rule."
          />
        </div>
      )}
    </Section>
  );
}
