import React from 'react';
import { Block, Seg, Warn } from '../layout';
import { Field, Hint, inputCls } from '../../ui';
import { hasLists } from '../helpers';
import type { TransformRule } from '../../../shared/types';
import type { Trigger } from '../helpers';

export function WhenBlock({
  rule,
  trigger,
  setTrigger,
  upd,
}: {
  rule: TransformRule;
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
