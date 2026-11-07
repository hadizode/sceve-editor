import React from 'react';
import { Section, Field, inputCls } from '../ui';
import { ConditionsEditor } from './ConditionsEditor';
import type { SceneObject } from '../../shared/types';

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
      {locked && (
        <>
          <Field label="Message while locked">
            <input
              className={inputCls}
              dir="rtl"
              lang="fa"
              value={obj.unusableMessage ?? ''}
              onChange={(e) => set({ unusableMessage: e.target.value || undefined }, `${obj.id}:unmsg`)}
            />
          </Field>
          <p className="text-[11px] text-gray-500">
            While locked, clicking only shows this message. A «Lock / unlock an object» effect from any
            transform/pickup can free it — or define a condition below so it unlocks by itself the moment it holds.
          </p>
          <ConditionsEditor cond={obj.unlockWhen} onChange={(next) => set({ unlockWhen: next }, `${obj.id}:unlockWhen`)} />
        </>
      )}
    </Section>
  );
}
