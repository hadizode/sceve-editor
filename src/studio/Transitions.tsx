import React, { useRef } from 'react';
import { useStudioStore } from '../stores/store';
import type { TransformRule, TransformEffect } from '../shared/types';
import { Icon, IconButton } from './icons';

// ============ Small UI primitives (local copy) ============
const inputCls =
  'bg-[#2a2a2a] border border-white/10 rounded px-1.5 py-1 text-[12px] text-gray-200 ' +
  'focus:outline-none focus:border-indigo-400/60 w-full';

const btnCls =
  'inline-flex items-center justify-center gap-1 rounded bg-[#3a3a3a] border border-white/10 ' +
  'px-2 py-1 text-[11px] text-gray-200 hover:bg-[#4a4a4a] disabled:opacity-40 disabled:pointer-events-none';

function Section({
  title,
  badge,
  right,
  children,
}: {
  title: string;
  badge?: number;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-white/5 pt-2">
      <div className="flex items-center gap-1 mb-1.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h4>
        {badge !== undefined && (
          <span className="rounded-full bg-white/10 px-1.5 text-[10px] leading-4 text-gray-300">{badge}</span>
        )}
        <div className="flex-1" />
        {right}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-0.5">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
      {children}
    </label>
  );
}

// ============ Image picker (text field + upload button) ============
function ImgPick({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => onChange(String(r.result));
    r.readAsDataURL(f);
    e.target.value = '';
  };
  return (
    <Field label={label}>
      <div className="flex items-center gap-1">
        <input className={inputCls} value={value} placeholder="URL or data URI" onChange={(e) => onChange(e.target.value)} />
        <IconButton icon="upload" solid title="Upload image" onClick={() => file.current?.click()} />
        <input ref={file} type="file" accept="image/*" className="hidden" onChange={onFile} />
      </div>
      {value && (
        <img src={value} alt="" className="mt-1 max-h-16 rounded border border-white/10 object-contain" />
      )}
    </Field>
  );
}

