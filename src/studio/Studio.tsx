import React, { useEffect, useMemo, useState } from 'react';
import { useCtx, useCurrentProject, useScene, useStudioStore } from '../stores/store';
import Canvas from './Canvas';
import Preview from './Preview';
import ProjectsView from './ProjectsView';
import { PropertiesPanel } from './Properties';
import { TransitionsTab } from './Transitions';
import { AssetsPanel, BackgroundPanel, ChainPanel, ChecksPanel, LayersPanel, RoomProps, RoomsPanel, useIssues } from './Panels';
import { btnPrimary, Group, IconBtn, isTyping, NumInput } from './ui';
import { DockTabs, PanelHead, Splitter, usePersistedNumber } from './dock';
import { buildCommands, type BottomTab } from './commands';
import { CommandPalette, MenuBar } from './MenuBar';

const st = () => useStudioStore.getState();

type Center = 'scene' | 'game';
type Inspector = 'object' | 'transitions' | 'room';
const DEFAULTS = { left: 240, right: 320, bottom: 230 };

function exportJson() {
  const s = st();
  const json = s.exportBundle();
  if (!json) return;
  const name = s.projects.find((p) => p.id === s.currentProjectId)?.name || 'project';
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Shows autosave progress (events are dispatched by shared/idb.ts). */
function SaveState() {
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const on = () => setSaving(true);
    const off = () => setSaving(false);
    window.addEventListener('studio-saving', on);
    window.addEventListener('studio-saved', off);
    return () => {
      window.removeEventListener('studio-saving', on);
      window.removeEventListener('studio-saved', off);
    };
  }, []);
  return <span className={saving ? 'text-amber-300' : 'text-emerald-400'}>{saving ? '● Saving…' : '✓ Saved'}</span>;
}

