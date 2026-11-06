export const uid = (prefix = 'id') =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export const nowIso = () => new Date().toISOString();

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** NOTE: the `data:` prefix is required, otherwise the browser treats it as a relative path. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function placeholderSvg(text: string, color: string, w = 100, h = 100, emoji = ''): string {
  return svgDataUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color}"/><stop offset="100%" style="stop-color:${color}88"/>
      </linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#g)" rx="12"/>
      <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.min(w, h) * 0.35}">${emoji}</text>
      <text x="50%" y="78%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${Math.max(8, Math.min(w, h) * 0.12)}" font-family="Vazirmatn">${esc(text)}</text>
    </svg>`
  );
}

export interface LoadedImage {
  url: string;
  width: number;
  height: number;
  name: string;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error ?? new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not read image'));
    i.src = src;
  });
}

/** Reads an image file, downscales big images (keeps alpha) so the project stays small. */
export async function fileToImage(file: File, maxSide = 1600): Promise<LoadedImage> {
  const name = file.name.replace(/\.[^.]+$/, '') || 'image';
  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth || 300;
  const h = img.naturalHeight || 300;
  if (file.type === 'image/svg+xml') return { url: dataUrl, width: w, height: h, name };

  const scale = Math.min(1, maxSide / Math.max(w, h));
  if (scale === 1 && file.size < 400_000) return { url: dataUrl, width: w, height: h, name };

  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  canvas.getContext('2d')!.drawImage(img, 0, 0, cw, ch);
  return { url: canvas.toDataURL('image/webp', 0.88), width: cw, height: ch, name };
}
