import React, { useState } from 'react';
import { Card } from '../ui';
import { Icon, IconButton } from '../icons';
import { WhenBlock } from './blocks/WhenBlock';
import { IfBlock } from './blocks/IfBlock';
import { ThenBlock } from './blocks/ThenBlock';
import { mergeCond, triggerOf, condCount, short } from './helpers';
import type { SceneObject, TransformRule } from '../../shared/types';
import type { Trigger, SetFn } from './helpers';

/** One-line rule summary shown in the card header. */
function summarize(obj: SceneObject, t: TransformRule, trigger: Trigger): string {
  const when = trigger === 'click' ? 'Click' : trigger === 'item' ? `Use “${t.requiresItem || '?'}”` : 'Automatic';
  const n = condCount(t.conditions);
  const then: string[] = [];
  if (t.hides) then.push('disappears');
  if (t.newName) then.push(`becomes “${short(t.newName, 16)}”`);
  else if (t.newSpriteId) then.push('new look');
  if (t.filter) then.push('filter');
  if (t.fade) then.push('fade');
  if (t.grantsItem) then.push(`gives ${t.grantsItem}`);
  if (t.effects?.length) then.push(`${t.effects.length} effect${t.effects.length > 1 ? 's' : ''}`);
  return `${when}${n ? ` · if ${n}` : ''} → ${then.join(', ') || obj.name}`;
}

export function RuleCard({ obj, ts, i, set }: { obj: SceneObject; ts: TransformRule[]; i: number; set: SetFn }) {
  const rule = ts[i];
  const [trigger, setTriggerState] = useState<Trigger>(() => triggerOf(rule));
  const write = (next: TransformRule[], k: string) => set({ transforms: next.length ? next : undefined }, `${obj.id}:tf-${k}`);
  const upd = (p: Partial<TransformRule>) => write(ts.map((t, j) => (j === i ? { ...t, ...p } : t)), `${i}:${Object.keys(p)[0]}`);

  const setTrigger = (m: Trigger) => {
    setTriggerState(m);
    if (m === 'item') upd({ conditions: mergeCond(rule.conditions, { autoApply: false }) });
    else if (m === 'click') upd({ conditions: mergeCond(rule.conditions, { autoApply: false }) });
    else upd({ requiresItem: '', conditions: mergeCond(rule.conditions, { autoApply: true }) });
  };

  const move = (d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= ts.length) return;
    const n = [...ts];
    [n[i], n[j]] = [n[j], n[i]];
    write(n, 'move');
  };

  return (
    <Card title={`Rule ${i + 1}`} subtitle={summarize(obj, rule, trigger)} defaultOpen={ts.length === 1 || i === ts.length - 1} onRemove={() => write(ts.filter((_, j) => j !== i), 'del')}>
      <div className="flex justify-end gap-0.5 -mt-0.5">
        <IconButton icon="arrowUp" compact title="Move earlier in the chain" disabled={i === 0} onClick={() => move(-1)} />
        <IconButton icon="arrowDown" compact title="Move later in the chain" disabled={i === ts.length - 1} onClick={() => move(1)} />
        <IconButton icon="copy" compact title="Duplicate rule" onClick={() => write([...ts.slice(0, i + 1), structuredClone(rule), ...ts.slice(i + 1)], 'dup')} />
      </div>
      <WhenBlock rule={rule} trigger={trigger} setTrigger={setTrigger} upd={upd} />
      <IfBlock obj={obj} rule={rule} upd={upd} />
      <ThenBlock obj={obj} rule={rule} trigger={trigger} upd={upd} />
    </Card>
  );
}
