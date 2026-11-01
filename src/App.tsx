import React, { useEffect, useState } from 'react';
import Studio from './studio/Studio';
import Player from './player/Player';
import { useStudioStore } from './stores/store';
import { Toasts } from './shared/notify';

type Tab = 'studio' | 'game';

export default function App() {
  const [tab, setTab] = useState<Tab>('studio');
  const hydrated = useStudioStore((s) => s.hydrated);
  const projectId = useStudioStore((s) => s.currentProjectId);
  const projectName = useStudioStore(
    (s) => s.projects.find((p) => p.id === s.currentProjectId)?.name ?? 'پروژه فعلی'
  );

  // keep body class in sync with the active tab (Studio sets it itself; restore on leaving)
  useEffect(() => {
    if (tab !== 'studio') document.body.className = 'bg-gray-900 text-white min-h-screen';
  }, [tab]);

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Top navigation: Studio <-> Game */}
      <nav className="flex items-center gap-1 px-3 py-1.5 bg-surface border-b border-line flex-shrink-0" aria-label="ناوبری اصلی">
        <span className="text-xs font-bold text-indigo-300 ml-2 select-none">اتاق فرار</span>
        <button
          aria-current={tab === 'studio' ? 'page' : undefined}
          className={`px-3 py-1 rounded-lg text-sm ${tab === 'studio' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-surface-hover'}`}
          onClick={() => setTab('studio')}
        >
          🛠 استودیو
        </button>
        <button
          aria-current={tab === 'game' ? 'page' : undefined}
          className={`px-3 py-1 rounded-lg text-sm ${tab === 'game' ? 'bg-primary text-white' : 'text-gray-400 hover:text-white hover:bg-surface-hover'}`}
          onClick={() => setTab('game')}
        >
          🎮 بازی
        </button>
        {tab === 'game' && projectId && (
          <span className="mr-auto text-xs text-gray-400 truncate max-w-[40vw]" dir="rtl">
            در حال بازی: {projectName}
          </span>
        )}
      </nav>

      <div className="flex-1 min-h-0 relative overflow-hidden">
        {!hydrated ? (
          <div className="h-full flex items-center justify-center text-gray-400">در حال بارگذاری…</div>
        ) : tab === 'studio' ? (
          <Studio />
        ) : projectId ? (
          <Player key={projectId} projectName={projectName} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400" dir="rtl">
            <p className="text-lg">🎮 هیچ پروژه‌ای باز نیست</p>
            <p className="text-sm">ابتدا در استودیو یک پروژه را باز یا بسازید، سپس به تب بازی بروید.</p>
            <button
              className="bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-xl text-sm"
              onClick={() => setTab('studio')}
            >
              رفتن به استودیو →
            </button>
          </div>
        )}
      </div>

      <Toasts />
    </div>
  );
}
