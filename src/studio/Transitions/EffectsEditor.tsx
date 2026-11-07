import React from 'react';
import { btnCls } from '../ui';
import { Icon } from '../icons';
import { EffectCard } from './EffectCard';
import type { TransformEffect } from '../../shared/types';

export function EffectsEditor({ effects, onChange }: { effects: TransformEffect[]; onChange: (next: TransformEffect[]) => void }) {
  const upd = (i: number, p: Partial<TransformEffect>) => onChange(effects.map((e, j) => (j === i ? { ...e, ...p } : e)));
  return (
    <div className="space-y-2">
      {effects.map((e, i) => (
        <EffectCard
          key={i}
          eff={e}
          idx={i}
          onChange={(p) => upd(i, p)}
          onRemove={() => onChange(effects.filter((_, j) => j !== i))}
        />
      ))}
      <button className={`${btnCls} w-full`} onClick={() => onChange([...effects, { action: 'transform' }])}>
        <Icon name="plus" size={12} /> Add effect
      </button>
    </div>
  );
}
