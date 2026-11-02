import React, { useEffect, useRef, useState } from 'react';
import { Icon, IconButton } from './icons';

// ---------- class tokens ----------
export const inputCls =
  'w-full h-6 bg-surface-light border border-line rounded-[3px] px-1.5 text-xs text-gray-100 placeholder:text-gray-500 ' +
  'outline-none hover:border-[#555] focus:border-primary';

export const textareaCls =
  'w-full min-h-14 bg-surface-light border border-line rounded-[3px] px-1.5 py-1 text-xs text-gray-100 placeholder:text-gray-500 ' +
  'outline-none hover:border-[#555] focus:border-primary resize-y';

export const btnCls =
  'inline-flex items-center justify-center gap-1 h-6 bg-surface-lighter hover:bg-surface-hover border border-line ' +
  'text-gray-100 px-2 rounded-[3px] text-[11px] font-medium disabled:opacity-40 disabled:hover:bg-surface-lighter';

export const btnPrimary =
  'inline-flex items-center justify-center gap-1 h-6 bg-primary hover:bg-primary-dark border border-black/40 text-white px-2.5 rounded-[3px] text-[11px] font-semibold disabled:opacity-40';

export const btnDanger =
  'inline-flex items-center justify-center gap-1 h-6 bg-danger/15 hover:bg-danger/30 text-red-300 border border-danger/40 px-2 rounded-[3px] text-[11px] disabled:opacity-40';

/** Tiny borderless icon button (✕, +, ↑ …) */
export const btnGhost =
  'inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-[3px] text-[11px] text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30';

/** Checkerboard behind image previews so transparent PNGs are readable. */
export const checker: React.CSSProperties = {
  backgroundColor: '#2b2b2b',
  backgroundImage: 'conic-gradient(#333 25%, transparent 0 50%, #333 0 75%, transparent 0)',
  backgroundSize: '8px 8px',
};

export function isTyping(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

// ---------- toolbar ----------
export function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 bg-black/20 border border-line rounded-[4px] p-0.5">{children}</div>;
}

export function IconBtn({
  active,
  className = '',
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...p}
      className={`h-6 min-w-6 px-2 rounded-[3px] text-[11px] ${active ? 'bg-primary text-white' : 'text-gray-300 hover:bg-white/10'} disabled:opacity-35 ${className}`}
    />
  );
}

// ---------- inspector building blocks ----------
export function Badge({ children }: { children: React.ReactNode }) {
  return <span className="min-w-4 h-4 px-1 rounded-full bg-primary/80 text-white text-[9px] leading-4 text-center">{children}</span>;
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-gray-500 leading-snug">{children}</p>;
}

