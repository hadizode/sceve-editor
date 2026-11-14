import React from 'react';

/** Presentational key grid shared by the Studio preview and the Player num pad. */
export interface NumPadKeysProps {
  min: number;
  max: number;
  /** Currently selected number string (pick mode) or null. */
  selected: string | null;
  onPress: (n: string) => void;
  /** Key size in px. */
  size: number;
  /** CSS font-family applied inline (Tailwind `font-*` classes do not exist). */
  font: string;
  /** Hex text color. */
  color: string;
  /** Hex key background. */
  bg: string;
}

export function NumPadKeys({
  min,
  max,
  selected,
  onPress,
  size,
  font,
  color,
  bg,
}: NumPadKeysProps) {
  const count = Math.max(0, max - min + 1);
  const base: React.CSSProperties = {
    fontFamily: font,
    width: size,
    height: size,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '0.5rem',
    borderWidth: '1px',
    borderStyle: 'solid',
    fontSize: '16px',
    fontWeight: 'bold',
  };

  return (
    <div className="flex gap-1 overflow-x-auto w-full min-w-[1px]">
      {[...Array(count).keys()].map((i) => {
        const n = min + i;
        const s = String(n);
        const active = selected === s;
        const css: React.CSSProperties = {
          ...base,
          color: active ? '#000000' : color,
          backgroundColor: active ? '#fbbf24' : bg,
          borderColor: active ? '#fcd34d' : '#71717a',
        };
        return (
          <button
            key={n}
            type="button"
            onClick={() => onPress(s)}
            style={css}
            className="transition-colors hover:opacity-80 focus:outline-none"
            title={`عدد ${n}`}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
