import React, { useMemo } from 'react';
import { useCtx, useStudioStore } from '../../stores/store';
import type { SceneObject } from '../../shared/types';
import type { SetFn } from './helpers';
import { st } from './helpers';
import { TransitionsEditor } from './TransitionsEditor';

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
