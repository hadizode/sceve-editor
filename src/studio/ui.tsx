import React, { useEffect, useState } from 'react';

// ---------- shared class tokens (one place to restyle the whole studio) ----------
export const inputCls =
  'w-full bg-surface-light border border-line rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-gray-500 ' +
  'outline-none transition-colors hover:border-gray-500 focus:border-primary focus:ring-1 focus:ring-primary/40';

export const btnCls =
  'inline-flex items-center justify-center gap-1 bg-surface-lighter hover:bg-surface-hover border border-line ' +
  'text-gray-100 px-2.5 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40 disabled:hover:bg-surface-lighter';

/** The single primary action of a screen/toolbar. */
export const btnPrimary =
  'inline-flex items-center justify-center gap-1 bg-primary hover:bg-primary-dark text-white px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40';

/** Destructive actions. */
export const btnDanger =
  'inline-flex items-center justify-center gap-1 bg-danger/15 hover:bg-danger/25 text-red-300 border border-danger/30 px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40';

export function isTyping(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

// ---------- toolbar building blocks ----------
/** A pill that groups related toolbar buttons. */
export function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 bg-surface-light/60 border border-line rounded-lg p-0.5">{children}</div>
  );
}

/** Compact toolbar button; `active` renders the toggled-on state. */
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
      className={`h-7 min-w-7 px-2 rounded-md text-xs ${active ? 'bg-primary text-white' : 'text-gray-300 hover:bg-surface-hover'} disabled:opacity-35 ${className}`}
    />
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">{label}</label>
      {children}
    </div>
  );
}

/** Collapsible inspector section (accordion). Open by default; pass defaultOpen={false} for rarely used ones. */
export function Section({
  title,
  color = 'text-indigo-300',
  defaultOpen = true,
  children,
}: {
  title: string;
  color?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-gray-700 pt-2 mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between font-bold text-sm ${color}`}
      >
        <span>{title}</span>
        <span className="text-gray-500 text-xs" aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="space-y-2 mt-2">{children}</div>}
    </div>
  );
}

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
