import React, { useCallback, useEffect, useRef, useState } from 'react';

/** Number that survives reloads (panel sizes, open/closed flags). Setter accepts a value or an updater and clamps. */
export function usePersistedNumber(key: string, def: number, min: number, max: number) {
  const [v, setV] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= min && n <= max) return n;
      }
    } catch {
      /* ignore */
    }
    return def;
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, String(v));
    } catch {
      /* ignore */
    }
  }, [key, v]);
  const set = useCallback(
    (n: number | ((p: number) => number)) =>
      setV((p) => Math.min(max, Math.max(min, Math.round(typeof n === 'function' ? n(p) : n)))),
    [min, max]
  );
  return [v, set] as const;
}

/** Draggable divider between docks. `axis="x"` resizes horizontally, `"y"` vertically. */
export function Splitter({
  axis,
  onDelta,
  onDragging,
}: {
  axis: 'x' | 'y';
  onDelta: (d: number) => void;
  onDragging?: (b: boolean) => void;
}) {
  const last = useRef<number | null>(null);
  const end = () => {
    last.current = null;
    onDragging?.(false);
  };
  const cls =
    axis === 'x'
      ? 'w-1 cursor-col-resize after:absolute after:inset-y-0 after:-left-1 after:-right-1'
      : 'h-1 cursor-row-resize after:absolute after:inset-x-0 after:-top-1 after:-bottom-1';
  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      className={`relative shrink-0 bg-black/60 hover:bg-primary/70 active:bg-primary transition-colors after:content-[''] ${cls}`}
      onPointerDown={(e) => {
        last.current = axis === 'x' ? e.clientX : e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
        onDragging?.(true);
      }}
      onPointerMove={(e) => {
        if (last.current === null) return;
        const p = axis === 'x' ? e.clientX : e.clientY;
        onDelta(p - last.current);
        last.current = p;
      }}
      onPointerUp={end}
      onPointerCancel={end}
    />
  );
}

/** Small uppercase title strip at the top of a dock. */
export function PanelHead({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="h-8 shrink-0 flex items-center justify-between gap-2 px-3 bg-dock-head border-b border-black/60 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
      <span>{title}</span>
      {right}
    </div>
  );
}

/** Unity-style tab strip: the active tab merges into the panel body below it. */
export function DockTabs<T extends string>({
  tabs,
  value,
  onChange,
  right,
}: {
  tabs: { id: T; label: string; badge?: number }[];
  value: T;
  onChange: (t: T) => void;
  right?: React.ReactNode;
}) {
  return (
    <div role="tablist" className="h-8 shrink-0 flex items-end gap-0.5 px-1 bg-dock-head border-b border-black/60">
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`h-7 px-3 text-xs rounded-t-md border-t-2 ${
              active ? 'bg-surface border-primary text-white' : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/5'
            }`}
          >
            {t.label}
            {!!t.badge && <span className="ml-1.5 bg-danger text-white rounded-full px-1.5 text-[10px]">{t.badge}</span>}
          </button>
        );
      })}
      <div className="flex-1" />
      {right && <div className="self-center">{right}</div>}
    </div>
  );
}
