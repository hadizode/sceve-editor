import React, { useEffect, useRef, useState } from 'react';
import { MENUS, type Cmd } from './commands';

/** Desktop-style menu bar (File / Edit / Object / Room / View). */
export function MenuBar({ cmds }: { cmds: Record<string, Cmd> }) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const down = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
    };
    window.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const renderItem = (id: string, k: number) => {
    if (id === '-') return <div key={`sep-${k}`} className="my-1 border-t border-white/10" />;
    const c = cmds[id];
    if (!c) return null;
    return (
      <button
        key={id}
        role="menuitem"
        disabled={c.isDisabled?.()}
        onClick={() => {
          setOpen(null);
          c.run();
        }}
        className="group w-full flex items-center justify-between gap-8 px-3 py-1.5 text-xs text-left text-gray-200 hover:bg-primary hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-gray-200"
      >
        <span>{c.label}</span>
        {c.shortcut && <span className="font-mono text-[10px] text-gray-500 group-hover:text-white/70">{c.shortcut}</span>}
      </button>
    );
  };

  return (
    <div ref={ref} role="menubar" className="flex items-center">
      {MENUS.map((m, i) => (
        <div key={m.label} className="relative">
          <button
            role="menuitem"
            aria-haspopup="menu"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            onMouseEnter={() => open !== null && setOpen(i)}
            className={`h-7 px-2.5 text-xs rounded ${open === i ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5'}`}
          >
            {m.label}
          </button>
          {open === i && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-0.5 min-w-60 py-1 bg-dock-head border border-black/60 rounded-lg shadow-2xl shadow-black/60 z-[300]"
            >
              {m.items.map(renderItem)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Ctrl+K — search and run any command. */
export function CommandPalette({ cmds, onClose }: { cmds: Record<string, Cmd>; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = Object.values(cmds).filter(
    (c) => !c.isDisabled?.() && words.every((w) => `${c.group} ${c.label}`.toLowerCase().includes(w))
  );
  const run = (c?: Cmd) => {
    if (!c) return;
    onClose();
    c.run();
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/50 flex items-start justify-center pt-[14vh]" onMouseDown={onClose}>
      <div
        dir="ltr"
        className="w-[34rem] max-w-[92vw] bg-dock-head border border-black/60 rounded-xl shadow-2xl shadow-black/70 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          placeholder="Type a command…"
          aria-label="Command search"
          className="w-full bg-transparent px-4 py-3 text-sm text-white outline-none border-b border-black/60 placeholder:text-gray-500"
          onChange={(e) => {
            setQ(e.target.value);
            setIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowDown') {
              e.preventDefault();
              setIdx((i) => Math.min(i + 1, list.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setIdx((i) => Math.max(i - 1, 0));
            } else if (e.key === 'Enter') run(list[idx]);
          }}
        />
        <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
          {list.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === idx}
              ref={(el) => {
                if (i === idx && el) el.scrollIntoView({ block: 'nearest' });
              }}
              onMouseEnter={() => setIdx(i)}
              onClick={() => run(c)}
              className={`flex items-center justify-between gap-4 px-4 py-1.5 text-xs cursor-pointer ${i === idx ? 'bg-primary text-white' : 'text-gray-300'}`}
            >
              <span>
                <span className="text-gray-500 mr-2">{c.group}</span>
                {c.label}
              </span>
              {c.shortcut && <span className="font-mono text-[10px] opacity-60">{c.shortcut}</span>}
            </li>
          ))}
          {list.length === 0 && <li className="px-4 py-3 text-xs text-gray-500">No matching command</li>}
        </ul>
      </div>
    </div>
  );
}
