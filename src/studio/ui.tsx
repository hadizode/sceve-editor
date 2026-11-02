import React from 'react';
import { useStudioStore } from '../stores/store';
import type { Asset, Scene, View } from '../shared/types';

// ============ Shared class strings (Unity-flat look) ============
export const inputCls =
  'w-full bg-surface-light border border-black/60 rounded-[3px] px-2 py-1 text-xs text-gray-200 ' +
  'focus:outline-none focus:border-primary';

export const btnCls =
  'bg-surface-lighter hover:bg-surface-hover text-gray-200 text-xs px-2 py-1 rounded-[3px] ' +
  'border border-black/40 leading-tight whitespace-nowrap';

export const checker = {
  backgroundColor: '#2b2b2b',
  backgroundImage:
    'linear-gradient(45deg, #3a3a3a 25%, transparent 25%, transparent 75%, #3a3a3a 75%),' +
    'linear-gradient(45deg, #3a3a3a 25%, transparent 25%, transparent 75%, #3a3a3a 75%)',
  backgroundSize: '12px 12px',
  backgroundPosition: '0 0, 6px 6px',
};

// ============ Layout primitives ============
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-2 border-b border-line last:border-b-0">
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[11px] text-gray-400">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <Hint>{hint}</Hint>}
    </label>
  );
}

export function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-gray-500 mt-1 leading-snug">{children}</p>;
}

// ============ Number inputs ============
export function NumInput({
  label, value, min = -Infinity, max = Infinity, step = 1, onChange,
}: {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 flex-1">
      {label && <span className="text-[10px] text-gray-500 w-4 shrink-0">{label}</span>}
      <input
        type="number"
        className={inputCls + ' flex-1'}
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </div>
  );
}

/** A number input with a coloured axis badge (X/Y/W/H), Unity-style. Drag on the badge to scrub. */
export function AxisNum({
  label, color, value, min = -Infinity, max = Infinity, step = 1, onChange,
}: {
  label: string;
  color: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  const drag = React.useRef<{ x: number; v: number } | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex items-center flex-1 min-w-0">
      <span
        className="select-none cursor-ew-resize text-[10px] font-bold px-1.5 py-1 rounded-l-[3px] text-black shrink-0"
        style={{ background: color }}
        title={`${label} — drag to scrub`}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, v: value };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          onChange(clamp(Math.round(drag.current.v + (e.clientX - drag.current.x) * step)));
        }}
        onPointerUp={() => { drag.current = null; }}
      >
        {label}
      </span>
      <input
        type="number"
        dir="ltr"
        className="flex-1 w-full min-w-0 bg-surface-light border border-l-0 border-black/60 rounded-r-[3px] px-1 py-1 text-xs text-gray-200 focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
      />
    </div>
  );
}

// ============ File picking ============
export async function pickImages(e: React.ChangeEvent<HTMLInputElement>): Promise<HTMLImageElement[]> {
  const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
  const imgs = await Promise.all(
    files.map(
      (f) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const url = URL.createObjectURL(f);
          const img = new Image();
          img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
          img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
          img.src = url;
        }),
    ),
  );
  e.target.value = '';
  return imgs;
}

// ============ Editor context helpers ============
type EditorTarget = { kind: 'scene'; id: string } | { kind: 'view'; sceneId: string; viewId: string };

function getTarget(s: ReturnType<typeof useStudioStore.getState>): EditorTarget | null {
  const { selectedObjectIds, scenes, currentSceneId } = s;
  for (const oid of selectedObjectIds) {
    for (const sc of Object.values(scenes)) {
      const view = sc.objects.find((o) => o.id === oid)?.view;
      if (view) return { kind: 'view', sceneId: sc.id, viewId: view.id };
    }
  }
  return currentSceneId ? { kind: 'scene', id: currentSceneId } : null;
}

/** The Scene or View currently being edited in the inspector. */
export function useCtx(): (Scene | View) | null {
  const target = useStudioStore(getTarget);
  const scene = useStudioStore((s) => (target && target.kind === 'scene' ? s.scenes[target.id] : null));
  if (!target) return null;
  if (target.kind === 'scene') return scene;
  const sc = useStudioStore.getState().scenes[target.sceneId];
  return sc?.objects.find((o) => o.view?.id === target.viewId)?.view ?? null;
}

/** Patch the current Scene or View in place (undoable). */
export function updateCtx(patch: Partial<Scene & View>, undoLabel?: string): void {
  const s = useStudioStore.getState();
  const target = getTarget(s);
  if (!target) return;
  if (target.kind === 'scene') {
    const cur = s.scenes[target.id];
    if (cur) s.updateScene({ ...cur, ...patch });
  } else {
    const sc = s.scenes[target.sceneId];
    const obj = sc?.objects.find((o) => o.view?.id === target.viewId);
    if (sc && obj?.view) {
      s.updateObject(obj.id, { view: { ...obj.view, ...patch } });
    }
  }
  void undoLabel;
}

/** Background setter that works on either the room or the open view. */
export function setBackground(url: string, width?: number, height?: number): void {
  const patch: Record<string, unknown> = { backgroundUrl: url };
  if (width != null) patch.width = width;
  if (height != null) patch.height = height;
  updateCtx(patch as Partial<Scene & View>);
}

/** Undoable scene metadata patch, e.g. st().updateScene({ title }, 'title'). */
export function updateSceneMeta(patch: Partial<Scene>, undoLabel?: string): void {
  const s = useStudioStore.getState();
  const id = s.currentSceneId;
  const cur = id ? s.scenes[id] : null;
  if (cur) s.updateScene({ ...cur, ...patch });
  void undoLabel;
}

/** The store handle used by panels: `const st = () => useStudioStore.getState()`. */
export const st = () => useStudioStore.getState();

/** Add an uploaded image to the project asset library and return the stored Asset. */
export function addAssetFromImage(img: HTMLImageElement): Asset {
  const s = useStudioStore.getState();
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const cctx = canvas.getContext('2d')!;
  cctx.drawImage(img, 0, 0);
  const url = canvas.toDataURL('image/png');
  const asset: Asset = {
    id: `asset-${Date.now()}-${Math.floor(Math.random() * 1e4)}`,
    name: `Image ${Object.keys(s.assets).length + 1}`,
    url,
    tags: [],
    createdAt: new Date().toISOString(),
  };
  s.addAsset(asset);
  return asset;
}

export function useProjectAssets(): Asset[] {
  return useStudioStore((s) => Object.values(s.assets));
}

/** Reference to a stored asset, e.g. "asset:abc123". */
export const assetRef = (id: string) => `asset:${id}`;

/** Apply an asset as the background of the current room/view (stretches the target to the image size). */
export async function applyBackground(a: Asset): Promise<void> {
  const img = new Image();
  await new Promise<void>((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = a.url;
  });
  const w = img.naturalWidth || img.width || 800;
  const h = img.naturalHeight || img.height || 600;
  setBackground(assetRef(a.id), w, h);
}
