import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { initTelegram } from './telegram';
import './index.css';
import Player from './player/Player';
import { useStudioStore } from './stores/store';
import { Toasts } from './shared/notify';

/** Persisted player session key (shared with `src/stores/store.ts`). */
const PLAYER_KEY = 'escape-player-v2';

export default function PlayApp() {
  const selectProject = useStudioStore((s) => s.selectProject);
  const currentProjectId = useStudioStore((s) => s.currentProjectId);
  const hydrated = useStudioStore((s) => s.hydrated);
  const projectName = useStudioStore(
    (s) => s.projects.find((p) => p.id === s.currentProjectId)?.name ?? 'پروژه فعلی'
  );

  // Init the Telegram Mini App bridge (safe to call outside Telegram; no-op there).
  useEffect(() => {
    initTelegram();
  }, []);

  // Select the first (seed) project when no project is open yet.
  useEffect(() => {
    if (currentProjectId) return;
    const project = useStudioStore.getState().projects[0];
    if (project) selectProject(project.id);
  }, [selectProject, currentProjectId]);

  if (!hydrated) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400 bg-gray-900" dir="rtl">
        در حال بارگذاری…
      </div>
    );
  }

  if (!currentProjectId) return null;

  // Play-only mode: every launch must start a fresh game with no saved progress.
  // Drop any persisted session before <Player> mounts so it can never resume.
  try {
    localStorage.removeItem(PLAYER_KEY);
  } catch {}

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden" dir="rtl">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <Player key={currentProjectId} projectName={projectName} />
      </div>
      <Toasts />
    </div>
  );
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<PlayApp />);
}