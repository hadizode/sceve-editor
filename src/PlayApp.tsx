import React, { useEffect, useState } from 'react';
import Player from './player/Player';
import { useStudioStore } from './stores/store';
import { Toasts } from './shared/notify';

export default function PlayApp() {
  const hydrated = useStudioStore((s) => s.hydrated);
  const [pid, setPid] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    tg?.ready();
    tg?.expand();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        const text = await (await fetch('/project.json')).text();
        const id: string = JSON.parse(text).project.id;
        const st = useStudioStore.getState();
        // آماده‌سازی تازه: اگر نسخه قبلی از IndexedDB لود شده، حذفش کن تا id حفظ شود
        if (st.projects.some((p) => p.id === id)) st.deleteProject(id);
        const r = useStudioStore.getState().importBundle(text);
        if (!r.ok) throw new Error(r.error);
        useStudioStore.getState().selectProject(id);
        setPid(id);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [hydrated]);

  const name = useStudioStore((s) => s.projects.find((p) => p.id === pid)?.name ?? '');

  return (
    <div className="h-screen bg-gray-900 text-white" dir="rtl">
      {err ? <p className="p-6 text-red-400">{err}</p>
        : pid ? <Player key={pid} projectName={name} />
        : <p className="p-6 text-gray-400">در حال بارگذاری…</p>}
      <Toasts />
    </div>
  );
}