import React, { useMemo } from 'react';
import { useSprites } from '../../stores/store';
import type { SceneObject } from '../../shared/types';
import type { SetFn } from './helpers';
import { ItemDatalist } from './ItemDatalist';
import { RuleCard } from './RuleCard';
import { UsabilitySection } from './UsabilitySection';
import { DoorSection } from './DoorSection';
import { EffectsEditor } from './EffectsEditor';
import { btnCls, Card } from '../ui';
import { Icon } from '../icons';

// ---------- Main panel (embedded in the Props tab below the basic properties) ----------
export function TransitionsEditor({ obj, set }: { obj: SceneObject; set: SetFn }) {
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
        <button className={btnCls} onClick={addRule}>
          <Icon name="plus" size={12} /> Rule
        </button>
      </div>

      {ts.length === 0 && (
        <div className="rounded border border-dashed border-white/10 p-3 text-center space-y-1.5">
          <p className="text-[11px] text-gray-400">«{obj.name}» doesn’t change yet.</p>
          <button className={btnCls} onClick={addRule}>
            <Icon name="plus" size={12} /> Add first rule
          </button>
        </div>
      )}

      {ts.map((_, i) => <RuleCard key={i} obj={obj} ts={ts} i={i} set={set} />)}

      {obj.pickupable && (
        <Card title="Pickup effects" subtitle="when this item is picked up" defaultOpen={!!obj.pickupEffects?.length}>
          <EffectsEditor
            effects={obj.pickupEffects ?? []}
            onChange={(next) => set({ pickupEffects: next.length ? next : undefined }, `${obj.id}:pk-eff`)}
          />
        </Card>
      )}
      {/* -------- Usability (locked objects / unlockWhen) -------- */}
      <UsabilitySection obj={obj} set={set} />
      {/* -------- Door -------- */}
      <DoorSection obj={obj} set={set} />
    </div>
  );
}
