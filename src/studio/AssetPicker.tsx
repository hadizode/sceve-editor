import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Asset } from '../shared/types';
import { inputCls, btnCls } from './ui';

export type AssetPickerExtra = { label: string; onClick: () => void };

type ListItem =
  | { kind: 'asset'; asset: Asset }
  | { kind: 'extra'; item: AssetPickerExtra };

/** Compact popover asset picker. Trigger shows a thumbnail + current name. */
export function AssetPicker({
  assets,
  value,
  onPick,
  extra,
}: {
  assets: Asset[];
  value: string;
  onPick: (asset: Asset) => void;
  extra?: AssetPickerExtra[];
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const current = assets.find((a) => a.id === value);

  const filtered = useMemo(
    () =>
      assets.filter((a) => a.name.toLowerCase().includes(query.toLowerCase())),
    [assets, query],
  );

  const list = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    if (extra) items.push(...extra.map((i) => ({ kind: 'extra' as const, item: i })));
    items.push(...filtered.map((a) => ({ kind: 'asset' as const, asset: a })));
    return items;
  }, [extra, filtered]);

  const close = () => setOpen(false);

  const pickAsset = (asset: Asset) => {
    onPick(asset);
    close();
  };

  const pickItem = (item: ListItem) => {
    if (item.kind === 'asset') pickAsset(item.asset);
    else {
      item.item.onClick();
      close();
    }
  };

  // Click outside closes.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (
        !open ||
        !triggerRef.current ||
        triggerRef.current.contains(e.target as Node) ||
        (popoverRef.current && popoverRef.current.contains(e.target as Node))
      )
        return;
      close();
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Auto-focus the search input when opened.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const navigate = useCallback(
    (dir: 1 | -1) => {
      if (!open) return;
      setHighlight((h) => {
        let n = h + dir;
        if (n < 0) n = list.length - 1;
        if (n >= list.length) n = 0;
        return n;
      });
    },
    [open, list.length],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      pickItem(list[highlight]);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      navigate(1);
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      navigate(-1);
      return;
    }
  };

  const highlightedItem = list[highlight];
  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      className={`${btnCls} flex items-center gap-2 min-w-[140px]`}
      onClick={() => setOpen((o) => !o)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen((o) => !o);
        }
      }}
    >
      {current ? (
        <img
          src={current.url}
          alt=""
          className="w-5 h-5 rounded object-contain shrink-0"
          draggable={false}
        />
      ) : (
        <div className="w-5 h-5 shrink-0 bg-gray-800 rounded" />
      )}
      <span
        className="truncate text-[11px] text-gray-200"
        title={current?.name ?? ''}
        dir="ltr"
      >
        {current ? current.name : '—'}
      </span>
    </button>
  );

  if (!open) return trigger;

  return (
    <div className="relative inline-block">
      {trigger}
      <div
        ref={popoverRef}
        className="absolute left-0 top-full mt-1 w-80 bg-surface border border-line rounded shadow-2xl z-50"
        style={{ outline: 'none' }}
      >
        <input
          ref={inputRef}
          type="text"
          className={`${inputCls} mb-1`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search…"
          dir="ltr"
          autoComplete="off"
        />
        <div className="max-h-[220px] overflow-y-auto" style={{ outline: 'none' }}>
          {list.map((item, i) => {
            const active = i === highlight;
            if (item.kind === 'extra') {
              return (
                <button
                  key={item.item.label}
                  type="button"
                  className={`w-full text-left px-2 py-1.5 text-xs ${
                    active ? 'bg-primary/20 text-indigo-300' : 'text-gray-300 hover:bg-white/5'
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    pickItem(item);
                  }}
                >
                  {item.item.label}
                </button>
              );
            }
            const a = item.asset;
            return (
              <div
                key={a.id}
                className={`flex items-center gap-2 px-2 py-1.5 cursor-default select-none ${
                  active ? 'bg-primary/20' : 'hover:bg-white/5'
                }`}
                onClick={() => pickItem(item)}
              >
                <img
                  src={a.url}
                  alt=""
                  className="w-6 h-6 rounded object-contain shrink-0 bg-black/20"
                  draggable={false}
                />
                <span className="text-[11px] truncate text-gray-200" title={a.name} dir="ltr">
                  {a.name}
                </span>
              </div>
            );
          })}
          {list.length === 0 && (
            <div className="px-2 py-1 text-[11px] text-gray-500">No matches</div>
          )}
        </div>
      </div>
    </div>
  );
}


