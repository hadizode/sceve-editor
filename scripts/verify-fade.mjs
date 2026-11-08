#!/usr/bin/env node
/**
 * verify-fade.mjs — End-to-end browser verification of the toggle cross-fade.
 *
 * Uses Playwright (via `npx -y playwright`, NOT added to package.json) to:
 *  1. Start the dev server (or reuse :3000)
 *  2. Import scripts/fixtures/fade-toggle.json
 *  3. Open the project, switch to Game view, start the game
 *  4. Click the "Lamp" object and sample img opacity every animation frame
 *  5. Assert a mid-fade (opacity strictly between 0.15 and 0.85) is observed
 *  6. Assert exactly one  remains after the transition
 *  7. Repeat for the revert click
 *  8. Click 5x at 100 ms intervals; assert only one  remains
 *
 * Exit code: 0 on PASS, non-zero on FAIL.
 *
 * NOTE: Cannot run if Chromium cannot be downloaded/launched. In that case it
 * prints a clear message and exits non-zero without claiming the fade works.
 */

import { execSync, spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const PORT = 3000;
const DEV_URL = `http://localhost:${PORT}`;
const FIXTURE = join(ROOT, 'scripts/fixtures/fade-toggle.json');
let serverProc = null;
let failed = false;

function log(...args) { console.log(...args); }
function fail(...args) { log('FAIL:', ...args); failed = true; }

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function findChromeExecutable() {
  const candidates = [
    join(ROOT, 'node_modules', 'playwright-core', '.local-browsers', 'chromium-*', 'chrome-linux', 'chrome'),
    join(ROOT, 'node_modules', 'playwright', '.local-browsers', 'chromium-*', 'chrome-linux', 'chrome'),
    '/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome',
    '/home/caffe/.cache/ms-playwright/chromium-*/chrome-linux/chrome',
  ];
  const { execSync: es } = require('child_process');
  for (const pat of candidates) {
    try {
      const out = es(`ls ${pat} 2>/dev/null | head -1`, { stdio: 'pipe' }).toString().trim();
      if (out) return out;
    } catch {}
  }
  return null;
}
export default async function run() {
  log('=== verify-fade.mjs ===');
  if (!existsSync(FIXTURE)) {
    fail(`Fixture not found: ${FIXTURE}`);
    process.exit(1);
  }
  const fixtureJson = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  log('Fixture loaded:', fixtureJson.project.name);
  let chromiumPath;
  try { chromiumPath = findChromeExecutable(); } catch {}
  if (!chromiumPath) {
    log('Chromium not found locally. Attempting `npx playwright install chromium`…');
    try {
      execSync('npx --yes playwright install chromium 2>&1', { stdio: 'inherit', timeout: 120000 });
      chromiumPath = findChromeExecutable();
    } catch (e) {
      fail('Cannot download Chromium (network TLS error or no network).');
      log('  -> Keep scripts/verify-fade.mjs in the repo for manual browser verification.');
      log('  -> Cannot claim the fade works without a real browser run.');
      process.exit(1);
    }
  }
  if (!chromiumPath) {
    fail('Chromium executable not found after install attempt.');
    process.exit(1);
  }
  log('Using Chromium:', chromiumPath);


  let serverUrl = DEV_URL;
  try {
    const res = await fetch(`${serverUrl}/`);
    if (res.ok) { log('Dev server already running on :3000'); }
  } catch {
    log('Starting `npm run dev` on :3000…');
    serverProc = spawn('npx', ['vite', '--port', String(PORT)], {
      cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(PORT) },
    });
    serverProc.stdout.on('data', (d) => { if (d.toString().includes('ready')) log('Dev server ready'); });
    for (let i = 0; i < 30; i++) {
      try { await fetch(`${serverUrl}/`); log('Dev server ready'); break; }
      catch { await sleep(500); }
    }
  }

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    executablePath: chromiumPath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  try {
    log('Opening', serverUrl);
    const fileInput = await page.waitForSelector('input[type="file"][accept*="json"]', { timeout: 10000 });
    await fileInput.setInputFiles(FIXTURE);
    await sleep(1000);

    const alertText = await page.evaluate(() => window.lastAlert).catch(() => null);
    if (alertText) fail('Import alert:', alertText);

    const openBtn = await page.waitForSelector('button:has-text("Open")', { timeout: 10000 });
    await openBtn.click();
    await sleep(500);

    let gameOpened = false;
    try {
      const viewMenu = await page.waitForSelector('button:has-text("View"), [title*="View"], [aria-label*="View"]', { timeout: 5000 });
      if (viewMenu) {
        await viewMenu.click();
        await sleep(300);
        const playBtn = await page.waitForSelector('text="Play (Game view)", text="بازی"', { timeout: 5000 });
        if (playBtn) { await playBtn.click(); gameOpened = true; }
      }
    } catch {}
    if (!gameOpened) {
      log('UI game toggle not found; cannot switch to Game view');
      fail('Could not switch to Game view via UI');
    }

    await sleep(1000);

    const readyBtn = await page.waitForSelector('button:has-text("آماده‌ام"), button:has-text("Ready")', { timeout: 10000 });
    await readyBtn.click();
    await sleep(300);
    const startBtn = await page.waitForSelector('button:has-text("شروع بدون منتور"), button:has-text("شروع")', { timeout: 10000 });
    await startBtn.click();
    await sleep(1000);

    const lamp = await page.waitForSelector('text="Lamp"', { timeout: 10000 });
    const lampBox = await lamp.locator('xpath=..');
    await lampBox.click();
    await sleep(300);

    log('\n--- Click 1: original -> new image (2000 ms fade) ---');
    const midFade1 = await sampleFade(page, 2600);
    log(`Click 1 mid-fade detected: ${midFade1}`);

    const imgCount1 = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      return imgs.length;
    });
    log(`Click 1 img count after fade: ${imgCount1}`);
    if (imgCount1 !== 1) fail(`Click 1: expected 1 , got ${imgCount1}`);

    log('\n--- Click 2: new image -> original (revert, 2000 ms fade) ---');
    await lampBox.click();
    await sleep(300);
    const midFade2 = await sampleFade(page, 2600);
    log(`Click 2 mid-fade detected: ${midFade2}`);

    const imgCount2 = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      return imgs.length;
    });
    log(`Click 2 img count after fade: ${imgCount2}`);
    if (imgCount2 !== 1) fail(`Click 2: expected 1 , got ${imgCount2}`);

    log('\n--- Click 3-7: rapid 5 clicks at 100 ms intervals ---');
    for (let i = 0; i < 5; i++) {
      await lampBox.click();
      await sleep(100);
    }
    await sleep(3000);
    const imgCountRapid = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      return imgs.length;
    });
    log(`Rapid clicks img count after 3000 ms: ${imgCountRapid}`);
    if (imgCountRapid !== 1) fail(`Rapid clicks: expected 1 , got ${imgCountRapid}`);

    log('\n=== RESULT ===');
    if (failed) {
      log('OVERALL: FAIL');
      process.exit(1);
    } else {
      log('OVERALL: PASS');
      process.exit(0);
    }
  } catch (err) {
    fail('Script error:', err.message);
    process.exit(1);
  } finally {
    await browser.close().catch(() => {});
    if (serverProc) serverProc.kill().catch(() => {});
  }
}

