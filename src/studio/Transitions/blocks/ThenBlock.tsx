import React from 'react';
import { Block, Seg, Warn } from '../layout';
import { Field, Hint, inputCls, btnCls, Sub } from '../../ui';
import { ImgPick } from '../ImgPick';
import { OpacityAnimEditor } from '../OpacityAnimEditor';
import { EffectsEditor } from '../EffectsEditor';
import { useResolved } from '../../konva-bits';
import { filterOrUndef } from '../helpers';
import type { SceneObject, SpriteFilter, TransformRule } from '../../../shared/types';
import type { Trigger } from '../helpers';

export function ThenBlock({ obj, rule, index, trigger, upd }: { obj: SceneObject; rule: TransformRule; index: number; trigger: Trigger; upd: (p: Partial<TransformRule>) => void }) {
  const f = rule.filter ?? {};

  // Toggle (Repeat) is only meaningful on the last click rule of an object, and only when
  // the rule actually changes something (image / name / filter / hides).
  const isLast = index === (obj.transforms?.length ?? 0) - 1;
  const hasChange = !!rule.newSpriteId || !!rule.newName || !!rule.filter || !!rule.hides;
  let disabledRepeat = false;
  let reasonRepeat: string | undefined;
  if (trigger !== 'click') {
    disabledRepeat = true;
    reasonRepeat = 'Toggle needs a Click trigger';
  } else if (!isLast) {
    disabledRepeat = true;
    reasonRepeat = 'Only the last rule can toggle';
  } else if (!hasChange) {
    disabledRepeat = true;
    reasonRepeat = 'Pick a New image first';
  }

  const origSrc = useResolved(obj.spriteRef);
  const afterSrc = useResolved(rule.newSpriteId ?? '');
  const setF = (p: SpriteFilter) => upd({ filter: filterOrUndef({ ...f, ...p }) });
  return (
    <Block n="3" title="Then" tone="then" hint="what happens">
      <Sub title="Appearance" defaultOpen>
        <Field label="New image" stack>
          <ImgPick value={rule.newSpriteId} onChange={(r) => upd({ newSpriteId: r })} />
        </Field>
        <Field label="Repeat" stack>
          <Seg
            value={rule.toggle ? 'toggle' : 'once'}
            options={[
              { v: 'once', label: 'Once', title: 'Apply this rule once per click' },
              { v: 'toggle', label: 'Toggle back and forth', title: 'Each click switches between the original look and the new look' },
            ]}
            onChange={(v) => upd({ toggle: v === 'toggle' ? true : undefined })}
            disabled={disabledRepeat}
          />
          {reasonRepeat && <Hint>{reasonRepeat}</Hint>}
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
        <label className="flex items-center gap-2 text-[11px] text-gray-300">
          <input
            type="checkbox"
            checked={!!rule.hides}
            onChange={(e) => upd({ hides: e.target.checked ? true : undefined })}
          />
          Disappears while this rule is active
        </label>
        {rule.toggle && (
          <div className="space-y-1 border-t border-white/5 pt-1.5">
            <div className="flex items-center gap-2 text-[10px] text-gray-400">
              <span className="w-14 text-center">Original</span>
              <span className="text-gray-600">→</span>
              <span className="w-14 text-center">After rule</span>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex flex-col items-center gap-0.5">
                {origSrc ? (
                  <img src={origSrc} alt="" className="w-10 h-10 rounded border border-line bg-black/30" />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-800" />
                )}
                <span className="text-[9px] text-gray-500">Original</span>
              </div>
              <span className="text-gray-500 text-xs">→</span>
              <div className="flex flex-col items-center gap-0.5">
                {afterSrc ? (
                  <img src={afterSrc} alt="" className="w-10 h-10 rounded border border-line bg-black/30" />
                ) : (
                  <div className="w-10 h-10 rounded bg-gray-800" />
                )}
                <span className="text-[9px] text-gray-500">After rule</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400">Click 1 → new look · Click 2 → original</p>
          </div>
        )}
        <Field label="Cross-fade (fade)" stack>
          <OpacityAnimEditor value={rule.fade} onChange={(v) => upd({ fade: v })} />
        </Field>
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