// ============ Transitions panel ============
export function TransitionsPanel() {
  const scenes = useStudioStore((s) => s.scenes);
  const currentSceneId = useStudioStore((s) => s.currentSceneId);
  const selectedObjectIds = useStudioStore((s) => s.selectedObjectIds);
  const updateObject = useStudioStore((s) => s.updateObject);
  const scene = currentSceneId ? scenes[currentSceneId] : null;
  const obj = scene?.objects.find((o) => o.id === selectedObjectIds[0]);
  if (!obj) return null;

  const rules = obj.transforms ?? [];
  const setRules = (next: TransformRule[]) =>
    updateObject(obj.id, { transforms: next.length > 0 ? next : undefined });

  const updateRule = (i: number, patch: Partial<TransformRule>) =>
    setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRule = (i: number) => setRules(rules.filter((_, j) => j !== i));
  const addRule = () =>
    setRules([...rules, { requiresItem: '', newMessage: '', consumesItem: true }]);

  // Effects applied after the transform fires (per rule)
  const setRuleEffects = (i: number, next: TransformEffect[]) =>
    updateRule(i, { effects: next.length > 0 ? next : undefined });
  const addEffect = (i: number) =>
    setRuleEffects(i, [...(rules[i].effects ?? []), { type: 'fadeIn', durationMs: 500 }]);

  return (
    <Section
      title="Transforms"
      badge={rules.length || undefined}
      right={<IconButton icon="plus" compact title="Add transform rule" onClick={addRule} />}
    >
      {rules.length === 0 && (
        <p className="text-[11px] text-gray-600">No transforms defined</p>
      )}

      {rules.map((rule, i) => {
        const objs = rule.requiresItems ?? (rule.requiresItem ? [rule.requiresItem] : []);
        const instant = !!rule.instant;
        const effects = rule.effects ?? [];
        return (
          <div key={i} className="space-y-1.5 rounded bg-black/20 p-2">
            <div className="flex items-center justify-between gap-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-300">
                <Icon name="pencil" size={12} /> Transform {i + 1}
              </span>
              <IconButton icon="trash" title="Remove rule" compact danger onClick={() => removeRule(i)} />
            </div>

            {/* Conditions: objects/items that must be present */}
            <Field label="Object must be transformed / required items">
              <div className="space-y-1">
                {objs.map((_o, j) => (
                  <div key={j} className="flex items-center gap-1">
                    <input
                      className={inputCls}
                      value={_o}
                      onChange={(e) => {
                        const next = objs.map((v, k) => (k === j ? e.target.value : v));
                        updateRule(i, { requiresItems: next, requiresItem: next[0] ?? '' });
                      }}
                    />
                    <IconButton icon="x" compact danger title="Remove" onClick={() => setObjs(objs.filter((_, k) => k !== j))} />
                  </div>
                ))}
                <button className={`${btnCls} w-full`} onClick={() => setObjs([...objs, ''])}>
                  <Icon name="plus" size={12} /> Object must be transformed
                </button>
              </div>
            </Field>

            <ImgPick
              label="New image"
              value={rule.newImageUrl ?? ''}
              onChange={(v) => updateRule(i, { newImageUrl: v || undefined })}
            />

            <Field label="New name">
              <input
                className={inputCls}
                value={rule.newName ?? ''}
                onChange={(e) => updateRule(i, { newName: e.target.value || undefined })}
              />
            </Field>

            <Field label="New message">
              <input
                dir="rtl"
                lang="fa"
                className={inputCls}
                value={rule.newMessage ?? ''}
                onChange={(e) => updateRule(i, { newMessage: e.target.value || undefined })}
              />
            </Field>

            <Field label="Grants item">
              <input
                className={inputCls}
                value={rule.grantsItem ?? ''}
                onChange={(e) => updateRule(i, { grantsItem: e.target.value || undefined })}
              />
            </Field>

            <label className="flex items-center gap-2 text-[11px] text-gray-400">
              <input
                type="checkbox"
                checked={rule.consumesItem !== false}
                onChange={(e) => updateRule(i, { consumesItem: e.target.checked })}
              />
              Consumes item
            </label>

            <label className="flex items-center gap-2 text-[11px] text-gray-400">
              <input
                type="checkbox"
                checked={!!rule.triggersDiscovery}
                onChange={(e) => updateRule(i, { triggersDiscovery: e.target.checked || undefined })}
              />
              Triggers discovery
            </label>

            <label className="flex items-center gap-2 text-[11px] text-gray-400">
              <input
                type="checkbox"
                checked={instant}
                onChange={(e) => updateRule(i, { instant: e.target.checked || undefined })}
              />
              <span className="inline-flex items-center gap-1">
                <Icon name="bolt" size={11} className="text-amber-400" /> Instant — apply without click
              </span>
            </label>

            {/* Effects for this rule */}
            <div className="space-y-1 pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300">
                <Icon name="bolt" size={12} /> Effects
                {effects.length > 0 && (
                  <span className="rounded-full bg-white/10 px-1.5 text-[10px] leading-4 text-gray-300">{effects.length}</span>
                )}
              </span>
              {effects.map((fx, j) => (
                <div key={j} className="flex items-center gap-1">
                  <select
                    className={`${inputCls} !w-auto`}
                    value={fx.type}
                    onChange={(e) =>
                      setRuleEffects(i, effects.map((v, k) => (k === j ? { ...v, type: e.target.value as TransformEffect['type'] } : v)))
                    }
                  >
                    <option value="fadeIn">Fade in</option>
                    <option value="pop">Pop</option>
                    <option value="shake">Shake</option>
                    <option value="flash">Flash</option>
                  </select>
                  <input
                    className={`${inputCls} !w-16`}
                    type="number"
                    value={fx.durationMs}
                    onChange={(e) =>
                      setRuleEffects(i, effects.map((v, k) => (k === j ? { ...v, durationMs: Number(e.target.value) || 0 } : v)))
                    }
                  />
                  <IconButton icon="x" compact danger title="Remove" onClick={() => setRuleEffects(i, effects.filter((_, k) => k !== j))} />
                </div>
              ))}
              <button className={`${btnCls} w-full`} onClick={() => addEffect(i)}>
                <Icon name="plus" size={12} /> Add effect
              </button>
            </div>
          </div>
        );

        function setObjs(next: string[]) {
          updateRule(i, {
            requiresItems: next.length > 0 ? next : undefined,
            requiresItem: next[0] ?? '',
          });
        }
      })}

      <button className={`${btnCls} w-full`} onClick={addRule}>
        <Icon name="plus" size={12} /> Add transform rule
      </button>
    </Section>
  );
}