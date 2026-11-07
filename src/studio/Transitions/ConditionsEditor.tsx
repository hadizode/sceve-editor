import React, { useMemo } from 'react';
import { Sub, ListInput, NumInput, btnCls, Hint, inputCls } from '../ui';
import { Icon, IconButton } from '../icons';
import { useProjectObjects } from './hooks';
import { mergeCond, short } from './helpers';
import { PositionRow } from './PositionRow';
import type { TransformCondition } from '../../shared/types';

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
                  setC({
                    transformedObjects: tos.map((x, j) =>
                      j === i ? { sceneId: sid || undefined, objectId: oid, minRule: x.minRule } : x
                    ),
                  });
                }}
              >
                <option value="|">— sprite —</option>
                {candidates.filter((t) => !used.has(t.key) || t.key === key).map((t) => (
                  <option key={t.key} value={t.key}>
                    {short(t.sceneTitle)} › {short(t.objTitle)} ({t.obj.transforms!.length})
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-gray-400 shrink-0" title="Which rule of that sprite must already have fired">
                rule ≥
              </span>
              <div className="w-12 shrink-0">
                <NumInput
                  value={(e.minRule ?? 0) + 1}
                  min={1}
                  onChange={(n) =>
                    setC({
                      transformedObjects: tos.map((x, j) =>
                        j === i ? { ...x, minRule: Math.max(0, Math.floor(n) - 1) } : x
                      ),
                    })
                  }
                />
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
