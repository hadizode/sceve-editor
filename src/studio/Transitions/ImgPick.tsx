import React, { useRef } from 'react';
import { useProjectAssets, useSprites } from '../../stores/store';
import { assetRef, blankSprite, spriteRef, transformRef } from '../../shared/types';
import { useResolved } from '../konva-bits';
import { fileToImage } from '../../shared/utils';
import { st } from './helpers';
import { btnCls, inputCls } from '../ui';
import { IconButton } from '../icons';

/** Picks an image (or a colour-only / invisible sprite). Stores FULL `sprite:` refs. */
export function ImgPick({ value, onChange }: { value?: string; onChange: (ref: string | undefined) => void }) {
  const assets = useProjectAssets();
  const sprites = useSprites();
  const file = useRef<HTMLInputElement>(null);
  const ref = value ? transformRef(value) : '';
  const current = ref ? sprites[ref.slice(7)] : undefined;
  const isBlank = !!current && !current.assetId;
  const selectValue = !value ? '' : current ? current.assetId || '__blank__' : value;
  const src = useResolved(ref);
  return (
    <div className="space-y-1">
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
            const a = st().addAsset(await fileToImage(f));
            onChange(st().useAssetSprite(assetRef(a.id), a.name));
          } catch (err) {
            alert((err as Error).message);
          }
        }}
      />
      <div className="flex gap-1 items-center">
        <IconButton icon="upload" solid title="Upload image" onClick={() => file.current?.click()} />
        <select
          className={`${inputCls} flex-1`}
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '') onChange(undefined);
            else if (v === '__blank__') onChange(spriteRef(st().addSprite(blankSprite('Blank')).id));
            else if (v.startsWith('asset:')) onChange(st().useAssetSprite(v));
            else onChange(v);
          }}
        >
          <option value="">— unchanged —</option>
          <option value="__blank__">■ Colour only / invisible</option>
          {assets.map((a) => <option key={a.id} value={assetRef(a.id)}>{a.name}</option>)}
        </select>
        {src ? (
          <img src={src} alt="" className="w-8 h-8 rounded object-contain bg-black/30 shrink-0" />
        ) : isBlank && current?.color ? (
          <span className="w-8 h-8 rounded shrink-0 border border-line" style={{ background: current.color }} />
        ) : null}
      </div>
      {isBlank && current && (
        <label className="flex items-center gap-2 text-[11px] text-gray-400">
          Fill colour
          <input
            type="color"
            value={current.color || '#000000'}
            onChange={(e) => st().updateSprite(current.id, { color: e.target.value })}
          />
          <button className={btnCls} onClick={() => st().updateSprite(current.id, { color: undefined })}>
            Invisible
          </button>
        </label>
      )}
    </div>
  );
}
