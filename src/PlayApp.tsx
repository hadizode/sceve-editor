import React, { useEffect, useState } from 'react';
import Player from './player/Player';
import { useStudioStore } from './stores/store';
import { Toasts } from './shared/notify';
import { initTelegram, tg } from './telegram';

const DEBUG_STAMP = true;

// Module-load snapshots (temporary field-test tooling).
const loadedAt = new Date();
let hadSaved = false;
try {
  hadSaved = localStorage.getItem('escape-player-v2') !== null;
} catch {
  hadSaved = false;
}

// True once the saved-progress wipe below has run.
let cleared = false;

export default function PlayApp() {
  const hydrated = useStudioStore((s) => s.hydrated);
  const [pid, setPid] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    initTelegram();
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

  // Wipe saved progress before <Player> mounts so every launch starts fresh.
  if (pid && !cleared) {
    try {
      localStorage.removeItem('escape-player-v2');
    } catch {
      /* ignore */
    }
    cleared = true;
  }

  return (
    <div className="fixed inset-0 bg-gray-900 text-white" dir="rtl">
      {err ? (
        <p className="p-6 text-red-400">{err}</p>
      ) : pid ? (
        <Player key={pid} projectName={name} />
      ) : (
        <p className="p-6 text-gray-400">در حال بارگذاری…</p>
      )}
      <Toasts />
      {DEBUG_STAMP && <DebugStamp />}
    </div>
  );
}

function DebugStamp() {
  const [now, setNow] = useState(loadedAt);
  const [version, setVersion] = useState('-');
  const [fullscreen, setFullscreen] = useState('-');
  const [platform, setPlatform] = useState('-');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const app = tg();
    if (!app) return;
    const update = () => {
      setVersion(String((app as any).version ?? '-'));
      setFullscreen(String((app as any).isFullscreen ?? '-'));
      setPlatform(String((app as any).platform ?? '-'));
    };
    update();
    (app as any).onEvent('fullscreenChanged', update);
    return () => {
      (app as any).offEvent('fullscreenChanged', update);
    };
  }, []);

  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  return (
    <div
      dir="ltr"
      className="fixed left-1 bottom-1 z-[999] text-[9px] opacity-70 pointer-events-none bg-black/60 text-white px-1 rounded"
    >
      {`L ${time} · saved:${hadSaved ? 'yes' : 'no'} · cleared:${cleared ? 'yes' : 'no'} · v${version} fs:${fullscreen} ${platform}`}
    </div>
  );
}