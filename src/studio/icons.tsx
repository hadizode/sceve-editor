import React from 'react';

const P = {
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.9M6.6 6.7C3.8 8.5 2 12 2 12s4 7 10 7c1.6 0 3-.4 4.3-1" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 7.5-2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  viewAdd: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 20h16" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="1.5" /><path d="M21 15l-5-5L5 21" /></>,
  fit: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></>,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  arrowDown: <path d="M12 5v14M5 12l7 7 7-7" />,
  toFront: <><path d="M12 4v10M7 9l5-5 5 5" /><path d="M5 19h14" /></>,
  toBack: <><path d="M12 20V10M7 15l5 5 5-5" /><path d="M5 5h14" /></>,
  flipH: <><path d="M12 3v18" /><path d="M8 7L3 17h5z" /><path d="M16 7l5 10h-5z" /></>,
  flipV: <g transform="rotate(90 12 12)"><path d="M12 3v18" /><path d="M8 7L3 17h5z" /><path d="M16 7l5 10h-5z" /></g>,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  door: <><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" /><path d="M3 21h18" /><circle cx="15" cy="12" r=".8" /></>,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  play: <path d="M6 4l14 8-14 8z" fill="currentColor" />,
  stop: <rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" />,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></>,
  redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 0 0 0 12h3" /></>,
  panelBottom: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 15h18" /></>,
  grid: <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />,
  magnet: <path d="M6 3v8a6 6 0 0 0 12 0V3h-4v8a2 2 0 0 1-4 0V3z" />,
  tag: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1" /></>,
  // hit shapes
  shapeBox: <rect x="4" y="4" width="16" height="16" />,
  shape3: <path d="M12 4l9 16H3z" />,
  shape5: <path d="M12 3l9 7-3.5 11h-11L3 10z" />,
  shape6: <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />,
  shape8: <path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" />,
  // align
  alignLeft: <><path d="M4 3v18" /><rect x="8" y="6" width="12" height="4" /><rect x="8" y="14" width="7" height="4" /></>,
  alignHCenter: <><path d="M12 3v18" /><rect x="5" y="6" width="14" height="4" /><rect x="8" y="14" width="8" height="4" /></>,
  alignRight: <><path d="M20 3v18" /><rect x="4" y="6" width="12" height="4" /><rect x="9" y="14" width="7" height="4" /></>,
  alignTop: <><path d="M3 4h18" /><rect x="6" y="8" width="4" height="12" /><rect x="14" y="8" width="4" height="7" /></>,
  alignVMiddle: <><path d="M3 12h18" /><rect x="6" y="5" width="4" height="14" /><rect x="14" y="8" width="4" height="8" /></>,
  alignBottom: <><path d="M3 20h18" /><rect x="6" y="4" width="4" height="12" /><rect x="14" y="9" width="4" height="7" /></>,
  distH: <><path d="M4 3v18M20 3v18" /><rect x="9" y="7" width="6" height="10" /></>,
  distV: <><path d="M3 4h18M3 20h18" /><rect x="7" y="9" width="10" height="6" /></>,
} satisfies Record<string, React.ReactNode>;

export type IconName = keyof typeof P;

export function Icon({ name, size = 14, className = '' }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`} aria-hidden>
      {P[name]}
    </svg>
  );
}

type IBProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  icon: IconName;
  title: string;            // tooltip + aria-label (required, icons have no text)
  active?: boolean;
  danger?: boolean;
  solid?: boolean;          // bordered button look instead of ghost
  compact?: boolean;        // 20px instead of 24px
  size?: number;
};

/** Square icon button. Ghost by default; `solid` = bordered, `active` = selection blue, `danger` = red on hover. */
export function IconButton({ icon, title, active, danger, solid, compact, size, className = '', ...p }: IBProps) {
  const dim = compact ? 'h-5 w-5' : 'h-6 w-6';
  const tone = active
    ? 'bg-primary text-white'
    : danger
      ? 'text-gray-400 hover:bg-danger/25 hover:text-red-300'
      : solid
        ? 'bg-surface-lighter hover:bg-surface-hover border border-line text-gray-100'
        : 'text-gray-400 hover:bg-white/10 hover:text-white';
  return (
    <button type="button" title={title} aria-label={title} aria-pressed={active}
      {...p}
      className={`inline-flex items-center justify-center shrink-0 rounded-[3px] disabled:opacity-35 disabled:pointer-events-none ${dim} ${tone} ${className}`}>
      <Icon name={icon} size={size ?? (compact ? 12 : 14)} />
    </button>
  );
}