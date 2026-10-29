import React, { useState } from 'react';
import Studio from './studio/Studio';
import Player from './player/Player';

type AppView = 'home' | 'studio' | 'player';

function HomePage({ onNavigate }: { onNavigate: (view: AppView) => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 animate-fade-in" dir="rtl" lang="fa">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="text-6xl md:text-8xl mb-4">🔐</div>
        <h1 className="text-3xl md:text-5xl font-black text-white mb-3">
          اتاق فرار <span className="text-indigo-400">گروهی</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-lg mx-auto">
          پلتفرم بازی اتاق فرار و اشیاء پنهان گروهی از طریق تلگرام
        </p>
      </div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-2xl w-full">
        {/* Studio Card */}
        <button
          onClick={() => onNavigate('studio')}
          className="group bg-surface rounded-2xl p-6 md:p-8 border border-gray-700 hover:border-indigo-500 transition-all hover:shadow-xl hover:shadow-indigo-500/10 text-right"
        >
          <div className="text-4xl mb-3">🎨</div>
          <h2 className="text-xl md:text-2xl font-bold text-white group-hover:text-indigo-300 transition-colors mb-2">
            استودیو طراحی
          </h2>
          <p className="text-gray-400 text-sm md:text-base">
            اتاق‌ها، اشیاء و زنجیره‌های سرنخ را طراحی کنید. خروجی JSON بگیرید.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded">Konva</span>
            <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded">ویرایشگر</span>
            <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded">خروجی JSON</span>
          </div>
        </button>

        {/* Player Card */}
        <button
          onClick={() => onNavigate('player')}
          className="group bg-surface rounded-2xl p-6 md:p-8 border border-gray-700 hover:border-amber-500 transition-all hover:shadow-xl hover:shadow-amber-500/10 text-right"
        >
          <div className="text-4xl mb-3">🎮</div>
          <h2 className="text-xl md:text-2xl font-bold text-white group-hover:text-amber-300 transition-colors mb-2">
            بازی (بازیکن)
          </h2>
          <p className="text-gray-400 text-sm md:text-base">
            بازی را تجربه کنید. اشیاء را کشف کنید، سرنخ‌ها را دنبال کنید و قفل را باز کنید.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded">بازی تعاملی</span>
            <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded">گروهی</span>
            <span className="text-xs bg-amber-900/50 text-amber-300 px-2 py-0.5 rounded">RTL</span>
          </div>
        </button>
      </div>

      {/* Features */}
      <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl w-full">
        {[
          { icon: '📱', label: 'موبایل‌محور' },
          { icon: '👥', label: 'بازی گروهی' },
          { icon: '🔗', label: 'زنجیره سرنخ' },
          { icon: '🔢', label: 'قفل عددی' },
        ].map(f => (
          <div key={f.label} className="bg-surface/50 rounded-xl p-3 text-center border border-gray-800">
            <div className="text-2xl mb-1">{f.icon}</div>
            <div className="text-xs text-gray-400">{f.label}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-gray-600 text-xs">
        <p>ساخته شده با React + TypeScript + Konva + Zustand + TailwindCSS</p>
        <p className="mt-1">فارسی • RTL • Vazirmatn</p>
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<AppView>('home');

  return (
    <div className="min-h-screen bg-gray-900" dir="rtl" lang="fa">
      {/* Navigation */}
      {view !== 'home' && (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur border-b border-gray-700 px-4 py-2 flex items-center justify-between">
          <button
            className="text-gray-300 hover:text-white flex items-center gap-1 text-sm"
            onClick={() => setView('home')}
          >
            <span className="rtl-mirror">←</span> بازگشت
          </button>
          <div className="flex gap-2">
            <button
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                view === 'studio' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setView('studio')}
            >
              🎨 استودیو
            </button>
            <button
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                view === 'player' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
              onClick={() => setView('player')}
            >
              🎮 بازی
            </button>
          </div>
        </nav>
      )}

      {/* Content */}
      <div className={view !== 'home' ? 'pt-11' : ''}>
        {view === 'home' && <HomePage onNavigate={setView} />}
        {view === 'studio' && <Studio />}
        {view === 'player' && <Player />}
      </div>
    </div>
  );
}
