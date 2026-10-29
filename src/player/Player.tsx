import React, { useState, useEffect } from 'react';
import { Stage, Layer, Image as KImage, Rect, Text, Circle, Group } from 'react-konva';
import useImage from 'use-image';
import { usePlayerStore } from '../stores/store';
import { SEED_SESSION, SEED_SCENE, SEED_SCENE_2 } from '../shared/seed-data';
import { isRoomComplete, allRoomsComplete, getRoomDigits } from '../shared/game-logic';
import type { SceneObject } from '../shared/types';

// ============ Lobby Component ============
function Lobby() {
  const { session, gameStarted, startGame, setPlayerReady } = usePlayerStore();
  const [showGuide, setShowGuide] = useState(false);
  if (!session) return null;

  const allReady = session.players.every(p => p.ready);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-surface rounded-2xl p-6 md:p-8 max-w-md w-full border border-gray-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-indigo-300 text-center mb-2">🎮 لابی بازی</h1>
        <p className="text-center text-gray-500 text-sm mb-6">اتاق فرار گروهی - کتابخانه قدیمی</p>
        
        {/* How to Play */}
        <button
          className="w-full text-center text-indigo-400 text-sm mb-4 hover:text-indigo-300"
          onClick={() => setShowGuide(!showGuide)}
        >
          {showGuide ? '▲ بستن راهنما' : '▼ نحوه بازی'}
        </button>
        
        {showGuide && (
          <div className="bg-surface-light rounded-xl p-4 mb-4 text-sm text-gray-300 space-y-2 animate-fade-in">
            <p>🔍 <strong>کاوش:</strong> روی اشیاء مختلف بزنید تا سرنخ‌ها را کشف کنید</p>
            <p>🔗 <strong>زنجیره:</strong> هر سرنخ شما را به شیء بعدی هدایت می‌کند</p>
            <p>🔢 <strong>اعداد:</strong> قطعات عدد را پیدا کنید تا اتاق کامل شود</p>
            <p>🎒 <strong>آیتم‌ها:</strong> آیتم‌های جمع‌آوری شده را روی اشیاء مناسب بکشید</p>
            <p>🔐 <strong>قفل نهایی:</strong> وقتی همه اتاق‌ها کامل شد، رمز نهایی را وارد کنید</p>
            <p>👥 <strong>گروهی:</strong> با هم‌تیمی‌هایتان همکاری کنید!</p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <h2 className="text-sm font-semibold text-gray-400">بازیکنان:</h2>
          {session.players.map(player => (
            <div key={player.telegramId} className="flex items-center justify-between bg-surface-light rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${player.online ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-white">{player.name}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${player.ready ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                {player.ready ? '✓ آماده' : 'در انتظار'}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-lg transition-colors active:scale-95"
            onClick={setPlayerReady}
            aria-label="اعلام آمادگی"
          >
            ✓ آماده‌ام
          </button>
          
          {allReady && (
            <button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-lg transition-colors animate-pulse-glow active:scale-95"
              onClick={startGame}
              aria-label="شروع بازی"
            >
              🚀 شروع بازی
            </button>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          🔗 لینک بازی: play.example.com/s/seed-token-abc123
        </p>
      </div>
    </div>
  );
}

// ============ Game Object Component ============
function GameObject({ obj, discovered, isSelected, onClick }: {
  obj: SceneObject;
  discovered: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const [image] = useImage(obj.imageUrl);
  
  if (!obj.visible) return null;
  if (discovered && obj.oneTimeUse) return null;

  return (
    <Group>
      <KImage
        image={image}
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        rotation={obj.rotation}
        onClick={onClick}
        onTap={onClick}
        cursor="pointer"
      />
      {discovered && (
        <Circle
          x={obj.x + obj.width - 10}
          y={obj.y + 10}
          radius={8}
          fill="#10b981"
          stroke="white"
          strokeWidth={1}
        />
      )}
      {isSelected && (
        <Rect
          x={obj.x - 3}
          y={obj.y - 3}
          width={obj.width + 6}
          height={obj.height + 6}
          stroke="#f59e0b"
          strokeWidth={2}
          dash={[5, 3]}
          cornerRadius={4}
        />
      )}
    </Group>
  );
}

// ============ Background Component ============
function GameBackground({ url, width, height }: { url: string; width: number; height: number }) {
  const [image] = useImage(url);
  if (!image) return <Rect x={0} y={0} width={width} height={height} fill="#1a1a2e" />;
  return <KImage image={image} x={0} y={0} width={width} height={height} />;
}

// ============ Inventory Panel ============
function InventoryPanel() {
  const { sessionState, selectedItem, selectItem } = usePlayerStore();
  
  const itemNames: Record<string, string> = {
    'key-small': '🔑 کلید کوچک',
    'digit-7': '🔢 عدد ۷',
  };

  if (sessionState.inventory.length === 0) {
    return (
      <div className="bg-surface/80 backdrop-blur rounded-xl p-3 text-center text-gray-400 text-sm">
        کوله‌پشتی خالی است
      </div>
    );
  }

  return (
    <div className="bg-surface/80 backdrop-blur rounded-xl p-3">
      <h3 className="text-xs font-bold text-gray-400 mb-2">🎒 کوله‌پشتی</h3>
      <div className="flex gap-2 flex-wrap">
        {sessionState.inventory.map(item => (
          <button
            key={item}
            className={`px-3 py-2 rounded-lg text-sm transition-all ${
              selectedItem === item
                ? 'bg-amber-600 text-white scale-105 shadow-lg'
                : 'bg-surface-light text-white hover:bg-surface-lighter'
            }`}
            onClick={() => selectItem(selectedItem === item ? null : item)}
          >
            {itemNames[item] || item}
          </button>
        ))}
      </div>
      {selectedItem && (
        <p className="text-xs text-amber-300 mt-2">آیتم انتخاب شد. روی یک شیء بزنید تا استفاده شود.</p>
      )}
    </div>
  );
}

// ============ Final Lock Component ============
function FinalLock() {
  const { lockInput, enterLockDigit, clearLockDigit, submitLock, gameComplete } = usePlayerStore();
  
  if (gameComplete) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-fade-in">
        <div className="bg-surface rounded-2xl p-8 text-center animate-victory">
          <div className="text-6xl mb-4">🎊</div>
          <h2 className="text-3xl font-bold text-amber-400 mb-2">تبریک!</h2>
          <p className="text-gray-300 text-lg">شما با موفقیت از اتاق فرار خارج شدید!</p>
          <div className="mt-4 text-4xl font-mono text-green-400">{lockInput}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl p-4 md:p-6 border border-gray-700">
      <h2 className="text-lg font-bold text-center text-amber-300 mb-4">🔐 قفل نهایی</h2>
      
      {/* Display */}
      <div className="bg-gray-800 rounded-xl p-4 mb-4 text-center">
        <div className="text-3xl font-mono tracking-widest text-white min-h-[48px]">
          {lockInput || '—'}
        </div>
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button
            key={n}
            className="num-key"
            onClick={() => enterLockDigit(n.toString())}
            aria-label={`عدد ${n}`}
          >
            {n}
          </button>
        ))}
        <button className="num-key bg-red-900/50 border-red-700" onClick={clearLockDigit} aria-label="پاک کردن">
          ←
        </button>
        <button className="num-key" onClick={() => enterLockDigit('0')} aria-label="عدد ۰">
          0
        </button>
        <button className="num-key bg-green-900/50 border-green-700" onClick={submitLock} aria-label="تایید">
          ✓
        </button>
      </div>
    </div>
  );
}

// ============ Toast Component ============
function Toast() {
  const { toast } = usePlayerStore();
  if (!toast) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className="bg-indigo-600 text-white px-6 py-3 rounded-xl shadow-2xl text-sm md:text-base font-medium max-w-sm text-center">
        {toast}
      </div>
    </div>
  );
}

// ============ Responsive Stage Component ============
function ResponsiveStage({ scene, children }: { scene: any; children: React.ReactNode }) {
  const [dims, setDims] = useState({ w: scene.width, h: scene.height, scale: 1 });
  
  useEffect(() => {
    const update = () => {
      const maxW = Math.min(window.innerWidth - 32, 800);
      const scale = Math.min(1, maxW / scene.width);
      setDims({ w: scene.width, h: scene.height, scale });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [scene.width, scene.height]);

  return (
    <Stage
      width={dims.w * dims.scale}
      height={dims.h * dims.scale}
      scaleX={dims.scale}
      scaleY={dims.scale}
      style={{ touchAction: 'none' }}
    >
      {children}
    </Stage>
  );
}

// ============ Main Player Component ============
export default function Player() {
  const store = usePlayerStore();
  const {
    session, scenes, currentSceneId, sessionState, gameStarted, gameComplete,
    selectedItem, initSession, clickObject, useItemOnObject, selectItem, switchScene,
  } = store;

  // Initialize with seed data
  useEffect(() => {
    if (!session) {
      // Try to restore from localStorage
      try {
        const saved = localStorage.getItem('escape-room-state');
        if (saved) {
          const state = JSON.parse(saved);
          initSession({ ...SEED_SESSION, state }, { [SEED_SCENE.id]: SEED_SCENE, [SEED_SCENE_2.id]: SEED_SCENE_2 });
          return;
        }
      } catch {}
      initSession(SEED_SESSION, { [SEED_SCENE.id]: SEED_SCENE, [SEED_SCENE_2.id]: SEED_SCENE_2 });
    }
  }, []);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">در حال بارگذاری...</div>
      </div>
    );
  }

  // Show lobby if game hasn't started
  if (!gameStarted) {
    return (
      <>
        <Lobby />
        <Toast />
      </>
    );
  }

  // Show victory
  if (gameComplete) {
    return <FinalLock />;
  }

  const currentScene = scenes[currentSceneId];
  if (!currentScene) {
    return <div className="text-center text-gray-400 p-8">صحنه یافت نشد</div>;
  }

  const discovered = sessionState.discoveredObjects[currentSceneId] || [];
  const numberPieces = currentScene.objects.filter(o => o.type === 'number-piece');
  const discoveredDigits = numberPieces.filter(np => discovered.includes(np.id));
  const roomComplete = isRoomComplete(sessionState, currentScene);
  const allComplete = allRoomsComplete(sessionState, Object.values(scenes));
  const projectScenes = session.projectId ? Object.values(scenes) : [];

  const handleObjectClick = (obj: SceneObject) => {
    if (selectedItem && (obj.type === 'container' || obj.requiresItem)) {
      useItemOnObject(selectedItem, obj.id);
    } else {
      clickObject(obj.id);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Toast />
      
      {/* Header */}
      <div className="bg-surface/90 backdrop-blur border-b border-gray-700 px-3 py-2">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-sm md:text-base font-bold text-indigo-300">{currentScene.title}</h1>
          <div className="flex items-center gap-2">
            {/* Online players */}
            {session.players.map(p => (
              <div key={p.telegramId} className="flex items-center gap-1" title={p.name}>
                <div className={`w-2 h-2 rounded-full ${p.online ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-400 hidden md:inline">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 flex items-center justify-center p-2 md:p-4 overflow-auto">
        <div className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-700">
          <ResponsiveStage scene={currentScene}>
            <Layer>
              <GameBackground url={currentScene.backgroundUrl} width={currentScene.width} height={currentScene.height} />
              {currentScene.objects
                .sort((a, b) => a.zIndex - b.zIndex)
                .map(obj => (
                  <GameObject
                    key={obj.id}
                    obj={obj}
                    discovered={discovered.includes(obj.id)}
                    isSelected={selectedItem !== null && (obj.type === 'container' || !!obj.requiresItem)}
                    onClick={() => handleObjectClick(obj)}
                  />
                ))}
            </Layer>
          </ResponsiveStage>
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="bg-surface/90 backdrop-blur border-t border-gray-700 p-3 space-y-3">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Room Progress */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">اعداد کشف شده:</span>
              <div className="flex gap-1">
                {numberPieces.map((np, i) => (
                  <div
                    key={np.id}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                      discovered.includes(np.id) ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-500'
                    }`}
                  >
                    {discovered.includes(np.id) ? np.number : '?'}
                  </div>
                ))}
              </div>
            </div>
            {roomComplete && (
              <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg">
                ✓ اتاق کامل! عدد: {currentScene.exitNumber}
              </span>
            )}
          </div>

          {/* Scene Navigation */}
          {projectScenes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {projectScenes.map(s => (
                <button
                  key={s.id}
                  className={`px-3 py-1 rounded-lg text-xs whitespace-nowrap ${
                    s.id === currentSceneId
                      ? 'bg-indigo-600 text-white'
                      : sessionState.completedScenes.includes(s.id)
                        ? 'bg-green-800 text-green-200'
                        : 'bg-gray-700 text-gray-300'
                  }`}
                  onClick={() => switchScene(s.id)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          )}

          {/* Inventory */}
          <InventoryPanel />

          {/* Final Lock */}
          {allComplete && !gameComplete && (
            <FinalLock />
          )}
        </div>
      </div>
    </div>
  );
}
