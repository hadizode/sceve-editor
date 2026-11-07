import React from 'react';
import { Block, Seg, Warn } from '../layout';
import { Field, Hint, inputCls } from '../../ui';
import { hasLists } from '../helpers';
import type { SceneObject, TransformRule } from '../../../shared/types';
import type { Trigger } from '../helpers';

export function WhenBlock({
  obj,
  rule,
  index,
  trigger,
  setTrigger,
  upd,
}: {
  obj: SceneObject;
  rule: TransformRule;
  /** Position of this rule in the object's chain. Toggle only makes sense on the last one. */
  index: number;
  trigger: Trigger;
  setTrigger: (t: Trigger) => void;
  upd: (p: Partial<TransformRule>) => void;
}) {
  return (
    <Block n="1" title="When" tone="when" hint="what triggers this rule">
      <Seg<Trigger>
        value={trigger}
        onChange={setTrigger}
        options={[
          { v: 'click', label: 'Click', title: 'Fires when the player clicks the object' },
          { v: 'item', label: 'Use item', title: 'Fires when the player uses a chosen inventory item on the object' },
          { v: 'auto', label: 'Automatic', title: 'Fires by itself the moment all conditions hold — no click' },
        ]}
      />
      {trigger === 'item' && (
        <>
          <Field label="Item that must be used" stack>
            <input
              className={inputCls}
              list="item-ids"
              value={rule.requiresItem}
              placeholder="e.g. wire-cutter"
              onChange={(e) => upd({ requiresItem: e.target.value.trim() })}
            />
          </Field>
          {!rule.requiresItem && (
            <Warn>No item chosen — until you pick one this rule fires on a plain click.</Warn>
          )}
        </>
      )}
      {trigger === 'click' && <Hint>Plain click. Add conditions below to make it wait for something.</Hint>}
      {trigger === 'click' &&
        index === (obj.transforms?.length ?? 0) - 1 &&
        !!rule.newSpriteId && (
          <label className="flex items-center gap-2 text-[11px] text-gray-300">
            <input
              type="checkbox"
              checked={!!rule.toggle}
              onChange={(e) => upd({ toggle: e.target.checked ? true : undefined })}
            />
            {'Toggle: each click switches back and forth'}
          </label>
        )}
      {trigger === 'auto' && (
        <>
          <Hint>
            Fires instantly when every condition below becomes true, and the player doesn’t click anything.
          </Hint>
          {!hasLists(rule.conditions) && (
            <Warn>Automatic needs at least one condition, otherwise it can never fire (and is dropped on reload).</Warn>
          )}
        </>
      )}
    </Block>
  );
}
