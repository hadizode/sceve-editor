import { useStudioStore, type AlignMode } from '../stores/store';
import type { SceneObject } from '../shared/types';

const st = () => useStudioStore.getState();

export type BottomTab = 'assets' | 'chain' | 'checks';

/** UI actions the editor shell provides to commands (everything else is read from the store lazily). */
export interface Host {
  exportJson: () => void;
  setCenter: (t: 'scene' | 'game') => void;
  openBottom: (t: BottomTab) => void;
  toggleBottom: () => void;
  resetLayout: () => void;
}

export interface Cmd {
  id: string;
  group: string;
  label: string;
  shortcut?: string;
  run: () => void;
  isDisabled?: () => boolean;
}

const sel = () => st().selectedObjectIds;
const patchSel = (p: Partial<SceneObject>) => st().updateObjects(Object.fromEntries(sel().map((i) => [i, p])));
const sceneCount = () => st().projects.find((p) => p.id === st().currentProjectId)?.scenes.length ?? 0;

/** Single source of truth for menu items AND the command palette. */
export function buildCommands(h: Host): Record<string, Cmd> {
  const out: Record<string, Cmd> = {};
  const c = (id: string, group: string, label: string, run: () => void, extra: Partial<Cmd> = {}) => {
    out[id] = { id, group, label, run, ...extra };
  };
  const needSel = (n = 1) => () => sel().length < n;

  // File
  c('file.projects', 'File', 'Close project (back to Projects)', () => st().closeProject());
  c('file.export', 'File', 'Export project as JSON…', h.exportJson);

  // Edit
  c('edit.undo', 'Edit', 'Undo', () => st().undo(), { shortcut: 'Ctrl+Z', isDisabled: () => st().past.length === 0 });
  c('edit.redo', 'Edit', 'Redo', () => st().redo(), { shortcut: 'Ctrl+Y', isDisabled: () => st().future.length === 0 });
  c('edit.copy', 'Edit', 'Copy', () => st().copySelected(), { shortcut: 'Ctrl+C', isDisabled: needSel() });
  c('edit.paste', 'Edit', 'Paste', () => st().paste(), { shortcut: 'Ctrl+V', isDisabled: () => st().clipboard.length === 0 });
  c('edit.duplicate', 'Edit', 'Duplicate', () => st().duplicateSelected(), { shortcut: 'Ctrl+D', isDisabled: needSel() });
  c('edit.selectAll', 'Edit', 'Select all', () => st().selectAll(), { shortcut: 'Ctrl+A' });
  c('edit.delete', 'Edit', 'Delete selected', () => st().deleteObjects(sel()), { shortcut: 'Del', isDisabled: needSel() });

  // Object
  c('obj.add', 'Object', 'Add sprite', () => st().addObject());
  c('obj.front', 'Object', 'Bring to front', () => st().orderObjects(sel(), 'top'), { isDisabled: needSel() });
  c('obj.forward', 'Object', 'Bring forward', () => st().orderObjects(sel(), 'up'), { isDisabled: needSel() });
  c('obj.backward', 'Object', 'Send backward', () => st().orderObjects(sel(), 'down'), { isDisabled: needSel() });
  c('obj.back', 'Object', 'Send to back', () => st().orderObjects(sel(), 'bottom'), { isDisabled: needSel() });
  const align = (id: string, mode: AlignMode, label: string, min = 2) =>
    c(id, 'Object', label, () => st().alignObjects(mode), { isDisabled: needSel(min) });
  align('align.left', 'left', 'Align left');
  align('align.hcenter', 'hcenter', 'Align horizontal center');
  align('align.right', 'right', 'Align right');
  align('align.top', 'top', 'Align top');
  align('align.vmiddle', 'vmiddle', 'Align vertical middle');
  align('align.bottom', 'bottom', 'Align bottom');
  align('align.hdist', 'hdist', 'Distribute horizontally', 3);
  align('align.vdist', 'vdist', 'Distribute vertically', 3);
  c('obj.lock', 'Object', 'Lock selected', () => patchSel({ locked: true }), { isDisabled: needSel() });
  c('obj.unlock', 'Object', 'Unlock selected', () => patchSel({ locked: false }), { isDisabled: needSel() });
  c('obj.show', 'Object', 'Show selected', () => patchSel({ visible: true }), { isDisabled: needSel() });
  c('obj.hide', 'Object', 'Hide selected', () => patchSel({ visible: false }), { isDisabled: needSel() });

  // Room
  c('room.add', 'Room', 'Add room', () => st().addScene());
  c('room.duplicate', 'Room', 'Duplicate room', () => {
    const id = st().currentSceneId;
    if (id) st().duplicateScene(id);
  });
  c('room.up', 'Room', 'Move room up', () => {
    const id = st().currentSceneId;
    if (id) st().moveScene(id, -1);
  });
  c('room.down', 'Room', 'Move room down', () => {
    const id = st().currentSceneId;
    if (id) st().moveScene(id, 1);
  });
  c(
    'room.delete',
    'Room',
    'Delete room…',
    () => {
      const s = st();
      const id = s.currentSceneId;
      if (id && confirm(`Delete room "${s.scenes[id]?.title ?? ''}"?`)) s.deleteScene(id);
    },
    { isDisabled: () => sceneCount() <= 1 }
  );

  // View
  c('view.scene', 'View', 'Show Scene view', () => h.setCenter('scene'));
  c('view.game', 'View', 'Play (Game view)', () => h.setCenter('game'));
  c('view.grid', 'View', 'Toggle grid', () => st().toggleGrid());
  c('view.snap', 'View', 'Toggle snap to grid', () => st().toggleSnap());
  c('view.labels', 'View', 'Toggle labels', () => st().toggleLabels());
  c('view.assets', 'View', 'Open Assets panel', () => h.openBottom('assets'));
  c('view.chain', 'View', 'Open Clue Chain panel', () => h.openBottom('chain'));
  c('view.checks', 'View', 'Open Checks panel', () => h.openBottom('checks'));
  c('view.bottom', 'View', 'Show / hide bottom panel', h.toggleBottom);
  c('view.reset', 'View', 'Reset layout', h.resetLayout);

  return out;
}

export const MENUS: { label: string; items: string[] }[] = [
  { label: 'File', items: ['file.projects', 'file.export'] },
  { label: 'Edit', items: ['edit.undo', 'edit.redo', '-', 'edit.copy', 'edit.paste', 'edit.duplicate', '-', 'edit.selectAll', 'edit.delete'] },
  {
    label: 'Object',
    items: [
      'obj.add', '-',
      'obj.front', 'obj.forward', 'obj.backward', 'obj.back', '-',
      'align.left', 'align.hcenter', 'align.right', 'align.top', 'align.vmiddle', 'align.bottom', 'align.hdist', 'align.vdist', '-',
      'obj.lock', 'obj.unlock', 'obj.show', 'obj.hide',
    ],
  },
  { label: 'Room', items: ['room.add', 'room.duplicate', '-', 'room.up', 'room.down', '-', 'room.delete'] },
  {
    label: 'View',
    items: ['view.scene', 'view.game', '-', 'view.grid', 'view.snap', 'view.labels', '-', 'view.assets', 'view.chain', 'view.checks', 'view.bottom', '-', 'view.reset'],
  },
];
