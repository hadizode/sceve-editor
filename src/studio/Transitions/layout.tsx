import React from 'react';

export const TONES = {
  when: 'border-sky-700/50 text-sky-300',
  if: 'border-amber-700/50 text-amber-300',
  then: 'border-emerald-700/50 text-emerald-300',
  fx: 'border-purple-700/50 text-purple-300',
} as const;

export function Block({
  n,
  title,
  tone,
  hint,
  children,
}: {
  n: string;
  title: string;
  tone: keyof typeof TONES;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[3px] border bg-black/15 ${TONES[tone].split(' ')[0]}`}>
      <div className="flex items-center gap-1.5 px-2 h-6 border-b border-white/5">
        <span className={`w-4 h-4 rounded-full bg-white/10 text-[10px] leading-4 text-center font-bold ${TONES[tone].split(' ')[1]}`}>{n}</span>
        <span className={`text-[11px] font-bold uppercase tracking-wide ${TONES[tone].split(' ')[1]}`}>{title}</span>
        {hint && <span className="text-[10px] text-gray-500 truncate">{hint}</span>}
      </div>
      <div className="p-2 space-y-2">{children}</div>
    </div>
  );
}

export function Warn({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-amber-400 leading-snug">⚠ {children}</p>;
}

export function Seg<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { v: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-0.5 bg-black/25 border border-line rounded-[4px] p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          disabled={disabled}
          title={disabled ? undefined : o.title}
          aria-pressed={o.v === value}
          aria-disabled={disabled || undefined}
          onClick={disabled ? undefined : () => onChange(o.v)}
          className={`flex-1 h-6 rounded-[3px] text-[11px] ${disabled
            ? 'text-gray-600 bg-black/10'
            : o.v === value
              ? 'bg-primary text-white'
              : 'text-gray-300 hover:bg-white/10'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
