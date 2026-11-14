import React from 'react';
import { usePlayerStore } from '../stores/store';
import { findObject } from '../shared/view-tree';
import type { SceneObject } from '../shared/types';
import { NumPadKeys } from '../shared/NumPadKeys';

/**
 * The num pad is another kind of inventory UI: it is drawn ON TOP of the inventory bar (same place,
 * same footprint) and never over the scene. Numbers come from the sprite configured in the Studio
 * (Properties → Num Pad); digits are rendered plain (no Farsi conversion).
 *
 * - pick mode: tapping a key selects that number (stays open); then click a sprite and the number is
 *   used on it like an item (`requiresItem: "5"`).
 * - type mode: the pad is bound to the clicked sprite (a lock). Each typed digit is applied to it, so its
 *   numeric transform rules fire one by one; one slot per numeric rule shows the progress.
 */

/** The sprite the open pad belongs to — null while the pad is closed or its sprite is not in the current room. */
export function useNumpadSource(): SceneObject | null {
  const open = usePlayerStore((s) => s.numpadOpen);
  const id = usePlayerStore((s) => s.numpadObjectId);
  const sceneId = usePlayerStore((s) => s.session?.state.currentSceneId);
  const scenes = usePlayerStore((s) => s.scenes);
  if (!open || !id || !sceneId) return null;
  const scene = scenes[sceneId];
  const obj = scene ? findObject(scene.objects, id) : undefined;
  return obj?.numpad ? obj : null;
}

export function NumsPadOverlay({ src }: { src: SceneObject }) {
  const viewId = usePlayerStore((s) => s.numpadViewId);
  const selectedItem = usePlayerStore((s) => s.selectedItem);
  const applied = usePlayerStore((s) => s.session?.state.transformsApplied?.[src.id] ?? -1);
  const closeNumpad = usePlayerStore((s) => s.closeNumpad);
  const selectItem = usePlayerStore((s) => s.selectItem);
  const applyItem = usePlayerStore((s) => s.useItemOnObject);

  // With trigger 'pickup' the sprite leaves the scene on pickup, so type mode is forced to pick.
  const mode = src.numpadTrigger === 'pickup' ? 'pick' : (src.numpadMode ?? 'pick');
  const min = src.numpadMin ?? 1;
  const max = src.numpadMax ?? 9;
  const font = src.numpadFont ?? 'Vazirmatn';
  const color = src.numpadColor ?? '#ffffff';
  const bg = src.numpadBg ?? '#3a3a3a';
  const size = src.numpadSize ?? 40;
  const selected = selectedItem ?? null;

  // Type mode: one slot per transform rule whose `requiresItem` is numeric.
  const slots = (src.transforms ?? [])
    .map((t, j) => ({ t, j }))
    .filter(({ t }) => /^\d+$/.test(t.requiresItem ?? ''));

  const pressKey = (n: string) => {
    if (mode === 'type') applyItem(n, src.id, viewId ?? undefined);
    else selectItem(selected === n ? null : n);
  };

  return (
    <div
      className="absolute inset-0 z-20 bg-surface border-t border-gray-700 px-3 flex items-center gap-2 overflow-hidden"
      dir="rtl"
    >
      <button
        type="button"
        onClick={closeNumpad}
        className="shrink-0 w-7 h-7 rounded text-sm hover:bg-gray-700/50"
        title="بستن"
        aria-label="بستن"
      >
        ✕
      </button>

      {mode === 'type' && slots.length > 0 && (
        <div className="flex gap-1.5 shrink-0" dir="ltr">
          {slots.map(({ t, j }) => (
            <div
              key={j}
              className="w-6 h-6 rounded border border-gray-600 flex items-center justify-center text-[11px] text-amber-300 bg-black/20"
            >
              {j <= applied ? t.requiresItem : ''}
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 min-w-0" dir="ltr">
        <NumPadKeys min={min} max={max} selected={selected} onPress={pressKey} size={size} font={font} color={color} bg={bg} />
      </div>

      {mode === 'pick' && selected !== null && (
        <span className="shrink-0 text-[11px] text-amber-300 animate-pulse">
          عدد {selected} انتخاب شد — روی یک شیء کلیک کنید
        </span>
      )}
    </div>
  );
}
