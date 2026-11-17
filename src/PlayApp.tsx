import React, { useEffect, useRef, useState } from 'react';
import Player from './player/Player';
import { useStudioStore } from './stores/store';
import { Toasts } from './shared/notify';
import { loadProject } from './loadProject';
import { initTelegram, tg } from './telegram';
import LoadingScreen from './LoadingScreen';
import { sceneRefs } from './shared/validation';
import { resolveSprite } from './shared/types';

const DEBUG_STAMP = true;

const MIN_SHOW_MS = 800;
const BLOCK_TIMEOUT_MS = 5000;

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
  const [err, setErr] = useState<string | undefined>(undefined);
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [title, setTitle] = useState('اتاق فرار');
  const [ready, setReady] = useState(false);
  const mountTime = useRef(Date.now());
  const [showScreen, setShowScreen] = useState(true);

  useEffect(() => {
    initTelegram();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      try {
        const text = await loadProject((p) => setProgress(p * 0.85));

        let bundle: { project: { id: string; name: string } };
        try {
          bundle = JSON.parse(text);
        } catch {
          throw new Error('پاسخ سرور معتبر نیست.');
        }
        const id: string = bundle.project.id;
        setTitle(bundle.project.name ?? 'اتاق فرار');

        const st = useStudioStore.getState();
        // آماده‌سازی تازه: اگر نسخه قبلی از IndexedDB لود شده، حذفش کن تا id حفظ شود
        if (st.projects.some((p) => p.id === id)) st.deleteProject(id);

        // Import + select complete → 0.9
        setProgress(0.9);
        const r = useStudioStore.getState().importBundle(text);
        if (!r.ok) throw new Error(r.error);
        useStudioStore.getState().selectProject(id);
        setPid(id);

        // Decode the first room's images (concurrency 2, bounded by BLOCK_TIMEOUT_MS) → 0.9..1
        const state = useStudioStore.getState();
        const project = state.projects.find((p) => p.id === id);
        const firstSceneId = project?.scenes[0];
        const firstScene = firstSceneId ? state.scenes[firstSceneId] : undefined;
        if (firstScene) {
          const urls = sceneRefs(firstScene)
            .map((ref) => resolveSprite(ref, state.sprites, state.assets))
            .filter((u): u is string => Boolean(u));
          if (urls.length > 0) {
            let decoded = 0;
            const advance = () => {
              decoded++;
              setProgress(0.9 + (decoded / urls.length) * 0.1);
            };
            const run = async (offset: number): Promise<void> => {
              for (let j = offset; j < urls.length; j += 2) {
                const img = new Image();
                img.src = urls[j];
                await img.decode().catch(() => {});
                advance();
              }
            };
            const guard = new Promise<void>((resolve) =>
              setTimeout(resolve, BLOCK_TIMEOUT_MS),
            );
            await Promise.race([Promise.all([run(0), run(1)]), guard]);
          }
        }

        setProgress(1);

        // Keep the screen up at least MIN_SHOW_MS since mount, then fade in the game.
        const elapsed = Date.now() - mountTime.current;
        if (elapsed < MIN_SHOW_MS) {
          await new Promise((resolve) =>
            setTimeout(resolve, MIN_SHOW_MS - elapsed),
          );
        }
        setReady(true);
        setLeaving(true);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, [hydrated]);

  // Wipe saved progress before <Player> mounts so every launch starts fresh.
  if (pid && !cleared) {
    try {
      localStorage.removeItem('escape-player-v2');
    } catch {
      /* ignore */
    }
    cleared = true;
  }

  // Unmount the loading screen 400 ms after the fade-out begins.
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setShowScreen(false), 400);
    return () => clearTimeout(timer);
  }, [leaving]);

  const name = useStudioStore((s) => s.projects.find((p) => p.id === pid)?.name ?? title);

  return (
    <div className="fixed inset-0 bg-gray-900 text-white" dir="rtl">
      {showScreen && (
        <LoadingScreen
          title={title}
          progress={progress}
          leaving={leaving}
          error={err}
          onRetry={() => location.reload()}
        />
      )}
      {!err && ready && pid ? <Player key={pid} projectName={name} /> : null}
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