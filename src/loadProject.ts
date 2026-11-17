/**
 * loadProject.ts — Load a play-only project bundle split across two files.
 *
 * Fetches `/play/project.json` (no cache), which contains the bundle with
 * `assets: []` and a `meta` pointer to the assets file, then streams the
 * assets file (reporting byte progress via `onProgress`), merges them back
 * together and returns the full bundle as JSON text — ready for `importBundle`.
 */

export interface ProjectMeta {
  assetsFile: string;
  assetsBytes: number;
}

type ProjectBundle = {
  meta?: ProjectMeta;
  assets?: unknown;
  [key: string]: unknown;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Returns the full bundle JSON text (assets merged in, `meta` stripped).
 * Throws an Error with a Persian message on network / schema problems.
 */
export async function loadProject(onProgress?: (p: number) => void): Promise<string> {
  const projectRes = await fetch('/play/project.json', { cache: 'no-cache' });
  if (!projectRes.ok) {
    throw new Error(`خطا در بارگذاری پروژه (کد ${projectRes.status})`);
  }

  let bundle: ProjectBundle;
  try {
    bundle = (await projectRes.json()) as ProjectBundle;
  } catch {
    throw new Error('پاسخ سرور معتبر نیست (JSON نامعتبر است).');
  }

  if (
    !bundle ||
    !bundle.meta ||
    typeof bundle.meta.assetsFile !== 'string' ||
    typeof bundle.meta.assetsBytes !== 'number'
  ) {
    throw new Error('اطلاعات فایل asset در متای پروژه موجود نیست.');
  }

  const { assetsFile, assetsBytes } = bundle.meta!;
  const total = assetsBytes > 0 ? assetsBytes : 1;

  let assets: unknown;
  const assetsRes = await fetch(assetsFile);
  if (!assetsRes.ok) {
    throw new Error(`خطا در بارگذاری فایل asset (کد ${assetsRes.status})`);
  }

  const body = assetsRes.body;
  if (body === null) {
    // Fallback for environments without a readable stream body.
    assets = await assetsRes.json();
    onProgress?.(1);
  } else {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.byteLength;
        onProgress?.(clamp01(received / total));
      }
    }
    const all = new Uint8Array(received);
    let offset = 0;
    for (const ch of chunks) {
      all.set(ch, offset);
      offset += ch.byteLength;
    }
    const text = new TextDecoder().decode(all);
    assets = JSON.parse(text);
  }

  bundle.assets = assets;
  delete bundle.meta;
  return JSON.stringify(bundle);
}
