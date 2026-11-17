#!/usr/bin/env node
/**
 * split-project.mjs — Split an exported escape-studio bundle into a small
 * project.json (images removed) plus one assets JSON file.
 *
 * Usage: node scripts/split-project.mjs <exported.json> [outDir=public/play]
 *
 * Writes:
 *   - <outDir>/assets.<hash>.json  compact JSON.stringify of bundle.assets
 *                                  (hash = first 10 hex of SHA-1 of its bytes)
 *   - <outDir>/project.json        bundle with assets: [] and a top-level
 *                                  meta { assetsFile: "/play/assets.<hash>.json", assetsBytes }
 * Older assets.*.json files in <outDir> are deleted first.
 * Prints the original size, the project.json size and the assets file size.
 *
 * Node ESM, no dependencies (only node built-ins).
 */

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';

const [inputPath, outDir = 'public/play'] = process.argv.slice(2);

if (!inputPath) {
  console.error('Usage: node scripts/split-project.mjs <exported.json> [outDir=public/play]');
  process.exit(1);
}

const raw = await readFile(inputPath, 'utf8');
const originalSize = Buffer.byteLength(raw, 'utf8');

let bundle;
try {
  bundle = JSON.parse(raw);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`Invalid JSON in ${inputPath}: ${msg}`);
  process.exit(1);
}

const assets = Array.isArray(bundle?.assets) ? bundle.assets : [];
const assetsJson = JSON.stringify(assets); // compact
const assetsBytes = Buffer.byteLength(assetsJson, 'utf8');
const hash = createHash('sha1').update(assetsJson, 'utf8').digest('hex').slice(0, 10);
const assetsFileName = `assets.${hash}.json`;

await mkdir(outDir, { recursive: true });

// Remove stale assets from previous runs (keep project.json intact).
for (const name of await readdir(outDir)) {
  if (/^assets\..+\.json$/.test(name)) {
    await unlink(join(outDir, name));
  }
}

const assetsPath = join(outDir, assetsFileName);
await writeFile(assetsPath, assetsJson, 'utf8');

const projectBundle = {
  ...bundle,
  assets: [],
  meta: { assetsFile: `/play/${assetsFileName}`, assetsBytes },
};
const projectJson = JSON.stringify(projectBundle); // compact
const projectBytes = Buffer.byteLength(projectJson, 'utf8');
await writeFile(join(outDir, 'project.json'), projectJson, 'utf8');

console.log(`split-project: original ${originalSize} bytes`);
console.log(`split-project: project.json ${projectBytes} bytes`);
console.log(`split-project: assets.${hash}.json ${assetsBytes} bytes`);
console.log(`split-project: wrote ${join(outDir, 'project.json')} and ${assetsPath}`);
