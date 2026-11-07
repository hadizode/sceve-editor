import React from 'react';
import { Block } from '../layout';
import { ConditionsEditor } from '../ConditionsEditor';
import type { SceneObject, TransformRule } from '../../../shared/types';

export function IfBlock({ obj, rule, upd }: { obj: SceneObject; rule: TransformRule; upd: (p: Partial<TransformRule>) => void }) {
  const c = rule.conditions;
  return (
    <Block n="2" title="Only if" tone="if" hint="all must hold — empty = always">
      <ConditionsEditor cond={c} onChange={(next) => upd({ conditions: next })} excludeObjId={obj.id} />
    </Block>
  );
}
