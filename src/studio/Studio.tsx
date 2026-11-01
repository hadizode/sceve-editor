import React, { useEffect, useState } from 'react';
import { useCtx, useCurrentProject, useStudioStore } from '../stores/store';
import Canvas from './Canvas';
import Preview from './Preview';
import ProjectsView from './ProjectsView';
import { PropertiesPanel } from './Properties';
import { TransitionsTab } from './Transitions';
import { AssetsPanel, BackgroundPanel, ChainPanel, ChecksPanel, LayersPanel, RoomProps, RoomsPanel, useIssues } from './Panels';
import { btnCls, btnPrimary, Group, IconBtn, isTyping, NumInput } from './ui';

type Tab = 'props' | 'transitions' | 'layers' | 'assets' | 'chain' | 'checks';
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

  const tabBtn = (t: Tab, label: string, badge?: number) => (
    <button
      key={t}
      role="tab"
      aria-selected={tab === t}
      title={label}
      className={`relative flex-1 px-1 py-2.5 text-xs border-b-2 ${tab === t ? 'border-primary text-white bg-surface-light/50' : 'border-transparent text-gray-400 hover:text-white hover:bg-surface-light/30'}`}
      onClick={() => setTab(t)}
    >
      {label}
      {!!badge && <span className="ml-1 bg-danger text-white rounded-full px-1.5 text-[10px]">{badge}</span>}
    </button>
  );

  return (
    // dir="ltr": the page body is RTL, which would otherwise mirror the sidebar order and borders.
    // Persian text fields set their own dir="rtl".
    <div dir="ltr" className="h-full flex flex-col bg-gray-900 text-white">
      {/* Toolbar */}
      <div className="bg-surface border-b border-line px-3 py-2 flex items-center gap-2 flex-wrap flex-shrink-0">
        <button className={btnCls} onClick={() => st().closeProject()}>← Projects</button>
        <input
          className="bg-transparent border border-transparent hover:border-gray-600 focus:border-primary rounded-lg px-2 py-1 text-indigo-300 font-semibold text-sm outline-none w-56"
          value={project.name}
          aria-label="Project name"
          onChange={(e) => st().updateProject({ name: e.target.value })}
        />
        <div className="flex-1" />

        <Group>
          <IconBtn title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={() => st().undo()}>↶</IconBtn>
          <IconBtn title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!canRedo} onClick={() => st().redo()}>↷</IconBtn>
        </Group>

        <Group>
          <IconBtn active={showGrid} onClick={() => st().toggleGrid()}>Grid</IconBtn>
          <div className="w-14 px-0.5"><NumInput value={gridSize} min={5} onChange={(n) => st().setGridSize(n)} /></div>
          <IconBtn active={snap} onClick={() => st().toggleSnap()}>Snap</IconBtn>
          <IconBtn active={labels} onClick={() => st().toggleLabels()}>Labels</IconBtn>
        </Group>

        <button className={btnCls} onClick={exportJson}>Export JSON</button>
        <button className={preview ? 'inline-flex items-center gap-1 bg-accent hover:bg-amber-500 text-black px-3 py-1.5 rounded-lg text-xs font-semibold' : btnPrimary} onClick={() => setPreview((p) => !p)}>
          {preview ? '✏️ Edit' : '▶ Preview'}
        </button>
      </div>

      {preview ? (
        <Preview />
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Left: tools */}
          <aside className="w-52 bg-surface border-r border-line overflow-y-auto flex-shrink-0">
            <div className="p-3 border-b border-line">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">{ctx?.view ? 'Add to view' : 'Add sprite'}</h3>
              {/* One unified sprite — it can be anything (image, color, invisible hotspot, pickup, transform…) */}
              <button className={`${btnPrimary} w-full py-2`} onClick={() => st().addObject()}>
                🧩 ＋ Add sprite
              </button>
              <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed" dir="rtl">
                هر اسپرایت می‌تواند هر چیزی باشد: تصویر، رنگ خالص، نامرئی تا پس از ترنسفورم، قابل برداشتن، قفل‌دار و…
              </p>
            </div>
            {!ctx?.view && <RoomsPanel />}
            {!ctx?.view && <RoomProps />}
            <BackgroundPanel />
            <div className="p-3 text-xs text-gray-400 space-y-0.5">
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
          <aside className="w-72 bg-surface border-l border-line flex flex-col flex-shrink-0 min-h-0">
            <div role="tablist" className="flex border-b border-line flex-shrink-0">
              {tabBtn('props', 'Props')}
              {tabBtn('transitions', '🔄 Transitions')}
              {tabBtn('layers', 'Layers')}
              {tabBtn('assets', 'Assets')}
              {tabBtn('chain', 'Chain')}
              {tabBtn('checks', 'Checks', errors)}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0" role="tabpanel">
              {tab === 'props' && <PropertiesPanel />}
              {tab === 'transitions' && <TransitionsTab />}
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
  if (!hydrated) return <div className="h-full flex items-center justify-center text-gray-400">در حال بارگذاری…</div>;
  return screen === 'projects' ? <ProjectsView /> : <Editor />;
}
