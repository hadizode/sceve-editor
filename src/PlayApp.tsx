import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import Player from './player/Player';
import { useStudioStore } from './stores/store';

/** Persisted player session key (shared with `src/stores/store.ts`). */
const PLAYER_KEY = 'escape-player-v2';

function PlayApp() {
  const selectProject = useStudioStore((s) => s.selectProject);
  const currentProjectId = useStudioStore((s) => s.currentProjectId);
  const projectName = useStudioStore(
    (s) => s.projects.find((p) => p.id === s.currentProjectId)?.name ?? 'پروژه فعلی'
  );

  // Play-only mode: every launch must start a fresh game with no saved progress.
  // Drop any persisted session before <Player> mounts so it can never resume.
  try {
    localStorage.removeItem(PLAYER_KEY);
  } catch {}

  // Select the first (seed) project when no project is open yet.
  useEffect(() => {
    if (currentProjectId) return;
    const project = useStudioStore.getState().projects[0];
    if (project) selectProject(project.id);
  }, [selectProject, currentProjectId]);

  if (!currentProjectId) return null;

  return <Player projectName={projectName} />;
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(<PlayApp />);
}
