import React, { useMemo, useState } from 'react';
import { Badge, IconButton, Image, Tappable } from '@telegram-apps/telegram-ui';
import { itemName, usePlayerStore } from '../stores/store';
import type { SceneObject } from '../shared/types';
import { getSprite, resolveSprite, transformRef } from '../shared/types';
import { Icon } from '../studio/icons';
import { useCompact } from './useCompact';
import type { Asset, Sprite } from '../shared/types';

const EMPTY: string[] = [];

function spriteSrc(
  ref: string | undefined,
  sprites: Record<string, Sprite>,
  assets: Record<string, Asset>,
) {
  return ref ? resolveSprite(ref, sprites, assets) : '';
}

function InventoryPanel({
  lockOpen,
  onToggleLock,
  compact,
}: { lockOpen?: boolean; onToggleLock?: () => void; compact?: boolean } = {}) {
  const isCompact = compact ?? false;
  const inventory = usePlayerStore((s) => s.session?.state.inventory ?? EMPTY);
  const selectedItem = usePlayerStore((s) => s.selectedItem);
  const selectItem = usePlayerStore((s) => s.selectItem);
  const scenes = usePlayerStore((s) => s.scenes);
  const projectId = usePlayerStore((s) => s.session?.projectId);
  const assets = usePlayerStore((s) => s.assets);
  const sprites = usePlayerStore((s) => s.sprites);

  const itemMeta = useMemo(() => {
    const m: Record<string, { name: string; url: string; color?: string; numpad?: { objectId: string; viewId?: string } }> = {};
    if (!projectId) return m;

    const walk = (objs: SceneObject[], viewId?: string) => {
      for (const o of objs) {
        const sp = getSprite(o.spriteRef, sprites);
        const u = spriteSrc(o.spriteRef, sprites, assets);

        if (o.grantsItem && !m[o.grantsItem]) {
          m[o.grantsItem] = { name: o.name, url: u, color: sp?.color };
        }

        const key = o.pickupItemId || o.id;
        if (o.pickupable && !m[key]) {
          m[key] = {
            name: o.name, url: u, color: sp?.color,
            numpad: o.numpad ? { objectId: o.id, viewId } : undefined,
          };
        }

        o.transforms?.forEach((t) => {
          if (t.grantsItem && !m[t.grantsItem]) {
            const tref = t.newSpriteId ? transformRef(t.newSpriteId) : o.spriteRef;
            m[t.grantsItem] = {
              name: `${o.name} ✨`,
              url: spriteSrc(tref, sprites, assets),
              color: getSprite(tref, sprites)?.color,
            };
          }
        });

        if (o.view) walk(o.view.objects, o.id);
      }
    };

    Object.values(scenes)
      .filter((sc) => sc.projectId === projectId)
      .forEach((sc) => walk(sc.objects));

    return m;
  }, [scenes, projectId, assets, sprites]);

  // Group duplicates so e.g. 3 collected fuses show one icon with a ×3 counter.
  const counts = inventory.reduce<Record<string, number>>(
    (a, id) => ((a[id] = (a[id] ?? 0) + 1), a),
    {},
  );

  return (
    <div
      className={`bg-surface border-t border-gray-700 flex items-center overflow-x-auto safe-bottom ${
        isCompact ? 'max-h-[70dvh] gap-1 px-2 py-1' : 'gap-2 px-3 py-2'
      }`}
      dir="rtl"
    >
      {onToggleLock && (
        <button
          type="button"
          onClick={onToggleLock}
          aria-label="قفل خروج"
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center border border-white/10 ${
          lockOpen ? 'bg-white/15 text-white' : 'bg-black/40 hover:bg-black/60 text-white'
          }`}
        >
          <Icon name={lockOpen ? 'unlock' : 'lock'} size={18} />
        </button>
      )}
      {inventory.length === 0 && (
        <div className="flex-1 flex items-center justify-center" aria-label="کیف خالی">
          <Icon name="bag" size={22} className="text-gray-500" />
        </div>
      )}

      {Object.keys(counts).map((id) => {
        const meta = itemMeta[id];

        return (
          <Tappable
            Component="button"
            key={id}
            onClick={() => {
              const next = selectedItem === id ? null : id;
              const owner = itemMeta[id]?.numpad;
              if (owner && next) {
                usePlayerStore.setState({
                  selectedItem: next,
                  numpadOpen: true,
                  numpadObjectId: owner.objectId,
                  numpadViewId: owner.viewId ?? null,
                });
              } else if (owner && !next) {
                usePlayerStore.getState().closeNumpad();
              } else {
                selectItem(next);
              }
            }}
            className={`relative shrink-0 ${isCompact ? 'w-9 h-9' : 'w-12 h-12'} rounded-xl border flex items-center justify-center overflow-hidden transition-all ${
              selectedItem === id
                ? 'border-white/70 ring-2 ring-white/20 scale-110'
                : 'border-gray-600 hover:border-gray-400'
            }`}
            title={meta?.name ?? itemName([], id)}
            aria-pressed={selectedItem === id}
          >
            {meta?.url ? (
              <Image src={meta.url} alt={meta?.name ?? itemName([], id)} size={isCompact ? 40 : 48} className="w-full h-full object-contain p-0.5" />
            ) : meta?.color ? (
              <div
                className="w-full h-full rounded-md"
                style={{ background: meta.color }}
                title={meta.name}
              />
            ) : (
              <Icon name="bag" size={20} className="text-gray-300" />
            )}

            {counts[id] > 1 && (
              <Badge
                type="number"
                mode="primary"
                className="absolute -bottom-1 -left-1 !min-w-4 !h-4 !px-1 text-[10px]"
              >
                ×{counts[id]}
              </Badge>
            )}
          </Tappable>
        );
      })}

    </div>
  );
}

export function InventoryOverlay({ lockOpen, onToggleLock }: { lockOpen?: boolean; onToggleLock?: () => void } = {}) {
  const [open, setOpen] = useState(false);
  const selectedItem = usePlayerStore((s) => s.selectedItem);
  const inventory = usePlayerStore((s) => s.session?.state.inventory ?? EMPTY);
  const compact = useCompact();

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none" dir="rtl">
      <div
        className={`absolute inset-x-0 bottom-0 pointer-events-auto transition-transform duration-200 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <InventoryPanel lockOpen={lockOpen} onToggleLock={onToggleLock} compact={compact} />
      </div>
      <IconButton
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'بستن نوار انبار' : 'باز کردن نوار انبار'}
        aria-expanded={open}
        mode="gray"
        size={compact ? 's' : 'm'}
        className={`absolute ${compact ? 'right-2' : 'right-4'} ${
          open
            ? compact ? 'bottom-[72px]' : 'bottom-[80px]'
            : compact ? 'bottom-0.5' : 'bottom-4'
        } z-40 ${compact ? '!w-9 !h-9 !min-w-9 !min-h-9' : ''} !rounded-full !bg-black/50 !text-white hover:!bg-black/60`}
      >
        <span className="relative flex items-center justify-center">
          <Icon name="bag" size={18} />
          <Icon name={open ? 'chevronDown' : 'chevronUp'} size={10} className="absolute -bottom-1 -right-1" />
          <Badge
            type="number"
            mode="critical"
            className="absolute -top-2 -left-2 !min-w-4 !h-4 !px-1 text-[10px]"
          >
            {inventory.length}
          </Badge>
        </span>
      </IconButton>
    </div>
  );
}