import React from 'react';
import { create } from 'zustand';

/** Lightweight in-app notifications — use instead of window.alert(). */
type Kind = 'info' | 'error' | 'success';
interface Item {
  id: number;
  text: string;
  kind: Kind;
}
interface NotifyState {
  items: Item[];
  push: (text: string, kind?: Kind) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useNotify = create<NotifyState>((set, get) => ({
  items: [],
  push: (text, kind = 'info') => {
    const id = ++seq;
    set((s) => ({ items: [...s.items.slice(-3), { id, text, kind }] }));
    window.setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

export const notify = (text: string, kind?: Kind) => useNotify.getState().push(text, kind);

const TONE: Record<Kind, string> = {
  info: 'border-primary',
  error: 'border-danger',
  success: 'border-success',
};

export function Toasts() {
  const items = useNotify((s) => s.items);
  const dismiss = useNotify((s) => s.dismiss);
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2" role="status" aria-live="polite">
      {items.map((i) => (
        <button
          key={i.id}
          type="button"
          dir="auto"
          onClick={() => dismiss(i.id)}
          className={`text-start text-sm bg-surface-lighter/95 backdrop-blur-md text-white px-4 py-2.5 rounded-xl border-s-4 ${TONE[i.kind]} shadow-2xl shadow-black/40 max-w-xs animate-fade-in`}
        >
          {i.text}
        </button>
      ))}
    </div>
  );
}