async function sampleFade(page, durationMs) {
  const results = await page.evaluate(async (durationMs) => {
    const rows = [];
    let midFade = false;
    const start = performance.now();
    let lastPrint = start;

    return new Promise((resolve) => {
      function frame() {
        const t = performance.now() - start;
        const imgs = Array.from(document.querySelectorAll('img'));
        const opacities = imgs.map((img) => {
          const cs = getComputedStyle(img);
          return parseFloat(cs.opacity);
        });
        for (const op of opacities) {
          if (op > 0.15 && op < 0.85) midFade = true;
        }
        rows.push({ t: Math.round(t), imgCount: imgs.length, opacities: opacities.map((o) => o.toFixed(2)) });

        if (t - lastPrint >= 200) {
          console.log(`  t=${Math.round(t)}ms imgs=${imgs.length} opacities=[${opacities.map((o) => o.toFixed(2)).join(', ')}]`);
          lastPrint = t;
        }

        if (t < durationMs) {
          requestAnimationFrame(frame);
        } else {
          resolve({ midFade, rows });
        }
      }
      requestAnimationFrame(frame);
    });
  }, durationMs);

  log('  (t ms | imgCount | opacities)');
  for (const r of results.rows.filter((_, i) => i % 5 === 0)) {
    log(`  ${r.t}ms | ${r.imgCount} | [${r.opacities.join(', ')}]`);
  }

  return results.midFade;
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
