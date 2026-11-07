import React from 'react';
import { Field, Hint, inputCls, btnCls, ListInput } from '../ui';
import { Warn } from './layout';
import { Icon, IconButton } from '../icons';
import { useProjectObjects, useRooms } from './hooks';
import { useStudioStore } from '../../stores/store';
import { short, shortName } from './helpers';
import { ImgPick } from './ImgPick';
import type { TransformEffect } from '../../shared/types';

export const ACTIONS: { v: TransformEffect['action']; label: string }[] = [
  { v: 'transform', label: 'Transform another object' },
  { v: 'background', label: 'Change background' },
  { v: 'unlockDoor', label: 'Open a door' },
  { v: 'setUsable', label: 'Lock / unlock an object' },
];

export function EffectCard({
  eff,
  idx,
  onChange,
  onRemove,
}: {
  eff: TransformEffect;
  idx: number;
  onChange: (p: Partial<TransformEffect>) => void;
  onRemove: () => void;
}) {
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
        <select
          className={`${inputCls} flex-1`}
          value={eff.action}
          onChange={(e) =>
            onChange({
              action: e.target.value as TransformEffect['action'],
              objectId: undefined,
              doorObjectId: undefined,
              ruleIndex: undefined,
              usable: undefined,
            })
          }
        >
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
                onChange({
                  sceneId: !sid || sid === curScene ? undefined : sid,
                  objectId: oid || undefined,
                  ruleIndex: 0,
                });
              }}
            >
              <option value="">— choose —</option>
              {allObjs.filter((t) => t.obj.transforms?.length).map((t) => (
                <option key={t.key} value={t.key}>
                  {short(t.sceneTitle)} › {short(t.objTitle)}
                </option>
              ))}
            </select>
          </Field>
          {target?.transforms && (
            <Field label="Which rule" stack>
              <select className={inputCls} value={eff.ruleIndex ?? 0} onChange={(e) => onChange({ ruleIndex: Number(e.target.value) })}>
                {target.transforms.map((t, i) => (
                  <option key={i} value={i}>
                    Rule {i + 1}{t.newName ? ` — ${short(t.newName, 20)}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}
      {eff.action === 'setUsable' && (
        <>
          <Field label="Object to lock / unlock">
            <select
              className={inputCls}
              value={eff.objectId ?? ''}
              onChange={(e) => onChange({ objectId: e.target.value || undefined })}
            >
              <option value="">— choose —</option>
              {targets.map((t) => (
                <option key={t.key} value={t.obj.id}>
                  {shortName(t.sceneTitle)} › {shortName(t.objTitle)}{t.obj.door ? ' 🚪' : ''}
                </option>
              ))}
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
            <select
              className={inputCls}
              value={eff.sceneId ?? ''}
              onChange={(e) => onChange({ sceneId: e.target.value || undefined })}
            >
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
          <select
            className={inputCls}
            value={eff.doorObjectId ?? ''}
            onChange={(e) => onChange({ doorObjectId: e.target.value || undefined })}
          >
            <option value="">— choose —</option>
            {allObjs.filter((t) => t.obj.door).map((t) => (
              <option key={t.key} value={t.obj.id}>
                {short(t.sceneTitle)} › {short(t.objTitle)}
              </option>
            ))}
          </select>
          {!allObjs.some((t) => t.obj.door) && <Warn>No door exists yet. Mark a sprite as a door first.</Warn>}
        </Field>
      )}
      <Field label="Toast message (optional)" stack>
        <input
          className={inputCls}
          dir="rtl"
          lang="fa"
          value={eff.message ?? ''}
          onChange={(e) => onChange({ message: e.target.value || undefined })}
        />
      </Field>
    </div>
  );
}