/** Unity-style property row: label on the left, control on the right. `stack` puts the label above (long controls). */
export function Field({
  label,
  hint,
  stack,
  children,
}: {
  label: string;
  hint?: string;
  stack?: boolean;
  children: React.ReactNode;
}) {
  if (stack) {
    return (
      <div className="space-y-1">
        <label className="block text-[11px] text-gray-400" title={hint}>{label}</label>
        {children}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 min-h-6">
      <label className="w-[36%] shrink-0 truncate text-[11px] text-gray-400" title={hint ?? label}>{label}</label>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function Check({
  label,
  checked,
  onChange,
  hint,
}: {
  label: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-[11px] text-gray-300 cursor-pointer select-none py-0.5">
      <input type="checkbox" className="mt-[2px]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        {label}
        {hint && <span className="block text-[10px] text-gray-500 leading-snug">{hint}</span>}
      </span>
    </label>
  );
}

/**
 * Component-style foldout. Full-bleed header (negative margin cancels the inspector's p-3),
 * optional badge and right-aligned actions.
 */
export function Section({
  title,
  defaultOpen = true,
  right,
  badge,
  children,
}: {
  title: string;
  /** @deprecated ignored — the palette is neutral on purpose. */
  color?: string;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  badge?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="-mx-3 mt-2 first:mt-0 border-t border-black/60">
      <div className="flex items-center bg-[#414141]">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex-1 min-w-0 flex items-center gap-1.5 h-6 px-3 text-left text-[11px] font-semibold text-gray-100 hover:bg-white/5"
        >
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={10} className="text-gray-400" />
          <span className="truncate">{title}</span>
          {!!badge && <Badge>{badge}</Badge>}
        </button>
        {right && <div className="flex items-center gap-1 pr-2">{right}</div>}
      </div>
      {open && <div className="px-3 py-2 space-y-1.5 bg-surface">{children}</div>}
    </div>
  );
}

/** Light inner foldout (uppercase caption) used inside cards. */
export function Sub({
  title,
  count = 0,
  defaultOpen = false,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-white/5 pt-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 h-5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 hover:text-gray-200"
      >
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={10} className="text-gray-400" />
        {title}
        {count > 0 && <Badge>{count}</Badge>}
      </button>
      {open && <div className="pt-1 space-y-1.5">{children}</div>}
    </div>
  );
}

/** Reorderable-list style element: collapsible card with a header summary and a remove button. */
export function Card({
  title,
  subtitle,
  onRemove,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  onRemove?: () => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-[3px] border border-black/60 bg-[#313131]">
      <div className="flex items-center h-6 bg-[#3d3d3d] rounded-t-[3px]">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex-1 min-w-0 flex items-center gap-1.5 px-1.5 text-left">
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={10} className="text-gray-400" />
          <span className="text-[11px] font-semibold text-gray-100 shrink-0">{title}</span>
          {subtitle && <span className="text-[10px] text-gray-400 truncate">{subtitle}</span>}
        </button>
          {onRemove && <IconButton icon="x" title="Remove" compact danger className="mr-0.5" onClick={onRemove} />}
      </div>
      {open && <div className="p-2 space-y-1.5 border-t border-black/50">{children}</div>}
    </div>
  );
}

// ---------- inputs ----------
export function NumInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [text, setText] = useState(String(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(String(value));
  }, [value, focus]);
  return (
    <input
      type="number"
      className={inputCls}
      min={min}
      max={max}
      step={step}
      value={focus ? text : String(value)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

/** Number field with a colored axis label. Drag the label left/right to scrub (Shift = ×10). */
export function AxisNum({
  label,
  color = '#9ca3af',
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  label: string;
  color?: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const start = useRef<{ x: number; v: number } | null>(null);
  const clampN = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  return (
    <div className="flex flex-1 min-w-0 [&_input]:rounded-l-none">
      <span
        title="Drag to scrub"
        className="w-4 h-6 shrink-0 flex items-center justify-center text-[10px] font-bold select-none cursor-ew-resize bg-black/25 border border-r-0 border-line rounded-l-[3px]"
        style={{ color }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          start.current = { x: e.clientX, v: value };
        }}
        onPointerMove={(e) => {
          const s = start.current;
          if (!s) return;
          const d = Math.round((e.clientX - s.x) / 2) * step * (e.shiftKey ? 10 : 1);
          onChange(clampN(Math.round((s.v + d) * 100) / 100));
        }}
        onPointerUp={() => (start.current = null)}
        onPointerCancel={() => (start.current = null)}
      >
        {label}
      </span>
      <div className="flex-1 min-w-0">
        <NumInput value={value} onChange={(n) => onChange(clampN(n))} min={min} max={max} step={step} />
      </div>
    </div>
  );
}

/** Comma separated list that keeps what you type (commas included) until blur. */
export function ListInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[] | undefined;
  onChange: (v: string[] | undefined) => void;
  placeholder?: string;
}) {
  const joined = (value ?? []).join(', ');
  const [text, setText] = useState(joined);
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(joined);
  }, [joined, focus]);
  return (
    <input
      className={inputCls}
      placeholder={placeholder}
      value={focus ? text : joined}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onChange={(e) => {
        setText(e.target.value);
        const list = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
        onChange(list.length ? list : undefined);
      }}
    />
  );
}

export function useElementSize(ref: React.RefObject<HTMLElement>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r && r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}