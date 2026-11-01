import React, { useEffect, useState } from 'react';
import { useCtx, useCurrentProject, useStudioStore } from '../stores/store';
import Canvas from './Canvas';
import Preview from './Preview';
import ProjectsView from './ProjectsView';
import { PropertiesPanel } from './Properties';
import { AssetsPanel, BackgroundPanel, ChainPanel, ChecksPanel, LayersPanel, RoomProps, RoomsPanel, useIssues } from './Panels';
import { inputCls, isTyping, NumInput } from './ui';

type Tab = 'props' | 'layers' | 'assets' | 'chain' | 'checks';
const st = () => useStudioStore.getState();

function Editor() {
  const project = useCurrentProject();
  const ctx = useCtx();
  const [preview, setPreview] = useState(false);
  const [tab, setTab] = useState<Tab>('props');
  const showGrid = useStudioStore((s) => s.showGrid);
  const snap = useStudioStore((s) => s.snapToGrid);
  const labels = useStudioStore((s) => s.showLabels);
  const gridSize = useStudioStore((s) => s.gridSize);
  const canUndo = useStudioStore((s) => s.past.length > 0);
  const canRedo = useStudioStore((s) => s.future.length > 0);
  const issues = useIssues();
  const errors = issues.filter((i) => i.level === 'error').length;

  // keyboard shortcuts (ignored while typing in inputs)
  useEffect(() => {
    if (preview) return;
    const h = (e: KeyboardEvent) => {
      if (isTyping(e)) return;
      const s = st();
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
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
  }, [preview]);

  const exportJson = () => {
    const json = st().exportBundle();
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project?.name || 'project'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!project) return null;

  const tb = (on: boolean) => `px-2 py-1 rounded text-xs text-white ${on ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`;
  const tabBtn = (t: Tab, label: string, badge?: number) => (
    <button
      key={t}
      className={`flex-1 px-1 py-2 text-xs border-b-2 ${tab === t ? 'border-indigo-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}
      onClick={() => setTab(t)}
    >
      {label}
      {!!badge && <span className="ml-1 bg-red-600 text-white rounded-full px-1.5 text-[10px]">{badge}</span>}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="bg-surface border-b border-gray-700 px-3 py-2 flex items-center gap-2 flex-wrap flex-shrink-0">
        <button className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm" onClick={() => st().closeProject()}>← Projects</button>
        <input
          className="bg-transparent border border-transparent hover:border-gray-600 focus:border-indigo-500 rounded px-2 py-1 text-indigo-300 font-semibold text-sm outline-none w-56"
          value={project.name}
          onChange={(e) => st().updateProject({ name: e.target.value })}
        />
        <div className="flex-1" />
        <button className={tb(false)} disabled={!canUndo} onClick={() => st().undo()} title="Undo (Ctrl+Z)">↶ Undo</button>
        <button className={tb(false)} disabled={!canRedo} onClick={() => st().redo()} title="Redo (Ctrl+Y)">↷ Redo</button>
        <div className="h-5 w-px bg-gray-600" />
        <button className={tb(showGrid)} onClick={() => st().toggleGrid()}>Grid</button>
        <div className="w-14"><NumInput value={gridSize} min={5} onChange={(n) => st().setGridSize(n)} /></div>
        <button className={tb(snap)} onClick={() => st().toggleSnap()}>Snap</button>
        <button className={tb(labels)} onClick={() => st().toggleLabels()}>Labels</button>
        <div className="h-5 w-px bg-gray-600" />
        <button className={tb(false)} onClick={exportJson}>Export JSON</button>
        <button className={`px-2 py-1 rounded text-xs text-white ${preview ? 'bg-amber-600' : 'bg-gray-700 hover:bg-gray-600'}`} onClick={() => setPreview((p) => !p)}>
          {preview ? '✏️ Edit' : '▶ Preview'}
        </button>
      </div>

      {preview ? (
        <Preview />
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Left: tools */}
          <aside className="w-52 bg-surface border-r border-gray-700 overflow-y-auto flex-shrink-0">
            <div className="p-3 border-b border-gray-700">
              <h3 className="text-xs font-bold text-gray-400 mb-2">{ctx?.view ? 'Add to view' : 'Add sprite'}</h3>
              {/* One unified sprite — it can be anything (image, color, invisible hotspot, pickup, transform…) */}
              <button
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1.5 rounded text-xs"
                onClick={() => st().addObject()}
              >
                🧩 ＋ Add sprite
              </button>
              <p className="text-[10px] text-gray-500 mt-1.5 leading-relaxed">
                هر اسپرایت می‌تواند هر چیزی باشد: تصویر، رنگ خالص، نامرئی تا پس از ترنسفورم، قابل برداشتن، قفل‌دار و…
              </p>
            </div>
            {!ctx?.view && <RoomsPanel />}
            {!ctx?.view && <RoomProps />}
            <BackgroundPanel />
            <div className="p-3 text-[11px] text-gray-500 space-y-0.5">
              <p>Ctrl+Z / Y — undo / redo</p>
              <p>Ctrl+C / V / D — copy / paste / duplicate</p>
              <p>Arrows — nudge (Shift = 10px)</p>
              <p>Del — delete • Esc — deselect / exit view</p>
            </div>
          </aside>

          {/* Canvas */}
          <main className="flex-1 min-w-0 min-h-0">
            <Canvas />
          </main>

          {/* Right: tabs */}
          <aside className="w-72 bg-surface border-l border-gray-700 flex flex-col flex-shrink-0 min-h-0">
            <div className="flex border-b border-gray-700 flex-shrink-0">
              {tabBtn('props', 'Props')}
              {tabBtn('layers', 'Layers')}
              {tabBtn('assets', 'Assets')}
              {tabBtn('chain', 'Chain')}
              {tabBtn('checks', 'Checks', errors)}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {tab === 'props' && <PropertiesPanel />}
              {tab === 'layers' && <LayersPanel />}
              {tab === 'assets' && <AssetsPanel />}
              {tab === 'chain' && <ChainPanel />}
              {tab === 'checks' && <ChecksPanel />}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

export default function Studio() {
  const hydrated = useStudioStore((s) => s.hydrated);
  const screen = useStudioStore((s) => s.screen);
  if (!hydrated) return <div className="h-full flex items-center justify-center text-gray-400">Loading…</div>;
  return screen === 'projects' ? <ProjectsView /> : <Editor />;
}
