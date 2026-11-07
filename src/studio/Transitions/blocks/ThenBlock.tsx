import React from 'react';
import { Block, Warn } from '../layout';
import { Field, Hint, inputCls, btnCls, Sub } from '../../ui';
import { ImgPick } from '../ImgPick';
import { EffectsEditor } from '../EffectsEditor';
import { filterOrUndef } from '../helpers';
import type { SceneObject, SpriteFilter, TransformRule } from '../../../shared/types';
import type { Trigger } from '../helpers';

export function ThenBlock({ obj, rule, trigger, upd }: { obj: SceneObject; rule: TransformRule; trigger: Trigger; upd: (p: Partial<TransformRule>) => void }) {
  const f = rule.filter ?? {};
  const setF = (p: SpriteFilter) => upd({ filter: filterOrUndef({ ...f, ...p }) });
  return (
    <Block n="3" title="Then" tone="then" hint="what happens">
      <Sub title="Appearance" defaultOpen>
        <Field label="New image" stack>
          <ImgPick value={rule.newSpriteId} onChange={(r) => upd({ newSpriteId: r })} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="New name" stack>
            <input
              className={inputCls}
              dir="rtl"
              lang="fa"
              value={rule.newName ?? ''}
              placeholder={obj.name}
              onChange={(e) => upd({ newName: e.target.value || undefined })}
            />
          </Field>
          <Field label="Message" stack>
            <input
              className={inputCls}
              dir="rtl"
              lang="fa"
              value={rule.newMessage ?? ''}
              onChange={(e) => upd({ newMessage: e.target.value || undefined })}
            />
          </Field>
        </div>
        <div className="space-y-1.5 border-t border-white/5 pt-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400">Colour filter (while this rule is showing)</span>
            {rule.filter && (
              <button className={btnCls} onClick={() => upd({ filter: undefined })}>
                Reset
              </button>
            )}
          </div>
          <div className="flex gap-4 text-[11px] text-gray-300">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!f.invert} onChange={(e) => setF({ invert: e.target.checked ? 1 : undefined })} /> Invert
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!f.grayscale} onChange={(e) => setF({ grayscale: e.target.checked ? 1 : undefined })} /> Grayscale
            </label>
          </div>
          <Field label={`Hue rotate — ${f.hueRotate ?? 0}°`} stack>
            <input
              type="range"
              min={0}
              max={360}
              className="w-full"
              value={f.hueRotate ?? 0}
              onChange={(e) => setF({ hueRotate: Number(e.target.value) || undefined })}
            />
          </Field>
          <Field label={`Brightness — ${(f.brightness ?? 1).toFixed(2)}×`} stack>
            <input
              type="range"
              min={0}
              max={3}
              step={0.05}
              className="w-full"
              value={f.brightness ?? 1}
              onChange={(e) => setF({ brightness: Number(e.target.value) })}
            />
          </Field>
        </div>
      </Sub>
      <Sub title="Items" defaultOpen={!!rule.grantsItem}>
        <Field label="Gives item" stack>
          <input
            className={inputCls}
            list="item-ids"
            value={rule.grantsItem ?? ''}
            placeholder="item id"
            onChange={(e) => upd({ grantsItem: e.target.value.trim() || undefined })}
          />
        </Field>
        {trigger === 'item' && (
          <label className="flex items-center gap-2 text-[11px] text-gray-300">
            <input
              type="checkbox"
              checked={rule.consumesItem !== false}
              onChange={(e) => upd({ consumesItem: e.target.checked })}
            />
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
        {!rule.effects?.length && (
          <Hint>Fire a rule on another sprite (even in another room), swap a room background, or open a door.</Hint>
        )}
      </Sub>
    </Block>
  );
}
