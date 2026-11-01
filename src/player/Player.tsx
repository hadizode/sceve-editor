import React, { useState, useEffect, useRef } from 'react';
import { Stage, Layer, Image as KImage, Rect, Circle, Group, Shape } from 'react-konva';
import useImage from 'use-image';
import { usePlayerStore } from '../stores/store';
import { SEED_SESSION, SEED_SCENE, SEED_SCENE_2 } from '../shared/seed-data';
import { isRoomComplete, allRoomsComplete, createObjectHitFunc, getRotatedBounds, getObjectCorners } from '../shared/game-logic';
import type { SceneObject, View } from '../shared/types';

// ============ Lobby Component ============
function Lobby() {
  const { session, startGame, setPlayerReady } = usePlayerStore();
  const [showGuide, setShowGuide] = useState(false);
  if (!session) return null;

  const allReady = session.players.every(p => p.ready);

  return (
    <div className="h-full flex items-center justify-center p-4 animate-fade-in overflow-auto">
      <div className="bg-surface rounded-2xl p-6 md:p-8 max-w-md w-full border border-gray-700 shadow-2xl">
        <h1 className="text-2xl font-bold text-indigo-300 text-center mb-2">🎮 Game Lobby</h1>
        <p className="text-center text-gray-500 text-sm mb-6">Group Escape Room - Old Library</p>
        
        <button
          className="w-full text-center text-indigo-400 text-sm mb-4 hover:text-indigo-300"
          onClick={() => setShowGuide(!showGuide)}
        >
          {showGuide ? '▲ Hide Guide' : '▼ How to Play'}
        </button>
        
        {showGuide && (
          <div className="bg-surface-light rounded-xl p-4 mb-4 text-sm text-gray-300 space-y-2 animate-fade-in">
            <p>🔍 <strong>Explore:</strong> Click objects to discover clues</p>
            <p>🔗 <strong>Chain:</strong> Each clue leads you to the next object</p>
            <p>🔢 <strong>Numbers:</strong> Find number pieces to complete each room</p>
            <p>🎒 <strong>Items:</strong> Use collected items on matching objects</p>
            <p>🔍 <strong>Views:</strong> Some objects open a close-up interactive view (zoom & pan inside)</p>
            <p>🔐 <strong>Final Lock:</strong> Enter the combined code when all rooms are complete</p>
            <p>👥 <strong>Teamwork:</strong> Collaborate with your teammates!</p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <h2 className="text-sm font-semibold text-gray-400">Players:</h2>
          {session.players.map(player => (
            <div key={player.telegramId} className="flex items-center justify-between bg-surface-light rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${player.online ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-white">{player.name}</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded ${player.ready ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'}`}>
                {player.ready ? '✓ Ready' : 'Waiting'}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <button
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-lg transition-colors active:scale-95"
            onClick={setPlayerReady}
            aria-label="Mark as ready"
          >
            ✓ I'm Ready
          </button>
          
          {allReady && (
            <button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-lg transition-colors animate-pulse-glow active:scale-95"
              onClick={startGame}
              aria-label="Start game"
            >
              🚀 Start Game
            </button>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          🔗 Link: play.example.com/s/seed-token-abc123
        </p>
      </div>
    </div>
  );
}

// ============ Sprite Player (animated frame sequence) ============
function useSpriteFrame(sprite: NonNullable<SceneObject['sprite']>) {
  const frames = sprite.frames;
  const [frame, setFrame] = useState(sprite.startFrame ?? 0);
  useEffect(() => {
    if (!frames || frames.length < 2) return;
    const start = Math.min(sprite.startFrame ?? 0, frames.length - 1);
    setFrame(start);
    let current = start;
    const interval = setInterval(() => {
      current += 1;
      if (current >= frames.length) {
        if (sprite.loop) current = 0;
        else { clearInterval(interval); return; }
      }
      setFrame(current);
    }, 1000 / Math.max(1, sprite.fps));
    return () => clearInterval(interval);
  }, [frames.join('|'), sprite.fps, sprite.loop, sprite.startFrame]);
  return frames && frames.length > 0 ? frames[Math.min(frame, frames.length - 1)] : null;
}

// ============ Game Object Component ============
function GameObject({ obj, discovered, isHighlighted, onClick }: {
  obj: SceneObject;
  discovered: boolean;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  const spriteUrl = obj.sprite ? useSpriteFrame(obj.sprite) : null;
  const [image] = useImage(spriteUrl || obj.imageUrl);

  if (!obj.visible) return null;
  if (discovered && obj.oneTimeUse) return null;

  // Hit area: custom polygon (local coords) when defined, otherwise the
  // image's own rectangle via an explicit hit path. All decorations are
  // non-interactive so they can never enlarge or block the click target.
  return (
    <Group>
      <KImage
        image={image}
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        rotation={obj.rotation}
        hitFunc={createObjectHitFunc(obj.width, obj.height, obj.hitArea)}
        onClick={onClick}
        onTap={onClick}
        cursor="pointer"
      />
      {obj.view && !discovered && (
        <Circle
          x={obj.x + 8}
          y={obj.y + 8}
          radius={6}
          fill="#6366f1"
          stroke="white"
          strokeWidth={1}
          listening={false}
        />
      )}
      {discovered && (
        <Circle
          x={obj.x + obj.width - 10}
          y={obj.y + 10}
          radius={8}
          fill="#10b981"
          stroke="white"
          strokeWidth={1}
          listening={false}
        />
      )}
      {isHighlighted && (
        <Shape
          sceneFunc={(ctx: any) => {
            const corners = getObjectCorners(obj);
            ctx.beginPath();
            ctx.moveTo(corners[0].x, corners[0].y);
            for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
            ctx.closePath();
            ctx.fillStrokeShape(ctx);
          }}
          stroke="#f59e0b"
          strokeWidth={2}
          dash={[5, 3]}
          listening={false}
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

// ============ View Overlay (Interactive close-up with zoom/pan) ============
function ViewOverlay({ view, onClose, discoveredObjects, onObjectClick }: {
  view: View;
  onClose: () => void;
  discoveredObjects: string[];
  onObjectClick: (obj: SceneObject) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.5, Math.min(3, z + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (spaceHeld || e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const displayW = Math.min(view.width, 500);
  const scale = displayW / view.width;

  return (
    <div className="fixed inset-0 bg-black/85 z-40 flex items-center justify-center animate-fade-in">
      <div className="bg-surface rounded-2xl border border-gray-600 shadow-2xl overflow-hidden max-w-[95vw] max-h-[90vh]">
        <div className="flex items-center justify-between px-4 py-2 bg-surface-light border-b border-gray-700">
          <h3 className="text-sm font-bold text-indigo-300" dir="rtl" lang="fa">🔍 {view.title}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
            <button
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
              onClick={onClose}
              aria-label="Close view"
            >
              ✕ Close
            </button>
          </div>
        </div>
        
        <div
          ref={containerRef}
          className="relative overflow-hidden select-none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onContextMenu={e => e.preventDefault()}
          style={{ cursor: spaceHeld ? (isPanning ? 'grabbing' : 'grab') : 'default' }}
        >
          <Stage
            width={displayW}
            height={view.height * scale}
            scaleX={zoom * scale}
            scaleY={zoom * scale}
            x={pan.x}
            y={pan.y}
          >
            <Layer>
              <GameBackground url={view.backgroundUrl} width={view.width} height={view.height} />
              {view.objects
                .sort((a, b) => a.zIndex - b.zIndex)
                .map(obj => (
                  <GameObject
                    key={obj.id}
                    obj={obj}
                    discovered={discoveredObjects.includes(obj.id)}
                    isHighlighted={false}
                    onClick={() => onObjectClick(obj)}
                  />
                ))}
            </Layer>
          </Stage>
        </div>

        <div className="px-4 py-2 bg-surface-light border-t border-gray-700 text-xs text-gray-500 flex justify-between">
          <span>Scroll = Zoom | Space + Drag = Pan</span>
          <span dir="rtl" lang="fa">اسکرول = زوم | Space + درگ = جابجایی</span>
        </div>
      </div>
    </div>
  );
}

// ============ Inventory Panel ============
function InventoryPanel() {
  const { sessionState, selectedItem, selectItem } = usePlayerStore();
  
  const itemNames: Record<string, string> = {
    'key-gold': '🔑 Golden Key',
    'key-small': '🔑 Small Key',
    'digit-7': '🔢 Number 7',
    'digit-3': '🔢 Number 3',
  };

  if (sessionState.inventory.length === 0) {
    return (
      <div className="bg-surface/80 backdrop-blur rounded-xl p-3 text-center text-gray-400 text-sm">
        🎒 Inventory is empty
      </div>
    );
  }

  return (
    <div className="bg-surface/80 backdrop-blur rounded-xl p-3">
      <h3 className="text-xs font-bold text-gray-400 mb-2">🎒 Inventory</h3>
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
        <p className="text-xs text-amber-300 mt-2">Item selected. Click an object to use it.</p>
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
          <h2 className="text-3xl font-bold text-amber-400 mb-2">Congratulations!</h2>
          <p className="text-gray-300 text-lg">You successfully escaped the room!</p>
          <div className="mt-4 text-4xl font-mono text-green-400">{lockInput}</div>
          <button
            className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl"
            onClick={() => window.location.reload()}
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl p-4 md:p-6 border border-gray-700">
      <h2 className="text-lg font-bold text-center text-amber-300 mb-4">🔐 Final Lock</h2>
      <div className="bg-gray-800 rounded-xl p-4 mb-4 text-center">
        <div className="text-3xl font-mono tracking-widest text-white min-h-[48px]">
          {lockInput || '—'}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <button
            key={n}
            className="num-key"
            onClick={() => enterLockDigit(n.toString())}
            aria-label={`Number ${n}`}
          >
            {n}
          </button>
        ))}
        <button className="num-key bg-red-900/50 border-red-700" onClick={clearLockDigit} aria-label="Delete">←</button>
        <button className="num-key" onClick={() => enterLockDigit('0')} aria-label="Number 0">0</button>
        <button className="num-key bg-green-900/50 border-green-700" onClick={submitLock} aria-label="Submit">✓</button>
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
      <div className="bg-indigo-600 text-white px-6 py-4 rounded-xl shadow-2xl text-sm md:text-base font-medium max-w-sm text-center" dir="rtl" lang="fa">
        {toast}
      </div>
    </div>
  );
}

// ============ Main Player Component ============
export default function Player() {
  const store = usePlayerStore();
  const {
    session, scenes, currentSceneId, sessionState, gameStarted, gameComplete,
    selectedItem, initSession, clickObject, useItemOnObject, pickupObject, selectItem, switchScene,
  } = store;

  const [activeView, setActiveView] = useState<{ view: View; parentObjectId: string } | null>(null);

  useEffect(() => {
    if (!session) {
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
    return <div className="min-h-screen flex items-center justify-center"><div className="text-gray-400">Loading...</div></div>;
  }

  if (!gameStarted) return <><Lobby /><Toast /></>;
  if (gameComplete) return <FinalLock />;

  const currentScene = scenes[currentSceneId];
  if (!currentScene) return <div className="text-center text-gray-400 p-8">Scene not found</div>;

  const discovered = sessionState.discoveredObjects[currentSceneId] || [];
  const viewDiscovered = activeView ? (sessionState.discoveredObjects[activeView.view.id] || []) : [];
  const numberPieces = currentScene.objects.filter(o => o.digit !== undefined);
  const roomComplete = isRoomComplete(sessionState, currentScene);
  const allComplete = allRoomsComplete(sessionState, Object.values(scenes));
  const projectScenes = Object.values(scenes);

  const handleObjectClick = (obj: SceneObject) => {
    // If using an item on an object
    if (selectedItem) {
      if (obj.type === 'container' || obj.requiresItem || obj.transforms) {
        useItemOnObject(selectedItem, obj.id);
        return;
      }
    }
    
    // If object has a view, open it
    if (obj.view) {
      if (obj.view.requiresItem && obj.view.requiresItem.length > 0) {
        const hasItems = obj.view.requiresItem.every(item => sessionState.inventory.includes(item));
        if (!hasItems) {
          store.setToast('You need a specific item to open this view');
          setTimeout(() => store.setToast(null), 4000);
          return;
        }
      }
      setActiveView({ view: obj.view, parentObjectId: obj.id });
      return;
    }
    
    // If object is pickupable, pick it up
    if (obj.pickupable) {
      const discovered = sessionState.discoveredObjects[currentSceneId] || [];
      if (!discovered.includes(obj.id)) {
        pickupObject(obj.id);
        return;
      }
    }
    
    // Normal discovery
    clickObject(obj.id);
  };

  const handleViewObjectClick = (obj: SceneObject) => {
    if (activeView) {
      const viewId = activeView.view.id;
      const vd = sessionState.discoveredObjects[viewId] || [];
      if (vd.includes(obj.id)) {
        store.setToast('Already discovered');
        setTimeout(() => store.setToast(null), 3000);
        return;
      }
      const newDiscovered = [...vd, obj.id];
      const newDiscoveredObjects = { ...sessionState.discoveredObjects, [viewId]: newDiscovered };
      let newInventory = [...sessionState.inventory];
      if (obj.grantsItem && !newInventory.includes(obj.grantsItem)) {
        newInventory.push(obj.grantsItem);
      }
      const newState = { ...sessionState, discoveredObjects: newDiscoveredObjects, inventory: newInventory };
      if (obj.message) {
        store.setToast(obj.message);
        setTimeout(() => store.setToast(null), 7000);
      }
      const updatedSession = { ...session, state: newState };
      store.initSession(updatedSession, scenes);
      try { localStorage.setItem('escape-room-state', JSON.stringify(newState)); } catch {}
    }
  };

  // Responsive canvas - fits to container, no zoom/pan in main game
  const maxCanvasW = typeof window !== 'undefined' ? Math.min(window.innerWidth - 32, 800) : 800;
  const canvasScale = Math.min(1, maxCanvasW / currentScene.width);

  return (
    <div className="h-full flex flex-col bg-gray-900 overflow-hidden">
      <Toast />
      
      {activeView && (
        <ViewOverlay
          view={activeView.view}
          onClose={() => {
            if (activeView.view.closeMessage) {
              store.setToast(activeView.view.closeMessage);
              setTimeout(() => store.setToast(null), 4000);
            }
            setActiveView(null);
          }}
          discoveredObjects={viewDiscovered}
          onObjectClick={handleViewObjectClick}
        />
      )}
      
      {/* Header */}
      <div className="bg-surface/90 backdrop-blur border-b border-gray-700 px-3 py-2">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <h1 className="text-sm md:text-base font-bold text-indigo-300">{currentScene.title}</h1>
          <div className="flex items-center gap-3">
            {session.players.map(p => (
              <div key={p.telegramId} className="flex items-center gap-1" title={p.name}>
                <div className={`w-2 h-2 rounded-full ${p.online ? 'bg-green-500' : 'bg-gray-500'}`} />
                <span className="text-xs text-gray-400 hidden md:inline">{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Game Canvas - No zoom/pan, just responsive fit */}
      <div className="flex-1 flex items-center justify-center p-2 md:p-4 overflow-hidden min-h-0">
        <div className="relative rounded-xl overflow-hidden shadow-2xl border border-gray-700">
          <Stage
            width={currentScene.width * canvasScale}
            height={currentScene.height * canvasScale}
            scaleX={canvasScale}
            scaleY={canvasScale}
            style={{ touchAction: 'none', display: 'block' }}
          >
            <Layer>
              <GameBackground url={currentScene.backgroundUrl} width={currentScene.width} height={currentScene.height} />
              {currentScene.objects
                .sort((a, b) => a.zIndex - b.zIndex)
                .map(obj => (
                  <GameObject
                    key={obj.id}
                    obj={obj}
                    discovered={discovered.includes(obj.id)}
                    isHighlighted={selectedItem !== null && (obj.type === 'container' || !!obj.requiresItem)}
                    onClick={() => handleObjectClick(obj)}
                  />
                ))}
            </Layer>
          </Stage>
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="bg-surface/90 backdrop-blur border-t border-gray-700 p-3 space-y-3 flex-shrink-0 overflow-y-auto max-h-[40vh]">
        <div className="max-w-2xl mx-auto space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Digits found:</span>
              <div className="flex gap-1">
                {numberPieces.map((np) => (
                  <div
                    key={np.id}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold ${
                      discovered.includes(np.id) ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-500'
                    }`}
                  >
                    {discovered.includes(np.id) ? np.digit : '?'}
                  </div>
                ))}
              </div>
            </div>
            {roomComplete && (
              <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-lg">
                ✓ Room complete! Digit: {currentScene.exitNumber}
              </span>
            )}
          </div>

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

          <InventoryPanel />

          {allComplete && !gameComplete && <FinalLock />}
        </div>
      </div>
    </div>
  );
}
