import React, { useEffect, useState } from 'react';

export const inputCls =
  'w-full bg-surface-light border border-gray-600 rounded px-2 py-1 text-white text-sm outline-none focus:border-indigo-500';
export const btnCls = 'bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded text-xs transition-colors disabled:opacity-40';

export function isTyping(e: Event): boolean {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-gray-400 text-xs mb-1">{label}</label>
      {children}
    </div>
  );
}

export function Section({ title, color = 'text-indigo-300', children }: { title: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-gray-700 pt-3 mt-3 space-y-2">
      <h4 className={`font-bold text-sm ${color}`}>{title}</h4>
      {children}
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