function Editor() {
  const project = useCurrentProject();
  const ctx = useCtx();
  const scene = useScene();
  const selected = useStudioStore((s) => s.selectedObjectIds);
  const showGrid = useStudioStore((s) => s.showGrid);
  const snap = useStudioStore((s) => s.snapToGrid);
  const labels = useStudioStore((s) => s.showLabels);
  const gridSize = useStudioStore((s) => s.gridSize);
  const canUndo = useStudioStore((s) => s.past.length > 0);
  const canRedo = useStudioStore((s) => s.future.length > 0);
  const issues = useIssues();
  const errors = issues.filter((i) => i.level === 'error').length;
  const warnings = issues.length - errors;

  const [center, setCenter] = useState<Center>('scene');
  const [inspector, setInspector] = useState<Inspector>('object');
  const [bottomTab, setBottomTab] = useState<BottomTab>('assets');
  const [left, setLeft] = usePersistedNumber('studio.left', DEFAULTS.left, 160, 420);
  const [right, setRight] = usePersistedNumber('studio.right', DEFAULTS.right, 240, 560);
  const [bottom, setBottom] = usePersistedNumber('studio.bottom', DEFAULTS.bottom, 120, 520);
  const [bottomOpen, setBottomOpen] = usePersistedNumber('studio.bottomOpen', 1, 0, 1);
  const [palette, setPalette] = useState(false);
  const [dragging, setDragging] = useState(false);

  const cmds = useMemo(
    () =>
      buildCommands({
        exportJson,
        setCenter,
        openBottom: (t) => {
          setBottomTab(t);
          setBottomOpen(1);
        },
        toggleBottom: () => setBottomOpen((o) => (o ? 0 : 1)),
        resetLayout: () => {
          setLeft(DEFAULTS.left);
          setRight(DEFAULTS.right);
          setBottom(DEFAULTS.bottom);
          setBottomOpen(1);
        },
      }),
    [setLeft, setRight, setBottom, setBottomOpen]
  );

  // Selecting something while the Room tab is open jumps to the object inspector.
  useEffect(() => {
    if (selected.length > 0) setInspector((t) => (t === 'room' ? 'object' : t));
  }, [selected.join('|')]);

  // keyboard shortcuts (ignored while typing in inputs)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'k') {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (center !== 'scene' || isTyping(e)) return;
      const s = st();
      if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); return; }
      if (mod && k === 'y') { e.preventDefault(); s.redo(); return; }
      if (mod && k === 'c') { s.copySelected(); return; }
      if (mod && k === 'v') { e.preventDefault(); s.paste(); return; }
      if (mod && k === 'd') { e.preventDefault(); s.duplicateSelected(); return; }
      if (mod && k === 'a') { e.preventDefault(); s.selectAll(); return; }
      if ((k === 'delete' || k === 'backspace') && s.selectedObjectIds.length) {
        e.preventDefault();
        s.deleteObjects(s.selectedObjectIds);
        return;
      }
      if (k === 'escape') {
        if (s.selectedObjectIds.length) s.clearSelection();
        else if (s.editingViewOf) s.exitView();
        return;
      }
      if (k.startsWith('arrow') && s.selectedObjectIds.length) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        s.nudge(k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [center]);

  if (!project) return null;

  const playing = center === 'game';

  const bottomBody =
    bottomTab === 'assets' ? (
      <div className="dock-assets"><AssetsPanel /></div>
    ) : bottomTab === 'chain' ? (
      <div className="max-w-xl"><ChainPanel /></div>
    ) : (
      <ChecksPanel />
    );

  return (
    // dir="ltr": the page body is RTL, which would otherwise mirror the dock order.
    // Persian text fields set their own dir="rtl".
    <div dir="ltr" className={`h-full flex flex-col bg-viewport text-white ${dragging ? 'select-none' : ''}`}>
      {/* ───────── Title bar: menus · project · transport ───────── */}
      <header className="h-10 shrink-0 flex items-center gap-3 px-2 bg-dock-head border-b border-black/60">
        <span className="text-xs font-bold text-indigo-300 px-1 select-none">Escape Studio</span>
        <MenuBar cmds={cmds} />
        <input
          className="flex-1 min-w-0 max-w-sm mx-auto text-center bg-transparent border border-transparent hover:border-white/15 focus:border-primary rounded-md px-2 py-1 text-sm text-gray-100 font-medium outline-none"
          value={project.name}
          aria-label="Project name"
          onChange={(e) => st().updateProject({ name: e.target.value })}
        />
        <Group>
          <IconBtn title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={() => st().undo()}>↶</IconBtn>
          <IconBtn title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!canRedo} onClick={() => st().redo()}>↷</IconBtn>
        </Group>
        <button
          onClick={() => setCenter(playing ? 'scene' : 'game')}
          className={`inline-flex items-center gap-1.5 h-7 px-3.5 rounded-md text-xs font-semibold text-white ${playing ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
        >
          {playing ? '■ Stop' : '▶ Play'}
        </button>
        <button
          onClick={() => setPalette(true)}
          className="h-7 px-2.5 rounded-md text-[11px] text-gray-400 bg-black/30 border border-white/10 hover:text-white hover:border-white/25"
          title="Command palette"
        >
          Search commands <span className="font-mono ml-1 text-gray-500">Ctrl+K</span>
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ───────── Left dock: Hierarchy ───────── */}
        <aside style={{ width: left }} className="shrink-0 flex flex-col min-h-0 bg-surface">
          <PanelHead
            title="Hierarchy"
            right={
              <button title="Add sprite" aria-label="Add sprite" onClick={() => st().addObject()} className="text-base leading-none text-gray-300 hover:text-white">
                ＋
              </button>
            }
          />
          <div className="flex-1 overflow-y-auto min-h-0">
            {!ctx?.view && <RoomsPanel />}
            <LayersPanel />
          </div>
        </aside>
        <Splitter axis="x" onDelta={(d) => setLeft((w) => w + d)} onDragging={setDragging} />

        {/* ───────── Center: viewport + bottom dock ───────── */}
        <div className="flex-1 min-w-0 flex flex-col">
          <section className="flex-1 min-h-0 flex flex-col bg-surface">
            <DockTabs<Center>
              tabs={[
                { id: 'scene', label: 'Scene' },
                { id: 'game', label: 'Game' },
              ]}
              value={center}
              onChange={setCenter}
              right={
                center === 'scene' ? (
                  <div className="flex items-center gap-1 pr-1">
                    <Group>
                      <IconBtn active={showGrid} onClick={() => st().toggleGrid()}>Grid</IconBtn>
                      <div className="w-12 px-0.5"><NumInput value={gridSize} min={5} onChange={(n) => st().setGridSize(n)} /></div>
                      <IconBtn active={snap} onClick={() => st().toggleSnap()}>Snap</IconBtn>
                      <IconBtn active={labels} onClick={() => st().toggleLabels()}>Labels</IconBtn>
                    </Group>
                    <button className={`${btnPrimary} !h-7`} onClick={() => st().addObject()}>＋ Sprite</button>
                  </div>
                ) : undefined
              }
            />
            <div className="relative flex-1 min-h-0 flex flex-col bg-viewport">
              {center === 'scene' ? (
                <div className="absolute inset-0">
                  <Canvas />
                </div>
              ) : (
                <Preview />
              )}
            </div>
          </section>

          {bottomOpen === 1 && (
            <>
              <Splitter axis="y" onDelta={(d) => setBottom((h) => h - d)} onDragging={setDragging} />
              <section style={{ height: bottom }} className="shrink-0 flex flex-col min-h-0 bg-surface">
                <DockTabs<BottomTab>
                  tabs={[
                    { id: 'assets', label: 'Assets' },
                    { id: 'chain', label: 'Clue Chain' },
                    { id: 'checks', label: 'Checks', badge: errors },
                  ]}
                  value={bottomTab}
                  onChange={setBottomTab}
                  right={
                    <button title="Hide panel" aria-label="Hide panel" onClick={() => setBottomOpen(0)} className="px-2 text-gray-400 hover:text-white">
                      ▾
                    </button>
                  }
                />
                <div className="flex-1 overflow-y-auto min-h-0">{bottomBody}</div>
              </section>
            </>
          )}
        </div>

        <Splitter axis="x" onDelta={(d) => setRight((w) => w - d)} onDragging={setDragging} />

        {/* ───────── Right dock: Inspector ───────── */}
        <aside style={{ width: right }} className="shrink-0 flex flex-col min-h-0 bg-surface">
          <DockTabs<Inspector>
            tabs={[
              { id: 'object', label: 'Inspector' },
              { id: 'transitions', label: 'Transitions' },
              { id: 'room', label: 'Room' },
            ]}
            value={inspector}
            onChange={setInspector}
          />
          <div className="flex-1 overflow-y-auto min-h-0" role="tabpanel">
            {inspector === 'object' && <PropertiesPanel />}
            {inspector === 'transitions' && <TransitionsTab />}
            {inspector === 'room' && (
              <>
                {!ctx?.view && <RoomProps />}
                <BackgroundPanel />
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ───────── Status bar ───────── */}
      <footer className="h-6 shrink-0 flex items-center justify-between gap-4 px-3 bg-dock-head border-t border-black/60 text-[11px] text-gray-400">
        <div className="flex items-center gap-4 min-w-0">
          <span className="truncate">
            {scene?.title ?? '—'}
            {ctx ? ` · ${ctx.width}×${ctx.height}` : ''}
            {ctx?.view ? ` · view: ${ctx.view.title}` : ''}
          </span>
          <span>{selected.length ? `${selected.length} selected` : 'Nothing selected'}</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            className={`hover:text-white ${errors ? 'text-red-400' : warnings ? 'text-amber-300' : 'text-emerald-400'}`}
            onClick={() => {
              setBottomTab('checks');
              setBottomOpen(1);
            }}
            title="Open Checks"
          >
            {errors || warnings ? `${errors} errors · ${warnings} warnings` : '✓ No issues'}
          </button>
          <SaveState />
          <button className="hover:text-white" onClick={() => setBottomOpen((o) => (o ? 0 : 1))} title="Toggle bottom panel">
            ▤ Panel
          </button>
        </div>
      </footer>

      {palette && <CommandPalette cmds={cmds} onClose={() => setPalette(false)} />}
    </div>
  );
}

export default function Studio() {
  const hydrated = useStudioStore((s) => s.hydrated);
  const screen = useStudioStore((s) => s.screen);
  if (!hydrated) return <div className="h-full flex items-center justify-center text-gray-400">در حال بارگذاری…</div>;
  return screen === 'projects' ? <ProjectsView /> : <Editor />;
}
