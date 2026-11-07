import React from 'react';
import { Card, Field, ListInput, inputCls } from '../ui';
import { useStudioStore } from '../../stores/store';
import { useRooms } from './hooks';
import { EffectsEditor } from './EffectsEditor';
import { short } from './helpers';
import type { SceneObject } from '../../shared/types';
import type { SetFn } from './helpers';

export function DoorSection({ obj, set }: { obj: SceneObject; set: SetFn }) {
  const rooms = useRooms();
  const curScene = useStudioStore((s) => s.currentSceneId);
  const door = obj.door;
  const sceneList = rooms;
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
      {door && (
        <>
          <Field label="Goes to room">
            <select
              className={inputCls}
              value={door.sceneId}
              onChange={(e) => set({ door: { ...door, sceneId: e.target.value } }, `${obj.id}:door`)}
            >
              <option value="">— choose —</option>
              {sceneList.map((sc) => <option key={sc.id} value={sc.id}>{sc.title}</option>)}
            </select>
          </Field>
          <Field label="Items required to pass (comma separated, empty = always open)">
            <ListInput value={door.requiresItems} onChange={(v) => set({ door: { ...door, requiresItems: v } }, `${obj.id}:doorreq`)} placeholder="key-gold, fuse" />
          </Field>
          <Field label="Locked message">
            <input
              className={inputCls}
              dir="rtl"
              lang="fa"
              value={door.lockedMessage ?? ''}
              onChange={(e) => set({ door: { ...door, lockedMessage: e.target.value || undefined } }, `${obj.id}:doorlock`)}
            />
          </Field>
          <Field label="When the player walks through, also…">
            <EffectsEditor
              effects={door.onEnterEffects ?? []}
              onChange={(next) => set({ door: { ...door, onEnterEffects: next.length ? next : undefined } }, `${obj.id}:door-eff`)}
            />
          </Field>
          <p className="text-[11px] text-gray-500">An «Open a door» effect from any transform/pickup can also unlock this door at runtime.</p>
        </>
      )}
    </Card>
  );
}
