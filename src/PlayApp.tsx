import React, { useEffect } from 'react';
import { initTelegram } from './telegram';
import Player from './player/Player';
import { useStudioStore } from './stores/store';
import { Toasts } from './shared/notify';

export default function PlayApp() {
  useEffect(() => {
    initTelegram();
  }, []);

  const hydrated = useStudioStore((s) => s.hydrated);
  const projectId = useStudioStore((s) => s.currentProjectId);
  const projectName = useStudioStore(
    (s) => s.projects.find((p) => p.id === s.currentProjectId)?.name ?? 'پروژه فعلی'
  );

  if (!hydrated) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-400 bg-gray-900">
        در حال بارگذاری…
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 text-gray-400 bg-gray-900" dir="rtl">
        <p className="text-lg">🎮 هیچ پروژه‌ای باز نیست</p>
        <p className="text-sm">ابتدا در استودیو یک پروژه را باز یا بسازید.</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <Player key={projectId} projectName={projectName} />
      </div>
      <Toasts />
    </div>
  );
}
