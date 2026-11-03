import React, { useRef } from 'react';
import { useProjectAssets, useScene, useStudioStore } from '../stores/store';
import { assetRef } from '../shared/types';
import { fileToImage } from '../shared/utils';
import { btnCls, btnDanger, btnPrimary, Field, inputCls, ListInput, NumInput, Section } from './ui';

const st = () => useStudioStore.getState();

/** Real pixel size of an image (stored asset sizes can be placeholders). */
function measure(url: string): Promise<{ w: number; h: number } | null> {
  return new Promise((res) => {
    const i = new Image();
    i.onload = () => res({ w: i.naturalWidth || 0, h: i.naturalHeight || 0 });
    i.onerror = () => res(null);
    i.src = url;
  });
}

/** Dedicated tab for building and configuring an object's Interactive View (close-up). */
export function ViewTab() {
  const scene = useScene();
  const viewOf = useStudioStore((s) => s.editingViewOf);
  const selected = useStudioStore((s) => s.selectedObjectIds);
  const sprites = useStudioStore((s) => s.sprites);
  const assets = useProjectAssets();
  const file = useRef<HTMLInputElement>(null);

  if (!scene) return null;
  const parent = scene.objects.find((o) => o.id === (viewOf ?? selected[0]));
  if (!parent) {
    return (
      <div className="p-4 text-xs text-gray-400">
        یک شیء را در اتاق انتخاب کنید تا نمای تعاملی‌اش را بسازید یا ویرایش کنید.
      </div>
    );
  }

  const v = parent.view;
  if (!v) {
    return (
      <div className="p-3 space-y-2 text-xs text-gray-300">
        <p>«{parent.name}» نمای تعاملی ندارد.</p>
        <button
          className={`${btnPrimary} w-full`}
          onClick={() => {
            st().addView(parent.id);
            st().enterView(parent.id);
          }}
        >
          ＋ ساخت Interactive View
        </button>
      </div>
    );
  }

  const upd = (p: Partial<typeof v>, k: string) => st().updateView(parent.id, p, `view-${k}`);
  const bgAsset = v.backgroundUrl.startsWith('sprite:') ? sprites[v.backgroundUrl.slice(7)]?.assetId ?? '' : v.backgroundUrl;
  const bgId = bgAsset.startsWith('asset:') ? bgAsset.slice(6) : '';
  const editing = viewOf === parent.id;

  const useAsBg = async (id: string) => {
    const a = assets.find((x) => x.id === id);
    if (!a) return;
    const m = await measure(a.url);
    upd({ backgroundUrl: st().useAssetSprite(assetRef(a.id), a.name), width: m?.w || a.width, height: m?.h || a.height }, 'bg');
  };

  return (
    <div className="p-3 space-y-2 text-xs">
      <div className="flex gap-1">
        {editing ? (
          <button className={`${btnCls} flex-1`} onClick={() => st().exitView()}>← بازگشت به اتاق</button>
        ) : (
          <button className={`${btnPrimary} flex-1`} onClick={() => st().enterView(parent.id)}>✎ ویرایش محتوای view</button>
        )}
        <button
          className={btnDanger}
          onClick={() => confirm('این view و همه‌چیز داخلش حذف شود؟') && st().removeView(parent.id)}
        >
          حذف
        </button>
      </div>

      <Section title={`View — ${parent.name}`}>
        <Field label="Title" stack>
          <input className={inputCls} dir="rtl" lang="fa" value={v.title} onChange={(e) => upd({ title: e.target.value }, 'title')} />
        </Field>
        <Field label="Message when closed" stack>
          <input className={inputCls} dir="rtl" lang="fa" value={v.closeMessage ?? ''} onChange={(e) => upd({ closeMessage: e.target.value || undefined }, 'close')} />
        </Field>
        <Field label="Items required to open" stack>
          <ListInput value={v.requiresItem} onChange={(x) => upd({ requiresItem: x }, 'req')} placeholder="key-gold" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width" stack><NumInput value={v.width} min={50} onChange={(n) => upd({ width: Math.max(50, Math.round(n)) }, 'w')} /></Field>
          <Field label="Height" stack><NumInput value={v.height} min={50} onChange={(n) => upd({ height: Math.max(50, Math.round(n)) }, 'h')} /></Field>
        </div>
        <Field label="Background" stack>
          <div className="flex gap-1">
            <select className={`${inputCls} flex-1`} value={bgId} onChange={(e) => void useAsBg(e.target.value)}>
              <option value="">{v.backgroundUrl ? '(current)' : 'Pick from assets…'}</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button className={btnCls} onClick={() => file.current?.click()}>Upload</button>
          </div>
          <input
            ref={file}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                const img = await fileToImage(f);
                const a = st().addAsset(img);
                upd({ backgroundUrl: st().useAssetSprite(assetRef(a.id), a.name), width: img.width, height: img.height }, 'bg');
              } catch (err) {
                alert((err as Error).message);
              }
            }}
          />
        </Field>
      </Section>

      <Section title={`Objects inside (${v.objects.length})`}>
        {!editing && <p className="text-[11px] text-gray-500">برای افزودن یا انتخاب اشیای داخل view، اول «ویرایش محتوا» را بزنید.</p>}
        {editing && (
          <button className={`${btnCls} w-full`} onClick={() => st().addObject()}>＋ Sprite داخل view</button>
        )}
        {v.objects.map((o) => (
          <button
            key={o.id}
            disabled={!editing}
            className={`w-full text-left px-2 py-1 rounded ${selected.includes(o.id) ? 'bg-primary/40' : 'hover:bg-white/5'}`}
            onClick={() => st().selectObject(o.id)}
          >
            {o.name}
          </button>
        ))}
      </Section>
    </div>
  );
}
